/**
 * offline-app/rulepack-validator.js unit tests
 * Framework: vitest
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest';
import RulePackValidator from '../offline-app/rulepack-validator.js';

function baseEntry(overrides) {
  return Object.assign(
    {
      term: '귀하',
      agencyName: '테스트기관',
      rationale: '내부 법정 서식에서 그대로 사용하는 용어로 승인됨',
      approver: '홍길동',
      approvedDate: '2026-01-01',
      reviewDate: '2026-06-01',
    },
    overrides
  );
}

function basePack(overrides) {
  return Object.assign(
    {
      agencyName: '테스트기관',
      version: '1.0',
      entries: [baseEntry()],
    },
    overrides
  );
}

function json(obj) {
  return JSON.stringify(obj);
}

// ── 정상 케이스 ─────────────────────────────────────────────────────────────

describe('validateRulePack() — 유효한 Rule Pack', () => {
  it('필수 필드를 모두 갖춘 Rule Pack을 통과시킨다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack()));
    expect(result.valid).toBe(true);
    expect(result.data.agencyName).toBe('테스트기관');
    expect(result.data.entries).toHaveLength(1);
  });

  it('version이 숫자여도 통과시킨다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ version: 1 })));
    expect(result.valid).toBe(true);
  });

  it('reviewDate가 approvedDate와 같은 날짜여도 통과시킨다', () => {
    const result = RulePackValidator.validateRulePack(
      json(basePack({ entries: [baseEntry({ approvedDate: '2026-01-01', reviewDate: '2026-01-01' })] }))
    );
    expect(result.valid).toBe(true);
  });

  it('entries가 정확히 500개이면 통과시킨다 (경계값)', () => {
    const entries = Array.from({ length: 500 }, (_, i) => baseEntry({ term: 't' + i, rationale: 'ab' }));
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(true);
    expect(result.data.entries).toHaveLength(500);
  });
});

// ── 입력 형식 오류 ───────────────────────────────────────────────────────────

describe('validateRulePack() — 입력 형식 오류', () => {
  it('문자열이 아닌 입력을 거부한다', () => {
    const result = RulePackValidator.validateRulePack(basePack());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('문자열이 아닙니다');
  });

  it('JSON 파싱에 실패하면 거부한다', () => {
    const result = RulePackValidator.validateRulePack('{ this is not valid json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('유효한 JSON 형식이 아닙니다');
  });

  it('최상위 값이 배열이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json([1, 2, 3]));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('객체');
  });

  it('최상위 값이 문자열이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json('그냥 문자열'));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('객체');
  });

  it('최상위 값이 null이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(null));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('객체');
  });
});

// ── 파일 크기 제한 ───────────────────────────────────────────────────────────

describe('validateRulePack() — 파일 크기 제한', () => {
  it('100KB를 초과하면 거부한다', () => {
    const huge = basePack({ entries: [baseEntry({ rationale: 'a'.repeat(500) })] });
    const hugeString = json(huge).padEnd(101 * 1024, ' ');
    // 패딩으로 JSON이 깨지므로, 크기 제한이 파싱보다 먼저 걸리는지만 확인
    const result = RulePackValidator.validateRulePack(hugeString);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('파일 크기');
  });

  it('100KB 미만이면 크기 제한에는 걸리지 않는다 (경계값)', () => {
    const result = RulePackValidator.validateRulePack(json(basePack()));
    expect(result.valid).toBe(true);
  });

  describe('TextEncoder가 없는 환경 (Buffer 폴백)', () => {
    afterEach(() => {
      global.TextEncoder = TextEncoder;
    });

    it('TextEncoder 미지원 환경에서도 Buffer로 크기를 계산해 정상 검증한다', () => {
      const original = global.TextEncoder;
      delete global.TextEncoder;
      try {
        const result = RulePackValidator.validateRulePack(json(basePack()));
        expect(result.valid).toBe(true);
      } finally {
        global.TextEncoder = original;
      }
    });
  });
});

// ── 최상위 필드 검증 ─────────────────────────────────────────────────────────

describe('validateRulePack() — 최상위 필드', () => {
  it('agencyName이 없으면 거부한다', () => {
    const pack = basePack();
    delete pack.agencyName;
    const result = RulePackValidator.validateRulePack(json(pack));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'agencyName' 필드가 없습니다"))).toBe(true);
  });

  it('agencyName이 문자열이 아니면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ agencyName: 123 })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'agencyName' 필드는 문자열"))).toBe(true);
  });

  it('agencyName이 50자를 초과하면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ agencyName: 'a'.repeat(51) })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'agencyName' 필드는 1자 이상 50자 이하"))).toBe(true);
  });

  it('agencyName이 빈 문자열이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ agencyName: '' })));
    expect(result.valid).toBe(false);
  });

  it('version이 없으면 거부한다', () => {
    const pack = basePack();
    delete pack.version;
    const result = RulePackValidator.validateRulePack(json(pack));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'version' 필드가 없습니다"))).toBe(true);
  });

  it('version이 boolean이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ version: true })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'version' 필드는 문자열 또는 숫자"))).toBe(true);
  });

  it('entries가 없으면 거부한다', () => {
    const pack = basePack();
    delete pack.entries;
    const result = RulePackValidator.validateRulePack(json(pack));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'entries' 필드가 없습니다"))).toBe(true);
  });

  it('entries가 배열이 아니면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: { term: '귀하' } })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'entries' 필드는 배열"))).toBe(true);
  });

  it('entries가 500개를 초과하면 거부한다', () => {
    const entries = Array.from({ length: 501 }, (_, i) => baseEntry({ term: 't' + i, rationale: 'ab' }));
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('최대 500개까지 허용'))).toBe(true);
  });

  it('여러 최상위 필드가 동시에 누락되면 오류를 모두 모아 반환한다', () => {
    const result = RulePackValidator.validateRulePack(json({}));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── entries 항목 필드 검증 ───────────────────────────────────────────────────

describe('validateRulePack() — entries 항목 필드', () => {
  it('entries 항목이 객체가 아니면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: ['그냥 문자열'] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('entries[0] 항목이 객체가 아닙니다'))).toBe(true);
  });

  it('entries 항목이 배열이면 거부한다 (배열은 객체가 아님)', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [[]] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('entries[0] 항목이 객체가 아닙니다'))).toBe(true);
  });

  it('entries 항목이 null이면 거부한다', () => {
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [null] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('entries[0] 항목이 객체가 아닙니다'))).toBe(true);
  });

  const stringFields = ['term', 'agencyName', 'rationale', 'approver'];

  stringFields.forEach((field) => {
    it(`entries[0].${field} 필드가 없으면 거부한다`, () => {
      const entry = baseEntry();
      delete entry[field];
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`entries[0] '${field}' 필드가 없습니다`))).toBe(true);
    });

    it(`entries[0].${field} 필드가 문자열이 아니면 거부한다`, () => {
      const entry = baseEntry({ [field]: 12345 });
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`entries[0] '${field}' 필드는 문자열`))).toBe(true);
    });
  });

  it('term이 50자를 초과하면 거부한다', () => {
    const entry = baseEntry({ term: 'a'.repeat(51) });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'term' 필드는 1자 이상 50자 이하"))).toBe(true);
  });

  it('term이 정확히 50자면 통과한다 (경계값)', () => {
    const entry = baseEntry({ term: 'a'.repeat(50) });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(true);
  });

  it('rationale이 500자를 초과하면 거부한다', () => {
    const entry = baseEntry({ rationale: 'a'.repeat(501) });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'rationale' 필드는 1자 이상 500자 이하"))).toBe(true);
  });

  it('rationale이 정확히 500자면 통과한다 (경계값)', () => {
    const entry = baseEntry({ rationale: 'a'.repeat(500) });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(true);
  });

  it('term이 빈 문자열이면 거부한다', () => {
    const entry = baseEntry({ term: '' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(false);
  });
});

// ── 중복 term 검증 ───────────────────────────────────────────────────────────

describe('validateRulePack() — 중복 term 거부', () => {
  it('동일한 term이 두 항목에 있으면 거부한다', () => {
    const entries = [baseEntry({ term: '귀하' }), baseEntry({ term: '귀하', approver: '김철수' })];
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('중복') && e.includes('귀하'))).toBe(true);
  });

  it('중복 오류 메시지에 중복된 항목들의 인덱스가 모두 포함된다', () => {
    const entries = [baseEntry({ term: '귀하' }), baseEntry({ term: '상이' }), baseEntry({ term: '귀하' })];
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('entries[0]') && e.includes('entries[2]'))).toBe(true);
  });

  it('서로 다른 term끼리는 중복으로 취급하지 않고 통과시킨다', () => {
    const entries = [baseEntry({ term: '귀하' }), baseEntry({ term: '상이' })];
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(true);
  });

  it('term이 유효하지 않은(문자열이 아닌) 항목끼리는 중복 검사에서 제외된다', () => {
    const entries = [baseEntry({ term: 123 }), baseEntry({ term: 123, approver: '김철수' })];
    const result = RulePackValidator.validateRulePack(json(basePack({ entries })));
    expect(result.valid).toBe(false);
    // 타입 오류만 있고, "중복" 오류는 발생하지 않아야 한다
    expect(result.errors.some((e) => e.includes('중복'))).toBe(false);
    expect(result.errors.filter((e) => e.includes("'term' 필드는 문자열"))).toHaveLength(2);
  });
});

// ── 날짜 필드 검증 ───────────────────────────────────────────────────────────

describe('validateRulePack() — 날짜 필드', () => {
  ['approvedDate', 'reviewDate'].forEach((field) => {
    it(`entries[0].${field} 필드가 없으면 거부한다`, () => {
      const entry = baseEntry();
      delete entry[field];
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`entries[0] '${field}' 필드가 없습니다`))).toBe(true);
    });

    it(`entries[0].${field} 형식이 YYYY-MM-DD가 아니면 거부한다`, () => {
      const entry = baseEntry({ [field]: '2026/01/01' });
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`entries[0] '${field}' 필드는 YYYY-MM-DD`))).toBe(true);
    });

    it(`entries[0].${field}가 실제로 존재하지 않는 날짜면 거부한다`, () => {
      const entry = baseEntry({ [field]: '2026-02-30' });
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`entries[0] '${field}' 필드는 YYYY-MM-DD`))).toBe(true);
    });

    it(`entries[0].${field}가 숫자면 거부한다`, () => {
      const entry = baseEntry({ [field]: 20260101 });
      const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
      expect(result.valid).toBe(false);
    });
  });

  it('reviewDate가 approvedDate보다 이전이면 거부한다', () => {
    const entry = baseEntry({ approvedDate: '2026-06-01', reviewDate: '2026-01-01' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'reviewDate'는 'approvedDate'보다 이전일 수 없습니다"))).toBe(true);
  });

  it('reviewDate가 approvedDate보다 이후면 통과한다', () => {
    const entry = baseEntry({ approvedDate: '2026-01-01', reviewDate: '2026-06-01' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(true);
  });

  it('날짜 형식이 이미 잘못된 경우 순서 비교는 건너뛴다 (중복 오류 방지)', () => {
    const entry = baseEntry({ approvedDate: '이상한값', reviewDate: '2026-01-01' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('이전일 수 없습니다'))).toBe(false);
  });
});

// ── 코드 실행 금지 / 프로토타입 오염 방지 ────────────────────────────────────

describe('validateRulePack() — 임의 코드 실행 금지 및 데이터 취급 보장', () => {
  it('term에 "__proto__" 문자열을 넣어도 데이터로만 취급되고 프로토타입을 오염시키지 않는다', () => {
    const entry = baseEntry({ term: '__proto__' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));

    expect(result.valid).toBe(true);
    expect(result.data.entries[0].term).toBe('__proto__');
    // Object.prototype이 오염되지 않았는지 확인
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('rationale에 함수처럼 보이는 문자열을 넣어도 실행되지 않고 문자열로만 반환된다', () => {
    const maliciousString = "(() => { globalThis.__rulepack_test_flag__ = true; })()";
    const entry = baseEntry({ rationale: maliciousString });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));

    expect(result.valid).toBe(true);
    expect(result.data.entries[0].rationale).toBe(maliciousString);
    expect(globalThis.__rulepack_test_flag__).toBeUndefined();
  });

  it('approver에 <script> 태그 문자열을 넣어도 데이터로만 반환된다', () => {
    const entry = baseEntry({ approver: '<script>alert(1)</script>' });
    const result = RulePackValidator.validateRulePack(json(basePack({ entries: [entry] })));

    expect(result.valid).toBe(true);
    expect(result.data.entries[0].approver).toBe('<script>alert(1)</script>');
  });

  it('JSON.parse가 실패하는 입력(코드 형태 문자열)은 실행 시도 없이 오류로 거부된다', () => {
    const codeAsInput = 'globalThis.__rulepack_test_flag_2__ = true;';
    const result = RulePackValidator.validateRulePack(codeAsInput);

    expect(result.valid).toBe(false);
    expect(globalThis.__rulepack_test_flag_2__).toBeUndefined();
  });
});
