import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

describe('index section explorer markup', () => {
  it('includes inline search and quick filters for the section navigation area', () => {
    expect(HTML).toContain('id="sectionSearchInput"');
    expect(HTML).toContain('id="sectionSearchClear"');
    expect(HTML).toContain('id="sectionFilterStatus"');
    expect(HTML).toContain('id="sectionEditorialEmpty"');
    expect(HTML).toContain('id="sectionFilterReset"');
    expect((HTML.match(/data-section-filter="/g) || []).length).toBe(5);
    expect((HTML.match(/data-filter-keywords="/g) || []).length).toBe(4);
    expect((HTML.match(/data-filter-group="/g) || []).length).toBe(4);
  });

  it('surfaces the principles operating flow from the home landing page', () => {
    expect(HTML).toContain('대표 사이트 순회로 원칙·사전·사례를 갱신하고, 사례 승격·10분 판정·KRDS 연결까지 다루는 공공 UX 라이팅 가이드.');
    expect(HTML).toContain('대표 사이트 순회로 원칙·사전·사례를 갱신하고, 사례 승격·10분 판정·KRDS 연결까지 다루는 공공 UX 라이팅 가이드라인입니다.');
    expect(HTML).toContain('대표 사이트 순회·사례 승격·10분 판정 흐름');
    expect(HTML).toContain('새 실화면을 받은 직후 10분 판정 루틴');
    expect(HTML).toContain('Layer 2·Layer 3 판정');
    expect(HTML).toContain('KRDS UX 라이팅 7장 체계');
    expect(HTML).toContain('대표 사이트 순회와 사례 승격');
    expect(HTML).toContain('대표 사이트 순회에서 수집한 실제 공공 서비스 화면을 원칙에 따라 다시 쓴 사례입니다.');
    expect(HTML).toContain('새 실화면이 들어오면 deep archive에서 비슷한 실패를 먼저 찾고 기존 CASE 묶음부터 대조한 뒤,');
    expect(HTML).toContain('관찰 사이트, KRDS 컴포넌트, 사례 승격 단서를 함께 확인하고');
    expect(HTML).toContain('같은 화면 단계의 원문 3개+CTA 1개를 먼저 기록합니다.');
    expect(HTML).toContain('정부24 · 홈택스 · 전자가족관계등록시스템 3개 기관 deep archive 기준점입니다.');
    expect(HTML).toContain('기존 CASE 묶음과 같은 화면 단계인지 확인한 뒤');
    expect(HTML).toContain('관찰 사이트·KRDS 컴포넌트·다음 사례 승격 후보와 KRDS 연결 포인트를 필터링할 수 있습니다.');
    expect(HTML).toContain('다음 사례 승격 후보와 KRDS 연결 포인트를 필터링할 수 있습니다.');
    expect(HTML).toContain('세 대표 사이트에서 반복되면 Layer 2 공통 원칙 후보로, 기관 고유 제도면 Layer 3 기관 특화 규칙으로 넘깁니다.');
    expect(HTML).toContain('대표 사이트 순회에서 Layer 2 공통 원칙과 Layer 3 기관 특화 규칙을 가른 뒤');
    expect(HTML).toContain('새 실화면은 기존 CASE 묶음부터 대조하고, 세 대표 사이트에서 반복되면 Layer 2 공통 원칙으로, 기관 고유 제도면 Layer 3 기관 특화 규칙으로 넘깁니다.');
    expect(HTML).toContain('각 기관의 사용자 맥락, KRDS 컴포넌트 조합, Before/After 사례를 함께 확인하세요.');
  });
});
