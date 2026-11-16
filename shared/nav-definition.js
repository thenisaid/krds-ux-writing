/**
 * shared/nav-definition.js — GNB 단일 정의 (정보 구조 '안 2')
 * 2026-11-13 · GNB 통일 1단계
 *
 * 브라우저 + Node.js + vitest 공용 (krds-lint.js 와 같은 UMD 방식)
 *   - Node:    const NAV = require('./shared/nav-definition.js');
 *   - 브라우저: window.KRDSNavDefinition
 *
 * 1차 탭 4개(원칙·사전·사례·도구) + 2차 탭, 홈 탭 없음(로고가 홈).
 * 이 파일은 데이터와 순수 함수만 담는다. DOM 접근·innerHTML 없음(CSP 영향 0).
 * 1단계에서는 아무 HTML 도 이 정의를 아직 사용하지 않는다.
 *
 * 근거: /tmp/nav-audit/REPORT.md (e)(f)(g)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.KRDSNavDefinition = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ─── 0. 공통 상수 ──────────────────────────────────────────────────────────
  // href 표기는 절대 경로 /krds-ux-writing/… 로 통일한다.
  // (shared/base-path.js 가 런타임에 이 접두사를 재작성하므로 상대경로 금지)
  var BASE = '/krds-ux-writing';

  // GNB(1차) 랜드마크 aria-label 단일값. 현재 가장 많이 쓰는 값("섹션 내비게이션")을 채택.
  var NAV_ARIA_LABEL = '섹션 내비게이션';
  // 2차 탭 랜드마크는 1차와 구분되는 별도 라벨이 필요하다(같은 라벨 nav 두 개 금지).
  var SUBNAV_ARIA_LABEL = '세부 메뉴';

  // 로고 링크 규칙: 페이지당 정확히 1개, aria-label 필수, 도착지는 사이트 루트.
  // 로고 안쪽 그래픽(태극 SVG vs 'K' 마크)은 이 단계에서 정하지 않는다(생성 대상 아님).
  var LOGO = {
    href: BASE + '/',
    ariaLabel: 'KRDS UX Writing 가이드라인 홈',
    rule: '페이지당 .gnb-logo 1개 · aria-label 필수 · href 는 사이트 루트(' + BASE + '/)'
  };

  // ─── 1. 확정되지 않은 사항 (오너 결정 대기) ────────────────────────────────
  // TODO(오너 결정): '도구' 탭의 도착 페이지 — 허브 페이지 신설 여부.
  //   신설 전까지는 기본값으로 린터를 도착지로 둔다. 허브를 만들면 이 값만 바꾸면 된다.
  var TOOLS_HUB_HREF = BASE + '/lint.html';

  // TODO(오너 결정): 'Before/After' 라벨의 한글화 여부(이 사이트 원칙은 '무번역').
  //   결정 전까지 현재 라벨을 그대로 두고, 영문 단독 라벨 금지 규칙에서만 일시 허용한다.
  //   한글화되면 이 목록에서 항목을 지운다(테스트가 미사용 허용 항목을 감지한다).
  var LABEL_TODO_ALLOW = {
    'Before/After': 'TODO(오너 결정): 한글화 여부 (예: "전후 비교")'
  };

  // ─── 2. 1차 탭 ─────────────────────────────────────────────────────────────
  // match[] : 사이트 상대 정규화 경로(normalizePath 결과)의 prefix. 가장 긴 prefix 가 이긴다.
  var PRIMARY_TABS = [
    {
      id: 'principles',
      label: '원칙',
      href: BASE + '/principles/',
      match: ['/principles']
    },
    {
      id: 'dictionary',
      label: '사전',
      href: BASE + '/dictionary/',
      // 권고안, 오너 미확정: 코퍼스는 사전 하위
      match: ['/dictionary', '/corpus']
    },
    {
      id: 'case-studies',
      label: '사례',
      href: BASE + '/case-studies/',
      // 권고안, 오너 미확정: 이슈 아카이브는 사례 하위
      match: ['/case-studies', '/archive']
    },
    {
      id: 'tools',
      label: '도구',
      href: TOOLS_HUB_HREF,
      // 허브 신설 여부는 TODO(오너 결정) — 위 TOOLS_HUB_HREF 참고
      hubHref: TOOLS_HUB_HREF,
      match: ['/prompt-library', '/before-after', '/lint', '/generator']
    }
  ];

  // ─── 3. 2차 탭 ─────────────────────────────────────────────────────────────
  // 2차 탭 라벨은 각 페이지 <title> 기준의 임시값이다(오너 미확정).
  // 원칙은 페이지 안에 LNB(사이드바)가 이미 있으므로 2차 탭을 두지 않는다.
  var SECONDARY_TABS = {
    principles: [],
    dictionary: [
      { id: 'dictionary-index', label: '대체어 사전', href: BASE + '/dictionary/', match: ['/dictionary'] },
      { id: 'dictionary-full', label: '전체 공개본', href: BASE + '/dictionary/full.html', match: ['/dictionary/full'] },
      // 권고안, 오너 미확정: 코퍼스는 사전 하위 2차 탭
      { id: 'corpus', label: '코퍼스', href: BASE + '/corpus/', match: ['/corpus'] }
    ],
    'case-studies': [
      { id: 'case-studies-index', label: '실전 사례', href: BASE + '/case-studies/', match: ['/case-studies'] },
      // 권고안, 오너 미확정: 이슈 아카이브는 사례 하위 2차 탭
      { id: 'archive', label: '이슈 아카이브', href: BASE + '/archive.html', match: ['/archive'] }
    ],
    tools: [
      { id: 'prompt-library', label: '프롬프트', href: BASE + '/prompt-library.html', match: ['/prompt-library'] },
      // TODO(오너 결정): 'Before/After' 라벨 한글화 여부
      { id: 'before-after', label: 'Before/After', href: BASE + '/before-after.html', match: ['/before-after'] },
      { id: 'lint', label: '린터', href: BASE + '/lint.html', match: ['/lint'] },
      { id: 'generator', label: '생성기', href: BASE + '/generator/', match: ['/generator'] }
    ]
  };

  // ─── 4. 페이지별 소속 (파일 경로 → 탭 id, 2차 탭 id) ───────────────────────
  // 홈(index.html)은 GNB 를 갖지만 활성 탭이 없다(tab: null).
  var PAGE_MAP = {
    'index.html': { tab: null, sub: null, home: true },

    'principles/index.html': { tab: 'principles', sub: null },
    'principles/components/index.html': { tab: 'principles', sub: null },
    'principles/core-info/index.html': { tab: 'principles', sub: null },
    'principles/derivative/index.html': { tab: 'principles', sub: null },
    'principles/foundation/index.html': { tab: 'principles', sub: null },
    'principles/governance/index.html': { tab: 'principles', sub: null },
    'principles/no-translation/index.html': { tab: 'principles', sub: null },
    'principles/notation/index.html': { tab: 'principles', sub: null },
    'principles/safety-net/index.html': { tab: 'principles', sub: null },
    'principles/structure/index.html': { tab: 'principles', sub: null },

    'dictionary/index.html': { tab: 'dictionary', sub: 'dictionary-index' },
    'dictionary/full.html': { tab: 'dictionary', sub: 'dictionary-full' },
    'corpus/index.html': { tab: 'dictionary', sub: 'corpus' },

    'case-studies/index.html': { tab: 'case-studies', sub: 'case-studies-index' },
    'archive.html': { tab: 'case-studies', sub: 'archive' },

    'prompt-library.html': { tab: 'tools', sub: 'prompt-library' },
    'before-after.html': { tab: 'tools', sub: 'before-after' },
    'lint.html': { tab: 'tools', sub: 'lint' },
    'generator/index.html': { tab: 'tools', sub: 'generator' }
  };

  // ─── 5. GNB 면제 목록 (파일 → 사유) ────────────────────────────────────────
  // 새 HTML 을 추가하면 PAGE_MAP 또는 여기 둘 중 하나에 반드시 분류해야 한다(테스트가 강제).
  var NAV_EXEMPT = {
    'sema_p1.html': '강연 슬라이드(SeMA) — 자체 슬라이드 내비게이션',
    'sema_p2.html': '강연 슬라이드(SeMA) — 자체 슬라이드 내비게이션',
    'sema_p3.html': '강연 슬라이드(SeMA) — 자체 슬라이드 내비게이션',
    'sema_p4.html': '강연 슬라이드(SeMA) — 자체 슬라이드 내비게이션',
    'demo-slides.html': '발표용 슬라이드 — GNB 면제',
    'krds-guide-intro.html': '소개 페이지 — GNB 면제',
    'ontology-query.html': '내부 도구 — 자체 header/nav (공개 여부는 오너 확인 필요)',
    'term-graph.html': '내부 도구 — 자체 header, 항상 다크 (공개 여부는 오너 확인 필요)',
    'krds-extension/popup.html': '크롬 확장 팝업 — 사이트 페이지 아님',
    'index-v2.html': '삭제 후보 — 어디서도 링크되지 않는 구버전 홈 (삭제 시 이 항목도 제거)',
    // 아래 항목은 오너 지정 면제 목록에 없던 것 — 분류 누락 방지를 위해 이 정의에서 추가함
    'offline-app/index.html': '오프라인 앱 번들 산출물 — scripts/build-offline-app.js 가 생성'
  };

  // ─── 6. 경로 정규화와 활성 탭 계산 ─────────────────────────────────────────
  // 사이트 상대 정규화 경로: 접두사(/krds-ux-writing)·쿼리·해시 제거,
  // index.html·후행 '/'·'.html' 제거. 예) /krds-ux-writing/lint.html → /lint
  function normalizePath(input) {
    var p = String(input == null ? '/' : input);
    p = p.split('#')[0].split('?')[0];
    if (p.indexOf(BASE) === 0 && (p.length === BASE.length || p.charAt(BASE.length) === '/')) {
      p = p.slice(BASE.length);
    }
    if (!p || p.charAt(0) !== '/') p = '/' + p;
    p = p.replace(/\/{2,}/g, '/').replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }

  // 세그먼트 단위 prefix 일치: '/lint' 는 '/lint-x' 와 일치하지 않는다.
  function matchesPrefix(path, prefix) {
    return path === prefix || path.indexOf(prefix + '/') === 0;
  }

  // 가장 긴 prefix 일치 항목을 고른다. 일치가 없으면 null.
  function longestMatch(path, items) {
    var best = null;
    var bestLen = -1;
    items.forEach(function (item) {
      item.match.forEach(function (prefix) {
        if (matchesPrefix(path, prefix) && prefix.length > bestLen) {
          best = item;
          bestLen = prefix.length;
        }
      });
    });
    return best;
  }

  // 활성 1차 탭 id. 홈·미분류 경로는 null (활성 탭 없음).
  function activeTabFor(path) {
    var tab = longestMatch(normalizePath(path), PRIMARY_TABS);
    return tab ? tab.id : null;
  }

  // 활성 2차 탭 id. 활성 1차 탭이 없거나 일치 항목이 없으면 null.
  function activeSubFor(path) {
    var normalized = normalizePath(path);
    var tabId = activeTabFor(normalized);
    if (!tabId) return null;
    var sub = longestMatch(normalized, SECONDARY_TABS[tabId] || []);
    return sub ? sub.id : null;
  }

  // aria-current 값 계산 (REPORT (e-5), 정적 마크업에 그대로 굽는다).
  //  - 2차 탭이 일치하면: 2차 항목 = "page", 1차 탭 = "true"
  //    (한 화면에 "현재 페이지"가 둘이 되는 스크린리더 중복을 피한다)
  //  - 2차 탭이 없는 탭(원칙): 랜딩 페이지 자신이면 "page", 하위 페이지면 "true"
  //  - 홈·미분류: 모두 null
  // 이견이 있으면 'page' 로 통일하는 변형이 가능하다(오너/리뷰어 확인 항목).
  function ariaCurrentFor(path) {
    var normalized = normalizePath(path);
    var tabId = activeTabFor(normalized);
    var result = { tabId: tabId, tab: null, subId: null, sub: null };
    if (!tabId) return result;

    var subId = activeSubFor(normalized);
    if (subId) {
      result.subId = subId;
      result.sub = 'page';
      result.tab = 'true';
      return result;
    }
    var tab = getTab(tabId);
    result.tab = normalizePath(tab.href) === normalized ? 'page' : 'true';
    return result;
  }

  function getTab(id) {
    for (var i = 0; i < PRIMARY_TABS.length; i++) {
      if (PRIMARY_TABS[i].id === id) return PRIMARY_TABS[i];
    }
    return null;
  }

  // 레포 파일 경로 → 공개 URL. 'x/index.html' → /krds-ux-writing/x/
  function pathForFile(file) {
    var f = String(file).replace(/^\.?\//, '');
    if (f === 'index.html') return BASE + '/';
    if (/\/index\.html$/.test(f)) return BASE + '/' + f.replace(/index\.html$/, '');
    return BASE + '/' + f;
  }

  // ─── 7. 라벨 규칙 ──────────────────────────────────────────────────────────
  // 반환: 위반 사유 배열(없으면 빈 배열). 한글 2자 이상, 영문 단독 금지(허용 목록 제외).
  function labelProblems(label) {
    var problems = [];
    var text = String(label == null ? '' : label).trim();
    if (Array.from(text).length < 2) problems.push('2자 미만');
    if (!/[가-힣]/.test(text) && /[A-Za-z]/.test(text) && !Object.prototype.hasOwnProperty.call(LABEL_TODO_ALLOW, text)) {
      problems.push('영문 단독 라벨');
    }
    return problems;
  }

  // 정의에 쓰인 모든 라벨 (1차 + 2차, 중복 제거 없음)
  function allLabels() {
    var labels = PRIMARY_TABS.map(function (t) { return t.label; });
    Object.keys(SECONDARY_TABS).forEach(function (id) {
      SECONDARY_TABS[id].forEach(function (s) { labels.push(s.label); });
    });
    return labels;
  }

  // ─── 8. 공개 API ───────────────────────────────────────────────────────────
  function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach(function (key) {
      var value = obj[key];
      if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
    });
    return Object.freeze(obj);
  }

  return deepFreeze({
    BASE: BASE,
    NAV_ARIA_LABEL: NAV_ARIA_LABEL,
    SUBNAV_ARIA_LABEL: SUBNAV_ARIA_LABEL,
    LOGO: LOGO,
    TOOLS_HUB_HREF: TOOLS_HUB_HREF,
    LABEL_TODO_ALLOW: LABEL_TODO_ALLOW,
    PRIMARY_TABS: PRIMARY_TABS,
    SECONDARY_TABS: SECONDARY_TABS,
    PAGE_MAP: PAGE_MAP,
    NAV_EXEMPT: NAV_EXEMPT,
    normalizePath: normalizePath,
    longestMatch: longestMatch,
    activeTabFor: activeTabFor,
    activeSubFor: activeSubFor,
    ariaCurrentFor: ariaCurrentFor,
    getTab: getTab,
    pathForFile: pathForFile,
    labelProblems: labelProblems,
    allLabels: allLabels,
    version: '0.1.0'
  });
});
