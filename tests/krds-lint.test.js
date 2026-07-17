/**
 * krds-lint.js unit tests
 * Framework: vitest
 * Run: npm test
 */
import { describe, it, expect } from 'vitest';
import KRDSLint from '../krds-lint.js';
import vm from 'vm';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ── ADMIN JARGON ─────────────────────────────────────────────────────────────

describe('lint() — admin jargon detection', () => {
  it('detects banned jargon "귀하" and returns error severity', () => {
    const result = KRDSLint.lint('귀하의 신청이 접수되었습니다.');
    const issue = result.issues.find(i => i.match === '귀하');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.type).toBe('admin-jargon');
  });

  it('detects "명일까지 제출" and suggests "내일까지 제출"', () => {
    // jargon-dictionary.json stores the full phrase "명일까지 제출"
    const result = KRDSLint.lint('명일까지 제출해 주세요.');
    const issue = result.issues.find(i => i.match === '명일까지 제출');
    expect(issue).toBeDefined();
    expect(issue.suggestion).toContain('내일까지');
  });

  it('detects placeholder-based jargon entries without requiring a literal "~"', () => {
    const result = KRDSLint.lint('문의하여 주시기 바랍니다.');
    const issue = result.issues.find(i => i.match === '문의하여 주시기 바랍니다');
    expect(issue).toBeDefined();
    expect(issue.suggestion).toContain('문의해 주세요');
    expect(issue.suggestion).not.toContain('~');
  });

  it('detects generic placeholder suffixes from the dictionary in real sentences', () => {
    const result = KRDSLint.lint('납부하여야 합니다.');
    const issue = result.issues.find(i => i.match === '하여야 합니다');
    expect(issue).toBeDefined();
    expect(issue.suggestion).toContain('해야 합니다');
    expect(issue.suggestion).not.toContain('~');
  });

  it('does not report false positive on clean text', () => {
    const result = KRDSLint.lint('내일까지 서류를 제출해 주세요.');
    expect(result.issues.filter(i => i.type === 'admin-jargon')).toHaveLength(0);
  });

  it('detects "죄송합니다" in error messages', () => {
    const result = KRDSLint.lint('죄송합니다. 오류가 발생했습니다.');
    const issue = result.issues.find(i => i.match === '죄송합니다');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });

  it('skips jargon check when checkAdminJargon: false', () => {
    const result = KRDSLint.lint('귀하의 신청이 접수되었습니다.', { checkAdminJargon: false });
    expect(result.issues.filter(i => i.type === 'admin-jargon')).toHaveLength(0);
  });

  it('deduplicates repeated jargon at same position', () => {
    // same banned term twice shouldn't produce duplicate issues at same line:col
    const result = KRDSLint.lint('귀하 귀하');
    const issues = result.issues.filter(i => i.match === '귀하');
    // Should find 2 (different columns), not duplicated
    const cols = issues.map(i => i.col);
    const uniqueCols = [...new Set(cols)];
    expect(uniqueCols).toHaveLength(cols.length);
  });

  it('prefers the longer specific jargon entry when it overlaps a generic suffix pattern', () => {
    const result = KRDSLint.lint('제출하시기 바랍니다.');
    const adminIssues = result.issues.filter(i => i.type === 'admin-jargon');
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0].match).toBe('제출하시기 바랍니다');
    expect(adminIssues[0].suggestion).toContain('제출하세요');
  });

  it('detects newly promoted consent-screen jargon from public-service sites', () => {
    const result = KRDSLint.lint('실명확인 후 자료제공동의를 완료해 주세요.');
    const identityIssue = result.issues.find(i => i.match === '실명확인');
    const consentIssue = result.issues.find(i => i.match === '자료제공동의');

    expect(identityIssue).toBeDefined();
    expect(identityIssue.suggestion).toContain('본인 확인');
    expect(consentIssue).toBeDefined();
    expect(consentIssue.suggestion).toContain('자료 제공 동의');
  });

  it('detects newly promoted tax, pension, and court jargon from public-service flows', () => {
    const text = '간주임대료와 예정 고지, 임의가입, 추납, 인지대, 송달료, 강제집행 기준을 확인하세요.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '간주임대료')?.suggestion).toContain('보증금을 이자로 계산한 임대수입');
    expect(result.issues.find(i => i.match === '예정 고지')?.suggestion).toContain('미리 청구');
    expect(result.issues.find(i => i.match === '임의가입')?.suggestion).toContain('원하면 직접 가입');
    expect(result.issues.find(i => i.match === '추납')?.suggestion).toContain('못 낸 기간 보험료');
    expect(result.issues.find(i => i.match === '인지대')?.suggestion).toContain('법원에 내는 수수료');
    expect(result.issues.find(i => i.match === '송달료')?.suggestion).toContain('서류를 보내는 우편 비용');
    expect(result.issues.find(i => i.match === '강제집행')?.suggestion).toContain('강제로 받는 절차');
  });

  it('detects newly promoted accessibility-label jargon from public-service controls', () => {
    const text = '서비스 상세 이동, 1번째 배너, AI 켜기, 새창';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '서비스 상세 이동')?.suggestion).toContain('서비스 이름 + 자세히 보기');
    expect(result.issues.find(i => i.match === '1번째 배너')?.suggestion).toContain('배너 제목 + 보기');
    expect(result.issues.find(i => i.match === 'AI 켜기')?.suggestion).toContain('AI 검색');
    expect(result.issues.find(i => i.match === '새창')?.suggestion).toContain('새 탭에서 열림');
  });

  it('detects newly promoted certificate and disclosure-scope jargon from public-service choices', () => {
    const text = '주민등록등본, 상세증명서, 납세증명서 (금융거래용), 개인정보 제공 범위 선택, 말소 사항 포함, 세무정보 열람권한 부여';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '주민등록등본')?.suggestion).toContain('가족 전체 주민등록증명서');
    expect(result.issues.find(i => i.match === '상세증명서')?.suggestion).toContain('상세 가족관계증명서');
    expect(result.issues.find(i => i.match === '납세증명서 (금융거래용)')?.suggestion).toContain('은행·대출 제출');
    expect(result.issues.find(i => i.match === '개인정보 제공 범위 선택')?.suggestion).toContain('주민번호 뒷자리는 제외');
    expect(result.issues.find(i => i.match === '말소 사항 포함')?.suggestion).toContain('현재 유효만');
    expect(result.issues.find(i => i.match === '세무정보 열람권한 부여')?.suggestion).toContain('마이페이지에서 해제');
  });

  it('detects newly promoted upload-constraint jargon from public-service forms', () => {
    const text = '파일을 첨부하세요. 증빙서류 파일 첨부. PDF 형식만 가능';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '파일을 첨부하세요')?.suggestion).toContain('허용 형식');
    expect(result.issues.find(i => i.match === '증빙서류 파일 첨부')?.suggestion).toContain('판독 불가 시 재제출');
    expect(result.issues.find(i => i.match === 'PDF 형식만 가능')?.suggestion).toContain('HWP는 PDF 변환 후 제출');
  });

  it('detects newly promoted electronic-issuance jargon from public-service certificate flows', () => {
    const text = '문서확인번호, 전자 발급본도 출력 시 원본과 동일 효력, 전자 발급본이 공문서와 동일한 효력';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '문서확인번호')?.suggestion).toContain('진위 확인용 문서 번호');
    expect(result.issues.find(i => i.match === '전자 발급본도 출력 시 원본과 동일 효력')?.suggestion).toContain('공공 마이데이터 제출');
    expect(result.issues.find(i => i.match === '전자 발급본이 공문서와 동일한 효력')?.suggestion).toContain('증명서 진위 확인');
  });

  it('detects newly promoted issuance-restriction jargon from public-service certificate flows', () => {
    const text = '온라인은 대리인 신청 불가. 발급일 현재 징수유예액 또는 체납처분유예액을 제외하고는 다른 국세를 체납한 사실이 없음을 증명. 집행문 부여 신청.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '온라인은 대리인 신청 불가')?.suggestion).toContain('본인만 신청할 수 있습니다');
    expect(result.issues.find(i => i.match === '발급일 현재 징수유예액 또는 체납처분유예액을 제외하고는 다른 국세를 체납한 사실이 없음을 증명')?.suggestion).toContain('미납한 국세');
    expect(result.issues.find(i => i.match === '집행문 부여 신청')?.suggestion).toContain('제1심법원');
  });

  it('detects newly promoted correction-result jargon from public-service follow-up flows', () => {
    const text = '판독 불가. 신고 불수리 통지 조회.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '판독 불가')?.suggestion).toContain('재제출 바로 가기');
    expect(result.issues.find(i => i.match === '신고 불수리 통지 조회')?.suggestion).toContain('신고 반려 통지 확인');
  });

  it('detects newly promoted alert-channel jargon from public-service notification settings', () => {
    const text = '전자고지(송달) 신청 및 해지';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '전자고지(송달) 신청 및 해지')?.suggestion).toContain('우편으로 다시 받기');
  });

  it('detects newly promoted split-task jargon from public-service multi-action menus', () => {
    const text = '지급명세서 제출·수정·삭제 현금영수증 발급·취소·수정 국선대리인 신청(불복청구서 제출전)/(제출후) 전자(세금)계산서';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '지급명세서 제출·수정·삭제')?.suggestion).toContain('제출 내역 수정');
    expect(result.issues.find(i => i.match === '현금영수증 발급·취소·수정')?.suggestion).toContain('발급 정보 수정');
    expect(result.issues.find(i => i.match === '국선대리인 신청(불복청구서 제출전)/(제출후)')?.suggestion).toContain('[불복청구서 제출 전] [제출 후]');
    expect(result.issues.find(i => i.match === '전자(세금)계산서')?.suggestion).toContain('세금계산서 / 계산서');
  });

  it('detects newly promoted notation QA jargon from public-service table headers', () => {
    const text = '신청자격 구비서류 발급서류 처리기간 처리기관 답변예정일 등록일';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '신청자격')?.suggestion).toContain('신청할 수 있는 사람');
    expect(result.issues.find(i => i.match === '구비서류')?.suggestion).toContain('준비할 서류');
    expect(result.issues.find(i => i.match === '발급서류')?.suggestion).toContain('발급되는 서류');
    expect(result.issues.find(i => i.match === '처리기간')?.suggestion).toContain('처리까지 걸리는 시간');
    expect(result.issues.find(i => i.match === '처리기관')?.suggestion).toContain('담당 기관');
    expect(result.issues.find(i => i.match === '답변예정일')?.suggestion).toContain('답변 예정일');
    expect(result.issues.find(i => i.match === '등록일')?.suggestion).toContain('접수한 날');
  });

  it('detects newly promoted notation QA jargon from compact navigation labels', () => {
    const text = '전자증명서안내 부가가치세예정신고 증명서발급';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '전자증명서안내')?.suggestion).toContain('전자증명서 안내');
    expect(result.issues.find(i => i.match === '부가가치세예정신고')?.suggestion).toContain('부가가치세 예정 신고');
    expect(result.issues.find(i => i.match === '증명서발급')?.suggestion).toContain('증명서 발급');
  });

  it('detects newly promoted eligibility-entry jargon from public-service qualification screens', () => {
    const text = '세대주 변경 신고. 사업장 현황 신고. 개명 허가 신청.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '세대주 변경 신고')?.suggestion).toContain('기존 세대주의 동의 필요');
    expect(result.issues.find(i => i.match === '사업장 현황 신고')?.suggestion).toContain('면세 사업자 신고');
    expect(result.issues.find(i => i.match === '개명 허가 신청')?.suggestion).toContain('불복 방법');
  });

  it('detects newly promoted navigation-label jargon from compact court menus', () => {
    const text = '가족관계등록부정정 허가';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '가족관계등록부정정 허가')?.suggestion).toContain('가족관계 기록 정정 허가');
  });

  it('detects newly promoted applicant-type jargon from public-service entry screens', () => {
    const text = '건강보험 피부양자 등록 신청. 연말정산 간소화. 소송 기록 열람·복사 신청.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '건강보험 피부양자 등록 신청')?.suggestion).toContain('가족관계증명서 + 소득 확인서');
    expect(result.issues.find(i => i.match === '연말정산 간소화')?.suggestion).toContain('부양가족 자료는 온라인 동의');
    expect(result.issues.find(i => i.match === '소송 기록 열람·복사 신청')?.suggestion).toContain('제3자는 법원 방문 신청');
  });

  it('detects newly promoted conditional-required jargon from public-service forms', () => {
    const text = '외국인등록번호 *\n영세율 신고';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '외국인등록번호 *')?.suggestion).toContain('해당자만 필수');
    expect(result.issues.find(i => i.match === '영세율 신고')?.suggestion).toContain('해당 거래만 필수');
  });

  it('detects newly promoted proxy-and-review jargon from delegated or high-friction flows', () => {
    const text = '병적증명서 발급. 세무대리인 수임 동의. 소송 대리인 등록. 협의이혼 의사확인 신청.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '병적증명서 발급')?.suggestion).toContain('위임장 지참 대리인');
    expect(result.issues.find(i => i.match === '세무대리인 수임 동의')?.suggestion).toContain('세금 업무 맡기기 동의');
    expect(result.issues.find(i => i.match === '소송 대리인 등록')?.suggestion).toContain('제한 위임·해임 신고 안내');
    expect(result.issues.find(i => i.match === '협의이혼 의사확인 신청')?.suggestion).toContain('숙려기간 뒤 확인기일 출석');
  });

  it('detects newly promoted completion-screen jargon from public-service result screens', () => {
    const text = '민원이 접수되었습니다. 귀하의 종합소득세 신고서가 접수되었습니다. 신고서가 정상적으로 접수되었습니다.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '민원이 접수되었습니다')?.suggestion).toContain('나의 민원 확인하기');
    expect(result.issues.find(i => i.match === '귀하의 종합소득세 신고서가 접수되었습니다')?.suggestion).toContain('지금 납부하기');
    expect(result.issues.find(i => i.match === '신고서가 정상적으로 접수되었습니다')?.suggestion).toContain('처리 현황 조회');
  });

  it('detects newly promoted wait-state jargon from public-service refund status screens', () => {
    const text = '환급금: 120,000원\n환급금: 30만원';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '환급금: 120,000원')?.suggestion).toContain('예상 입금일 확인');
    expect(result.issues.find(i => i.match === '환급금: 120,000원')?.suggestion).toContain('계좌 등록하기');
    expect(result.issues.find(i => i.match === '환급금: 30만원')?.suggestion).toContain('지연 사유 조회');
  });

  it('detects newly promoted session-termination jargon from public-service timeout flows', () => {
    const text = '개인정보 보호를 위해 로그인 후 약 0분 동안 서비스 이용이 없어 자동 로그아웃 됩니다. 세션이 만료되었습니다. 처음부터 다시 시작하세요. 로그아웃 되었습니다.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '개인정보 보호를 위해 로그인 후 약 0분 동안 서비스 이용이 없어 자동 로그아웃 됩니다.')?.suggestion).toContain('임시 저장됩니다');
    expect(result.issues.find(i => i.match === '세션이 만료되었습니다. 처음부터 다시 시작하세요.')?.suggestion).toContain('다시 로그인하면 이어서 작성');
    expect(result.issues.find(i => i.match === '로그아웃 되었습니다.')?.suggestion).toContain('메인으로 가기');
  });

  it('detects newly promoted service-unavailable jargon from public-service outage flows', () => {
    const text = '서비스 이용이 일시적으로 중단되었습니다. 지방세 연계 납부';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '서비스 이용이 일시적으로 중단되었습니다.')?.suggestion).toContain('다시 열리는 시각');
    expect(result.issues.find(i => i.match === '지방세 연계 납부')?.suggestion).toContain('위택스에서 별도 신고·납부');
  });

  it('detects newly promoted emergency-link and parallel-procedure jargon from public-service flows', () => {
    const text = '친권 상실 청구 소상공인 정책자금 신청 부재자 재산 관리인 선임 청구';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '친권 상실 청구')?.suggestion).toContain('112 또는 1577-1391로 먼저 연락');
    expect(result.issues.find(i => i.match === '소상공인 정책자금 신청')?.suggestion).toContain('보증서 필요 여부 먼저 확인');
    expect(result.issues.find(i => i.match === '부재자 재산 관리인 선임 청구')?.suggestion).toContain('가압류·가처분 병행');
  });

  it('detects newly promoted environment-guidance jargon from public-service device notices', () => {
    const text = '정부24 앱으로 더 편리하게 이용하세요. 해당 서비스는 PC 홈택스에서만 이용하실 수 있습니다 증명서발급과 인터넷신고는 PC를 이용하여 주시기 바랍니다.';
    const result = KRDSLint.lint(text);

    expect(result.issues.find(i => i.match === '정부24 앱으로 더 편리하게 이용하세요.')?.suggestion).toContain('앱 열기');
    expect(result.issues.find(i => i.match === '해당 서비스는 PC 홈택스에서만 이용하실 수 있습니다')?.suggestion).toContain('QR코드 보기');
    expect(result.issues.find(i => i.match === '증명서발급과 인터넷신고는 PC를 이용하여 주시기 바랍니다.')?.suggestion).toContain('PC에서 다시 접속');
  });

  it('uses the more descriptive replacement when duplicate dictionary entries share the same banned phrase', () => {
    const result = KRDSLint.lint('창설적 신분행위');
    const issue = result.issues.find(i => i.match === '창설적 신분행위');
    expect(issue).toBeDefined();
    expect(issue.category).toBe('전문 용어');
    expect(issue.suggestion).toContain('결혼, 입양 등');
  });
});

