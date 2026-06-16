import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const JSON_DICT = JSON.parse(fs.readFileSync(path.join(ROOT, 'jargon-dictionary.json'), 'utf8'));
const BROWSER_DICT_SOURCE = fs.readFileSync(path.join(ROOT, 'jargon-dictionary.js'), 'utf8');
const LINT_SOURCE = fs.readFileSync(path.join(ROOT, 'krds-lint.js'), 'utf8');

function loadBrowserLint() {
  const context = {
    console,
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(BROWSER_DICT_SOURCE, context);
  vm.runInNewContext(LINT_SOURCE, context);

  return context;
}

describe('browser jargon dictionary integration', () => {
  it('keeps jargon-dictionary.js aligned with jargon-dictionary.json', () => {
    const context = loadBrowserLint();

    expect(context.KRDS_JARGON_DICT.entries).toEqual(JSON_DICT.entries);
  });

  it('detects extracted dictionary entries in the browser runtime, not only the inline fallback set', () => {
    const context = loadBrowserLint();
    const issue = context.KRDSLint.lint('유부녀').issues.find((entry) => entry.match === '유부녀');

    expect(issue).toBeDefined();
    expect(issue.category).toBe('전문 용어');
    expect(issue.suggestion).toContain('기혼 여성');
  });

  it('loads jargon-dictionary.js before krds-lint.js on pages that call KRDSLint directly', () => {
    ['lint.html', 'before-after.html'].forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const dictIndex = html.indexOf('jargon-dictionary.js');
      const lintIndex = html.indexOf('krds-lint.js');

      expect(dictIndex, `${relPath}: missing jargon-dictionary.js`).toBeGreaterThanOrEqual(0);
      expect(lintIndex, `${relPath}: missing krds-lint.js`).toBeGreaterThanOrEqual(0);
      expect(dictIndex, `${relPath}: jargon-dictionary.js must load before krds-lint.js`).toBeLessThan(lintIndex);
    });
  });
});
