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

describe('browser custom KRDS_JARGON_DICT injection', () => {
  it('silently skips null and malformed entries in the custom jargon dictionary', () => {
    const context = {
      KRDS_JARGON_DICT: {
        entries: [
          null,
          { banned: '', alt: '대안', cat: '테스트' },
          { banned: '귀하', alt: '고객님', cat: '행정어' },
        ],
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(LINT_SOURCE, context);
    const result = context.KRDSLint.lint('귀하의 신청');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].match).toBe('귀하');
  });

  it('matches date-range placeholder patterns when a jargon entry contains a 기간 bracket', () => {
    const context = {
      KRDS_JARGON_DICT: {
        entries: [{ banned: '처리 기간: [기간]', alt: '언제 처리됩니다', cat: '날짜테스트' }],
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(LINT_SOURCE, context);
    const result = context.KRDSLint.lint('처리 기간: 30일');
    expect(result.issues.some((i) => i.category === '날짜테스트')).toBe(true);
  });

  it('matches name placeholder patterns when a jargon entry contains an 이름 bracket', () => {
    const context = {
      KRDS_JARGON_DICT: {
        entries: [{ banned: '신청인: [이름]', alt: '신청인 이름을 적어 주세요', cat: '이름테스트' }],
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(LINT_SOURCE, context);
    const result = context.KRDSLint.lint('신청인: 홍길동');
    expect(result.issues.some((i) => i.category === '이름테스트')).toBe(true);
  });

  it('uses the default wildcard placeholder for unrecognised bracket labels like 코드', () => {
    const context = {
      KRDS_JARGON_DICT: {
        entries: [{ banned: '오류 코드: [코드]', alt: '오류 상황을 설명해 주세요', cat: '코드테스트' }],
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(LINT_SOURCE, context);
    const result = context.KRDSLint.lint('오류 코드: 404');
    expect(result.issues.some((i) => i.category === '코드테스트')).toBe(true);
  });
});

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
