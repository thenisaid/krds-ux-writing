/**
 * krds-lint.js 정규식 지연(G3) 회귀 테스트
 * 공백 없는 긴 한글 입력에서 선행 한정자(+, {n,})가 모든 시작점에서 재시도되어
 * O(n²)로 느려지는 문제를 막고, 반복 상한 경계에서의 동작을 고정한다.
 * Framework: vitest
 */
import { describe, it, expect } from 'vitest';
import KRDSLint from '../krds-lint.js';

// 조사 후보(이/을/를/의/에/로/와/과)와 '지'·'화'·'적'을 포함하지 않는 한글 채움 문자열
const FILLER = '가나다라마바사아자차카타파하';
const filler = (n) => FILLER.repeat(Math.ceil(n / FILLER.length)).slice(0, n);

const ofType = (text, type) => KRDSLint.lint(text).issues.filter((i) => i.type === type);

describe('lint() — 공백 없는 긴 한글 입력 성능 (G3)', () => {
  it('공백 없는 한글 2만자를 1.5초 안에 처리한다', () => {
    const text = filler(20000);
    const start = Date.now();
    const result = KRDSLint.lint(text);
    const elapsed = Date.now() - start;

    // 정규식 규칙 4개는 이 입력에서 아무것도 잡지 않는다 (long-sentence 만 해당)
    const types = result.issues.map((i) => i.type);
    expect(types).toEqual(['long-sentence']);
    // 상한 도입 전 약 2.6초 → 도입 후 수십 ms. CI 편차를 감안해 넉넉히 1.5초.
    expect(elapsed).toBeLessThan(1500);
  });
});

describe('lint() — 반복 상한 경계 (G3)', () => {
  describe('noun-chain', () => {
    it('상한(80자) 안의 명사 체인은 전체가 그대로 잡힌다', () => {
      const run = filler(80);
      const issues = ofType(run + '를 확인하세요.', 'noun-chain');
      expect(issues).toHaveLength(1);
      expect(issues[0].match).toBe(run + '를');
    });

    it('상한을 넘는 명사 체인도 여전히 1건으로 감지되고, 매치 길이는 상한 + 조사로 제한된다', () => {
      const issues = ofType(filler(120) + '를 확인하세요.', 'noun-chain');
      expect(issues).toHaveLength(1);
      expect(issues[0].match.length).toBeLessThanOrEqual(81);
    });
  });

  describe('double-negative', () => {
    it('짧은 선두 어절은 기존과 같이 감지한다', () => {
      const issues = ofType('완료하지 않으면 안 됩니다.', 'double-negative');
      expect(issues).toHaveLength(1);
      expect(issues[0].match).toBe('완료하지 않으면 안 됩니다');
    });

    it('선두가 상한(40자)을 넘어도 감지하되 매치 길이는 제한된다', () => {
      const tail = '지 않으면 안 됩니다';
      const issues = ofType(filler(100) + tail, 'double-negative');
      expect(issues).toHaveLength(1);
      expect(issues[0].match.length).toBeLessThanOrEqual(40 + tail.length);
    });
  });

  describe('translation-artifact', () => {
    it('짧은 앞말 + "에 대한"은 기존과 같이 감지한다', () => {
      const issues = ofType('신청서에 대한 안내를 드립니다.', 'translation-artifact');
      expect(issues).toHaveLength(1);
      expect(issues[0].match).toBe('신청서에 대한 안내를');
    });

    it('앞말이 상한(40자)을 넘어도 감지하되 매치 길이는 제한된다', () => {
      const issues = ofType(filler(100) + '에 대하여 설명합니다.', 'translation-artifact');
      expect(issues).toHaveLength(1);
      expect(issues[0].match.length).toBeLessThanOrEqual(40 + '에 대하여'.length);
    });
  });

  describe('over-nominalization', () => {
    it('짧은 앞말 + "화를"은 기존과 같이 감지한다', () => {
      const issues = ofType('서비스 안정화를 추진합니다.', 'over-nominalization');
      expect(issues).toHaveLength(1);
      expect(issues[0].match).toBe('안정화를 ');
    });

    it('앞말이 상한(40자)을 넘어도 감지하되 매치 길이는 제한된다', () => {
      const issues = ofType(filler(100) + '화를 추진합니다.', 'over-nominalization');
      expect(issues).toHaveLength(1);
      expect(issues[0].match.length).toBeLessThanOrEqual(40 + '화를 '.length);
    });
  });
});
