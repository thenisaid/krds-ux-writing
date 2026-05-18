/**
 * krds-lint.js unit tests
 * Framework: vitest
 * Run: npm test
 */
import { describe, it, expect } from 'vitest';
import KRDSLint from '../krds-lint.js';

// ── ADMIN JARGON ─────────────────────────────────────────────────────────────

describe('lint() — admin jargon detection', () => {
  it('detects banned jargon "귀하" and returns error severity', () => {
    const result = KRDSLint.lint('귀하의 신청이 접수되었습니다.');
    const issue = result.issues.find(i => i.match === '귀하');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.type).toBe('admin-jargon');
  });

  it('detects "명일까지 제출" and suggests "내일까지 제출"', () => {
    // jargon-dictionary.json stores the full phrase "명일까지 제출"
    const result = KRDSLint.lint('명일까지 제출해 주세요.');
    const issue = result.issues.find(i => i.match === '명일까지 제출');
    expect(issue).toBeDefined();
    expect(issue.suggestion).toContain('내일까지');
  });

  it('does not report false positive on clean text', () => {
    const result = KRDSLint.lint('내일까지 서류를 제출해 주세요.');
    expect(result.issues.filter(i => i.type === 'admin-jargon')).toHaveLength(0);
  });

  it('detects "죄송합니다" in error messages', () => {
    const result = KRDSLint.lint('죄송합니다. 오류가 발생했습니다.');
    const issue = result.issues.find(i => i.match === '죄송합니다');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });

  it('skips jargon check when checkAdminJargon: false', () => {
    const result = KRDSLint.lint('귀하의 신청이 접수되었습니다.', { checkAdminJargon: false });
    expect(result.issues.filter(i => i.type === 'admin-jargon')).toHaveLength(0);
  });

  it('deduplicates repeated jargon at same position', () => {
    // same banned term twice shouldn't produce duplicate issues at same line:col
    const result = KRDSLint.lint('귀하 귀하');
    const issues = result.issues.filter(i => i.match === '귀하');
    // Should find 2 (different columns), not duplicated
    const cols = issues.map(i => i.col);
    const uniqueCols = [...new Set(cols)];
    expect(uniqueCols).toHaveLength(cols.length);
  });
});

// ── PATTERN RULES ─────────────────────────────────────────────────────────────

describe('lint() — pattern rule detection', () => {
  it('detects "오류가 발생했습니다." as standalone-error-retry warning', () => {
    const result = KRDSLint.lint('오류가 발생했습니다.');
    const issue = result.issues.find(i => i.type === 'standalone-error-retry');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
  });

  it('detects "다시 시도해 주세요." as standalone-error-retry', () => {
    const result = KRDSLint.lint('다시 시도해 주세요.');
    const issue = result.issues.find(i => i.type === 'standalone-error-retry');
    expect(issue).toBeDefined();
  });

  it('detects "ERROR 404" as error-code-standalone error', () => {
    const result = KRDSLint.lint('ERROR 404가 발생했습니다.');
    const issue = result.issues.find(i => i.type === 'error-code-standalone');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });

  it('detects "※" as forbidden-char-note warning', () => {
    const result = KRDSLint.lint('※ 주의사항을 확인하세요.');
    const issue = result.issues.find(i => i.type === 'forbidden-char-note');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
  });

  it('skips pattern check when checkPatterns: false', () => {
    const result = KRDSLint.lint('오류가 발생했습니다.', { checkPatterns: false });
    expect(result.issues.filter(i => i.type === 'standalone-error-retry')).toHaveLength(0);
  });
});

// ── SCORE ─────────────────────────────────────────────────────────────────────

describe('computeScore() via lint()', () => {
  it('returns 100 for clean text with no issues', () => {
    const result = KRDSLint.lint('내일까지 서류를 제출해 주세요. 감사합니다.');
    expect(result.score).toBe(100);
  });

  it('returns score < 100 when issues are present', () => {
    const result = KRDSLint.lint('귀하의 신청서가 오류가 발생했습니다. 다시 시도해 주세요.');
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for score floor — never negative', () => {
    // Many issues on a single short word → should not go below 0
    const result = KRDSLint.lint('귀하');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('empty text returns score 100 with no issues', () => {
    const result = KRDSLint.lint('');
    expect(result.score).toBe(100);
    expect(result.summary.total).toBe(0);
  });
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────

describe('lint() summary counts', () => {
  it('counts errors, warnings, infos separately', () => {
    // Error: 귀하 (admin-jargon)
    // Warning: ※ (forbidden-char-note)
    const result = KRDSLint.lint('귀하의 신청 ※ 주의사항');
    expect(result.summary.errors).toBeGreaterThanOrEqual(1);
    expect(result.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(result.summary.total).toBe(result.summary.errors + result.summary.warnings + result.summary.infos);
  });

  it('issues are sorted by line then col', () => {
    const result = KRDSLint.lint('귀하\n명일까지');
    const lines = result.issues.map(i => i.line);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]);
    }
  });
});

// ── MULTILINE ────────────────────────────────────────────────────────────────

describe('lint() multiline input', () => {
  it('correctly identifies line numbers for multiline text', () => {
    const text = '안녕하세요.\n귀하의 신청이 접수되었습니다.\n감사합니다.';
    const result = KRDSLint.lint(text);
    const issue = result.issues.find(i => i.match === '귀하');
    expect(issue).toBeDefined();
    expect(issue.line).toBe(2);
  });

  it('handles text with only whitespace as no-issue', () => {
    const result = KRDSLint.lint('   \n  \n  ');
    expect(result.summary.total).toBe(0);
  });
});

// ── PUBLIC API SHAPE ─────────────────────────────────────────────────────────

describe('KRDSLint public API', () => {
  it('exposes lint, formatCLI, ADMIN_JARGON, PATTERN_RULES, version', () => {
    expect(typeof KRDSLint.lint).toBe('function');
    expect(typeof KRDSLint.formatCLI).toBe('function');
    expect(Array.isArray(KRDSLint.ADMIN_JARGON)).toBe(true);
    expect(Array.isArray(KRDSLint.PATTERN_RULES)).toBe(true);
    expect(KRDSLint.version).toBe('1.0.0');
  });

  it('ADMIN_JARGON has at least 30 entries', () => {
    expect(KRDSLint.ADMIN_JARGON.length).toBeGreaterThanOrEqual(30);
  });

  it('each ADMIN_JARGON entry has banned, alt, cat fields', () => {
    KRDSLint.ADMIN_JARGON.forEach(entry => {
      expect(entry).toHaveProperty('banned');
      expect(entry).toHaveProperty('alt');
      expect(entry).toHaveProperty('cat');
    });
  });

  it('formatCLI returns a string with score information', () => {
    const result = KRDSLint.lint('귀하의 신청');
    const formatted = KRDSLint.formatCLI(result);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('품질 점수');
  });
});