// ── PATTERN RULES ─────────────────────────────────────────────────────────────

describe('lint() — pattern rule detection', () => {
  it('detects "오류가 발생했습니다." as standalone-error-retry warning', () => {
    const result = KRDSLint.lint('오류가 발생했습니다.');
    const issue = result.issues.find(i => i.type === 'standalone-error-retry');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
  });

  it('detects "다시 시도해 주세요." as standalone-error-retry', () => {
    const result = KRDSLint.lint('다시 시도해 주세요.');
    const issue = result.issues.find(i => i.type === 'standalone-error-retry');
    expect(issue).toBeDefined();
  });

  it('detects "ERROR 404" as error-code-standalone error', () => {
    const result = KRDSLint.lint('ERROR 404가 발생했습니다.');
    const issue = result.issues.find(i => i.type === 'error-code-standalone');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });

  it('detects "※" as forbidden-char-note warning', () => {
    const result = KRDSLint.lint('※ 주의사항을 확인하세요.');
    const issue = result.issues.find(i => i.type === 'forbidden-char-note');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
  });

  it('detects common Korean double-negative templates like "하지 않으면 안 됩니다"', () => {
    const result = KRDSLint.lint('제출하지 않으면 안 됩니다.');
    const issue = result.issues.find(i => i.type === 'double-negative');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.match).toContain('않으면 안');
  });

  it('detects litotes-style double negatives like "없지 않습니다"', () => {
    const result = KRDSLint.lint('문제가 없지 않습니다.');
    const issue = result.issues.find(i => i.type === 'double-negative');
    expect(issue).toBeDefined();
    expect(issue.match).toBe('없지 않습니다');
  });

  it('does not confuse a single negative condition with a double negative', () => {
    const result = KRDSLint.lint('로그인하지 않으면 이용할 수 없습니다.');
    expect(result.issues.filter(i => i.type === 'double-negative')).toHaveLength(0);
  });

  it('skips pattern check when checkPatterns: false', () => {
    const result = KRDSLint.lint('오류가 발생했습니다.', { checkPatterns: false });
    expect(result.issues.filter(i => i.type === 'standalone-error-retry')).toHaveLength(0);
  });
});

