import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildOutput,
  parse,
  buildBrowserBundle,
  mergeEntries,
  syncJargonDictionary,
  readExistingOutput,
} = require('../scripts/extract-jargon.js');

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('scripts/extract-jargon.js', () => {
  it('does not rewrite jargon-dictionary.json when extracted entries are unchanged', () => {
    const existingOutput = JSON.parse(read('jargon-dictionary.json'));
    const writes = [];

    const result = syncJargonDictionary({
      md: read('principles.md'),
      date: '2099-12-31',
      outputPath: path.join(ROOT, 'jargon-dictionary.json'),
      existingOutput,
      writeFile(filePath, contents) {
        writes.push({ filePath, contents });
      },
      stdout: { write() {} },
      stderr: { write() {} },
    });

    expect(result.changed).toBe(false);
    expect(writes).toEqual([]);
    expect(result.output.generated).toBe(existingOutput.generated);
    expect(result.output.note).toBe(existingOutput.note);
    expect(result.output.source).toBe(existingOutput.source);
  });

  it('preserves existing metadata while dropping stale entries that no longer exist in principles.md', () => {
    const existingOutput = {
      version: '1.2.3',
      generated: '2026-04-29',
      source: 'custom source',
      note: 'custom note',
      entries: [
        { banned: '하시기 바랍니다', alt: '해 주세요', cat: '과도한 경어' },
        { banned: '보강 항목', alt: '추가 대체어', cat: '행정 관습어', context: '보강' },
      ],
    };

    const output = buildOutput({
      entries: [
        { banned: '~하시기 바랍니다', alt: '~해 주세요', cat: '과도한 경어' },
      ],
      existingOutput,
      date: '2099-12-31',
    });

    expect(output.version).toBe('1.2.3');
    expect(output.generated).toBe('2099-12-31');
    expect(output.source).toBe('custom source');
    expect(output.note).toBe('custom note');
    expect(output.entries).toEqual([
      { banned: '~하시기 바랍니다', alt: '~해 주세요', cat: '과도한 경어' },
    ]);
  });

  it('removes stale entries from the generated dictionary when principles.md no longer contains them', () => {
    const existingOutput = {
      version: '1.0.0',
      generated: '2026-04-29',
      source: 'principles.md § 2.1',
      note: 'test',
      entries: [
        { banned: '명일까지 제출', alt: '내일까지 제출', cat: '행정 관습어', context: '공통' },
        { banned: '공시송달', alt: '공고로 통지', cat: '행정 관습어', context: '공통' },
      ],
    };

    const output = buildOutput({
      entries: [
        { banned: '명일까지 제출', alt: '내일까지 제출', cat: '행정 관습어', context: '공통' },
      ],
      existingOutput,
      date: '2099-12-31',
    });

    expect(output.entries).toEqual([
      { banned: '명일까지 제출', alt: '내일까지 제출', cat: '행정 관습어', context: '공통' },
    ]);
  });

  it('deduplicates entries that normalize to the same banned phrase and keeps the more descriptive replacement', () => {
    const output = buildOutput({
      entries: [
        { banned: '창설적 신분행위', alt: '법적 신분 변경', cat: '행정 관습어', context: '법원' },
        { banned: '창설적 신분행위', alt: '법적 신분 변경 (결혼, 입양 등)', cat: '전문 용어', context: '법원' },
      ],
      date: '2099-12-31',
    });

    expect(output.entries).toEqual([
      { banned: '창설적 신분행위', alt: '법적 신분 변경 (결혼, 입양 등)', cat: '전문 용어', context: '법원' },
    ]);
  });

  it('builds a browser bundle that exposes KRDS_JARGON_DICT', () => {
    const output = buildOutput({
      entries: [
        { banned: '유부녀', alt: '기혼 여성', cat: '전문 용어', context: '법원' },
      ],
      date: '2099-12-31',
    });
    const bundle = buildBrowserBundle(output);
    const context = { globalThis: null };
    context.globalThis = context;

    vm.runInNewContext(bundle, context);

    expect(context.KRDS_JARGON_DICT).toEqual(output);
  });

  it('extracts newly promoted welfare, labor, consent, tax, pension, and court terms from principles.md', () => {
    const entries = parse(read('principles.md'));
    const byBanned = new Map(entries.map((entry) => [entry.banned, entry]));

    expect(byBanned.get('소득평가액')).toMatchObject({
      alt: '월 소득으로 계산한 금액',
      context: '복지로',
    });
    expect(byBanned.get('소득환산액')).toMatchObject({
      alt: '재산을 소득으로 바꾼 금액',
      context: '복지로',
    });
    expect(byBanned.get('등록일')).toMatchObject({
      alt: '접수한 날',
      context: '국민신문고, 서울시',
    });
    expect(byBanned.get('첫만남이용권')).toMatchObject({
      alt: '출생아 첫 지원금',
      context: '정부24 (출생 지원)',
    });
    expect(byBanned.get('국민행복카드')).toMatchObject({
      alt: '임신·출산·육아 지원 카드',
      context: '정부24 (임신·출산)',
    });
    expect(byBanned.get('사회서비스 이용권')).toMatchObject({
      alt: '돌봄·활동 지원 서비스 이용권',
      context: '정부24 (복지 서비스)',
    });
    expect(byBanned.get('피부양자')).toMatchObject({
      alt: '부양가족',
      context: '국민건강보험 (피부양자·산정특례 안내)',
    });
    expect(byBanned.get('득실 신고')).toMatchObject({
      alt: '취득·상실 신고',
      context: '국민건강보험 (피부양자·산정특례 안내)',
    });
    expect(byBanned.get('본인일부부담금')).toMatchObject({
      alt: '본인부담금',
      context: '국민건강보험 (피부양자·산정특례 안내)',
    });
    expect(byBanned.get('산정특례')).toMatchObject({
      alt: '중증질환 본인부담 감면',
      context: '국민건강보험 (피부양자·산정특례 안내)',
    });
    expect(byBanned.get('보험료 산정')).toMatchObject({
      alt: '보험료 계산',
      context: '국민건강보험 (보험료 산정)',
    });
    expect(byBanned.get('임의계속가입')).toMatchObject({
      alt: '퇴직 뒤 예전 직장 보험료로 계속 가입',
      context: '국민건강보험 (보험료 산정)',
    });
    expect(byBanned.get('실업인정')).toMatchObject({
      alt: '실업 상태 확인',
      context: '고용24 (실업인정 인터넷 신청)',
    });
    expect(byBanned.get('적극적인 재취업활동')).toMatchObject({
      alt: '재취업 활동',
      context: '고용24 (실업인정 인터넷 신청)',
    });
    expect(byBanned.get('실업인정일')).toMatchObject({
      alt: '실업급여를 확인하는 날',
      context: '고용24 (실업인정 인터넷 신청)',
    });
    expect(byBanned.get('조기재취업수당')).toMatchObject({
      alt: '빨리 다시 취업했을 때 받는 수당',
      context: '고용24 (조기재취업수당 안내)',
    });
    expect(byBanned.get('통신판매중개자')).toMatchObject({
      alt: '판매를 중개하는 플랫폼',
      context: '고용24 (통신판매중개자·노무제공플랫폼사업자 고용보험 안내)',
    });
    expect(byBanned.get('노무제공플랫폼사업자')).toMatchObject({
      alt: '일을 연결하는 플랫폼 사업자',
      context: '고용24 (통신판매중개자·노무제공플랫폼사업자 고용보험 안내)',
    });
    expect(byBanned.get('실명확인')).toMatchObject({
      alt: '본인 확인',
      context: '국민신문고',
    });
    expect(byBanned.get('자료제공동의')).toMatchObject({
      alt: '자료 제공 동의',
      context: '홈택스',
    });
    expect(byBanned.get('세무대리인')).toMatchObject({
      alt: '세금 업무를 대신하는 전문가',
      context: '홈택스',
    });
    expect(byBanned.get('수임')).toMatchObject({
      alt: '업무 맡기기',
      context: '홈택스',
    });
    expect(byBanned.get('간주임대료')).toMatchObject({
      alt: '보증금을 이자로 계산한 임대수입',
      context: '홈택스',
    });
    expect(byBanned.get('임의가입')).toMatchObject({
      alt: '원하면 직접 가입',
      context: '정부24 (국민연금)',
    });
    expect(byBanned.get('추납')).toMatchObject({
      alt: '못 낸 기간 보험료 나중에 내기',
      context: '정부24 (국민연금)',
    });
    expect(byBanned.get('예정 고지')).toMatchObject({
      alt: '미리 청구',
      context: '홈택스 (부가세)',
    });
    expect(byBanned.get('중간예납')).toMatchObject({
      alt: '중간에 미리 내는 세금',
      context: '홈택스',
    });
    expect(byBanned.get('장기미환급금')).toMatchObject({
      alt: '못 받은 세금 환급금',
      context: '홈택스',
    });
    expect(byBanned.get('전자증명서안내')).toMatchObject({
      alt: '전자증명서 안내',
      context: '정부24',
    });
    expect(byBanned.get('부가가치세예정신고')).toMatchObject({
      alt: '부가가치세 예정 신고',
      context: '홈택스',
    });
    expect(byBanned.get('증명서발급')).toMatchObject({
      alt: '증명서 발급',
      context: '법원',
    });
    expect(byBanned.get('인터넷신고')).toMatchObject({
      alt: '온라인 신고',
      context: '법원',
    });
    expect(byBanned.get('가족관계등록부정정')).toMatchObject({
      alt: '가족관계 기록 정정',
      context: '법원',
    });
    expect(byBanned.get('가족관계등록부정정 허가')).toMatchObject({
      alt: '가족관계 기록 정정 허가',
      context: '법원',
    });
    expect(byBanned.get('정부민원안내콜센터')).toMatchObject({
      alt: '정부 민원 안내',
      context: '정부24',
    });
    expect(byBanned.get('국세상담센터')).toMatchObject({
      alt: '세금 신고·납부 상담',
      context: '홈택스',
    });
    expect(byBanned.get('사용자지원센터')).toMatchObject({
      alt: '전자가족관계등록 이용 문의',
      context: '법원',
    });
    expect(byBanned.get('서비스 상세 이동')).toMatchObject({
      alt: '서비스 이름 + 자세히 보기',
      context: '정부24 혜택 카드 접근성 레이블',
    });
    expect(byBanned.get('1번째 배너')).toMatchObject({
      alt: '배너 제목 + 보기',
      context: '홈택스 배너 접근성 레이블',
    });
    expect(byBanned.get('AI 켜기')).toMatchObject({
      alt: 'AI 검색 꺼짐 — 켜려면 클릭 / AI 검색 사용 중 — 끄려면 클릭',
      context: '정부24 AI 검색 토글',
    });
    expect(byBanned.get('새창')).toMatchObject({
      alt: '제목 + 새 탭에서 열림',
      context: '법원 외부 링크 접근성 레이블',
    });
    expect(byBanned.get('주민등록등본')).toMatchObject({
      alt: '가족 전체 주민등록증명서 (등본) — 대출·계약·학교 제출',
      context: '정부24 (주민등록 발급)',
    });
    expect(byBanned.get('상세증명서')).toMatchObject({
      alt: '상세 가족관계증명서 — 전 가족 기록 포함, 상속·이민 제출',
      context: '법원 (가족관계증명서)',
    });
    expect(byBanned.get('납세증명서 (금융거래용)')).toMatchObject({
      alt: '금융거래용 납세증명서 — 은행·대출 제출',
      context: '홈택스',
    });
    expect(byBanned.get('개인정보 제공 범위 선택')).toMatchObject({
      alt: '은행·학교 제출용 — 주민번호 뒷자리는 제외하고 필요한 항목만 선택',
      context: '정부24 (주민등록 발급)',
    });
    expect(byBanned.get('말소 사항 포함')).toMatchObject({
      alt: '대출·담보 제출용 — 말소 포함 전체 / 소송 제출용 — 현재 유효만',
      context: '법원 (등기사항증명서)',
    });
    expect(byBanned.get('세무정보 열람권한 부여')).toMatchObject({
      alt: '세무사 [대리인 이름]이 [기간] 동안 신고·납부 내역과 과세자료를 확인합니다. 마이페이지에서 해제할 수 있습니다',
      context: '홈택스 (세무대리 수임)',
    });
    expect(byBanned.get('건강보험 피부양자 등록 신청')).toMatchObject({
      alt: '관계별 서류 확인 — 부모 등록은 가족관계증명서 + 소득 확인서 필요',
      context: '정부24·건강보험 (피부양자 등록)',
    });
    expect(byBanned.get('연말정산 간소화')).toMatchObject({
      alt: '본인 자료는 바로 조회 / 부양가족 자료는 온라인 동의 또는 세무서 방문 필요',
      context: '홈택스 (연말정산 간소화)',
    });
    expect(byBanned.get('소송 기록 열람·복사 신청')).toMatchObject({
      alt: '당사자는 온라인 열람 가능 / 이해관계인은 소명 서류 + 허가 절차 필요 / 제3자는 법원 방문 신청',
      context: '법원 (소송 기록 열람)',
    });
    expect(byBanned.get('협의이혼 의사확인 신청')).toMatchObject({
      alt: '이혼 성립 전 확인 / 배우자 두 분 방문 + 미성년 자녀 협의서 + 숙려기간 뒤 확인기일 출석',
      context: '법원 (협의이혼 의사확인)',
    });
    expect(byBanned.get('외국인등록번호 *')).toMatchObject({
      alt: '외국인이라면 외국인등록번호 입력 (해당자만 필수)',
      context: '정부24 (신청인 정보 입력)',
    });
    expect(byBanned.get('영세율 신고')).toMatchObject({
      alt: '영세율 대상 거래라면 첨부서류 제출 (해당 거래만 필수)',
      context: '홈택스 (영세율 첨부서류)',
    });
    expect(byBanned.get('병적증명서 발급')).toMatchObject({
      alt: '본인 또는 위임장 지참 대리인 신청 가능',
      context: '정부24 (증명서 대리 발급)',
    });
    expect(byBanned.get('세무대리인 수임 동의')).toMatchObject({
      alt: '세금 업무 맡기기 동의 / 위임 범위·해지 경로 먼저 확인',
      context: '홈택스 (세무대리 위임)',
    });
    expect(byBanned.get('소송 대리인 등록')).toMatchObject({
      alt: '서류 제출·열람·기일 신청·항소 대리 / 제한 위임·해임 신고 안내',
      context: '법원 (소송 대리인)',
    });
    expect(byBanned.get('파일을 첨부하세요')).toMatchObject({
      alt: '허용 형식 + 파일당 최대 용량 + 최대 개수 안내',
      context: '정부24, 법원 업로드 화면',
    });
    expect(byBanned.get('증빙서류 파일 첨부')).toMatchObject({
      alt: '허용 형식 + 총 용량 + 판독 불가 시 재제출 경로 안내',
      context: '홈택스',
    });
    expect(byBanned.get('PDF 형식만 가능')).toMatchObject({
      alt: 'PDF만 가능 · HWP는 PDF 변환 후 제출',
      context: '법원 전자소송',
    });
    expect(byBanned.get('문서확인번호')).toMatchObject({
      alt: '진위 확인용 문서 번호',
      context: '정부24 인터넷 발급',
    });
    expect(byBanned.get('전자 발급본도 출력 시 원본과 동일 효력')).toMatchObject({
      alt: '출력본도 원본과 같은 효력 / 공공 마이데이터 제출 또는 PDF 첨부',
      context: '홈택스',
    });
    expect(byBanned.get('전자 발급본이 공문서와 동일한 효력')).toMatchObject({
      alt: '전자 발급본도 공문서와 같은 효력 / 제출 전 증명서 진위 확인 가능',
      context: '법원',
    });
    expect(byBanned.get('온라인은 대리인 신청 불가')).toMatchObject({
      alt: '온라인은 본인만 신청할 수 있습니다 / 대리 신청은 방문 시 위임장을 준비해 주세요',
      context: '정부24 (주민등록표 등본)',
    });
    expect(byBanned.get('발급일 현재 징수유예액 또는 체납처분유예액을 제외하고는 다른 국세를 체납한 사실이 없음을 증명')).toMatchObject({
      alt: '이 증명서는 지금 미납한 국세가 없을 때 발급됩니다 / 지금 발급되지 않으면 체납 내역부터 확인해 주세요',
      context: '정부24 (납세증명서)',
    });
    expect(byBanned.get('집행문 부여 신청')).toMatchObject({
      alt: '강제집행 전에 필요한 서류입니다 / 판결·조정조서는 제1심법원, 공정증서는 공증인사무소에 신청',
      context: '대한민국법원 (집행문)',
    });
    expect(byBanned.get('판독 불가')).toMatchObject({
      alt: '보완 요청 — 스캔본 판독이 어려워 다시 제출해 주세요 / 재제출 바로 가기',
      context: '홈택스 (증빙 재제출)',
    });
    expect(byBanned.get('신고 불수리 통지 조회')).toMatchObject({
      alt: '신고 반려 통지 확인 / 거부 사유 보기 + 다시 신고하기',
      context: '법원 (가족관계등록 반려 통지)',
    });
    expect(byBanned.get('전자고지(송달) 신청 및 해지')).toMatchObject({
      alt: '전자 고지서 받기 / 우편으로 다시 받기',
      context: '홈택스 (전자 고지서 설정)',
    });
    expect(byBanned.get('지급명세서 제출·수정·삭제')).toMatchObject({
      alt: '지급명세서 제출 / 제출 내역 수정 / 제출 내역 삭제',
      context: '홈택스 (지급명세서 처리)',
    });
    expect(byBanned.get('현금영수증 발급·취소·수정')).toMatchObject({
      alt: '현금영수증 발급 / 발급 취소 / 발급 정보 수정',
      context: '홈택스 (현금영수증 처리)',
    });
    expect(byBanned.get('국선대리인 신청(불복청구서 제출전)/(제출후)')).toMatchObject({
      alt: '국선대리인 신청 → [불복청구서 제출 전] [제출 후]',
      context: '법원 (국선대리인 신청 단계)',
    });
    expect(byBanned.get('전자(세금)계산서')).toMatchObject({
      alt: '세금계산서 / 계산서',
      context: '홈택스 (계산서 유형 선택)',
    });
    expect(byBanned.get('세대주 변경 신고')).toMatchObject({
      alt: '세대 대표자 변경 신고 (세대주 변경) / 기존 세대주의 동의 필요 / 세대 분리 신청과 다름',
      context: '정부24 (주민등록 정정)',
    });
    expect(byBanned.get('사업장 현황 신고')).toMatchObject({
      alt: '부가가치세 면세 사업자 신고 / 내 업종 확인 + 신고 기한 확인',
      context: '홈택스 (면세 사업자 신고)',
    });
    expect(byBanned.get('개명 허가 신청')).toMatchObject({
      alt: '개명 허가 기준 확인 / 허가 사유·심사 기간·불복 방법 보기',
      context: '법원 (개명 허가)',
    });
    expect(byBanned.get('민원이 접수되었습니다')).toMatchObject({
      alt: '신청이 완료됐습니다 / 처리까지 약 3일 / 나의 민원 확인하기 + 알림 설정하기',
      context: '정부24, 국민신문고 (민원 완료)',
    });
    expect(byBanned.get('귀하의 종합소득세 신고서가 접수되었습니다')).toMatchObject({
      alt: '종합소득세 신고가 완료됐습니다 / 접수번호 확인 + 납부 기한 확인 + 지금 납부하기',
      context: '홈택스 (종합소득세 신고 완료)',
    });
    expect(byBanned.get('신고서가 정상적으로 접수되었습니다')).toMatchObject({
      alt: '신고가 접수됐습니다 / 심사 기간 확인 + 처리 현황 조회',
      context: '전자가족관계등록시스템 (국적이탈 신고 완료)',
    });
    expect(byBanned.get('환급금: [금액]')).toMatchObject({
      alt: '환급 결정 완료 / 예상 입금일 확인 + 지연 사유 조회 + 계좌 등록하기',
      context: '홈택스 (환급 입금 대기)',
    });
    expect(byBanned.get('개인정보 보호를 위해 로그인 후 약 0분 동안 서비스 이용이 없어 자동 로그아웃 됩니다.')).toMatchObject({
      alt: '5분 뒤 자동으로 로그아웃됩니다 / 작성 중인 내용은 임시 저장됩니다 / 로그인 유지하기',
      context: '정부24, 국민신문고 (세션 만료 전 경고)',
    });
    expect(byBanned.get('세션이 만료되었습니다. 처음부터 다시 시작하세요.')).toMatchObject({
      alt: '자리를 비운 사이 로그인이 끊겼습니다 / 다시 로그인하면 이어서 작성할 수 있습니다',
      context: '홈택스, 정부24 (세션 종료)',
    });
    expect(byBanned.get('로그아웃 되었습니다.')).toMatchObject({
      alt: '로그아웃 됐습니다 / 메인으로 가기 + 다시 로그인하기',
      context: '공통 (로그아웃 완료)',
    });
    expect(byBanned.get('서비스 이용이 일시적으로 중단되었습니다.')).toMatchObject({
      alt: '지금은 이 서비스를 이용할 수 없습니다 / 다시 열리는 시각 + 대체 경로 안내',
      context: '정부24 (점검 화면)',
    });
    expect(byBanned.get('지방세 연계 납부')).toMatchObject({
      alt: '위택스에서 별도 신고·납부 / 연계 오류 시 납부 처리 상태 확인',
      context: '홈택스 (위택스 연계)',
    });
    expect(byBanned.get('친권 상실 청구')).toMatchObject({
      alt: '112 또는 1577-1391로 먼저 연락 / 보호 조치 후 친권 상실·일시 정지 절차 이어서 신청',
      context: '법원 (친권 상실)',
    });
    expect(byBanned.get('소상공인 정책자금 신청')).toMatchObject({
      alt: '보증서 필요 여부 먼저 확인 / 직접·대리대출 비교 / 보증서 발급 1~2주 소요',
      context: '정부24 (소상공인 정책자금)',
    });
    expect(byBanned.get('부재자 재산 관리인 선임 청구')).toMatchObject({
      alt: '재산 처분이 급하면 가압류·가처분 병행 / 관리인 선임만으로는 부동산 매각·담보 설정 차단 불가',
      context: '법원 (부재자 재산 관리)',
    });
    expect(byBanned.get('정부24 앱으로 더 편리하게 이용하세요.')).toMatchObject({
      alt: '앱에서 가능한 기능 안내 / 앱 열기 + 앱 다운로드',
      context: '정부24 (앱 안내)',
    });
    expect(byBanned.get('해당 서비스는 PC 홈택스에서만 이용하실 수 있습니다')).toMatchObject({
      alt: '이 서비스는 PC에서 이용 가능 / PC로 이동하는 QR코드 보기',
      context: '홈택스 (PC 전용)',
    });
    expect(byBanned.get('증명서발급과 인터넷신고는 PC를 이용하여 주시기 바랍니다.')).toMatchObject({
      alt: '일부 서비스는 PC에서만 이용 가능 / PC에서 다시 접속해 주세요',
      context: '법원 (모바일 제한)',
    });
    expect(byBanned.get('정보이용료')).toMatchObject({
      alt: '추가 서비스 요금',
      context: '법원 상담센터',
    });
    expect(byBanned.get('손말이음센터')).toMatchObject({
      alt: '청각장애인 통신중계',
      context: '홈택스',
    });
    expect(byBanned.get('사전답변')).toMatchObject({
      alt: '세법 적용 결과 미리 확인',
      context: '홈택스',
    });
    expect(byBanned.get('해임')).toMatchObject({
      alt: '위임 취소',
      context: '홈택스 (세무대리인)',
    });
    expect(byBanned.get('원천징수영수증')).toMatchObject({
      alt: '급여에서 공제된 세금 확인서',
      context: '홈택스',
    });
    expect(byBanned.get('세금포인트')).toMatchObject({
      alt: '세금 납부 혜택 포인트',
      context: '홈택스',
    });
    expect(byBanned.get('반기납부')).toMatchObject({
      alt: '1년에 두 번 나눠 내기',
      context: '홈택스 (원천세)',
    });
    expect(byBanned.get('간이과세자')).toMatchObject({
      alt: '소규모 사업자용 부가세 방식',
      context: '홈택스 (부가세)',
    });
    expect(byBanned.get('환급세액')).toMatchObject({
      alt: '돌려받을 세금',
      context: '홈택스',
    });
    expect(byBanned.get('과납')).toMatchObject({
      alt: '더 낸 세금',
      context: '홈택스',
    });
    expect(byBanned.get('계좌신고')).toMatchObject({
      alt: '환급 계좌 등록',
      context: '홈택스',
    });
    expect(byBanned.get('인지대')).toMatchObject({
      alt: '법원에 내는 수수료',
      context: '법원',
    });
    expect(byBanned.get('송달료')).toMatchObject({
      alt: '서류를 보내는 우편 비용',
      context: '법원',
    });
    expect(byBanned.get('강제집행')).toMatchObject({
      alt: '판결 뒤 돈·재산을 강제로 받는 절차',
      context: '법원',
    });
    expect(byBanned.get('성년후견')).toMatchObject({
      alt: '판단이 어려운 성인을 돕는 법원 보호 제도',
      context: '법원 (후견)',
    });
    expect(byBanned.get('친권 상실')).toMatchObject({
      alt: '부모의 법적 결정권을 없애는 절차',
      context: '법원 (아동 보호)',
    });
    expect(byBanned.get('친권 일시 정지')).toMatchObject({
      alt: '부모의 법적 결정권을 일정 기간 멈추는 절차',
      context: '법원 (아동 보호)',
    });
    expect(byBanned.get('임시 후견인')).toMatchObject({
      alt: '급한 상황에서 잠시 대신 보호·결정할 사람',
      context: '법원 (아동 보호, 후견)',
    });
    expect(byBanned.get('국적 이탈')).toMatchObject({
      alt: '한국 국적 포기 신고',
      context: '전자가족관계등록시스템 (국적 이탈 신고)',
    });
    expect(byBanned.get('국적 회복')).toMatchObject({
      alt: '한국 국적 다시 받기',
      context: '전자가족관계등록시스템, 법무부 (국적 회복 허가)',
    });
    expect(byBanned.get('개명 허가')).toMatchObject({
      alt: '이름 바꾸기 허가',
      context: '법원 (가족관계등록)',
    });
    expect(byBanned.get('협의이혼 의사확인')).toMatchObject({
      alt: '부부가 이혼에 합의했는지 확인',
      context: '법원 (이혼)',
    });
    expect(byBanned.get('상속포기')).toMatchObject({
      alt: '상속 거부 신고',
      context: '법원 (상속)',
    });
    expect(byBanned.get('임의계속가입')).toMatchObject({
      alt: '퇴직 뒤 예전 직장 보험료로 계속 가입',
      context: '국민건강보험 (보험료 산정)',
    });
    expect(byBanned.get('장기요양인정')).toMatchObject({
      alt: '장기요양 등급 신청',
      context: '정부24 (장기요양)',
    });
    expect(byBanned.get('지방소득세')).toMatchObject({
      alt: '지방자치단체에 따로 내는 소득세',
      context: '홈택스, 위택스',
    });
    expect(byBanned.get('확정일자')).toMatchObject({
      alt: '전세 계약서 날짜 확인 (보증금 보호)',
      context: '정부24 (전월세)',
    });
    expect(byBanned.get('긴급복지지원')).toMatchObject({
      alt: '갑작스러운 위기 가구를 위한 생계·의료·주거 지원',
      context: '정부24 (복지)',
    });
    expect(byBanned.get('분납')).toMatchObject({
      alt: '세금 나눠 내기',
      context: '홈택스, 지방세',
    });
  });

  describe('mergeEntries — isMoreDescriptiveEntry branch coverage', () => {
    it('keeps the entry with the longer alt when alt lengths differ (branch 1)', () => {
      const entries = [
        { banned: '공고문', alt: 'AB', cat: '행정 관습어' },
        { banned: '공고문', alt: 'LONGER_ALT', cat: '행정 관습어' },
      ];
      const result = mergeEntries(entries);
      expect(result).toHaveLength(1);
      expect(result[0].alt).toBe('LONGER_ALT');
    });

    it('keeps the entry with the longer context when both have the same alt length (branch 2)', () => {
      const entries = [
        { banned: '공고문', alt: 'AB', cat: '행정 관습어', context: 'X' },
        { banned: '공고문', alt: 'CD', cat: '행정 관습어', context: '더긴맥락' },
      ];
      const result = mergeEntries(entries);
      expect(result).toHaveLength(1);
      expect(result[0].context).toBe('더긴맥락');
    });

    it('keeps the first entry when both alt length and context length are equal (tiebreak → return false)', () => {
      const entries = [
        { banned: '민원인', alt: 'AB', cat: '행정 관습어', context: 'CC' },
        { banned: '민원인', alt: 'XY', cat: '전문 용어', context: 'ZZ' },
      ];
      const result = mergeEntries(entries);
      expect(result).toHaveLength(1);
      expect(result[0].alt).toBe('AB');
    });

    it('skips exact duplicate entries (seenExactEntries guard)', () => {
      const entry = { banned: '민원인', alt: '시민', cat: '행정 관습어', context: '공통' };
      const result = mergeEntries([entry, entry]);
      expect(result).toHaveLength(1);
    });

    it('skips entries with an empty banned field (bannedKey guard)', () => {
      const entries = [
        { banned: '', alt: '대체어', cat: '행정 관습어' },
        { banned: '공고문', alt: '안내문', cat: '행정 관습어' },
      ];
      const result = mergeEntries(entries);
      expect(result).toHaveLength(1);
      expect(result[0].banned).toBe('공고문');
    });
  });

  it('dry-run mode writes json to stdout and skips file writes', () => {
    const stdoutLines = [];
    const stderrLines = [];

    const result = syncJargonDictionary({
      md: read('principles.md'),
      dryRun: true,
      date: '2099-12-31',
      existingOutput: null,
      writeFile(_filePath, _contents) {
        throw new Error('writeFile must not be called in dry-run');
      },
      stdout: { write(s) { stdoutLines.push(s); } },
      stderr: { write(s) { stderrLines.push(s); } },
    });

    const joined = stdoutLines.join('');
    const parsed = JSON.parse(joined);
    expect(parsed).toHaveProperty('entries');
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(stderrLines.join('')).toContain('[dry-run]');
    expect(result).toHaveProperty('output');
  });

  it('writes output files when entries have changed and returns changed=true', () => {
    const writes = [];

    const result = syncJargonDictionary({
      md: '### 2.1 행정어·전문용어 대체어 사전\n#### 카테고리 1. 행정 관습어\n| 쓰지 마세요 | 대신 쓰세요 |\n|---|---|\n| 귀하 | 고객님 |\n### 2.1 부록\n',
      dryRun: false,
      date: '2099-12-31',
      existingOutput: null,
      writeFile(filePath, contents) { writes.push({ filePath, contents }); },
      stdout: { write() {} },
      stderr: { write() {} },
    });

    expect(result.changed).toBe(true);
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.some((w) => w.contents.includes('귀하'))).toBe(true);
  });

  it('writes only the JSON file when json changes but the browser bundle is already current', () => {
    const md = '### 2.1 행정어·전문용어 대체어 사전\n#### 카테고리 1. 행정 관습어\n| 쓰지 마세요 | 대신 쓰세요 |\n|---|---|\n| 귀하 | 고객님 |\n### 2.1 부록\n';
    const date = '2099-12-31';
    const entries = parse(md);
    const output = buildOutput({ entries, existingOutput: null, date });
    const currentBrowserBundle = buildBrowserBundle(output);

    const writes = [];
    const stderrLines = [];

    const result = syncJargonDictionary({
      md,
      dryRun: false,
      date,
      existingOutput: null,
      existingBrowserBundle: currentBrowserBundle,
      writeFile(filePath, contents) { writes.push({ filePath, contents }); },
      stdout: { write() {} },
      stderr: { write(s) { stderrLines.push(s); } },
    });

    expect(result.changed).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].contents).toContain('귀하');
    const stderr = stderrLines.join('');
    expect(stderr).toContain('JSON 저장 위치');
    expect(stderr).not.toContain('브라우저 번들 저장 위치');
  });

  it('writes only the browser bundle when the bundle changes but the JSON is already current', () => {
    const md = '### 2.1 행정어·전문용어 대체어 사전\n#### 카테고리 1. 행정 관습어\n| 쓰지 마세요 | 대신 쓰세요 |\n|---|---|\n| 귀하 | 고객님 |\n### 2.1 부록\n';
    const date = '2099-12-31';
    const entries = parse(md);
    const output = buildOutput({ entries, existingOutput: null, date });
    const currentJson = JSON.stringify(output, null, 2);
    const currentOutput = JSON.parse(currentJson);

    const writes = [];
    const stderrLines = [];

    const result = syncJargonDictionary({
      md,
      dryRun: false,
      date,
      existingOutput: currentOutput,
      existingBrowserBundle: 'outdated-bundle',
      writeFile(filePath, contents) { writes.push({ filePath, contents }); },
      stdout: { write() {} },
      stderr: { write(s) { stderrLines.push(s); } },
    });

    expect(result.changed).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].contents).toContain('KRDS_JARGON_DICT');
    const stderr = stderrLines.join('');
    expect(stderr).toContain('브라우저 번들 저장 위치');
    expect(stderr).not.toContain('JSON 저장 위치');
  });
});

