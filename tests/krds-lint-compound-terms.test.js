/**
 * krds-lint.js — 일상어+괄호 병기 허용 · 고유 용어 예외 · 오탐 보정 테스트
 * 각 항목은 '허용되는 경우는 이슈 없음' 과 '허용되지 않는 인접 경우는 여전히 이슈' 를 쌍으로 검증한다.
 *   (1) english-only-label : JSON, '사례 번호 체계' 문맥의 CASE
 *   (2) admin-jargon       : 일상어 바로 뒤 괄호 안 병기 (principles.md:4463, A.4)
 *   (3) admin-jargon       : 고유 용어 예외(육아휴직 급여, 이슈 아카이브) + 허용 목록 스냅샷
 *   (4) error-no-action    : 문장 경계를 넘는 행동 표현 면제 + 최악 입력 성능
 * Framework: vitest
 */
import { describe, it, expect } from 'vitest';
import KRDSLint from '../krds-lint.js';

const OPTS = { checkAdminJargon: true, checkPatterns: true };
const issuesOf = (text, type) => KRDSLint.lint(text, OPTS).issues.filter((i) => i.type === type);
const jargonOf = (text, word) => issuesOf(text, 'admin-jargon').filter((i) => i.match === word);

// ── (1) english-only-label ───────────────────────────────────────────────────

describe('english-only-label — JSON · 사례 번호 체계 CASE 예외', () => {
  it('JSON 은 데이터 형식 이름이라 지적하지 않는다', () => {
    expect(issuesOf('raw markdown·JSON, 기관별 원문을 확인합니다.', 'english-only-label')).toHaveLength(0);
  });

  it('JSON 을 포함한 더 긴 영문 대문자 단어(JSONL)는 여전히 지적한다', () => {
    const issues = issuesOf('JSONL 파일을 내려받습니다.', 'english-only-label');
    expect(issues).toHaveLength(1);
    expect(issues[0].match).toBe('JSONL');
  });

  it.each([
    ['CASE 묶음부터 대조합니다.'],
    ['CASE 번호를 확인합니다.'],
    ['CASE 시작점을 정합니다.'],
    ['CASE 12 를 참고합니다.'],
    ['CASE1 을 참고합니다.'],
  ])('사례 번호 체계 문맥의 CASE 는 지적하지 않는다: %s', (text) => {
    expect(issuesOf(text, 'english-only-label')).toHaveLength(0);
  });

  it.each([
    ['CASE입니다.', 'CASE'],
    ['CASE 안내를 확인합니다.', 'CASE'],
    ['SHOWCASE 1 을 확인합니다.', 'SHOWCASE'],
    ['COMING SOON', 'COMING SOON'],
    ['COMING SOON 서비스입니다.', 'COMING SOON'],
  ])('사례 번호 문맥이 아닌 영문 레이블은 여전히 지적한다: %s', (text, expected) => {
    const issues = issuesOf(text, 'english-only-label');
    expect(issues).toHaveLength(1);
    expect(issues[0].match).toBe(expected);
  });
});

// ── (2) 괄호 병기 허용 ───────────────────────────────────────────────────────

describe('admin-jargon — 일상어 바로 뒤 괄호 안 병기 허용', () => {
  it('"추가 세금(가산세)" — 일상어 바로 뒤 괄호 안의 금지어는 지적하지 않는다', () => {
    expect(jargonOf('지금 신고하면 추가 세금(가산세)이 붙습니다.', '가산세')).toHaveLength(0);
  });

  it('"세금 상담 전화(국세상담센터 126)" — 괄호 안 금지어 뒤 번호가 있어도 허용한다', () => {
    expect(jargonOf('세금 상담 전화(국세상담센터 126)로 문의하세요.', '국세상담센터')).toHaveLength(0);
  });

  it('일상어와 괄호 사이에 공백이 있어도 허용한다', () => {
    expect(jargonOf('추가 세금 (가산세)이 붙습니다.', '가산세')).toHaveLength(0);
  });

  it('괄호 밖 단독 사용은 여전히 지적한다', () => {
    expect(jargonOf('신고기한이 지났습니다. 가산세가 부과됩니다.', '가산세')).toHaveLength(1);
  });

  it('줄 첫머리·태그 뒤의 괄호(앞이 한글이 아님)는 병기로 보지 않는다', () => {
    expect(jargonOf('(가산세)가 부과됩니다.', '가산세')).toHaveLength(1);
    expect(jargonOf('<li>(가산세)가 부과됩니다.</li>', '가산세')).toHaveLength(1);
    expect(jargonOf('2024(가산세)가 부과됩니다.', '가산세')).toHaveLength(1);
  });

  it('금지어가 일상어 쪽이고 괄호 안이 설명인 순서(가산세(추가 세금))는 여전히 지적한다', () => {
    expect(jargonOf('가산세(추가 세금)가 붙습니다.', '가산세')).toHaveLength(1);
  });

  it('괄호 안에 금지어 외 다른 내용이 이어지는 경우는 병기로 보지 않는다', () => {
    expect(jargonOf('안내(가산세가 부과되는 경우)입니다.', '가산세')).toHaveLength(1);
    expect(jargonOf('안내(가산세, 중가산세)입니다.', '가산세')).toHaveLength(2);
  });

  it('닫는 괄호가 없으면 병기로 보지 않는다', () => {
    expect(jargonOf('추가 세금(가산세가 붙습니다.', '가산세')).toHaveLength(1);
  });

  it('병기로 면제된 긴 금지어 안의 더 짧은 금지어가 대신 지적되지 않는다 (새 이슈 방지)', () => {
    const text = '급여에서 공제된 세금 확인서 (원천징수영수증)';
    expect(jargonOf(text, '원천징수영수증')).toHaveLength(0);
    expect(jargonOf(text, '원천징수')).toHaveLength(0);
  });

  it('같은 긴 금지어가 괄호 밖 단독이면 긴 금지어 하나만 지적한다', () => {
    const text = '원천징수영수증을 발급합니다.';
    expect(jargonOf(text, '원천징수영수증')).toHaveLength(1);
    expect(jargonOf(text, '원천징수')).toHaveLength(0);
  });

  it('줄 어디서든 같은 금지어의 괄호 안 병기와 괄호 밖 단독 사용이 섞이면 단독 사용만 지적한다', () => {
    const issues = jargonOf('추가 세금(가산세)이 붙고, 가산세 안내도 있습니다.', '가산세');
    expect(issues).toHaveLength(1);
    expect(issues[0].col).toBeGreaterThan(11);
  });
});

