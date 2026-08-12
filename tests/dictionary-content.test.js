import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('dictionary page content', () => {
  it('documents the representative-site sweep workflow and synchronized dictionary counts', () => {
    const html = read('dictionary/index.html');

    expect(html).toContain('<meta name="description" content="대표 사이트 8종 순회와 대한민국법원 보조 표본으로 채운 행정어 대체어 사전. 14세 기준 일상어 교체, 사전 후보 → 사례 카드 → KRDS 컴포넌트 보강 흐름을 다룹니다.">');
    expect(html).toContain('정부24·홈택스·복지로·국민건강보험·국민신문고·고용24·전자가족관계등록시스템·서울특별시 응답소 대표 화면 재검토.');
    expect(html).toContain('완료 뒤 후속 흐름·권리구제 문장은 대한민국법원 보조 표본으로 함께 확인.');
    expect(html).toContain('사전은 용어 목록이 아니라 순회 로그의 첫 도착지입니다');
    expect(html).toContain('용어 1개 = 사전 1행이 아닙니다.');
    expect(html).toContain('사전 승격 보류 기준');
    expect(html).toContain('사전에 올리지 않는 이유를 세 가지로 나눠 먼저 공개합니다.');
    expect(html).toContain('aria-label="사전 승격 보류 3분류"');
    expect(html).toContain('구조 규칙 우선');
    expect(html).toContain('일반화 후 재판정');
    expect(html).toContain('긍정 사례·원칙 유지');
    expect(html).toContain('전입신고 / 사업자 등록 사항 정정 신청 / 집행문 부여 신청');
    expect(html).toContain('담당 기관·관할');
    expect(html).toContain('사례 카드 + KRDS 컴포넌트 보강');
    expect(html).toContain('외국인등록번호 *');
    expect(html).toContain('화면 단계 승격 연결');
    expect(html).toContain('전자증명서안내');
    expect(html).toContain('CASE 49');
    expect(html).toContain('CASE 32');
    expect(html).toContain('CASE 45');
    expect(html).toContain('CASE 46');
    expect(html).toContain('CASE 57');
    expect(html).toContain('CASE 59');
    expect(html).toContain('CASE 60');
    expect(html).toContain('첫 레이블 + 도움말 + 메뉴 이름 + CTA');
    expect(html).toContain('현재 페이지는 고우선순위 167개 선별본입니다.');
    expect(html).toContain('href="/krds-ux-writing/dictionary/full.html"');
    expect(html).toContain('href="/krds-ux-writing/corpus/"');
    expect(html).toContain('국민건강보험 기록법');
    expect(html).toContain('결과 화면에서는 <code>변동 신고</code>, <code>경감 신청 자가 진단</code>, <code>임의계속가입 확인</code>이 같은 첫 블록에서 이어지는지도 같이 적습니다.');
    expect(html).toContain('고용24 기록법');
    expect(html).toContain('<code>조기재취업수당 안내</code>는 누가 대상인지, 언제 다시 취업했는지, 무엇으로 확인하는지도 첫 블록에서 같이 적습니다.');
    expect(html).toContain('사용 맥락 기록 규칙');
    expect(html).toContain('<code>국민건강보험 (보험료 산정)</code>, <code>고용24 (실업인정 인터넷 신청)</code>, <code>고용24 (조기재취업수당 안내)</code>, <code>전자가족관계등록시스템 (국적 회복 허가)</code>처럼 실제 화면 단계까지 적습니다.');
    expect(html).toContain('서울응답소 분기');
    expect(html).toContain('전자가족관계등록 정식 승격 기준');
    expect(html).toContain('<code>국적 회복 허가</code>, <code>국적 이탈 신고</code>, <code>개명 허가</code>는 사전 행만 만들지 않습니다.');
    expect(html).toContain('<code>국적 회복 허가</code>와 <code>국적 이탈 신고</code>는 허가 뒤 신고 의무');
    expect(html).toContain('<code>[신고 방법 보기]</code>·<code>[요건 확인]</code> CTA가 같은 첫 블록에서 함께 읽히면 2장·3장·4장·7장 정식 승격 대상으로 올립니다.');
    expect(html).toContain('2장 로그에는 <code>한국 국적 다시 받기 허가 결과</code> → <code>1년 내 외국 국적 포기</code> → <code>외국국적불행사서약 대상 여부</code> → <code>외국 국적 포기 증명서 제출 경로</code>, <code>국적 이탈 가능 기한</code> → <code>병역 조건</code> → <code>기한 경과 뒤 상태</code>를 같은 순서로 남기고');
    expect(html).toContain('<code>국적 회복 허가 뒤 1년 기한과 국적 이탈 병역 조건 확인하기</code>');
    expect(html).toContain('전체 <span class="count">167</span>');
    expect(html).toContain('외래어·전문용어 <span class="count">50</span>');
    expect(html).toContain('<span id="resultCount"><strong>167</strong>개 용어</span>');
    expect(html).toContain('출처: principles.md 2.1절 — 전체 283개 사전 중 고우선순위 167개 수록 |');
    expect(html).toContain('전체 사전 283개 보기');
    expect(html).toContain('코퍼스 공개 현황');
  });

  it('surfaces newly promoted health-insurance and employment terms as actual dictionary rows', () => {
    const html = read('dictionary/index.html');

    expect(html).toContain('<td class="td-bad">보험료 산정</td>');
    expect(html).toContain('<td class="td-good">보험료 계산</td>');
    expect(html).toContain('<span class="cat-tag cat-foreign">외래어·전문용어</span> 국민건강보험 (보험료 산정)');
    expect(html).toContain('<td class="td-bad">본인일부부담금</td>');
    expect(html).toContain('<td class="td-good">본인부담금</td>');
    expect(html).toContain('<span class="cat-tag cat-admin">행정관습어</span> 국민건강보험 (피부양자·산정특례 안내)');
    expect(html).toContain('<td class="td-bad">실업인정일</td>');
    expect(html).toContain('<td class="td-good">실업급여를 확인하는 날</td>');
    expect(html).toContain('<span class="cat-tag cat-foreign">외래어·전문용어</span> 고용24 (실업인정 인터넷 신청)');
    expect(html).toContain('<td class="td-bad">조기재취업수당</td>');
    expect(html).toContain('<td class="td-good">빨리 다시 취업했을 때 받는 수당</td>');
    expect(html).toContain('<span class="cat-tag cat-foreign">외래어·전문용어</span> 고용24 (조기재취업수당 안내)');
  });
});
