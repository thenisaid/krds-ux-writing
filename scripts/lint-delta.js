#!/usr/bin/env node
'use strict';

/**
 * scripts/lint-delta.js
 *
 * krds-lint.yml PR 게이트의 판정 로직: "이 PR 이 새로 만든 오류" 만 센다.
 *
 * 파일 하나에 대해 base 의 린트 JSON 과 PR 의 린트 JSON 을 받아
 * 오류를 (category, match) 키의 다중집합으로 비교한다.
 *   - 줄 번호는 편집으로 밀리므로 키에 넣지 않는다.
 *   - PR 쪽 개수가 base 쪽 개수를 넘는 키마다 초과분이 새 오류다.
 *   - 한 키에서 줄고 다른 키에서 늘면 늘어난 만큼만 센다(상쇄 없음).
 *   - 비교 불가(파싱 실패·절단·린터 비정상 종료·결과 불일치)는 통과가 아니라 FAIL.
 *
 * CLI (워크플로에서 호출):
 *   node scripts/lint-delta.js --pr <pr.json> --pr-exit <n> \
 *        (--base <base.json> --base-exit <n> | --new-file) \
 *        [--file <표시용 경로>] [--md-out <파일>]
 *   stdout 한 줄: STATUS|신규|기존|경고|점수|사유   (사유에 '|' 가 올 수 있어 마지막)
 *   종료 코드: 판정 완료 0 (FAIL 여부는 STATUS 로 판단), 인자 오류 2.
 *   린트 JSON 은 파이프가 아니라 파일로 받는다(큰 출력이 파이프에서 절단되는 문제).
 */

const fs = require('fs');

const ISSUE_LIMIT = 15;

function issueKey(issue) {
  return String(issue.category) + '\u0000' + String(issue.match);
}

/**
 * 린트 JSON 텍스트 하나를 검증하며 파싱한다. 실패하면 { ok:false, reason }.
 * @param {string|null|undefined} text
 * @param {number|null|undefined} exitCode 린터 종료 코드 (undefined/null 이면 종료 코드 검증 생략)
 */
function parseLintResult(text, exitCode) {
  let r;
  try {
    r = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: '린트 결과(JSON) 파싱 실패 또는 출력 절단 — ' + e.name + ': ' + String(e.message).slice(0, 80) };
  }
  const s = r && r.summary;
  if (!s || !Number.isInteger(s.errors) || !Number.isInteger(s.warnings) || !Array.isArray(r.issues)) {
    return { ok: false, reason: '린트 결과에 summary/issues 가 없거나 형식이 다릅니다' };
  }
  const errorIssues = r.issues.filter(function (i) { return i && i.severity === 'error'; });
  if (errorIssues.length !== s.errors) {
    return { ok: false, reason: '린트 결과 불일치 — summary 오류 ' + s.errors + '건, issues 오류 ' + errorIssues.length + '건' };
  }
  if (typeof exitCode === 'number') {
    if (exitCode > 1) return { ok: false, reason: '린터 비정상 종료 (exit ' + exitCode + ')' };
    if (exitCode === 1 && s.errors === 0) return { ok: false, reason: '린터 exit 1 이지만 오류 0건으로 보고됨 (결과 불일치)' };
    if (exitCode === 0 && s.errors > 0) return { ok: false, reason: '린터 exit 0 이지만 오류 ' + s.errors + '건으로 보고됨 (결과 불일치)' };
  }
  return {
    ok: true,
    errorIssues: errorIssues,
    warnings: s.warnings,
    score: r.score !== undefined ? r.score : 100,
  };
}

function failResult(reason) {
  return { status: 'FAIL', reason: reason, newErrors: 1, existingErrors: 0, fixedErrors: 0, errors: 1, warnings: 0, score: 0, newIssues: [] };
}

/**
 * 오류 이슈 배열 두 개를 (category, match) 다중집합으로 비교한다.
 * @returns {{ newIssues: object[], newErrors: number, existingErrors: number, fixedErrors: number }}
 */
function diffErrors(baseErrors, prErrors) {
  const baseCount = new Map();
  baseErrors.forEach(function (i) {
    const k = issueKey(i);
    baseCount.set(k, (baseCount.get(k) || 0) + 1);
  });

  const prByKey = new Map();
  prErrors.forEach(function (i) {
    const k = issueKey(i);
    if (!prByKey.has(k)) prByKey.set(k, []);
    prByKey.get(k).push(i);
  });

  let newIssues = [];
  let fixedErrors = 0;
  prByKey.forEach(function (list, k) {
    const excess = list.length - (baseCount.get(k) || 0);
    if (excess > 0) newIssues = newIssues.concat(list.slice(list.length - excess));
  });
  baseCount.forEach(function (n, k) {
    const prN = prByKey.has(k) ? prByKey.get(k).length : 0;
    if (n > prN) fixedErrors += n - prN;
  });

  newIssues.sort(function (a, b) { return (a.line || 0) - (b.line || 0) || (a.col || 0) - (b.col || 0); });
  return {
    newIssues: newIssues,
    newErrors: newIssues.length,
    existingErrors: prErrors.length - newIssues.length,
    fixedErrors: fixedErrors,
  };
}

