import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

function getIds(html) {
  return new Set([...html.matchAll(/\sid=(['"])(.*?)\1/g)].map((match) => match[2]));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('skip-link coverage', () => {
  it('provides a working skip link on every page with shared gnb chrome', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      if (!/<header\b[^>]*class="[^"]*\bgnb\b[^"]*"/.test(html)) return;

      const skipTagMatch = html.match(/<a\b[^>]*class="[^"]*\bskip-(?:link|nav)\b[^"]*"[^>]*>/i);
      expect(skipTagMatch, relPath).not.toBeNull();

      const skipMatch = skipTagMatch[0].match(/\bhref="#([^"]+)"/i);
      expect(skipMatch, relPath).not.toBeNull();

      const ids = getIds(html);
      expect(ids.has(skipMatch[1]), `${relPath}: #${skipMatch[1]}`).toBe(true);

      const mainTargetRe = new RegExp(`<main\\b[^>]*\\bid=(['"])${escapeRegExp(skipMatch[1])}\\1[^>]*>`, 'i');
      expect(mainTargetRe.test(html), `${relPath}: #${skipMatch[1]}`).toBe(true);
    });
  });
});
