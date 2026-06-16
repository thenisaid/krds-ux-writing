#!/usr/bin/env node
'use strict';

/**
 * scripts/extract-jargon.js — principles.md 2.1 행정어 사전 → jargon-dictionary.{json,js} 변환
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
const OUTPUT_JS     = path.join(ROOT, 'jargon-dictionary.js');
const DEFAULT_OUTPUT_META = {
  version: '1.0.0',
  source: 'principles.md § 2.1',
  note: 'scripts/extract-jargon.js 로 자동 생성. 직접 편집 대신 principles.md를 수정 후 재실행하세요.',
};

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

function readExistingOutput(outputPath = OUTPUT_JSON) {
  if (!fs.existsSync(outputPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function readExistingText(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function hasSameEntries(existingOutput, entries) {
  return Array.isArray(existingOutput && existingOutput.entries)
    && JSON.stringify(existingOutput.entries) === JSON.stringify(entries);
}

function normalizeEntryKeyPart(value) {
  return String(value || '')
    .replace(/^~+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBannedKey(value) {
  return String(value || '')
    .replace(/~/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createEntryKey(entry) {
  return [
    normalizeEntryKeyPart(entry && entry.banned),
    normalizeEntryKeyPart(entry && entry.alt),
    normalizeEntryKeyPart(entry && entry.cat),
    normalizeEntryKeyPart(entry && entry.context),
  ].join('\u0000');
}

function isMoreDescriptiveEntry(candidate, current) {
  const candidateAltLength = normalizeEntryKeyPart(candidate && candidate.alt).length;
  const currentAltLength = normalizeEntryKeyPart(current && current.alt).length;
  if (candidateAltLength !== currentAltLength) return candidateAltLength > currentAltLength;

  const candidateContextLength = normalizeEntryKeyPart(candidate && candidate.context).length;
  const currentContextLength = normalizeEntryKeyPart(current && current.context).length;
  if (candidateContextLength !== currentContextLength) return candidateContextLength > currentContextLength;

  return false;
}

function mergeEntries(entries) {
  const seenExactEntries = new Set();
  const mergedByBanned = new Map();
  const orderedBannedKeys = [];

  entries.forEach((entry) => {
    const key = createEntryKey(entry);
    if (seenExactEntries.has(key)) return;
    seenExactEntries.add(key);

    const bannedKey = normalizeBannedKey(entry && entry.banned);
    if (!bannedKey) return;

    if (!mergedByBanned.has(bannedKey)) {
      mergedByBanned.set(bannedKey, entry);
      orderedBannedKeys.push(bannedKey);
      return;
    }

    const current = mergedByBanned.get(bannedKey);
    if (isMoreDescriptiveEntry(entry, current)) {
      mergedByBanned.set(bannedKey, entry);
    }
  });

  return orderedBannedKeys.map((bannedKey) => mergedByBanned.get(bannedKey));
}

function buildOutput({ entries, existingOutput = null, date = new Date().toISOString().slice(0, 10) }) {
  const mergedEntries = mergeEntries(entries, existingOutput);
  const sameEntries = hasSameEntries(existingOutput, mergedEntries);

  return {
    version: typeof (existingOutput && existingOutput.version) === 'string'
      ? existingOutput.version
      : DEFAULT_OUTPUT_META.version,
    generated: sameEntries && typeof (existingOutput && existingOutput.generated) === 'string'
      ? existingOutput.generated
      : date,
    source: typeof (existingOutput && existingOutput.source) === 'string'
      ? existingOutput.source
      : DEFAULT_OUTPUT_META.source,
    note: typeof (existingOutput && existingOutput.note) === 'string'
      ? existingOutput.note
      : DEFAULT_OUTPUT_META.note,
    entries: mergedEntries,
  };
}

function buildBrowserBundle(output) {
  return [
    '/* Auto-generated by scripts/extract-jargon.js. Do not edit manually. */',
    '(function (root) {',
    "  'use strict';",
    '  root.KRDS_JARGON_DICT = ' + JSON.stringify(output, null, 2) + ';',
    "})(typeof globalThis !== 'undefined' ? globalThis : this);",
    '',
  ].join('\n');
}

function syncJargonDictionary({
  md,
  dryRun = false,
  date = new Date().toISOString().slice(0, 10),
  outputPath = OUTPUT_JSON,
  browserOutputPath = OUTPUT_JS,
  existingOutput = readExistingOutput(outputPath),
  existingBrowserBundle = readExistingText(browserOutputPath),
  writeFile = fs.writeFileSync,
  stdout = process.stdout,
  stderr = process.stderr,
}) {
  const entries = parse(md);
  const output = buildOutput({ entries, existingOutput, date });
  const json = JSON.stringify(output, null, 2);
  const browserBundle = buildBrowserBundle(output);
  const existingJson = existingOutput ? JSON.stringify(existingOutput, null, 2) : null;
  const extractedCount = entries.length;
  const totalCount = output.entries.length;
  const jsonChanged = existingJson !== json;
  const browserBundleChanged = existingBrowserBundle !== browserBundle;

  if (dryRun) {
    stdout.write(json + '\n');
    stderr.write(`[dry-run] 원본 ${extractedCount}개 추출, 총 ${totalCount}개 항목 출력 (파일 저장 안 함)\n`);
    return { changed: jsonChanged || browserBundleChanged, extractedCount, totalCount, output };
  }

  if (!jsonChanged && !browserBundleChanged) {
    stderr.write(`ℹ️ jargon-dictionary assets already up to date — 원본 ${extractedCount}개, 총 ${totalCount}개 항목\n`);
    return { changed: false, extractedCount, totalCount, output };
  }

  if (jsonChanged) writeFile(outputPath, json, 'utf8');
  if (browserBundleChanged) writeFile(browserOutputPath, browserBundle, 'utf8');

  stderr.write(`✅ jargon dictionary assets 생성 완료 — 원본 ${extractedCount}개, 총 ${totalCount}개 항목\n`);
  if (jsonChanged) stderr.write(`   JSON 저장 위치: ${outputPath}\n`);
  if (browserBundleChanged) stderr.write(`   브라우저 번들 저장 위치: ${browserOutputPath}\n`);
  return { changed: true, extractedCount, totalCount, output };
}

function main(args = process.argv.slice(2)) {
  const dryRun = args.includes('--dry-run');
  const md = fs.readFileSync(PRINCIPLES_MD, 'utf8');
  syncJargonDictionary({ md, dryRun });
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  DEFAULT_OUTPUT_META,
  OUTPUT_JS,
  parse,
  readExistingOutput,
  readExistingText,
  mergeEntries,
  buildOutput,
  buildBrowserBundle,
  syncJargonDictionary,
  main,
};
