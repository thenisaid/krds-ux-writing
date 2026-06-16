import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.join(process.cwd(), 'krds-guide-intro.html'), 'utf8');

describe('guide intro content', () => {
  it('explains the operating split between shared rules and agency-specific guidance', () => {
    expect(HTML).toContain('대표 사이트 순회에서 분리한 기관 고유 보이스·예외 규칙을 KRDS 위에 쌓아 올릴 수 있습니다.');
    expect(HTML).toContain('대표 사이트 순회, 새 실화면을 받은 직후 10분 판정 루틴, 사례 승격 기준과 KRDS 컴포넌트 패턴 제공');
    expect(HTML).toContain('한 기관에서만 반복되는 표현은 여기에 유지');
    expect(HTML).toContain('대표 사이트 순회에서 Layer 2 공통 원칙과 분리된 문화예술 전용 표현 정리');
    expect(HTML).toContain('새 실화면을 받은 직후 10분 판정 루틴 실습');
    expect(HTML).toContain('사례 승격 후보와 Layer 2·Layer 3 분리 연습');
  });
});
