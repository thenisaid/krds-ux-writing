import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'research', 'phase4-runtime-verification.md');
const ORIGIN = 'http://localhost:3000';

process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8200/krds';
process.env.ANTHROPIC_API_KEY = '';

const CASES = [
  {
    mode: 'guide-draft',
    title: '기관 가이드 초안',
    payload: {
      mode: 'guide-draft',
      agencyName: '서울시립미술관',
      agencyType: '공공기관',
      screenType: '일반 안내',
      samples: [
        '귀하의 신청서가 접수되었습니다. 처리 결과는 추후 통보 예정입니다.',
        'ERROR 4023: 인증 실패. 다시 시도해 주세요.',
        '해당 항목은 필수 입력 사항입니다.',
      ],
    },
    expectedMarkers: [
      '# 서울시립미술관 UX Writing 가이드라인 초안',
      '## KRDS 품질 게이트',
      '## 6. 즉시 적용 체크리스트',
    ],
  },
  {
    mode: 'rewrite',
    title: '문장 재작성',
    payload: {
      mode: 'rewrite',
      agencyName: '정부24',
      agencyType: '중앙행정기관',
      screenType: '공지/배너',
      samples: [
        '상기 내용을 숙지하신 후 확인 버튼을 클릭하여 주시기 바랍니다.',
        '귀하의 민원은 처리되시겠습니다.',
      ],
    },
    expectedMarkers: [
      '# 정부24 UX Writing 재작성안',
      '## 2. Before / After',
      '## KRDS 품질 게이트',
    ],
  },
  {
    mode: 'message-pack',
    title: '상태 메시지 개선',
    payload: {
      mode: 'message-pack',
      agencyName: '정부24',
      agencyType: '중앙행정기관',
      screenType: '에러/경고',
      samples: [
        'ERROR 4023: 인증 실패. 다시 시도해 주세요.',
        '신청이 완료되었습니다. 감사합니다!',
        '검색 결과가 없습니다.',
      ],
    },
    expectedMarkers: [
      '# 정부24 상태 메시지 개선안',
      '## 2. 오류 메시지',
      '## KRDS 품질 게이트',
    ],
  },
  {
    mode: 'tone-adjust',
    title: '톤 조정',
    payload: {
      mode: 'tone-adjust',
      agencyName: '복지로',
      agencyType: '중앙행정기관',
      screenType: '완료/성공',
      toneTarget: '더 안내형으로',
      samples: [
        '반드시 확인하여야 합니다.',
        '빠르게 처리해 드리겠습니다.',
        '감사합니다! 잘하셨습니다.',
      ],
    },
    expectedMarkers: [
      '# 복지로 톤 조정안',
      '## 3. Before / After',
      '## KRDS 품질 게이트',
    ],
  },
  {
    mode: 'derivative-guide',
    title: 'Layer 3 파생 가이드 초안',
    payload: {
      mode: 'derivative-guide',
      agencyName: '서울시립미술관',
      agencyType: '공공기관',
      screenType: '검색/탐색',
      taskBrief: '전시 탐색, 예약, 교육 프로그램 신청 흐름을 우선 반영해 주세요.',
      samples: [
        '전시 예약이 완료되었습니다. 당일 QR 코드로 입장해 주세요.',
        '도슨트 예약은 하루 전까지 취소할 수 있습니다.',
        '검색 결과가 없습니다. 다른 전시명이나 기간으로 다시 찾아보세요.',
      ],
    },
    expectedMarkers: [
      '# 서울시립미술관 Layer 3 파생 가이드 초안',
      '## 2. 전문용어 추가 사전',
      '## 4. 주요 오류 시나리오 5개',
      '## KRDS 품질 게이트',
    ],
  },
];

function buildRequest(payload, index) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': `198.51.100.${index + 1}`,
    },
    body: JSON.stringify(payload),
  });
}

function parseSseEvents(rawText) {
  return String(rawText || '')
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
      .filter(Boolean))
    .flat()
    .map((jsonText) => {
      try {
        return JSON.parse(jsonText);
      } catch {
        return { type: 'parse_error', raw: jsonText };
      }
    });
}

function collectMarkdown(events) {
  return events
    .filter((event) => event && event.type === 'chunk')
    .map((event) => event.text || '')
    .join('');
}

function escapeMd(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function buildReport(results) {
  const lines = [
    '# Phase 4 Runtime Verification',
    '',
    '- 검증 시각: ' + new Date().toLocaleString('ko-KR'),
    '- Anthropic 호환 엔드포인트: `' + process.env.ANTHROPIC_BASE_URL + '`',
    '- 검증 방식: `api/generate.js` 핸들러를 직접 호출하고, 로컬 LLangs 게이트웨이 응답을 SSE로 수신',
    '',
    '## 결과 요약',
    '',
    '| 모드 | 결과 | 상태 코드 | 누락 마커 | 첫 줄 |',
    '|---|---|---:|---|---|',
  ];

  results.forEach((result) => {
    lines.push(
      '| ' + escapeMd(result.mode) +
      ' | ' + escapeMd(result.ok ? '통과' : '실패') +
      ' | ' + result.status +
      ' | ' + escapeMd(result.missing.join(', ') || '-') +
      ' | ' + escapeMd(result.firstLine || '-') + ' |'
    );
  });

  lines.push('', '## 상세', '');

  results.forEach((result) => {
    lines.push('### ' + result.mode + ' — ' + result.title, '');
    lines.push('- 상태 코드: ' + result.status);
    lines.push('- 결과: ' + (result.ok ? '통과' : '실패'));
    lines.push('- 누락 마커: ' + (result.missing.join(', ') || '없음'));
    if (result.errorMessage) {
      lines.push('- SSE 오류: ' + result.errorMessage);
    }
    lines.push('');
    lines.push('```md');
    lines.push(result.preview || '(응답 없음)');
    lines.push('```');
    lines.push('');
  });

  return lines.join('\n');
}

async function runCase(testCase, index) {
  const { default: handler } = await import('../api/generate.js?phase4=' + Date.now() + '-' + index);
  const response = await handler(buildRequest(testCase.payload, index));
  const rawText = await response.text();
  const events = parseSseEvents(rawText);
  const markdown = collectMarkdown(events).trim();
  const errorEvent = events.find((event) => event && event.type === 'error');
  const missing = testCase.expectedMarkers.filter((marker) => !markdown.includes(marker));
  const firstLine = markdown.split('\n').map((line) => line.trim()).find(Boolean) || '';
  const ok = response.status === 200 && !errorEvent && missing.length === 0;

  return {
    mode: testCase.mode,
    title: testCase.title,
    status: response.status,
    ok,
    missing,
    errorMessage: errorEvent ? errorEvent.message || '' : '',
    firstLine,
    preview: markdown.split('\n').slice(0, 24).join('\n'),
    rawText,
  };
}

async function main() {
  const results = [];
  for (let index = 0; index < CASES.length; index += 1) {
    results.push(await runCase(CASES[index], index));
  }

  const report = buildReport(results);
  if (process.argv.includes('--write-report')) {
    await fs.writeFile(REPORT_PATH, report, 'utf8');
  }

  process.stdout.write(report + '\n');

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
  process.exitCode = 1;
});
