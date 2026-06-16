import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const THEME_INIT_FILES = [
  'archive.html',
  'before-after.html',
  'case-studies/index.html',
  'dictionary/index.html',
  'index-v2.html',
  'index.html',
  'principles/index.html',
  'principles/components/index.html',
  'principles/core-info/index.html',
  'principles/derivative/index.html',
  'principles/foundation/index.html',
  'principles/governance/index.html',
  'principles/no-translation/index.html',
  'principles/notation/index.html',
  'principles/safety-net/index.html',
  'principles/structure/index.html',
  'prompt-library.html',
];

const HASHED_INLINE_SCRIPT_FILES = [
  'archive.html',
  'index.html',
  'prompt-library.html',
];

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function getInlineScripts(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

function getCspContent(html) {
  const metaMatch = html.match(/<meta[\s\S]*?Content-Security-Policy[\s\S]*?content="([^"]+)"/i);
  return metaMatch ? metaMatch[1] : '';
}

describe('HTML inline script safety', () => {
  it('wraps theme bootstrap storage access in try/catch', () => {
    THEME_INIT_FILES.forEach((relPath) => {
      const html = readFile(relPath);
      const firstScript = getInlineScripts(html)[0] || '';

      expect(firstScript, relPath).toContain("localStorage.getItem('krds-theme')");
      expect(firstScript, relPath).toContain('try{');
      expect(firstScript, relPath).toContain("typeof window.matchMedia==='function'");
      expect(firstScript, relPath).toContain('document.documentElement.setAttribute');
    });
  });

  it('keeps CSP hashes aligned with current inline scripts', () => {
    HASHED_INLINE_SCRIPT_FILES.forEach((relPath) => {
      const html = readFile(relPath);
      const csp = getCspContent(html);
      const inlineScripts = getInlineScripts(html);

      expect(csp, relPath).toContain('script-src');
      inlineScripts.forEach((content) => {
        const hash = crypto.createHash('sha256').update(content).digest('base64');
        expect(csp, `${relPath} missing ${hash}`).toContain(`'sha256-${hash}'`);
      });
    });
  });

  it('keeps prompt-library copy fallback in place for clipboard failures', () => {
    const html = readFile('prompt-library.html');
    const promptCopyScript = readFile('shared/prompt-copy.js');

    expect(html).toContain('shared/prompt-copy.js');
    expect(promptCopyScript).toContain('function copyWithFallback');
    expect(promptCopyScript).toContain("document.execCommand('copy')");
    expect(promptCopyScript).toContain('.catch(function () {');
  });
});