// ── (3) 고유 용어 예외 ───────────────────────────────────────────────────────

describe('admin-jargon — 고유 용어 예외 (육아휴직 급여, 이슈 아카이브)', () => {
  it('"육아휴직 급여" 구간 안의 "급여" 는 지적하지 않는다', () => {
    expect(jargonOf('육아휴직 급여 신청하기', '급여')).toHaveLength(0);
  });

  it('같은 줄의 다른 위치 "급여" 단독 사용은 여전히 지적한다', () => {
    const issues = jargonOf('육아휴직 급여 신청 후 급여가 입금됩니다.', '급여');
    expect(issues).toHaveLength(1);
    expect(issues[0].col).toBe(14); // 두 번째 "급여" 의 위치(1부터 셈)
  });

  it('"급여" 단독 · 다른 합성어 안의 "급여" 는 여전히 지적한다', () => {
    expect(jargonOf('급여 신청하기', '급여')).toHaveLength(1);
    expect(jargonOf('출산 급여 신청하기', '급여')).toHaveLength(1);
  });

  it('"이슈 아카이브" 구간 안의 "아카이브" 는 지적하지 않는다', () => {
    expect(jargonOf('<div class="arc-entry-label">이슈 아카이브</div>', '아카이브')).toHaveLength(0);
  });

  it('"아카이브" 단독 · 다른 위치 사용은 여전히 지적한다', () => {
    expect(jargonOf('아카이브 보기 →', '아카이브')).toHaveLength(1);
    expect(jargonOf('정부24 전체 이슈 294개 아카이브 보기', '아카이브')).toHaveLength(1);
    expect(jargonOf('이슈 아카이브와 아카이브 보기', '아카이브')).toHaveLength(1);
  });
});

describe('admin-jargon 고유 용어 예외 허용 목록 스냅샷', () => {
  // 새 예외 항목은 이 스냅샷을 고쳐야 추가할 수 있다 — 어느 용어가 '고유 용어'인지는
  // 콘텐츠 오너가 확인해야 하므로, 스냅샷을 고치는 PR 은 근거(reason)를 함께 리뷰받는다.
  // (린트 무시 속성 사용처 스냅샷과 같은 발상. 형식: '<고유 용어> => <지적 제외 대상>')
  const ALLOWED_EXCEPTIONS = [
    '육아휴직 급여 => 급여',
    '이슈 아카이브 => 아카이브',
  ];

  it('COMPOUND_TERM_EXCEPTIONS 가 허용 스냅샷과 같다', () => {
    const list = KRDSLint.COMPOUND_TERM_EXCEPTIONS;
    expect(Array.isArray(list)).toBe(true);
    expect(list.map((e) => e.term + ' => ' + e.banned)).toEqual(ALLOWED_EXCEPTIONS);
  });

  it('각 항목은 근거(reason)·사용처(usage)를 갖고, 고유 용어가 지적 제외 대상을 포함하며, 대상은 사전 금지어다', () => {
    KRDSLint.COMPOUND_TERM_EXCEPTIONS.forEach((e) => {
      expect(typeof e.reason).toBe('string');
      expect(e.reason.length).toBeGreaterThan(10);
      expect(typeof e.usage).toBe('string');
      expect(e.usage.length).toBeGreaterThan(3);
      expect(e.term.includes(e.banned)).toBe(true);
      expect(KRDSLint.ADMIN_JARGON.some((j) => j.banned === e.banned)).toBe(true);
    });
  });

  it('목록은 동결되어 런타임에 항목을 추가할 수 없다', () => {
    expect(Object.isFrozen(KRDSLint.COMPOUND_TERM_EXCEPTIONS)).toBe(true);
  });
});

