#!/usr/bin/env node
'use strict';

/**
 * scripts/extract-jargon.js — principles.md 2.1 행정어 사전 → jargon-dictionary.json 변환
 *
 * 사용법:
 *   node scripts/extract-jargon.js
 *   node scripts/extract-jargon.js --dry-run   # 콘솔 출력만, 파일 저장 안 함
 *
 * 파싱 범위: "### 2.1 행정어·전문용어 대체어 사전" ~ "### 2.1 부록"
 * 카테고리별 마크다운 테이블을 파싱합니다.
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.join(__dirname, '..');
const PRINCIPLES_MD = path.join(ROOT, 'principles.md');
const OUTPUT_JSON   = path.join(ROOT, 'jargon-dictionary.json');

// ─── 카테고리 헤더 → cat 코드 매핑 ─────────────────────────────────────────────
const CAT_MAP = {
  '행정 관습어': '행정 관습어',
  '이중 부정':   '이중 부정',
  '외래어':      '전문 용어',
  '전문 용어':   '전문 용어',
  '과도한 수식':  '과도한 수식',
  '명사 체인':   '과도한 수식',
  '과도한 경어':  '과도한 경어',
};

function detectCat(header) {
  for (const [key, val] of Object.entries(CAT_MAP)) {
    if (header.includes(key)) return val;
  }
  return header.trim();
}

// ─── 마크다운 테이블 행 파싱 ────────────────────────────────────────────────────
function parseTableRow(line) {
  // "| 쓰지 마세요 | 대신 쓰세요 | 맥락 |" → cells 배열
  const cells = line.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
  return cells;
}

function isHeaderRow(cells) {
  return cells.some(c => c === '쓰지 마세요' || c === '금지어' || c === '쓰지마세요');
}

function isSeparatorRow(line) {
  return /^\|[-| :]+\|$/.test(line.trim());
}

// ─── 메인 파싱 ──────────────────────────────────────────────────────────────────
function parse(md) {
  const lines = md.split('\n');
  const entries = [];

  let inSection   = false;
  let currentCat  = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 섹션 시작: "### 2.1 행정어·전문용어 대체어 사전"
    if (/^### 2\.1\s+행정어/.test(line)) {
      inSection = true;
      continue;
    }

    // 섹션 끝: "### 2.1 부록" 또는 다음 ### 절
    if (inSection && /^###\s/.test(line) && !/^### 2\.1\s+행정어/.test(line)) {
      break;
    }

    if (!inSection) continue;

    // 카테고리 헤더: "#### 카테고리 N. ..."
    if (/^####/.test(line)) {
      currentCat = detectCat(line.replace(/^####\s*카테고리\s*\d+\.\s*/, '').trim());
      continue;
    }

    // 테이블 행
    if (line.startsWith('|') && currentCat) {
      if (isSeparatorRow(line)) continue;
      const cells = parseTableRow(line);
      if (cells.length < 2) continue;
      if (isHeaderRow(cells)) continue;

      const banned = cells[0];
      const alt    = cells[1];
      // 세 번째 열이 있으면 맥락/출처
      const ctx    = cells[2] || '';

      if (!banned || banned === '...' || banned.startsWith('**')) continue;

      const entry = { banned, alt, cat: currentCat };
      if (ctx) entry.context = ctx;
      entries.push(entry);
    }
  }

  return entries;
}

// ─── 실행 ────────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const md      = fs.readFileSync(PRINCIPLES_MD, 'utf8');
const entries = parse(md);

const output = {
  version:   '1.0.0',
  generated: new Date().toISOString().slice(0, 10),
  source:    'principles.md § 2.1',
  note:      'scripts/extract-jargon.js 로 자동 생성. 직접 편집 대신 principles.md를 수정 후 재실행하세요.',
  entries,
};

const json = JSON.stringify(output, null, 2);

if (dryRun) {
  process.stdout.write(json + '\n');
  process.stderr.write(`[dry-run] 총 ${entries.length}개 항목 추출 (파일 저장 안 함)\n`);
} else {
  fs.writeFileSync(OUTPUT_JSON, json, 'utf8');
  process.stderr.write(`✅ jargon-dictionary.json 생성 완료 — ${entries.length}개 항목\n`);
  process.stderr.write(`   저장 위치: ${OUTPUT_JSON}\n`);
}
