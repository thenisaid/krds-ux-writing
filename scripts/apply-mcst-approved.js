#!/usr/bin/env node
'use strict';

/**
 * scripts/apply-mcst-approved.js — 사람이 체크한 MCST 후보를 principles.md에 반영
 *
 * research/mcst-terms-review.md 에서 사람이 [x]로 체크한 줄만 읽어
 * principles.md § 2.1 "카테고리 3. 외래어·전문 용어" 표 끝에 새 행으로 추가합니다.
 * 체크하지 않은 줄, 이미 반영된 줄(반영됨 표시), 이미 사전에 있는 용어는 건너뜁니다.
 *
 * 반영 후에는 review.md의 해당 줄에 "반영됨 YYYY-MM-DD" 표시를 남겨
 * 다시 실행해도 중복 반영되지 않게 합니다(멱등).
 *
 * 사용법:
 *   node scripts/fetch-mcst-terms.js
 *   node scripts/score-mcst-candidates.js
 *   (research/mcst-terms-review.md 에서 [ ] → [x] 체크)
 *   node scripts/apply-mcst-approved.js
 *   node scripts/extract-jargon.js   # jargon-dictionary.json 재생성 (필수)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REVIEW_MD = path.join(ROOT, 'research', 'mcst-terms-review.md');
const PRINCIPLES_MD = path.join(ROOT, 'principles.md');
const JARGON_JSON = path.join(ROOT, 'jargon-dictionary.json');

const CHECKED_LINE_RE = /^- \[([xX])\]\s*(.+?)\s*→\s*(.+?)\s*\|\s*([^<]+?)\s*(?:<!--.*-->)?\s*$/;

function loadExistingBannedTerms() {
  const data = JSON.parse(fs.readFileSync(JARGON_JSON, 'utf8'));
  return new Set(data.entries.map((e) => e.banned.trim()));
}

function parseReview(reviewText) {
  const lines = reviewText.split('\n');
  const approved = []; // { lineIndex, banned, alt, context }
  lines.forEach((line, i) => {
    if (line.includes('반영됨')) return; // 이미 반영된 줄은 다시 처리하지 않음
    const m = line.match(CHECKED_LINE_RE);
    if (!m) return;
    approved.push({ lineIndex: i, banned: m[2].trim(), alt: m[3].trim(), context: m[4].trim() });
  });
  return { lines, approved };
}

function findCategory3TableRange(principlesLines) {
  const headerIdx = principlesLines.findIndex((l) => /^#### 카테고리 3\.\s*외래어/.test(l));
  if (headerIdx === -1) {
    throw new Error('principles.md에서 "#### 카테고리 3. 외래어·전문 용어" 절을 찾지 못했습니다.');
  }
  let tableStart = -1;
  for (let i = headerIdx; i < principlesLines.length; i++) {
    if (/^\|\s*쓰지 마세요/.test(principlesLines[i])) {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) {
    throw new Error('카테고리 3 절 안에서 표 헤더(| 쓰지 마세요 |)를 찾지 못했습니다.');
  }
  let tableEnd = tableStart + 1; // 헤더 다음 줄(구분선)부터
  while (tableEnd < principlesLines.length && /^\|/.test(principlesLines[tableEnd])) {
    tableEnd++;
  }
  return { lastRowIndex: tableEnd - 1 }; // 표의 마지막 데이터 행 인덱스
}

function main() {
  if (!fs.existsSync(REVIEW_MD)) {
    console.error(`${path.relative(ROOT, REVIEW_MD)} 이 없습니다. 먼저 fetch-mcst-terms.js / score-mcst-candidates.js 를 실행하세요.`);
    process.exit(1);
  }

  const reviewText = fs.readFileSync(REVIEW_MD, 'utf8');
  const { lines: reviewLines, approved } = parseReview(reviewText);

  if (approved.length === 0) {
    console.log('체크된([x]) 신규 항목이 없습니다. research/mcst-terms-review.md 에서 반영할 항목을 체크하세요.');
    return;
  }

  const existingBanned = loadExistingBannedTerms();
  const toInsert = [];
  const skippedExisting = [];

  const seenThisRun = new Set();
  for (const item of approved) {
    if (existingBanned.has(item.banned) || seenThisRun.has(item.banned)) {
      skippedExisting.push(item.banned);
      continue;
    }
    seenThisRun.add(item.banned);
    toInsert.push(item);
  }

  if (toInsert.length === 0) {
    console.log(`체크된 항목 ${approved.length}개가 모두 이미 사전에 있어 반영할 신규 항목이 없습니다.`);
    return;
  }

  const principlesText = fs.readFileSync(PRINCIPLES_MD, 'utf8');
  const principlesLines = principlesText.split('\n');
  const { lastRowIndex } = findCategory3TableRange(principlesLines);

  const newRows = toInsert.map((item) => `| ${item.banned} | ${item.alt} | ${item.context} |`);
  principlesLines.splice(lastRowIndex + 1, 0, ...newRows);
  fs.writeFileSync(PRINCIPLES_MD, principlesLines.join('\n'), 'utf8');

  const today = new Date().toISOString().slice(0, 10);
  const insertedLineIndexes = new Set(
    approved.filter((a) => toInsert.some((t) => t.banned === a.banned)).map((a) => a.lineIndex)
  );
  const updatedReviewLines = reviewLines.map((line, i) =>
    insertedLineIndexes.has(i) ? `${line}  ✅ 반영됨 ${today}` : line
  );
  fs.writeFileSync(REVIEW_MD, updatedReviewLines.join('\n'), 'utf8');

  console.log(`principles.md § 2.1 "카테고리 3. 외래어·전문 용어" 표에 ${toInsert.length}개 행 추가:`);
  toInsert.forEach((item) => console.log(`  + ${item.banned} → ${item.alt} (${item.context})`));
  if (skippedExisting.length > 0) {
    console.log(`이미 사전에 있어 건너뜀: ${skippedExisting.join(', ')}`);
  }
  console.log('');
  console.log('다음 단계: node scripts/extract-jargon.js 를 실행해 jargon-dictionary.json을 재생성하세요.');
}

main();