// ── (4) error-no-action ──────────────────────────────────────────────────────

describe('error-no-action — 문장 경계를 넘는 행동 표현 면제', () => {
  const GOOD =
    '공동인증서 확인이 완료되지 않았습니다.<br>인증서 유효기간이 지났거나 비밀번호가 틀렸을 수 있습니다.<br><strong>[간편인증으로 다시 시도하기]</strong>';

  it('마침표가 두 번 이상 지난 뒤 같은 줄 버튼 라벨에 행동이 있으면 이슈 없음 (index.html After)', () => {
    expect(issuesOf(GOOD, 'error-no-action')).toHaveLength(0);
  });

  it.each([
    ['시도하', '오류가 발생했습니다. 원인은 알 수 없습니다. 잠시 뒤 시도하면 됩니다.'],
    ['다시 시도', '오류가 발생했습니다. 원인은 알 수 없습니다. [다시 시도]'],
    ['재시도', '오류가 발생했습니다. 원인은 알 수 없습니다. [재시도]'],
    ['하기]', '오류가 발생했습니다. 원인은 알 수 없습니다. [처음으로 이동하기]'],
  ])('보강한 행동 표현 "%s" 이 같은 줄 뒤에 있으면 면제한다', (_label, text) => {
    expect(issuesOf(text, 'error-no-action')).toHaveLength(0);
  });

  it('행동 표현이 160자 이내(문장 경계 포함)면 면제한다', () => {
    const filler = '가'.repeat(60);
    const text = '오류가 발생했습니다. ' + filler + '입니다. ' + filler + '입니다. 다시 시도해 주세요.';
    expect(issuesOf(text, 'error-no-action')).toHaveLength(0);
  });

  it('행동 표현이 160자를 넘어 떨어져 있으면 여전히 지적한다', () => {
    const filler = '가'.repeat(100);
    const text = '오류가 발생했습니다. ' + filler + '입니다. ' + filler + '입니다. 다시 시도해 주세요.';
    expect(issuesOf(text, 'error-no-action')).toHaveLength(1);
  });

  it('행동 표현이 다음 줄에 있으면(같은 줄이 아니면) 여전히 지적한다', () => {
    expect(issuesOf('오류가 발생했습니다.\n다시 시도해 주세요.', 'error-no-action')).toHaveLength(1);
  });

  it('행동 표현이 전혀 없는 진짜 위반은 여전히 지적한다', () => {
    expect(issuesOf('오류가 발생했습니다.', 'error-no-action')).toHaveLength(1);
    expect(issuesOf('파일 업로드에 실패했습니다.', 'error-no-action')).toHaveLength(1);
    expect(issuesOf('오류가 발생했습니다. 원인은 알 수 없습니다. 담당 부서 정보는 아래와 같습니다.', 'error-no-action')).toHaveLength(1);
  });

  it('행동 없는 Before 문구는 여전히 지적한다 (index.html Before)', () => {
    const before = '<p class="ba-text">공동인증서 확인이 완료되지 않았습니다.</p>';
    expect(issuesOf(before, 'error-no-action')).toHaveLength(1);
  });
});

describe('error-no-action — 최악 입력 성능 (PR #2 수준 유지: 4만자 1초 미만)', () => {
  const rep = (s, n) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  const timed = (text) => {
    const t0 = Date.now();
    const result = KRDSLint.lint(text, OPTS);
    return { ms: Date.now() - t0, result };
  };

  it.each([
    ['공백 없는 한글 4만자', rep('가나다라마바사아자차카타파하', 40000)],
    ['마침표가 많은 4만자', rep('가나다. ', 40000)],
    ['마침표만 4만개', '.'.repeat(40000)],
    ['"오류입니다." 반복 4만자', rep('오류입니다.', 40000)],
    ['"오류" 키워드만 반복(마침표 없음) 4만자', rep('오류', 40000)],
    ['"오류가 있습니다 " 반복(마침표 없음) 4만자', rep('오류가 있습니다 ', 40000)],
    ['오류 문장 뒤 행동 없는 필러 반복 4만자', rep('오류입니다.' + '가나'.repeat(158), 40000)],
    ['"완료되지 않았다 " 반복 4만자', rep('완료되지 않았다 ', 40000)],
  ])('%s 을 1초 안에 처리한다', (_label, text) => {
    expect(text.length).toBe(40000);
    expect(timed(text).ms).toBeLessThan(1000);
  });
});
