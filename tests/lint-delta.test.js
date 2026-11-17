import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const delta = require('../scripts/lint-delta.js');

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts', 'lint-delta.js');
const tempRoots = [];

function err(category, match, line = 1, col = 1) {
  return { type: 'admin-jargon', severity: 'error', category, line, col, match, message: 'm', suggestion: '→ 대체' };
}
function warn(category, match, line = 1) {
  return { type: 'pattern', severity: 'warning', category, line, col: 1, match, message: 'm', suggestion: '→ 대체' };
}
function lintJson(issues) {
  return JSON.stringify({
    issues,
    summary: {
      total: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: 0,
    },
    score: 80,
  });
}
function exitFor(issues) {
  return issues.some((i) => i.severity === 'error') ? 1 : 0;
}
function run(baseIssues, prIssues, extra = {}) {
  return delta.evaluate({
    baseText: lintJson(baseIssues),
    baseExit: exitFor(baseIssues),
    prText: lintJson(prIssues),
    prExit: exitFor(prIssues),
    ...extra,
  });
}

afterEach(() => {
  while (tempRoots.length > 0) fs.rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('lint-delta evaluate — 새 오류 판정', () => {
  it('새 파일(base 없음)은 base 오류 0 으로 간주해 오류 전부가 신규다', () => {
    const r = delta.evaluate({
      isNewFile: true,
      prText: lintJson([err('A', '귀하'), err('B', '금일')]),
      prExit: 1,
    });
    expect(r.status).toBe('OK');
    expect(r.newErrors).toBe(2);
    expect(r.existingErrors).toBe(0);
  });

  it('새 파일이어도 오류가 없으면 신규 0건으로 통과한다', () => {
    const r = delta.evaluate({ isNewFile: true, prText: lintJson([]), prExit: 0 });
    expect(r.status).toBe('OK');
    expect(r.newErrors).toBe(0);
  });

  it('기존 오류만 있고 변화가 없으면 신규 0건, 기존 N건이다', () => {
    const issues = [err('A', '귀하'), err('B', '금일'), err('B', '금일')];
    const r = run(issues, issues);
    expect(r.status).toBe('OK');
    expect(r.newErrors).toBe(0);
    expect(r.existingErrors).toBe(3);
    expect(r.errors).toBe(3);
  });

  it('새 오류 1건이 추가되면 신규 1건이고 상세에 그 오류가 담긴다', () => {
    const base = [err('A', '귀하')];
    const pr = [err('A', '귀하'), err('C', '상기', 7, 3)];
    const r = run(base, pr);
    expect(r.newErrors).toBe(1);
    expect(r.existingErrors).toBe(1);
    expect(r.newIssues).toHaveLength(1);
    expect(r.newIssues[0].match).toBe('상기');
    expect(r.newIssues[0].line).toBe(7);
  });

  it('한 키에서 줄고 다른 키에서 늘면 상쇄하지 않고 늘어난 만큼만 센다', () => {
    const base = [err('A', '귀하'), err('A', '귀하'), err('A', '귀하')];
    const pr = [err('A', '귀하'), err('B', '금일'), err('B', '금일')];
    const r = run(base, pr);
    expect(r.newErrors).toBe(2);
    expect(r.existingErrors).toBe(1);
    expect(r.fixedErrors).toBe(2);
    expect(r.newIssues.every((i) => i.category === 'B')).toBe(true);
  });

  it('줄 번호만 밀린 경우(편집으로 위치 이동)는 신규 0건이다', () => {
    const base = [err('A', '귀하', 10, 2), err('B', '금일', 20, 5)];
    const pr = [err('A', '귀하', 14, 2), err('B', '금일', 31, 9)];
    const r = run(base, pr);
    expect(r.newErrors).toBe(0);
    expect(r.existingErrors).toBe(2);
  });

  it('동일 키가 base 3개 → PR 4개이면 신규 1건이다', () => {
    const k = (line) => err('A', '귀하', line);
    const r = run([k(1), k(2), k(3)], [k(1), k(2), k(3), k(4)]);
    expect(r.newErrors).toBe(1);
    expect(r.existingErrors).toBe(3);
  });

  it('동일 키가 base 3개 → PR 2개이면 신규 0건이고 해소 1건이다', () => {
    const k = (line) => err('A', '귀하', line);
    const r = run([k(1), k(2), k(3)], [k(1), k(2)]);
    expect(r.newErrors).toBe(0);
    expect(r.fixedErrors).toBe(1);
  });

  it('같은 match 라도 category 가 다르면 다른 키다', () => {
    const r = run([err('A', '귀하')], [err('A', '귀하'), err('B', '귀하')]);
    expect(r.newErrors).toBe(1);
    expect(r.newIssues[0].category).toBe('B');
  });

  it('경고는 신규 판정에 쓰지 않고 경고 수만 PR 값으로 보고한다', () => {
    const r = run([], [warn('W', '먼저')]);
    expect(r.status).toBe('OK');
    expect(r.newErrors).toBe(0);
    expect(r.warnings).toBe(1);
  });
});

describe('lint-delta evaluate — fail-closed', () => {
  it('base 쪽 JSON 파싱 실패면 base 0 으로 취급하지 않고 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: '{"issues": [', baseExit: 1, prText: lintJson([]), prExit: 0 });
    expect(r.status).toBe('FAIL');
    expect(r.newErrors).toBeGreaterThanOrEqual(1);
    expect(r.reason).toContain('base');
  });

  it('base 결과가 없으면(null) FAIL 이다', () => {
    const r = delta.evaluate({ baseText: null, prText: lintJson([]), prExit: 0 });
    expect(r.status).toBe('FAIL');
  });

  it('base 린터가 비정상 종료(exit 2 이상)면 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 2, prText: lintJson([]), prExit: 0 });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toContain('base');
  });

  it('PR 쪽 JSON 파싱 실패(절단)면 FAIL 이다', () => {
    const full = lintJson([err('A', '귀하')]);
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: full.slice(0, full.length - 20), prExit: 1 });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toContain('PR');
  });

  it('PR 쪽 summary 누락이면 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: '{"issues":[]}', prExit: 0 });
    expect(r.status).toBe('FAIL');
  });

  it('PR 린터가 비정상 종료(exit 2 이상)면 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: lintJson([]), prExit: 137 });
    expect(r.status).toBe('FAIL');
  });

  it('PR 린터 exit 1 인데 오류 0건이면 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: lintJson([]), prExit: 1 });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toContain('불일치');
  });

  it('PR 린터 exit 0 인데 오류가 있으면 FAIL 이다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: lintJson([err('A', '귀하')]), prExit: 0 });
    expect(r.status).toBe('FAIL');
  });

  it('summary.errors 와 issues 의 오류 수가 다르면 FAIL 이다', () => {
    const bad = JSON.stringify({ issues: [err('A', '귀하')], summary: { total: 1, errors: 0, warnings: 0, infos: 0 } });
    const r = delta.evaluate({ baseText: lintJson([]), baseExit: 0, prText: bad, prExit: 0 });
    expect(r.status).toBe('FAIL');
  });

  it('새 파일 경로에서도 PR 쪽 파싱 실패는 FAIL 이다', () => {
    const r = delta.evaluate({ isNewFile: true, prText: 'not json', prExit: 1 });
    expect(r.status).toBe('FAIL');
  });

  it('종료 코드가 주어지지 않으면 종료 코드 검증만 생략한다', () => {
    const r = delta.evaluate({ baseText: lintJson([]), prText: lintJson([err('A', '귀하')]) });
    expect(r.status).toBe('OK');
    expect(r.newErrors).toBe(1);
  });
});