// ── SCORE ─────────────────────────────────────────────────────────────────────

describe('computeScore() via lint()', () => {
  it('returns 100 for clean text with no issues', () => {
    const result = KRDSLint.lint('내일까지 서류를 제출해 주세요. 감사합니다.');
    expect(result.score).toBe(100);
  });

  it('returns score < 100 when issues are present', () => {
    const result = KRDSLint.lint('귀하의 신청서가 오류가 발생했습니다. 다시 시도해 주세요.');
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for score floor — never negative', () => {
    // Many issues on a single short word → should not go below 0
    const result = KRDSLint.lint('귀하');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('empty text returns score 100 with no issues', () => {
    const result = KRDSLint.lint('');
    expect(result.score).toBe(100);
    expect(result.summary.total).toBe(0);
  });
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────

describe('lint() summary counts', () => {
  it('counts errors, warnings, infos separately', () => {
    // Error: 귀하 (admin-jargon)
    // Warning: ※ (forbidden-char-note)
    const result = KRDSLint.lint('귀하의 신청 ※ 주의사항');
    expect(result.summary.errors).toBeGreaterThanOrEqual(1);
    expect(result.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(result.summary.total).toBe(result.summary.errors + result.summary.warnings + result.summary.infos);
  });

  it('issues are sorted by line then col', () => {
    const result = KRDSLint.lint('귀하\n명일까지');
    const lines = result.issues.map(i => i.line);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]);
    }
  });

  it('issues on the same line are sorted by col (a.col - b.col sort branch)', () => {
    const result = KRDSLint.lint('귀하 귀하');
    const sameLineIssues = result.issues.filter(i => i.line === 1);
    expect(sameLineIssues.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < sameLineIssues.length; i++) {
      expect(sameLineIssues[i].col).toBeGreaterThanOrEqual(sameLineIssues[i - 1].col);
    }
  });
});

// ── MULTILINE ────────────────────────────────────────────────────────────────

describe('lint() multiline input', () => {
  it('correctly identifies line numbers for multiline text', () => {
    const text = '안녕하세요.\n귀하의 신청이 접수되었습니다.\n감사합니다.';
    const result = KRDSLint.lint(text);
    const issue = result.issues.find(i => i.match === '귀하');
    expect(issue).toBeDefined();
    expect(issue.line).toBe(2);
  });

  it('handles text with only whitespace as no-issue', () => {
    const result = KRDSLint.lint('   \n  \n  ');
    expect(result.summary.total).toBe(0);
  });

  it('treats nullish input as empty text instead of throwing', () => {
    expect(() => KRDSLint.lint(null)).not.toThrow();
    expect(() => KRDSLint.lint(undefined)).not.toThrow();
    expect(KRDSLint.lint(null)).toEqual(KRDSLint.lint(''));
    expect(KRDSLint.lint(undefined)).toEqual(KRDSLint.lint(''));
  });

  it('coerces primitive non-string input to text instead of throwing', () => {
    expect(() => KRDSLint.lint(404)).not.toThrow();
    expect(() => KRDSLint.lint(false)).not.toThrow();
    expect(KRDSLint.lint(404)).toEqual(KRDSLint.lint('404'));
    expect(KRDSLint.lint(false)).toEqual(KRDSLint.lint('false'));
  });
});

// ── PATTERN RULES ────────────────────────────────────────────────────────────

describe('PATTERN_RULES detection', () => {
  it('detects double-passive expressions like "되어지다"', () => {
    const result = KRDSLint.lint('신청이 완료되어지다.');
    const issue = result.issues.find(i => i.type === 'double-passive');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.match).toBe('되어지다');
  });

  it('detects excessive-honorific expressions like "처리되시겠습니다"', () => {
    const result = KRDSLint.lint('서류가 처리되시겠습니다.');
    const issue = result.issues.find(i => i.type === 'excessive-honorific');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(issue.match).toContain('처리되시겠습니다');
  });

  it('detects subjective-adverb expressions like "빠르게"', () => {
    const result = KRDSLint.lint('빠르게 처리해 드립니다.');
    const issue = result.issues.find(i => i.type === 'subjective-adverb');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(issue.match).toBe('빠르게');
  });

  it('detects forbidden-char-excl when multiple exclamation marks appear', () => {
    const result = KRDSLint.lint('지금 신청하세요!!');
    const issue = result.issues.find(i => i.type === 'forbidden-char-excl');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.match).toBe('!!');
  });

  it('detects forbidden-char-tilde when a tilde is used in text', () => {
    const result = KRDSLint.lint('1~3일 소요됩니다.');
    const issue = result.issues.find(i => i.type === 'forbidden-char-tilde');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(issue.match).toBe('~');
  });

  it('detects forbidden-char-mandatory when (필수) label appears in text', () => {
    const result = KRDSLint.lint('이름 (필수)');
    const issue = result.issues.find(i => i.type === 'forbidden-char-mandatory');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(issue.match).toBe('(필수)');
  });

  it('detects noun-chain when 14+ Korean characters precede a particle', () => {
    const result = KRDSLint.lint('공공기관정보시스템사용자인증절차가이드를 확인하세요.');
    const issue = result.issues.find(i => i.type === 'noun-chain');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('info');
  });

  it('does not flag a 13-char Korean sequence as a noun-chain', () => {
    const result = KRDSLint.lint('공공기관정보시스템사용자를 확인하세요.');
    const issue = result.issues.find(i => i.type === 'noun-chain');
    expect(issue).toBeUndefined();
  });
});

