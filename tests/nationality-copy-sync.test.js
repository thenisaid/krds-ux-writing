import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function normalizeCopy(source) {
  return source
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNC_FILES = [
  'research/public-service-corpus.md',
  'principles.md',
  'case-studies/index.html',
  'principles/no-translation/index.html',
  'principles/components/index.html',
  'principles/safety-net/index.html',
  'tests/principles-pages-content.test.js',
  'tests/case-studies-html.test.js',
];

const CANONICAL_HANDOFF_FILES = [
  'principles.md',
  'case-studies/index.html',
  'principles/no-translation/index.html',
  'principles/components/index.html',
];

describe('nationality follow-up copy sync', () => {
  it('keeps the 1-year follow-up wording aligned across docs and regression tests', () => {
    const requiredFragments = [
      '1년 내 외국 국적 포기',
      '외국국적불행사서약 대상 여부',
      '외국 국적 포기 증명서 제출 경로',
    ];

    for (const relPath of SYNC_FILES) {
      const source = read(relPath);

      for (const fragment of requiredFragments) {
        expect(source, `${relPath} should include "${fragment}"`).toContain(fragment);
      }

      expect(
        source,
        `${relPath} should not keep the stale nationality-recovery wording`,
      ).not.toContain('2년 신고 의무');
    }
  });

  it('keeps the canonical KRDS handoff sequence reusable across the public guides', () => {
    const canonicalSequence =
      '한국 국적 다시 받기 허가 결과 → 1년 내 외국 국적 포기 → 외국국적불행사서약 대상 여부 → 외국 국적 포기 증명서 제출 경로';
    const canonicalCtaSet =
      '국적 회복 허가 결과 확인하기 / 외국 국적 포기 기한과 서약 대상 확인하기 / 외국 국적 포기 증명서 제출 경로 확인하기 / 국적 신고 방법 보기';

    for (const relPath of CANONICAL_HANDOFF_FILES) {
      const source = normalizeCopy(read(relPath));

      expect(
        source,
        `${relPath} should keep the canonical handoff sequence`,
      ).toContain(canonicalSequence);
      expect(
        source,
        `${relPath} should keep the canonical CTA set`,
      ).toContain(canonicalCtaSet);
    }
  });
});