describe('lint-delta 보고 포맷', () => {
  it('신규 0건이면 코멘트 상세가 비어 있다', () => {
    const r = run([err('A', '귀하')], [err('A', '귀하')]);
    expect(delta.formatDetail('a.md', r)).toBe('');
  });

  it('신규 오류만 상세에 나오고 기존 오류는 나오지 않는다', () => {
    const r = run([err('A', '귀하')], [err('A', '귀하'), err('C', '상기')]);
    const md = delta.formatDetail('docs/a.md', r);
    expect(md).toContain('상기');
    expect(md).not.toContain('귀하');
    expect(md).toContain('신규 오류 1건 (기존 1건)');
  });

  it('상세는 15건까지만 나오고 나머지는 건수로 줄인다', () => {
    const pr = Array.from({ length: 18 }, (_, i) => err('A', 'x' + i, i + 1));
    const md = delta.formatDetail('a.md', run([], pr));
    expect(md).toContain('... 외 3건 더');
  });

  it('FAIL 은 사유를 보여 준다', () => {
    const r = delta.evaluate({ baseText: 'x', prText: lintJson([]), prExit: 0 });
    expect(delta.formatDetail('a.md', r)).toContain('base 쪽 비교 불가');
  });

  it('match 의 백틱·파이프·개행은 코멘트 마크다운을 깨지 않게 치환된다', () => {
    const r = run([], [err('A', 'a`b|c\nd')]);
    const md = delta.formatDetail('a.md', r);
    expect(md).toContain('`a b c d`');
  });

  it('formatLine 은 STATUS|신규|기존|경고|점수|사유 한 줄이다', () => {
    const r = run([err('A', '귀하')], [err('A', '귀하'), err('C', '상기')]);
    expect(delta.formatLine(r)).toBe('OK|1|1|0|80|');
    const f = delta.evaluate({ baseText: 'x', prText: lintJson([]), prExit: 0 });
    expect(delta.formatLine(f).startsWith('FAIL|1|0|0|0|base 쪽 비교 불가')).toBe(true);
  });
});

