#!/usr/bin/env node
'use strict';

/**
 * scripts/score-mcst-candidates.js — MCST 후보 용어 관련성 스코어링
 *
 * scripts/fetch-mcst-terms.js 가 만든 research/mcst-terms-candidates.json은
 * "일반 외래어 순화어" 전체라 공공기관 UX Writing과 무관한 항목이 대부분입니다.
 * 이 스크립트는 principles.md § 2.1에 실제로 쓰인 기관명·행정 도메인 키워드와
 * 겹치는 항목만 걸러 "relevant" 티어로 분리하고, 사람이 체크박스로 최종 확정할
 * research/mcst-terms-review.md 를 생성합니다.
 *
 * 사용법:
 *   node scripts/fetch-mcst-terms.js      # 1) 먼저 원본 수집
 *   node scripts/score-mcst-candidates.js # 2) 관련성 스코어링 + 검토 체크리스트 생성
 *   (사람이 research/mcst-terms-review.md 에서 체크박스 확정)
 *   node scripts/apply-mcst-approved.js   # 3) 체크된 항목만 principles.md에 반영
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN_JSON = path.join(ROOT, 'research', 'mcst-terms-candidates.json');
const OUT_JSON = path.join(ROOT, 'research', 'mcst-terms-scored.json');
const OUT_MD = path.join(ROOT, 'research', 'mcst-terms-review.md');

// principles.md § 2.1에 실제로 등장하는 기관명 + 행정 도메인 키워드
// (2026-08 기준 principles.md 카테고리 1~5 "맥락" 열 + 대체어 텍스트에서 추출·정리)
const KEYWORD_BANK = [
  // 기관·서비스명
  '정부24', '홈택스', '국세청', '위택스', '복지로', '고용24', '국민건강보험',
  '국민연금', '법원', '국민신문고', '전자가족관계등록시스템', '건강보험',
  '고용보험', '지방세', '세무서', '주민센터', '등기소',
  // 세무
  '세금', '소득세', '부가세', '부가가치세', '원천징수', '연말정산', '종합소득세',
  '양도소득세', '증여세', '상속세', '가산세', '체납', '환급', '납부', '분납',
  '과세', '면세', '세율', '경정청구', '중간예납',
  // 복지·연금·보험
  '복지', '급여', '수당', '지원금', '바우처', '보조금', '기초생활', '중위소득',
  '장애', '노인', '아동', '육아', '출산', '보험료', '실업급여', '재취업',
  '연금', '요양',
  // 등기·법원·가족관계
  '소송', '판결', '등기', '후견', '이혼', '상속', '국적', '개명', '친권',
  '집행', '증명서', '가족관계',
  // 신청·행정 절차 일반
  '신청', '신고', '접수', '발급', '민원', '자격', '등록', '인증서', '전자문서',
  '개인정보', '주민등록', '병역', '여권', '비자', '사업자등록', '대출', '계좌',
];

// 짧은 키워드는 무관한 단어 안에 우연히 포함되는 경우가 있어 개별 예외 처리.
// 예: "비자"가 "소비자"에, "신고"가 "신고전주의/신고전적"에 우연히 포함됨.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const KEYWORD_OVERRIDES = {
  비자: /(?<!소)비자/,
  신고: /신고(?!전)/,
};
const KEYWORD_PATTERNS = KEYWORD_BANK.map((kw) => ({
  kw,
  re: KEYWORD_OVERRIDES[kw] || new RegExp(escapeRegExp(kw)),
}));

function main() {
  if (!fs.existsSync(IN_JSON)) {
    console.error(`${path.relative(ROOT, IN_JSON)} 이 없습니다. 먼저 node scripts/fetch-mcst-terms.js 를 실행하세요.`);
    process.exit(1);
  }

  const { candidates, fetchedAt, sourceUrl } = JSON.parse(fs.readFileSync(IN_JSON, 'utf8'));

  const scored = candidates.map((c) => {
    const haystack = `${c.banned} ${c.alt}`;
    const matched = KEYWORD_PATTERNS.filter(({ re }) => re.test(haystack)).map(({ kw }) => kw);
    return { ...c, matchedKeywords: matched, tier: matched.length > 0 ? 'relevant' : 'generic' };
  });

  const relevant = scored.filter((c) => c.tier === 'relevant');
  const generic = scored.filter((c) => c.tier === 'generic');

  console.log(`전체 ${scored.length}개 중 관련성 매치: ${relevant.length}개 / 일반 어휘(제외): ${generic.length}개`);

  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      { sourceUrl, fetchedAt, scoredAt: new Date().toISOString().slice(0, 10), total: scored.length, relevant: relevant.length, generic: generic.length, candidates: scored },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const mdLines = [
    '# MCST 후보 용어 — 관련성 검토 체크리스트',
    '',
    `- 원본: [research/mcst-terms-candidates.json](./mcst-terms-candidates.json) (${sourceUrl})`,
    `- 스코어링: ${new Date().toISOString().slice(0, 10)} — principles.md § 2.1 기관명·행정 도메인 키워드 대조`,
    `- 관련성 매치 ${relevant.length}개 / 일반 어휘 제외 ${generic.length}개`,
    '',
    '## 사용법',
    '',
    '1. 아래 체크리스트에서 principles.md에 실을 가치가 있는 항목만 `[ ]` → `[x]`로 체크하세요.',
    '2. 필요하면 `|` 뒤의 "맥락" 텍스트를 실제 서비스/기관명으로 고쳐 쓰세요 (기본값: 공통).',
    '3. 다 골랐으면 `node scripts/apply-mcst-approved.js` 실행 — 체크된 항목만 principles.md § 2.1',
    '   "카테고리 3. 외래어·전문 용어" 표에 자동 삽입되고, 이 파일의 해당 줄은 반영 완료로 표시됩니다.',
    '4. 반영 후 `node scripts/extract-jargon.js`를 실행해 jargon-dictionary.json을 재생성하세요.',
    '',
    `## 검토 대상 — 관련성 매치 (${relevant.length}개)`,
    '',
    ...relevant.map(
      (c) =>
        `- [ ] ${c.banned} → ${c.alt.replace(/\n/g, ' ').trim()} | 공통  <!-- 근거: ${c.matchedKeywords.join(', ')} -->`
    ),
    '',
    `## 참고 — 매치 없음, 기본 제외 (${generic.length}개, 상위 20개만 표시)`,
    '',
    '전체 목록은 research/mcst-terms-scored.json 의 `tier: "generic"` 항목을 참고하세요.',
    '',
    ...generic.slice(0, 20).map((c) => `- ${c.banned} → ${c.alt.replace(/\n/g, ' ').trim()}`),
    '',
  ];
  fs.writeFileSync(OUT_MD, mdLines.join('\n'), 'utf8');

  console.log(`출력: ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`출력: ${path.relative(ROOT, OUT_MD)}`);
}

main();
