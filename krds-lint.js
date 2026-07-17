/**
 * krds-lint.js — KRDS UX Writing 자동화 린팅 엔진
 * 버전: 1.0.0 (2026-04-18)
 *
 * 브라우저 + Node.js 양쪽 호환
 * 거버넌스 조건 5: 라이팅 자동화(Linting) 도입 (IND-6)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js: jargon-dictionary.json 에서 로드 (없으면 인라인 폴백)
    var _dict = null;
    try {
      var _path = require('path').join(__dirname, 'jargon-dictionary.json');
      _dict = require(_path);
    } catch (e) {}
    module.exports = factory(_dict);
  } else {
    // 브라우저: window.KRDS_JARGON_DICT 로 주입 가능 (없으면 인라인 폴백)
    root.KRDSLint = factory(root.KRDS_JARGON_DICT || null);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (jargonDict) {

  // ─── 1. 행정어·전문용어 금지어 데이터베이스 (principles.md 2.1) ──────────────
  // Node.js: jargon-dictionary.json 자동 로드 (scripts/extract-jargon.js 로 재생성)
  // 브라우저: <script src="jargon-dictionary.js"> 또는 window.KRDS_JARGON_DICT 주입

  // 에러 메시지 금지 표현 (4.1) — jargon-dictionary.json 로드 여부와 무관하게 항상 포함
  const INLINE_JARGON = [
    { banned: '잘못 입력하셨습니다', alt: '"일치하지 않습니다" / "확인이 필요합니다"', cat: '에러 메시지' },
    { banned: '올바르지 않은 정보입니다', alt: '구체적 필드명 + 기대 형식 명시', cat: '에러 메시지' },
    { banned: '맞춤법 오류가 있는지 확인해 주세요', alt: '"결과를 찾지 못했습니다" + 검색 팁', cat: '에러 메시지' },
    { banned: '철자를 확인해 주세요', alt: '"결과를 찾지 못했습니다" + 검색 팁', cat: '에러 메시지' },
    { banned: '죄송합니다', alt: '공감 없이 건조하게 상황+행동만 제시', cat: '에러 메시지' },
    { banned: '비밀번호가 틀렸습니다', alt: '비밀번호가 일치하지 않습니다', cat: '에러 메시지' },
    { banned: '잘못 입력한 항목이 있습니다', alt: '확인이 필요한 항목이 있습니다', cat: '에러 메시지' },
  ];

  function normalizePlaceholderTildes(value) {
    return String(value || '').replace(/~/g, '').trim();
  }

  function normalizeJargonEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    var banned = normalizePlaceholderTildes(entry.banned);
    var alt = normalizePlaceholderTildes(entry.alt);
    var cat = String(entry.cat || '').trim();

    if (!banned || !alt || !cat) return null;

    return {
      banned: banned,
      alt: alt,
      cat: cat,
      bannedRegex: buildBannedRegex(banned),
    };
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function placeholderPattern(label) {
    var token = String(label || '').trim();

    if (/금액|요금|세액|가격|금전/.test(token)) {
      return '(?:\\d{1,3}(?:,\\d{3})*|\\d+)(?:\\.\\d+)?\\s*(?:원|만원|천원|억원|조원)';
    }
    if (/기간|기한|일정|시점|날짜/.test(token)) {
      return '(?:\\d{4}\\.\\d{2}~\\d{4}\\.\\d{2}|\\d{4}\\.\\d{2}(?:\\.\\d{2})?|\\d+~\\d+\\s*(?:일|개월|년)|\\d+\\s*(?:일|개월|년)(?:\\s*(?:이내|후|남음))?)';
    }
    if (/이름|명칭|기관|대상/.test(token)) {
      return '[\\uAC00-\\uD7A3A-Za-z0-9·\\s]+?';
    }

    return '[^\\n/]+?';
  }

  function buildBannedRegex(banned) {
    var placeholderRe = /\[([^\]]+)\]/g;
    if (!placeholderRe.test(banned)) return null;

    placeholderRe.lastIndex = 0;

    var source = '';
    var lastIndex = 0;
    var match;

    while ((match = placeholderRe.exec(banned)) !== null) {
      source += escapeRegExp(banned.slice(lastIndex, match.index));
      source += placeholderPattern(match[1]);
      lastIndex = match.index + match[0].length;
    }

    source += escapeRegExp(banned.slice(lastIndex));

    return new RegExp(source, 'g');
  }

  function buildJargonEntries(entries) {
    var seen = new Set();

    return entries
      .map(normalizeJargonEntry)
      .filter(function (entry) {
        if (!entry) return false;
        if (seen.has(entry.banned)) return false;
        seen.add(entry.banned);
        return true;
      });
  }

  // jargon-dictionary.json이 로드되면 INLINE_JARGON을 병합 (dedup by banned)
  const ADMIN_JARGON = (jargonDict && jargonDict.entries)
    ? buildJargonEntries([...jargonDict.entries, ...INLINE_JARGON.filter(function(e) {
        return !jargonDict.entries.some(function(d) { return d && d.banned === e.banned; });
      })])
    : buildJargonEntries([
    // 카테고리 1: 행정 관습어 (한자어·관청 은어)
    { banned: '명일까지', alt: '내일까지', cat: '행정 관습어' },
    { banned: '직접 내방하여', alt: '직접 방문하여', cat: '행정 관습어' },
    { banned: '내방하여', alt: '방문하여', cat: '행정 관습어' },
    { banned: '내방해', alt: '방문해', cat: '행정 관습어' },
    { banned: '기표 완료', alt: '등록 완료', cat: '행정 관습어' },
    { banned: '상기 사항', alt: '위 내용', cat: '행정 관습어' },
    { banned: '동 기간 내', alt: '같은 기간 안에', cat: '행정 관습어' },
    { banned: '익일까지', alt: '다음 날까지', cat: '행정 관습어' },
    { banned: '전일 기준', alt: '전날 기준', cat: '행정 관습어' },
    { banned: '교부 신청', alt: '발급 신청', cat: '행정 관습어' },
    { banned: '교부 청구', alt: '발급 요청', cat: '행정 관습어' },
    { banned: '교부서류', alt: '발급 서류', cat: '행정 관습어' },
    { banned: '귀책사유', alt: '잘못, 책임', cat: '행정 관습어' },
    { banned: '귀하', alt: '고객님, 신청인', cat: '행정 관습어' },
    { banned: '파기', alt: '삭제', cat: '행정 관습어' },
    { banned: '정보주체', alt: '(본인), 개인정보 보유 대상자', cat: '행정 관습어' },
    { banned: '피부양자', alt: '부양가족', cat: '행정 관습어' },
    { banned: '본인일부부담금', alt: '본인부담금', cat: '행정 관습어' },
    { banned: '산정특례', alt: '중증질환 본인부담 감면', cat: '행정 관습어' },
    { banned: '법정대리인', alt: '부모님 또는 후견인', cat: '행정 관습어' },
    { banned: '인우인 보증서', alt: '신원 보증서', cat: '행정 관습어' },
    { banned: '소명자료', alt: '증빙 자료', cat: '행정 관습어' },
    { banned: '변상금', alt: '손해배상금, 보상금', cat: '행정 관습어' },
    { banned: '과태료 부과', alt: '과태료 청구', cat: '행정 관습어' },
    { banned: '행정처분', alt: '행정 제재', cat: '행정 관습어' },
    { banned: '전출 신고', alt: '주소 옮김 신고', cat: '행정 관습어' },
    { banned: '경정청구', alt: '세금 환급 신청', cat: '행정 관습어' },
    { banned: '원천징수', alt: '급여에서 미리 뗀 세금', cat: '행정 관습어' },
    { banned: '연말정산', alt: '한 해 세금 정산', cat: '행정 관습어' },
    { banned: '가산세', alt: '추가 세금', cat: '행정 관습어' },
    { banned: '체납', alt: '세금·보험료 미납', cat: '행정 관습어' },
    { banned: '결손처분', alt: '세금 면제 처리', cat: '행정 관습어' },
    { banned: '예정신고', alt: '미리 신고', cat: '행정 관습어' },
    { banned: '예정고지', alt: '미리 청구', cat: '행정 관습어' },
    { banned: '부득이한 사유', alt: '불가피한 사정, 어쩔 수 없는 경우', cat: '행정 관습어' },
    { banned: '탈세제보', alt: '불법 탈세 신고', cat: '행정 관습어' },
    { banned: '신분증명서', alt: '신분증', cat: '행정 관습어' },
    { banned: '기초생활수급자', alt: '기초생활 지원 대상자', cat: '행정 관습어' },
    { banned: '차상위계층', alt: '기초생활 지원 바로 위 소득 계층', cat: '행정 관습어' },
    { banned: '수급권자', alt: '지원 대상자', cat: '행정 관습어' },
    { banned: '의료급여', alt: '의료비 지원', cat: '행정 관습어' },
    { banned: '현물지급', alt: '물품으로 지급', cat: '행정 관습어' },
    { banned: '선정기준', alt: '지원 자격', cat: '행정 관습어' },
    { banned: '취약계층', alt: '도움이 필요한 분, 어려운 형편의 가구', cat: '행정 관습어' },
    { banned: '지급개시일', alt: '지원 시작일', cat: '행정 관습어' },
    { banned: '고유식별정보', alt: '주민등록번호 (병기 설명 사용)', cat: '행정 관습어' },
    { banned: '신청간주', alt: '자동 신청 처리', cat: '행정 관습어' },
    { banned: '공시가격', alt: '정부가 발표한 기준 가격', cat: '행정 관습어' },
    { banned: '연부연납', alt: '분할 납부', cat: '행정 관습어' },
    { banned: '납부유예', alt: '납부 연기, 나중에 내기', cat: '행정 관습어' },
    { banned: '과세이연', alt: '세금 납부 미루기', cat: '행정 관습어' },
    { banned: '국선대리인', alt: '무료 세무 대리인', cat: '행정 관습어' },
    { banned: '자활', alt: '자립, 스스로 살아가기', cat: '행정 관습어' },

    // 카테고리 3: 외래어·전문 용어
    { banned: '행태정보', alt: '행동 패턴 정보, 브라우징 기록', cat: '전문 용어' },
    { banned: '디스클로저', alt: '접기·펼치기', cat: '전문 용어' },
    { banned: '코치마크', alt: '초보자 안내 표시', cat: '전문 용어' },
    { banned: '플로팅 버튼', alt: '떠 있는 버튼, 빠른 버튼', cat: '전문 용어' },
    { banned: '아카이브', alt: '자료실, 기록 보관소', cat: '전문 용어' },
    { banned: '레거시', alt: '기존 시스템, 이전 방식', cat: '전문 용어' },
    { banned: 'API 연동', alt: '시스템 연결', cat: '전문 용어' },
    { banned: '임의비급여', alt: '보험 미적용 비용', cat: '전문 용어' },
    { banned: '요양급여', alt: '의료비 지원, 건강보험 혜택', cat: '전문 용어' },
    { banned: '전자바우처', alt: '전자 서비스 이용권, 복지카드', cat: '전문 용어' },
    { banned: '수탁자', alt: '위탁 업체', cat: '전문 용어' },
    { banned: '파생상품', alt: '선물·옵션 등 파생금융상품', cat: '전문 용어' },

    // 카테고리 5: 과도한 경어
    { banned: '하시기 바랍니다', alt: '해 주세요', cat: '과도한 경어' },
    { banned: '하여 주시기 바랍니다', alt: '해 주세요', cat: '과도한 경어' },
    { banned: '하시길 권장드립니다', alt: '하세요 / 하는 것을 권합니다', cat: '과도한 경어' },
    { banned: '해 주시어 감사합니다', alt: '해 주셔서 감사합니다', cat: '과도한 경어' },
    { banned: '하실 수 있으십니다', alt: '하실 수 있습니다', cat: '과도한 경어' },
    { banned: '이용해 주시면 감사하겠습니다', alt: '이용해 주세요', cat: '과도한 경어' },
    { banned: '문의하여 주시기 바랍니다', alt: '문의해 주세요', cat: '과도한 경어' },
    { banned: '되오니 양지하여 주시기 바랍니다', alt: '이오니 참고해 주세요', cat: '과도한 경어' },
    { banned: '드리오니', alt: '드리니', cat: '과도한 경어' },
    { banned: '협조를 부탁드리오며', alt: '협조 부탁드립니다', cat: '과도한 경어' },
    { banned: '하여야 합니다', alt: '해야 합니다 / 하세요', cat: '과도한 경어' },
    { banned: '제출하시기 바랍니다', alt: '제출하세요', cat: '과도한 경어' },
    { banned: '확인하시기 바랍니다', alt: '확인하세요', cat: '과도한 경어' },
    { banned: '갈음할 수 있습니다', alt: '대신합니다', cat: '행정 관습어' },
    { banned: '한 것으로 간주됩니다', alt: '한 것으로 봅니다', cat: '행정 관습어' },
    { banned: '이행하지 아니한 경우에는', alt: '하지 않으면', cat: '이중 부정' },

    // 에러 메시지 금지 표현 (4.1)
    { banned: '잘못 입력하셨습니다', alt: '"일치하지 않습니다" / "확인이 필요합니다"', cat: '에러 메시지' },
    { banned: '올바르지 않은 정보입니다', alt: '구체적 필드명 + 기대 형식 명시', cat: '에러 메시지' },
    { banned: '맞춤법 오류가 있는지 확인해 주세요', alt: '"결과를 찾지 못했습니다" + 검색 팁', cat: '에러 메시지' },
    { banned: '철자를 확인해 주세요', alt: '"결과를 찾지 못했습니다" + 검색 팁', cat: '에러 메시지' },
    { banned: '죄송합니다', alt: '공감 없이 건조하게 상황+행동만 제시', cat: '에러 메시지' },
    { banned: '비밀번호가 틀렸습니다', alt: '비밀번호가 일치하지 않습니다', cat: '에러 메시지' },
    { banned: '잘못 입력한 항목이 있습니다', alt: '확인이 필요한 항목이 있습니다', cat: '에러 메시지' },
  ]);

  const ADMIN_JARGON_MATCH_ORDER = ADMIN_JARGON.slice().sort(function (a, b) {
    return b.banned.length - a.banned.length;
  });

  // ─── 2. 패턴 기반 규칙 ───────────────────────────────────────────────────────

  const PATTERN_RULES = [

    // 이중 피동형
    {
      id: 'double-passive',
      name: '이중 피동형',
      severity: 'error',
      pattern: /되어지다|받아지다|되어져|받아져|되어지|받아지/g,
      message: (match) => `이중 피동형 "${match}" — "되다" 또는 능동형으로 교체하세요.`,
      alt: '"처리됩니다", "완료됩니다" 등 단순 피동형 사용',
    },

    // 과잉 존칭 (-시- 남용)
    {
      id: 'excessive-honorific',
      name: '과잉 존칭',
      severity: 'warning',
      pattern: /처리되시겠습니다|완료되시겠습니다|진행되시겠습니다|발송되시겠습니다|입력되시면|확인되시면|[\uac00-\ud7a3\w]{1,5}되시[\uac00-\ud7a3\w]{0,5}겠습니다/g,
      message: (match) => `과잉 존칭 "${match}" — 주어를 명확히 하고 "-시-"를 제거하세요.`,
      alt: '"처리됩니다", "완료됩니다"',
    },

    // 주관적 부사
    {
      id: 'subjective-adverb',
      name: '주관적 부사',
      severity: 'warning',
      // 빠르게(?!\s*\S*하려면): 절차 안내 문맥 ("빠르게 처리하려면 ~하세요") 면제
      pattern: /빠르게(?!\s*\S*하려면)|빠른|신속하게|신속히|간편하게|간편한|쉽게|쉬운|편리하게|편리한|안전하게|안전한|정확하게|편하게/g,
      message: (match) => `주관적 부사 "${match}" — 수치 또는 구체적 사실로 대체하세요.`,
      alt: '"3초 안에", "2단계로", "99.9% 정확도" 등 수치 기반 표현',
    },

    // 금지 문자 패턴
    {
      id: 'forbidden-char-excl',
      name: '금지 문자: 느낌표 연속',
      severity: 'error',
      pattern: /!{2,}/g,
      message: () => '느낌표 2개 이상(!!) — 단일 느낌표 또는 제거하세요. 오류 메시지에는 느낌표 금지.',
      alt: '느낌표 제거 또는 1개만 사용',
    },
    {
      id: 'forbidden-char-tilde',
      name: '금지 문자: 물결표(~)',
      severity: 'warning',
      pattern: /~/g,
      message: () => '물결표(~) — "부터", "까지", "-" 또는 구체적 표현으로 대체하세요.',
      alt: '"5만원부터 10만원까지", "5-10만원"',
    },
    {
      id: 'forbidden-char-mandatory',
      name: '금지 표현: (필수)',
      severity: 'warning',
      pattern: /\(필수\)/g,
      message: () => '"(필수)" — 별표(*)와 범례("*필수 항목") 패턴으로 대체하거나 레이블 디자인으로 표현하세요.',
      alt: '레이블 옆 * 표시 + 페이지 하단 "* 필수 입력 항목" 안내',
    },
    {
      id: 'forbidden-char-note',
      name: '금지 문자: 참고 기호(※)',
      severity: 'warning',
      pattern: /※/g,
      message: () => '"※" — "참고:", "주의:", "[안내]" 등 일상어 레이블로 대체하세요.',
      alt: '"참고:", "주의:", "안내:"',
    },

    // 이중 부정
    {
      id: 'double-negative',
      name: '이중 부정',
      severity: 'error',
      // 한국어에서 실제로 자주 쓰이는 이중 부정 템플릿만 잡아 과검출을 줄인다.
      pattern: /(?:[\uac00-\ud7a3A-Za-z0-9_-]+지\s*않(?:으면|는다면?)\s*안\s*(?:됩(?:니다|니까)?|된다|되다|됨|돼요|돼)|없지\s*않(?:습니다|는다|다)|미비하지\s*않(?:으면|습니다|다)|불가능하지\s*않(?:습니다|다))/g,
      message: (match) => `이중 부정 "${match.substring(0,30)}..." — 긍정문으로 전환하세요.`,
      alt: '"모두 준비되면 신청할 수 있습니다" 등 긍정문 사용',
    },

    // 오류 메시지 단독 금지 (연속 패턴은 한 번만 카운트)
    {
      id: 'standalone-error-retry',
      name: '에러 메시지: 단독 재시도 요청',
      severity: 'warning',
      // 재시도 단독 요청 + 원인 없는 오류 문장을 하나의 패턴으로 묶어 중복 억제
      pattern: /(?:오류가 발생했습니다\.\s*(?:다시 시도해 주세요\.)?|시스템 오류입니다\.\s*(?:다시 시도해 주세요\.)?|잠시 후 다시 시도해 주세요\.|(?<!(?:오류가 발생했습니다|시스템 오류입니다)\.\s*)다시 시도해 주세요\.)/g,
      message: (match) => `에러 메시지 금지 표현 — 3단 구조(상황+원인+행동)로 대체하세요.`,
      alt: '1단(상황) + 2단(원인) + 3단(행동) 구조',
    },

    // ERROR 코드 단독 노출
    {
      id: 'error-code-standalone',
      name: '에러 코드 단독 노출',
      severity: 'error',
      pattern: /ERROR\s*\d+/gi,
      message: (match) => `에러 코드 "${match}" 단독 노출 — 1단(상황 설명)으로 대체하고 코드는 괄호 병기.`,
      alt: '"파일을 올리지 못했습니다. (오류 코드: 4023)"',
    },

    // 명사 체인 (14자 이상 수식어)
    {
      id: 'noun-chain',
      name: '과도한 명사 체인',
      severity: 'info',
      pattern: /[\uac00-\ud7a3·]{14,}(이|을|를|의|에|으로|로|와|과|이다|합니다)/g,
      message: (match) => `명사 체인 의심 "${match.substring(0,20)}..." — 동사 구조로 풀어쓰세요.`,
      alt: '"UI를 만드는 기본 재료입니다" 등 동사 구조 사용',
    },

    // 번역투: ~에 대한/에 대하여 명사 수식 (일본어·영어 번역 잔재)
    {
      id: 'translation-artifact',
      name: '번역투 표현',
      severity: 'warning',
      // "~에 대한 안내", "~에 대하여 설명" 등
      // 단, FAQ·영문 단어 바로 뒤 레이블성 표현은 면제
      pattern: /[가-힣A-Za-z0-9]{2,}에\s*대한\s*[가-힣]{2,}|[가-힣A-Za-z0-9]{2,}에\s*대하여/g,
      message: (match) => `번역투 "${match}" — 동사 구조로 바꾸세요.`,
      alt: '"~을 안내합니다", "~를 설명합니다" 등 직접 서술 구조',
    },

    // 일본어 관청 번역투: ~를 실시하다/도모하다/에 즈음하여
    {
      id: 'japanese-translation',
      name: '일본어 번역투',
      severity: 'warning',
      pattern: /을\s*실시하|를\s*실시하|을\s*도모하|를\s*도모하|에\s*즈음하여|을\s*강구하|에\s*임하여|에\s*관한\s*건/g,
      message: (match) => `일본어 번역투 "${match}" — 직접 서술형으로 바꾸세요.`,
      alt: '"~합니다", "~를 추진합니다" 등 자연스러운 한국어 표현',
    },

    // 명사화 남용: -화/-성/-적 과도한 추상화 (GOV.UK·국어원 공통 지적)
    {
      id: 'over-nominalization',
      name: '명사화 남용',
      severity: 'info',
      // "-화를", "-성을", "-적인" 이 명사 뒤에 오는 패턴
      pattern: /[가-힣]{2,}화를\s|[가-힣]{2,}화가\s|[가-힣]{2,}화에\s|[가-힣]{2,}성을\s확보|[가-힣]{2,}성이\s요구|[가-힣]{2,}적인\s[가-힣]/g,
      message: (match) => `명사화 남용 "${match}" — 동사 구조로 풀어쓰세요.`,
      alt: '"~을 확보합니다", "~이 필요합니다" 등 동사형 표현',
    },

    // 에러 메시지: 행동 지침 누락 (GOV.UK·NARA 3단 구조 기준)
    // 에러성 키워드로 끝나는 문장 → 같은 줄에 행동 지침("하세요" 등)이 없을 때
    {
      id: 'error-no-action',
      name: '에러 메시지: 행동 지침 누락',
      severity: 'error',
      // 에러 키워드 + "습니다/됩니다" + 마침표 → 같은 줄 120자 내에 행동 지침 없으면 감지
      // 같은 줄에 "하세요/해 주세요/바랍니다" 등이 있으면 면제 (부정 전방탐색)
      pattern: /(?:오류|실패|불가능|처리할 수 없|등록할 수 없|확인할 수 없|만료|초과)[^.。\n]*?(?:습니다|됩니다|입니다)[.。](?!(?:[^.。\n]{0,120})(?:하세요|해 주세요|해주세요|바랍니다|하시기 바랍니다|눌러|선택하|입력하))/g,
      message: () => '에러 메시지에 행동 지침("~하세요")이 없습니다. 상황+원인+행동 3단 구조로 완성하세요.',
      alt: '"파일 크기가 초과되었습니다. 5MB 이하로 줄여 다시 업로드해 주세요."',
    },

    // 문장 길이: 60자 초과 단일 문장 (국어원 구어적 문서 60자, 공문서 70자 기준)
    // ※ PATTERN_RULES는 줄 단위 적용 — 마침표 없이 이어지는 긴 구문을 감지
    {
      id: 'long-sentence',
      name: '과도하게 긴 문장',
      severity: 'info',
      // 마침표 없이 60자 이상 이어지는 한글+공백 연속 구문
      pattern: /[가-힣][가-힣\s,·]{58,}[가-힣]/g,
      message: (match) => `긴 문장 (${match.length}자) — 국어원 권고 60~70자 이내로 분리하세요.`,
      alt: '한 문장에 하나의 정보만 담고, 긴 문장은 두 문장으로 분리하세요.',
    },
  ];

  // ─── 3. 린팅 핵심 함수 ──────────────────────────────────────────────────────

  /**
   * 텍스트를 린팅합니다.
   * @param {string} text - 검사할 텍스트
   * @param {object} options
   * @param {boolean} options.checkAdminJargon - 행정어 검사 여부 (기본 true)
   * @param {boolean} options.checkPatterns - 패턴 검사 여부 (기본 true)
   * @returns {LintResult}
   */
  function lint(text, options) {
    options = Object.assign({ checkAdminJargon: true, checkPatterns: true, minSeverity: 'info' }, options || {});
    const SEV_ORDER = { error: 0, warning: 1, info: 2 };
    const minSevOrd = SEV_ORDER[options.minSeverity] != null ? SEV_ORDER[options.minSeverity] : 2;
    text = text == null ? '' : String(text);

    const issues = [];
    const lines = text.split('\n');

    // 3-1. 행정어 검사
    if (options.checkAdminJargon) {
      lines.forEach(function (line, lineIdx) {
        var occupiedRanges = [];

        ADMIN_JARGON_MATCH_ORDER.forEach(function (entry) {
          if (entry.bannedRegex) {
            var re = new RegExp(entry.bannedRegex.source, entry.bannedRegex.flags);
            var match;

            while ((match = re.exec(line)) !== null) {
              var matchedText = match[0];
              var start = match.index;
              var end = start + matchedText.length;
              var overlaps = occupiedRanges.some(function (range) {
                return start < range.end && end > range.start;
              });

              if (!overlaps) {
                issues.push({
                  type: 'admin-jargon',
                  severity: 'error',
                  category: entry.cat,
                  line: lineIdx + 1,
                  col: start + 1,
                  match: matchedText,
                  message: '행정어/금지어: "' + matchedText + '"',
                  suggestion: '→ ' + entry.alt,
                });
                occupiedRanges.push({ start: start, end: end });
              }

              if (matchedText.length === 0) re.lastIndex += 1;
            }

            return;
          }

          let idx = line.indexOf(entry.banned);
          while (idx !== -1) {
            var end = idx + entry.banned.length;
            var overlaps = occupiedRanges.some(function (range) {
              return idx < range.end && end > range.start;
            });

            if (!overlaps) {
              issues.push({
                type: 'admin-jargon',
                severity: 'error',
                category: entry.cat,
                line: lineIdx + 1,
                col: idx + 1,
                match: entry.banned,
                message: '행정어/금지어: "' + entry.banned + '"',
                suggestion: '→ ' + entry.alt,
              });
              occupiedRanges.push({ start: idx, end: end });
            }

            idx = line.indexOf(entry.banned, idx + 1);
          }
        });
      });
    }

    // 3-2. 패턴 규칙 검사
    if (options.checkPatterns) {
      PATTERN_RULES.forEach(function (rule) {
        lines.forEach(function (line, lineIdx) {
          var re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '') + 'g');
          var m;
          while ((m = re.exec(line)) !== null) {
            issues.push({
              type: rule.id,
              severity: rule.severity,
              category: rule.name,
              line: lineIdx + 1,
              col: m.index + 1,
              match: m[0],
              message: rule.message(m[0]),
              suggestion: '→ ' + rule.alt,
            });
          }
        });
      });
    }

    // 3-3. 중복 제거 (같은 줄+위치+타입)
    const seen = new Set();
    const deduped = issues.filter(function (issue) {
      const key = issue.type + ':' + issue.line + ':' + issue.col + ':' + issue.match;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 3-4. minSeverity 필터 (Vale 스타일 옵션)
    const filtered = minSevOrd < 2
      ? deduped.filter(function (i) { return (SEV_ORDER[i.severity] || 0) <= minSevOrd; })
      : deduped;

    // 3-5. 정렬 (줄 → 열 순)
    filtered.sort(function (a, b) {
      return a.line !== b.line ? a.line - b.line : a.col - b.col;
    });

    // 3-6. 요약 생성
    const summary = {
      total: filtered.length,
      errors: filtered.filter(function (i) { return i.severity === 'error'; }).length,
      warnings: filtered.filter(function (i) { return i.severity === 'warning'; }).length,
      infos: filtered.filter(function (i) { return i.severity === 'info'; }).length,
    };

    return {
      issues: filtered,
      summary: summary,
      score: computeScore(text, summary),
    };
  }

  // 이슈 심각도별 패널티 가중치 (품질 점수 차감)
  var PENALTY_ERROR   = 10;
  var PENALTY_WARNING = 5;
  var PENALTY_INFO    = 2;

  /**
   * 품질 점수 계산 (0~100)
   * 이슈가 없을수록 100에 가까움
   *
   * 한계: 공백 기준 어절 분리 방식으로, 교착어인 한국어에서는
   * 형태소 단위 정규화 대비 base 값이 작아 점수가 낮게 산정될 수 있음.
   * Phase 2: 형태소 분석기(Kiwi 등) 연동으로 개선 예정. (TODOS.md 참조)
   */
  function computeScore(text, summary) {
    // 어절(공백 구분) 수 기반 기준점 — 한국어 형태소 미분리 (TODO: Phase 2)
    const words = text.replace(/\s+/g, ' ').trim().split(' ').length;
    const base = Math.max(words, 1);
    const penalty = (summary.errors * PENALTY_ERROR) + (summary.warnings * PENALTY_WARNING) + (summary.infos * PENALTY_INFO);
    const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / base) * 100)));
    return score;
  }

  /**
   * CLI 출력용 포맷터
   */
  function formatCLI(result) {
    const lines = [];
    result.issues.forEach(function (issue) {
      const icon = { error: '❌', warning: '⚠️', info: 'ℹ️' }[issue.severity] || '•';
      lines.push(icon + ' [' + issue.line + ':' + issue.col + '] [' + issue.category + '] ' + issue.message);
      lines.push('   ' + issue.suggestion);
    });
    lines.push('');
    lines.push('─'.repeat(50));
    lines.push('총 이슈: ' + result.summary.total +
      ' (오류 ' + result.summary.errors +
      ' / 경고 ' + result.summary.warnings +
      ' / 안내 ' + result.summary.infos + ')');
    lines.push('품질 점수: ' + result.score + '/100');
    return lines.join('\n');
  }

  // ─── 4. 공개 API ────────────────────────────────────────────────────────────

  return {
    lint: lint,
    formatCLI: formatCLI,
    ADMIN_JARGON: ADMIN_JARGON,
    PATTERN_RULES: PATTERN_RULES,
    version: '1.0.0',
  };

});