// ── PUBLIC API SHAPE ─────────────────────────────────────────────────────────

describe('KRDSLint public API', () => {
  it('exposes lint, formatCLI, ADMIN_JARGON, PATTERN_RULES, version', () => {
    expect(typeof KRDSLint.lint).toBe('function');
    expect(typeof KRDSLint.formatCLI).toBe('function');
    expect(Array.isArray(KRDSLint.ADMIN_JARGON)).toBe(true);
    expect(Array.isArray(KRDSLint.PATTERN_RULES)).toBe(true);
    expect(KRDSLint.version).toBe('1.0.0');
  });

  it('ADMIN_JARGON has at least 30 entries', () => {
    expect(KRDSLint.ADMIN_JARGON.length).toBeGreaterThanOrEqual(30);
  });

  it('each ADMIN_JARGON entry has banned, alt, cat fields', () => {
    KRDSLint.ADMIN_JARGON.forEach(entry => {
      expect(entry).toHaveProperty('banned');
      expect(entry).toHaveProperty('alt');
      expect(entry).toHaveProperty('cat');
    });
  });

  it('formatCLI returns a string with score information', () => {
    const result = KRDSLint.lint('귀하의 신청');
    const formatted = KRDSLint.formatCLI(result);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('품질 점수');
  });

  it('uses the bullet fallback icon when an issue has an unrecognized severity value', () => {
    const formatted = KRDSLint.formatCLI({
      issues: [{ line: 1, col: 1, severity: 'unknown-severity', category: '테스트', message: '테스트 메시지', suggestion: '→ 대안' }],
      summary: { total: 1, errors: 0, warnings: 0, infos: 1 },
      score: 90,
    });
    expect(formatted).toContain('•');
    expect(formatted).toContain('테스트 메시지');
  });

  it('uses the ℹ️ icon for info-severity issues in formatCLI output', () => {
    const result = KRDSLint.lint('사용자식별번호등록처리시스템이');
    const infoIssue = result.issues.find(i => i.severity === 'info');
    expect(infoIssue).toBeDefined();
    const formatted = KRDSLint.formatCLI(result);
    expect(formatted).toContain('ℹ️');
  });
});

