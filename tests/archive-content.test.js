import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('archive page content', () => {
  it('explains how the deep archive connects to representative-site sweeps and case promotion', () => {
    const html = read('archive.html');

    expect(html).toContain('<meta name="description" content="정부24 · 홈택스 · 전자가족관계등록시스템 UX Writing 이슈 805개 deep archive — 대표 사이트 순회에서 반복 이슈를 찾고 사례 승격·KRDS 연결 후보를 고르는 아카이브.">');
    expect(html).toContain('정부24 · 홈택스 · 전자가족관계등록시스템 3개 기관을 42 Cycle 동안 깊게 검수한 결과입니다.');
    expect(html).toContain('대표 사이트 순회에서는 이 3기관을 deep archive 기준점으로 삼아');
    expect(html).toContain('기존 CASE 묶음부터 대조한 뒤 반복되면 사례 승격 후보로 넘깁니다.');
    expect(html).toContain('대표 사이트 순회에서 이 아카이브를 쓰는 방법');
    expect(html).toContain('대표 사이트 8종 전체 목록이 아니라');
    expect(html).toContain('원문 3개+CTA 1개');
    expect(html).toContain('<code>기존 CASE 묶음</code>부터 대조합니다.');
    expect(html).toContain('<code>Layer 2</code> 사례 카드·관련 원칙·KRDS 컴포넌트 규칙으로 승격하고, 기관 고유 제도면 <code>Layer 3</code> 파생 가이드 후보로 보류합니다.');
    expect(html).toContain('찾을 것: 원문 3개+CTA 1개');
    expect(html).toContain('먼저 대조: 기존 CASE 묶음');
    expect(html).toContain('반복 판정: 세 대표 사이트면 Layer 2 / 기관 고유면 Layer 3');
    expect(html).toContain('다음 도착지: 사례 운영 · 거버넌스 · 파생 가이드');
    expect(html).toContain('실제 사례 추가 운영 방법');
    expect(html).toContain('사례 승격·KRDS 연결 규칙');
    expect(html).toContain('기관별 파생 가이드');
  });

  it('records the archive-positioning note in the public-service corpus log', () => {
    const corpus = read('research/public-service-corpus.md');

    expect(corpus).toContain('| `archive.html`, `research/public-service-corpus.md`, `tests/archive-content.test.js` | 아카이브 deep-dive 위치 공개 | 아카이브 헤더를 `대표 사이트 8종 전체 목록`이 아니라 `정부24·홈택스·전자가족관계등록시스템 3개 기관 deep archive 기준점`으로 다시 설명하고, `기존 CASE 묶음 우선 대조`, `원문 3개+CTA 1개`, `세 대표 사이트 반복 시 Layer 2 / 기관 고유 제도면 Layer 3`, `사례 운영·거버넌스·파생 가이드` 다음 도착지 링크를 넣어 실제 순회에서 아카이브를 언제 참고하고 언제 승격 후보나 기관 특화 보류로 넘기는지 공개 문서에도 고정한다 |');
  });
});