describe('lint-delta CLI', () => {
  function tmp() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krds-lint-delta-'));
    tempRoots.push(dir);
    return dir;
  }
  function cli(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  }

  it('base/PR JSON 파일을 비교해 한 줄을 출력하고 md-out 에 새 오류만 덧붙인다', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'base.json'), lintJson([err('A', '귀하')]));
    fs.writeFileSync(path.join(dir, 'pr.json'), lintJson([err('A', '귀하'), err('C', '상기')]));
    const md = path.join(dir, 'detail.md');
    const r = cli(['--pr', path.join(dir, 'pr.json'), '--pr-exit', '1', '--base', path.join(dir, 'base.json'), '--base-exit', '1', '--file', 'x.md', '--md-out', md]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('OK|1|1|0|80|');
    expect(fs.readFileSync(md, 'utf8')).toContain('상기');
  });

  it('--new-file 이면 base 없이 오류 전부를 신규로 센다', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'pr.json'), lintJson([err('A', '귀하'), err('B', '금일')]));
    const r = cli(['--pr', path.join(dir, 'pr.json'), '--pr-exit', '1', '--new-file']);
    expect(r.stdout.trim()).toBe('OK|2|0|0|80|');
  });

  it('base 결과 파일이 없으면 FAIL 한 줄을 출력한다', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'pr.json'), lintJson([]));
    const r = cli(['--pr', path.join(dir, 'pr.json'), '--pr-exit', '0', '--base', path.join(dir, 'missing.json'), '--base-exit', '0']);
    expect(r.status).toBe(0);
    expect(r.stdout.startsWith('FAIL|')).toBe(true);
  });

  it('PR 결과 파일이 없으면 FAIL 한 줄을 출력한다', () => {
    const dir = tmp();
    const r = cli(['--pr', path.join(dir, 'missing.json'), '--pr-exit', '0', '--new-file']);
    expect(r.stdout.startsWith('FAIL|')).toBe(true);
  });

  it('필수 인자가 없거나 알 수 없는 옵션이면 종료 코드 2 이다', () => {
    expect(cli([]).status).toBe(2);
    expect(cli(['--pr']).status).toBe(2);
    expect(cli(['--bogus']).status).toBe(2);
  });
});