describe('extract-jargon.js — uncovered branch paths', () => {
  it('detectCat falls back to header.trim() when the category does not match any CAT_MAP key', () => {
    const md = [
      '### 2.1 행정어·전문용어 대체어 사전',
      '#### 카테고리 99. 알수없는특수범주',
      '| 쓰지 마세요 | 대신 쓰세요 |',
      '|---|---|',
      '| 특수어 | 쉬운말 |',
      '### 2.1 부록',
    ].join('\n');
    const entries = parse(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].cat).toBe('알수없는특수범주');
  });

  it('parse skips a table row whose banned cell is exactly "..." (ellipsis placeholder)', () => {
    const md = [
      '### 2.1 행정어·전문용어 대체어 사전',
      '#### 카테고리 1. 행정 관습어',
      '| 쓰지 마세요 | 대신 쓰세요 |',
      '|---|---|',
      '| ... | 대체어 |',
      '| 귀하 | 고객님 |',
      '### 2.1 부록',
    ].join('\n');
    const entries = parse(md);
    expect(entries.map((e) => e.banned)).not.toContain('...');
    expect(entries.some((e) => e.banned === '귀하')).toBe(true);
  });

  it('parse skips a table row whose banned cell starts with "**" (markdown bold)', () => {
    const md = [
      '### 2.1 행정어·전문용어 대체어 사전',
      '#### 카테고리 1. 행정 관습어',
      '| 쓰지 마세요 | 대신 쓰세요 |',
      '|---|---|',
      '| **Bold Header** | 설명 |',
      '| 귀하 | 고객님 |',
      '### 2.1 부록',
    ].join('\n');
    const entries = parse(md);
    expect(entries.map((e) => e.banned)).not.toContain('**Bold Header**');
    expect(entries.some((e) => e.banned === '귀하')).toBe(true);
  });

  it('isMoreDescriptiveEntry returns false immediately when candidate alt is shorter than current (first-branch false path)', () => {
    const entries = [
      { banned: '공고문', alt: '길고상세한대체어입니다', cat: '행정 관습어' },
      { banned: '공고문', alt: 'AB', cat: '행정 관습어' },
    ];
    const result = mergeEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].alt).toBe('길고상세한대체어입니다');
  });

  it('isMoreDescriptiveEntry returns false via branch 2 when alt lengths are equal but candidate context is shorter (branch 2 false path)', () => {
    // Entry 1 (becomes current): alt='AB' (len 2), context='긴맥락' (len 3)
    // Entry 2 (becomes candidate): alt='XY' (len 2), context='X' (len 1)
    // candidateAltLength === currentAltLength → skip branch 1
    // candidateContextLength (1) < currentContextLength (3) → branch 2 fires, returns false
    // Current entry (entry 1) is kept
    const entries = [
      { banned: '공고문', alt: 'AB', cat: '행정 관습어', context: '긴맥락' },
      { banned: '공고문', alt: 'XY', cat: '행정 관습어', context: 'X' },
    ];
    const result = mergeEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].alt).toBe('AB');
    expect(result[0].context).toBe('긴맥락');
  });

  it('readExistingOutput returns null when the file contains invalid JSON (catch branch)', () => {
    const tmpFile = path.join(os.tmpdir(), 'krds-test-corrupt-' + Date.now() + '.json');
    fs.writeFileSync(tmpFile, '{ not valid json }', 'utf8');
    try {
      const result = readExistingOutput(tmpFile);
      expect(result).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