/**
 * 파일 하나의 판정.
 * @param {object} p
 * @param {string} p.prText     PR 쪽 린트 JSON 텍스트
 * @param {number} [p.prExit]   PR 쪽 린터 종료 코드
 * @param {string|null} [p.baseText]  base 쪽 린트 JSON 텍스트 (isNewFile 이면 무시)
 * @param {number} [p.baseExit]
 * @param {boolean} [p.isNewFile]     base 에 파일이 없음 → base 오류 0 으로 간주
 * @returns {{status:'OK'|'FAIL', reason:string, newErrors:number, existingErrors:number,
 *            fixedErrors:number, errors:number, warnings:number, score:number, newIssues:object[]}}
 */
function evaluate(p) {
  const pr = parseLintResult(p.prText, p.prExit);
  if (!pr.ok) return failResult('PR 쪽 ' + pr.reason);

  let baseErrors = [];
  if (!p.isNewFile) {
    const base = parseLintResult(p.baseText, p.baseExit);
    if (!base.ok) return failResult('base 쪽 비교 불가 — ' + base.reason);
    baseErrors = base.errorIssues;
  }

  const d = diffErrors(baseErrors, pr.errorIssues);
  return {
    status: 'OK',
    reason: '',
    newErrors: d.newErrors,
    existingErrors: d.existingErrors,
    fixedErrors: d.fixedErrors,
    errors: pr.errorIssues.length,
    warnings: pr.warnings,
    score: pr.score,
    newIssues: d.newIssues,
  };
}

function sanitizeInline(s) {
  return String(s == null ? '' : s).replace(/[`\r\n|]/g, ' ').trim();
}

/** 새 오류만 보여 주는 PR 코멘트용 상세 블록. 신규 0건·FAIL 아님이면 빈 문자열. */
function formatDetail(file, result) {
  if (result.status === 'FAIL') {
    return '### `' + sanitizeInline(file) + '`\n> ❌ ' + sanitizeInline(result.reason) + '\n\n';
  }
  if (result.newErrors === 0) return '';
  const lines = ['### `' + sanitizeInline(file) + '` — 신규 오류 ' + result.newErrors + '건 (기존 ' + result.existingErrors + '건)'];
  result.newIssues.slice(0, ISSUE_LIMIT).forEach(function (i) {
    lines.push('❌ [' + (i.line || '-') + '줄] [' + sanitizeInline(i.category) + '] `' + sanitizeInline(i.match) + '` ' + sanitizeInline(i.suggestion));
  });
  if (result.newIssues.length > ISSUE_LIMIT) lines.push('... 외 ' + (result.newIssues.length - ISSUE_LIMIT) + '건 더');
  return lines.join('\n') + '\n\n';
}

function formatLine(result) {
  return [result.status, result.newErrors, result.existingErrors, result.warnings, result.score, sanitizeInline(result.reason)].join('|');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { newFile: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--new-file') out.newFile = true;
    else if (['--pr', '--pr-exit', '--base', '--base-exit', '--file', '--md-out'].indexOf(a) !== -1) {
      if (i + 1 >= argv.length) return null;
      out[a.slice(2).replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = argv[++i];
    } else return null;
  }
  return out;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function toExit(v) {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isInteger(n) ? n : undefined;
}

function main(argv) {
  const a = parseArgs(argv);
  if (!a || !a.pr || (!a.newFile && !a.base)) {
    process.stderr.write('사용법: lint-delta.js --pr <json> --pr-exit <n> (--base <json> --base-exit <n> | --new-file) [--file <경로>] [--md-out <파일>]\n');
    return 2;
  }
  const prText = readIfExists(a.pr);
  const result = prText === null
    ? failResult('PR 쪽 린트 결과 파일을 읽지 못했습니다')
    : evaluate({
      prText: prText,
      prExit: toExit(a.prExit),
      isNewFile: a.newFile,
      baseText: a.newFile ? null : readIfExists(a.base),
      baseExit: toExit(a.baseExit),
    });
  if (a.mdOut) {
    const md = formatDetail(a.file || a.pr, result);
    if (md) fs.appendFileSync(a.mdOut, md);
  }
  process.stdout.write(formatLine(result) + '\n');
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { parseLintResult, diffErrors, evaluate, formatDetail, formatLine, issueKey, main };
