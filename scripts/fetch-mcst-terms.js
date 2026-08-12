#!/usr/bin/env node
'use strict';

/**
 * scripts/fetch-mcst-terms.js — 국립국어원 공공언어 용어 목록 수집·대조
 *
 * 공공데이터포털(data.go.kr) 문화체육관광부 국립국어원
 * "쉽고 바른 공공언어 쓰기 평가용 용어 목록"을 내려받아
 * jargon-dictionary.json(= principles.md § 2.1 자동 생성본)에 이미 등재된
 * 금지어와 대조하고, 아직 없는 신규 후보만 골라 research/에 출력합니다.
 *
 * 데이터셋: https://www.data.go.kr/data/15130006/fileData.do
 * (파일데이터는 로그인/인증키 없이 다운로드 가능 — 오픈API 아님)
 *
 * 이 스크립트는 principles.md를 직접 수정하지 않습니다.
 * 출력된 후보 목록은 사람이 공공기관 UX Writing 맥락 관련성을 검토한 뒤
 * principles.md § 2.1 표에 수동으로 반영하고
 * node scripts/extract-jargon.js 를 재실행해야 jargon-dictionary.json에 반영됩니다.
 *
 * 사용법:
 *   node scripts/fetch-mcst-terms.js            # 캐시 있으면 재사용, 없으면 다운로드
 *   node scripts/fetch-mcst-terms.js --refresh  # 캐시 무시하고 항상 새로 다운로드
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'research', 'raw');
const RAW_CSV = path.join(RAW_DIR, 'mcst-easy-terms.csv');
const JARGON_JSON = path.join(ROOT, 'jargon-dictionary.json');
const OUT_MD = path.join(ROOT, 'research', 'mcst-terms-candidates.md');
const OUT_JSON = path.join(ROOT, 'research', 'mcst-terms-candidates.json');

const DATASET_PAGE = 'https://www.data.go.kr/data/15130006/fileData.do';
const DOWNLOAD_URL =
  'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003033340&fileDetailSn=1&insertDataPrcus=N';

const FORCE_REFRESH = process.argv.includes('--refresh');

// ─── 다운로드 (redirect 1단계까지 추적) ──────────────────────────────────────
function download(url, dest, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (krds-ux-writing fetch-mcst-terms.js)' } },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) return reject(new Error('리다이렉트가 너무 많습니다'));
            res.resume();
            return resolve(download(res.headers.location, dest, redirectsLeft - 1));
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`다운로드 실패: HTTP ${res.statusCode} (${DATASET_PAGE} 에서 다운로드 URL이 바뀌었을 수 있습니다)`));
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, buf);
            resolve(buf);
          });
          res.on('error', reject);
        }
      )
      .on('error', reject);
  });
}

// ─── CSV 파싱 (따옴표·콤마 포함 셀 대비 최소 파서) ────────────────────────────
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  const rows = lines.map(parseCsvLine);
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = (cells[i] || '').trim()));
    return row;
  });
}

// ─── 기존 사전 로드 ───────────────────────────────────────────────────────────
function loadExistingBannedTerms() {
  const data = JSON.parse(fs.readFileSync(JARGON_JSON, 'utf8'));
  const set = new Set();
  for (const e of data.entries) {
    if (e.banned) set.add(e.banned.trim());
  }
  return set;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  let buf;
  if (!FORCE_REFRESH && fs.existsSync(RAW_CSV)) {
    buf = fs.readFileSync(RAW_CSV);
    console.log(`캐시 사용: ${path.relative(ROOT, RAW_CSV)} (--refresh로 강제 재다운로드)`);
  } else {
    console.log(`국립국어원 데이터 다운로드 중... (${DATASET_PAGE})`);
    buf = await download(DOWNLOAD_URL, RAW_CSV);
    console.log(`다운로드 완료: ${buf.length.toLocaleString()} bytes → ${path.relative(ROOT, RAW_CSV)}`);
  }

  const text = buf.toString('utf8').replace(/^﻿/, '');
  const rows = parseCsv(text);
  console.log(`총 ${rows.length}개 용어 파싱 완료`);

  const existing = loadExistingBannedTerms();

  const seen = new Set();
  const candidates = [];
  let coveredCount = 0;

  for (const row of rows) {
    const term = row['단어_용어'];
    const altSpelling = row['이표기_오표기'];
    const alt = row['대안어(안)'];
    if (!term || !alt) continue;
    if (seen.has(term)) continue; // 데이터셋 자체 중복 제거
    seen.add(term);

    const isCovered = existing.has(term) || (altSpelling && existing.has(altSpelling));

    if (isCovered) {
      coveredCount++;
    } else {
      candidates.push({
        banned: term,
        altSpelling: altSpelling || null,
        alt,
        context: '공통', // 기본값 — 사람이 실제 맥락(기관/서비스)으로 교체 필요
      });
    }
  }

  console.log(`이미 등재됨: ${coveredCount}개 / 신규 후보: ${candidates.length}개`);

  const fetchedAt = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        source: '문화체육관광부 국립국어원_쉽고 바른 공공언어 쓰기 평가용 용어 목록',
        sourceUrl: DATASET_PAGE,
        fetchedAt,
        totalTerms: rows.length,
        alreadyCovered: coveredCount,
        newCandidates: candidates.length,
        candidates,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const mdLines = [
    '# 국립국어원 공공언어 용어 목록 — 신규 후보 (자동 수집)',
    '',
    `- 출처: [문화체육관광부 국립국어원_쉽고 바른 공공언어 쓰기 평가용 용어 목록](${DATASET_PAGE})`,
    `- 수집일: ${fetchedAt}`,
    `- 원본 ${rows.length}개 중 기존 jargon-dictionary.json 미등재 ${candidates.length}개 (등재됨 ${coveredCount}개)`,
    '',
    '> ⚠️ 자동 대조 결과이며 그대로 반영하면 안 됩니다. "맥락" 열은 기본값(공통)입니다.',
    '> principles.md § 2.1에 옮기기 전에 다음을 사람이 확인하세요:',
    '> 1) 공공기관 행정 서비스 맥락에서 실제로 쓰이는 용어인지 (이 목록은 일반 외래어 순화어라 무관한 항목이 섞여 있음)',
    '> 2) "맥락" 열을 실제 서비스/기관명으로 구체화',
    '> 3) 반영 후 `node scripts/extract-jargon.js` 재실행 필요',
    '',
    '| 쓰지 마세요 | 대신 쓰세요 | 맥락 |',
    '|------------|------------|------|',
    ...candidates.map((c) => `| ${c.banned} | ${c.alt.replace(/\n/g, ' ').trim()} | ${c.context} |`),
    '',
  ];
  fs.writeFileSync(OUT_MD, mdLines.join('\n'), 'utf8');

  console.log(`출력: ${path.relative(ROOT, OUT_MD)}`);
  console.log(`출력: ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch((err) => {
  console.error('오류:', err.message);
  process.exit(1);
});
