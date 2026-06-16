import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function collectLocalCss(html, htmlPath) {
  const htmlDir = path.dirname(path.join(ROOT, htmlPath));
  const hrefs = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g)].map((match) => match[1]);

  return hrefs.flatMap((href) => {
    if (/^https?:/i.test(href) || href.startsWith('data:')) return [];
    const cssPath = path.resolve(htmlDir, href);
    if (!fs.existsSync(cssPath)) return [];
    return [fs.readFileSync(cssPath, 'utf8')];
  });
}

function findMissingCssVars(htmlPath) {
  const html = read(htmlPath);
  const combined = [html, ...collectLocalCss(html, htmlPath)].join('\n');
  const defined = new Set([...combined.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)].map((match) => `--${match[1]}`));
  const usedWithoutFallback = [...combined.matchAll(/var\((--[a-zA-Z0-9_-]+)\s*\)/g)].map((match) => match[1]);

  return [...new Set(usedWithoutFallback.filter((token) => !defined.has(token)))].sort();
}

describe('HTML token contracts', () => {
  it('does not reference undefined CSS custom properties without a fallback', () => {
    const htmlFiles = walkHtmlFiles(ROOT, {
      ignoredDirs: ['.claude', '.context', '.playwright-mcp', 'node_modules', 'research'],
    });

    const failures = htmlFiles
      .map((htmlPath) => ({ htmlPath, missing: findMissingCssVars(htmlPath) }))
      .filter((entry) => entry.missing.length > 0)
      .map((entry) => `${entry.htmlPath}: ${entry.missing.join(', ')}`);

    expect(failures).toEqual([]);
  });
});