describe('placeholderPattern branches via synthetic dictionary', () => {
  // Run the UMD factory in a VM browser-path to inject a custom jargonDict.
  // When `module` is absent from the sandbox, the IIFE takes the browser branch
  // and sets root.KRDSLint = factory(root.KRDS_JARGON_DICT).
  const LINT_SOURCE = fs.readFileSync(
    fileURLToPath(new URL('../krds-lint.js', import.meta.url)),
    'utf8',
  );

  function makeCustomLint(entries) {
    const root = { KRDS_JARGON_DICT: { entries } };
    vm.runInNewContext(LINT_SOURCE, root);
    return root.KRDSLint;
  }

  it('builds a date-range regex when the placeholder label contains "기간"', () => {
    const lint = makeCustomLint([
      { banned: '신청기간: [기간]', alt: '신청 기간을 명시하세요', cat: '행정 관습어' },
    ]);
    const result = lint.lint('신청기간: 2024.01~2024.03');
    const issue = result.issues.find(i => i.type === 'admin-jargon');
    expect(issue).toBeDefined();
    expect(issue.match).toMatch(/신청기간/);
  });

  it('builds a name/org regex when the placeholder label contains "기관"', () => {
    const lint = makeCustomLint([
      { banned: '담당기관: [기관]', alt: '담당 기관명을 명시하세요', cat: '행정 관습어' },
    ]);
    const result = lint.lint('담당기관: 행정안전부');
    const issue = result.issues.find(i => i.type === 'admin-jargon');
    expect(issue).toBeDefined();
    expect(issue.match).toMatch(/담당기관/);
  });

  it('uses the generic fallback pattern when the placeholder label is unrecognized', () => {
    const lint = makeCustomLint([
      { banned: '처리번호: [코드]', alt: '처리 번호를 명시하세요', cat: '행정 관습어' },
    ]);
    const result = lint.lint('처리번호: ABC-001');
    const issue = result.issues.find(i => i.type === 'admin-jargon');
    expect(issue).toBeDefined();
    expect(issue.match).toMatch(/처리번호/);
  });

  it('silently drops null entries in a custom dictionary without crashing', () => {
    const lint = makeCustomLint([
      null,
      { banned: '귀책사유', alt: '잘못, 책임', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀책사유');
    expect(result.issues.find(i => i.match === '귀책사유')).toBeDefined();
  });

  it('silently drops non-object entries (e.g. a string) in a custom dictionary', () => {
    const lint = makeCustomLint([
      '잘못된 엔트리',
      { banned: '귀하', alt: '고객님', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀하');
    expect(result.issues.find(i => i.match === '귀하')).toBeDefined();
  });

  it('silently drops entries whose banned phrase normalises to an empty string', () => {
    const lint = makeCustomLint([
      { banned: '', alt: '대안', cat: '행정 관습어' },
      { banned: '귀하', alt: '고객님', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀하');
    expect(result.issues.find(i => i.match === '귀하')).toBeDefined();
  });

  it('builds a monetary amount regex when the placeholder label contains "금액"', () => {
    const lint = makeCustomLint([
      { banned: '납부금액: [금액]', alt: '납부할 금액을 명시하세요', cat: '행정 관습어' },
    ]);
    const result = lint.lint('납부금액: 50,000원');
    const issue = result.issues.find(i => i.type === 'admin-jargon');
    expect(issue).toBeDefined();
    expect(issue.match).toMatch(/납부금액/);
  });

  it('deduplicates entries with the same banned phrase in a custom dictionary', () => {
    const lint = makeCustomLint([
      { banned: '귀하', alt: '고객님', cat: '행정 관습어' },
      { banned: '귀하', alt: '신청인', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀하');
    const issues = result.issues.filter(i => i.match === '귀하' && i.type === 'admin-jargon');
    expect(issues.length).toBe(1);
  });

  it('silently drops entries whose alt phrase is empty', () => {
    const lint = makeCustomLint([
      { banned: '귀하', alt: '', cat: '행정 관습어' },
      { banned: '잘못', alt: '오류', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀하 잘못');
    expect(result.issues.find(i => i.match === '귀하')).toBeUndefined();
    expect(result.issues.find(i => i.match === '잘못')).toBeDefined();
  });

  it('silently drops entries whose cat field is missing or empty', () => {
    const lint = makeCustomLint([
      { banned: '귀하', alt: '고객님', cat: '' },
      { banned: '잘못', alt: '오류', cat: '행정 관습어' },
    ]);
    const result = lint.lint('귀하 잘못');
    expect(result.issues.find(i => i.match === '귀하')).toBeUndefined();
    expect(result.issues.find(i => i.match === '잘못')).toBeDefined();
  });

  it('strips tildes from the banned text before matching (normalizePlaceholderTildes branch)', () => {
    // banned has a literal tilde → normalizePlaceholderTildes removes it → entry becomes '기간정보'
    const lint = makeCustomLint([
      { banned: '기간~정보', alt: '기간 정보', cat: '행정 관습어' },
    ]);
    const result = lint.lint('기간정보를 확인하세요.');
    const issue = result.issues.find(i => i.type === 'admin-jargon');
    expect(issue).toBeDefined();
    expect(issue.match).toBe('기간정보');
  });

  it('skips a bannedRegex match whose range is already occupied by a longer entry (overlaps true branch — regex path)', () => {
    // Entry A (longer): banned='금액: [금액]' → bannedRegex matches '금액: 50,000원' → occupies range [0..10]
    // Entry B (shorter): banned='[금액]'     → bannedRegex matches '50,000원' at index 4 → overlaps → skipped
    const lint = makeCustomLint([
      { banned: '금액: [금액]', alt: '납부할 금액을 명시하세요', cat: '행정 관습어' },
      { banned: '[금액]',      alt: '금액을 명시하세요',       cat: '행정 관습어' },
    ]);
    const result = lint.lint('금액: 50,000원');
    const jargonIssues = result.issues.filter(i => i.type === 'admin-jargon');
    // The longer entry occupies the range; the shorter inner match should be suppressed.
    expect(jargonIssues).toHaveLength(1);
    expect(jargonIssues[0].match).toMatch(/금액/);
  });

  it('increments re.lastIndex to prevent infinite loop when bannedRegex produces a zero-length match (line 380 guard)', () => {
    const lint = makeCustomLint([
      { banned: '[이름] 처리', alt: '이름을 명시하세요', cat: '행정 관습어' },
    ]);
    // ADMIN_JARGON entries are shared by reference with ADMIN_JARGON_MATCH_ORDER
    // (the latter is a shallow .slice().sort() copy), so mutating an entry object here
    // is visible inside lint() at runtime.
    const entry = lint.ADMIN_JARGON.find(e => e.bannedRegex);
    entry.bannedRegex = /a*/g;  // matches zero-length at every position

    // Without the re.lastIndex += 1 guard, /a*/g on text that contains no 'a'
    // would match '' at position 0, leave lastIndex at 0, and loop forever.
    const result = lint.lint('없는검색어');
    expect(result).toBeDefined();
    expect(result.issues).toBeDefined();
  });

  it('falls back to the inline jargon list when jargonDict is truthy but has no entries property (jargonDict && !jargonDict.entries false branch)', () => {
    // Provides a truthy jargonDict object with no .entries → condition (jargonDict && jargonDict.entries) is false
    // → buildJargonEntries falls through to the inline ADMIN_JARGON list which includes INLINE_JARGON entries
    const root = { KRDS_JARGON_DICT: {} };
    vm.runInNewContext(LINT_SOURCE, root);
    const lint = root.KRDSLint;
    const result = lint.lint('잘못 입력하셨습니다.');
    expect(result.issues.some((i) => i.match === '잘못 입력하셨습니다')).toBe(true);
  });

  it('falls back to the inline jargon list when jargonDict.entries is explicitly null (entries falsy branch)', () => {
    const root = { KRDS_JARGON_DICT: { entries: null } };
    vm.runInNewContext(LINT_SOURCE, root);
    const lint = root.KRDSLint;
    const result = lint.lint('죄송합니다');
    expect(result.issues.some((i) => i.match === '죄송합니다')).toBe(true);
  });
});

describe('formatCLI', () => {
  it('uses the bullet fallback icon when issue.severity is an unrecognised value (|| "•" branch)', () => {
    const result = KRDSLint.lint('귀하');
    const issue = result.issues[0];
    const patched = { ...result, issues: [{ ...issue, severity: 'custom' }] };
    const output = KRDSLint.formatCLI(patched);
    expect(output).toContain('•');
    expect(output).not.toContain('❌');
    expect(output).not.toContain('⚠️');
    expect(output).not.toContain('ℹ️');
  });
});

describe('lint() option branches', () => {
  it('skips pattern-rule checks when checkPatterns is false', () => {
    const textWithPattern = '빠르게 간편하게 처리하실 수 있습니다';
    const withPatterns = KRDSLint.lint(textWithPattern, { checkPatterns: true });
    const withoutPatterns = KRDSLint.lint(textWithPattern, { checkPatterns: false });
    const patternTypes = KRDSLint.PATTERN_RULES.map((r) => r.id);
    const hasPatternIssue = withPatterns.issues.some((i) => patternTypes.includes(i.type));
    expect(hasPatternIssue).toBe(true);
    const noPatternIssue = withoutPatterns.issues.every((i) => !patternTypes.includes(i.type));
    expect(noPatternIssue).toBe(true);
  });
});

describe('UMD Node.js branch — jargon-dictionary.json load failure falls back to inline list', () => {
  const LINT_SOURCE = fs.readFileSync(
    fileURLToPath(new URL('../krds-lint.js', import.meta.url)),
    'utf8',
  );

  it('uses the inline jargon list when the JSON dictionary cannot be loaded in the Node.js UMD branch', () => {
    const mod = { exports: {} };
    const ctx = {
      module: mod,
      exports: mod.exports,
      require: function (p) {
        if (p === 'path') return require('path');
        throw new Error('simulated load failure');
      },
      __dirname: '/nonexistent',
      globalThis: null,
      console,
    };
    ctx.globalThis = ctx;
    vm.runInNewContext(LINT_SOURCE, ctx);
    const lintFn = ctx.module.exports;
    const result = lintFn.lint('잘못 입력하셨습니다.');
    expect(result.issues.some((i) => i.match === '잘못 입력하셨습니다')).toBe(true);
  });
});

// ─── RSI Iter 4: 국제 best practice 기반 신규 규칙 회귀 테스트 ──────────────

describe('RSI Iter4 — 일본어 번역투 (japanese-translation)', () => {
  it('실시하다를 감지한다', () => {
    const r = KRDSLint.lint('이번 프로젝트를 실시하겠습니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'japanese-translation')).toBe(true);
  });
  it('도모하다를 감지한다', () => {
    const r = KRDSLint.lint('서비스 안정성을 도모하겠습니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'japanese-translation')).toBe(true);
  });
  it('자연스러운 한국어는 통과한다', () => {
    const r = KRDSLint.lint('이번 행사를 진행합니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'japanese-translation')).toBe(false);
  });
});

describe('RSI Iter4 — 명사화 남용 (over-nominalization)', () => {
  it('안정화를 감지한다', () => {
    const r = KRDSLint.lint('서비스 안정화를 추진합니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'over-nominalization')).toBe(true);
  });
  it('동사형 표현은 통과한다', () => {
    const r = KRDSLint.lint('서비스를 안정적으로 운영합니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'over-nominalization')).toBe(false);
  });
});

describe('RSI Iter4 — 에러 행동 지침 누락 (error-no-action)', () => {
  it('행동 지침 없는 에러 문장을 감지한다', () => {
    const r = KRDSLint.lint('파일 업로드에 실패했습니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'error-no-action')).toBe(true);
  });
  it('행동 지침이 있으면 통과한다', () => {
    const r = KRDSLint.lint('파일 크기가 초과되었습니다. 5MB 이하로 줄여 다시 업로드해 주세요.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'error-no-action')).toBe(false);
  });
  it('만료 에러도 감지한다', () => {
    const r = KRDSLint.lint('세션이 만료됩니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'error-no-action')).toBe(true);
  });
});

describe('RSI Iter4 — 긴 문장 (long-sentence)', () => {
  it('60자 초과 문장을 감지한다', () => {
    const long = '모든 서류를 첨부하여 주시기 바라며 처리 결과는 담당자 검토 후 개별 안내드릴 예정이오니 참고하여 주시기 바랍니다';
    const r = KRDSLint.lint(long, { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'long-sentence')).toBe(true);
  });
  it('짧은 문장은 통과한다', () => {
    const r = KRDSLint.lint('결과를 안내해 드리겠습니다.', { checkPatterns: true });
    expect(r.issues.some(i => i.type === 'long-sentence')).toBe(false);
  });
});

describe('RSI Iter4 — minSeverity 옵션', () => {
  it('minSeverity=error면 warning/info를 제외한다', () => {
    const r = KRDSLint.lint('이번 행사를 실시하겠습니다.', { checkPatterns: true, minSeverity: 'error' });
    expect(r.issues.every(i => i.severity === 'error')).toBe(true);
    expect(r.issues.some(i => i.severity === 'warning')).toBe(false);
  });
  it('minSeverity=info면 모든 이슈를 반환한다', () => {
    const text = '이번 행사를 실시하겠습니다. 모든 서류를 첨부하여 주시기 바라며 처리 결과는 담당자 검토 후 개별 안내드릴 예정이오니 참고하여 주시기 바랍니다';
    const rAll = KRDSLint.lint(text, { checkPatterns: true, minSeverity: 'info' });
    const rErr = KRDSLint.lint(text, { checkPatterns: true, minSeverity: 'error' });
    expect(rAll.issues.length).toBeGreaterThanOrEqual(rErr.issues.length);
  });
});
