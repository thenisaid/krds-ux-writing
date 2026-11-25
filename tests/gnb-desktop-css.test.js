// shared/gnb-desktop.css 와 이를 링크하는 9쪽(dictionary 2쪽·corpus·case-studies + archive·before-after + generator·lint + index)의 데스크톱 GNB 계약 (D0~D4).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '..');
const SYNC = require('../scripts/sync-site-nav.js');

// D1: 하위 폴더 쪽(링크 ../shared/…). D2: 루트 쪽(링크 shared/…) — 헤더 구조가 서로 다르다.
// D3: generator/index.html(하위 폴더, .gnb 클래스 없는 .site-header)·lint.html(루트, 바깥 요소를 <header class="gnb"> 로 바꿈).
const SUB_PAGES = ['dictionary/index.html', 'dictionary/full.html', 'corpus/index.html', 'case-studies/index.html', 'generator/index.html'];
// D4: index.html(홈, 루트 쪽) — 2차 탭이 없고 현재 위치 탭도 없다(tab null). 배지 v2.0 은 .gnb-actions 안에 남는다.
const ROOT_PAGES = ['archive.html', 'before-after.html', 'lint.html', 'index.html'];
const HOME = 'index.html';
const PAGES = [...SUB_PAGES, ...ROOT_PAGES];
// 헤더 안에서 gnb:end 마커 뒤에 오는 첫 요소(마커가 이 앞에 있어야 한다). archive 는 .gnb-actions 가 없고 테마 버튼이 바로 온다.
const AFTER_MARKER = { 'archive.html': 'class="gnb-theme-btn"', 'lint.html': 'class="gnb-theme-btn"', 'generator/index.html': 'id="genThemeToggle"' };
const HEADER_OPEN = {
  'archive.html': '<header class="gnb" role="banner">',
  'before-after.html': '<header class="gnb" role="banner">',
  'lint.html': '<header class="gnb" role="banner">',
  'generator/index.html': '<header class="site-header">',
  'index.html': '<header class="gnb" id="gnb" role="banner">',
};
// 테마 버튼 id 와 .gnb-badge 유무(archive·lint·generator 에는 배지가 없다).
const THEME_ID = { 'lint.html': 'themeToggle', 'generator/index.html': 'genThemeToggle' };
const NO_BADGE = ['archive.html', 'lint.html', 'generator/index.html'];
// shared/style.css 를 쓰는 쪽은 같은 규칙이 이미 있어 이 CSS 를 링크하지 않는다.
const STYLE_CSS_PAGES = [
  'principles/index.html', 'principles/components/index.html', 'principles/core-info/index.html',
  'principles/derivative/index.html', 'principles/foundation/index.html', 'principles/governance/index.html',
  'principles/no-translation/index.html', 'principles/notation/index.html', 'principles/safety-net/index.html',
  'principles/structure/index.html', 'prompt-library.html',
];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const count = (text, re) => (text.match(re) || []).length;
const CSS = read('shared/gnb-desktop.css');
const CSS_NO_COMMENT = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('shared/gnb-desktop.css', () => {
  it('(a) 너비 중단점은 min-width: 901px 하나뿐이다(700/480/640/max-width 없음)', () => {
    const widths = [...CSS_NO_COMMENT.matchAll(/\(\s*((?:min|max)-width)\s*:\s*(\d+px)\s*\)/g)].map((m) => m[1] + ': ' + m[2]);
    expect(widths.length).toBeGreaterThan(0);
    widths.forEach((w) => expect(w).toBe('min-width: 901px'));
    expect(CSS_NO_COMMENT).not.toMatch(/max-width/);
    [700, 480, 640, 720, 900, 920].forEach((n) => expect(CSS_NO_COMMENT).not.toMatch(new RegExp('\\b' + n + 'px')));
  });

  it('(a2) 모든 규칙이 데스크톱 @media 안에 있다 — 최상위(미디어 밖)에 규칙이 없어 drawer.css 의 900px 이하 숨김을 덮지 않는다', () => {
    // 최상위 블록(중괄호 깊이 0 에서 시작)의 머리글이 모두 @media 여야 한다. 중첩 @supports 도 허용한다.
    const heads = [];
    let depth = 0;
    let buf = '';
    for (const ch of CSS_NO_COMMENT) {
      if (ch === '{') { if (depth === 0) heads.push(buf.trim()); depth += 1; buf = ''; }
      else if (ch === '}') { depth -= 1; buf = ''; }
      else if (depth === 0) buf += ch;
    }
    expect(depth).toBe(0);
    expect(heads.length).toBeGreaterThan(0);
    heads.forEach((h) => expect(h).toMatch(/^@media\s*\(\s*min-width:\s*901px\s*\)/));
    expect(buf.trim()).toBe('');
  });

  it('(b) .gnb-subnav·[aria-current] 규칙이 있고, 현재 위치는 굵기 700 + 2px 밑줄을 함께 쓴다(색 단독 금지, 틴트 배경 없음)', () => {
    expect(CSS_NO_COMMENT).toMatch(/\.gnb-subnav\s*\{[^}]*display:\s*flex/);
    expect(CSS_NO_COMMENT).toMatch(/\.gnb-subnav-link\s*\{[^}]*font-size:\s*13px[^}]*padding:\s*6px 10px[^}]*border-radius:\s*6px/);
    const m = CSS_NO_COMMENT.match(/\.gnb-nav-link\[aria-current\],\s*\.gnb-subnav-link\[aria-current\]\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/font-weight:\s*700/);
    expect(m[1]).toMatch(/text-decoration:\s*underline/);
    expect(m[1]).toMatch(/text-decoration-thickness:\s*2px/);
    expect(m[1]).toMatch(/text-underline-offset:\s*6px/);
    expect(m[1]).toMatch(/background:\s*none/);
  });

  it('(b2) 2차 탭은 1차 탭 바로 옆에 온다: .gnb-nav 는 flex: 0 1 auto, 2차 탭은 같은 줄(margin-left 8px, padding-left 12px, border-left)', () => {
    expect(CSS_NO_COMMENT).toMatch(/\.gnb-nav\s*\{\s*flex:\s*0 1 auto/);
    const sub = CSS_NO_COMMENT.match(/\.gnb-subnav\s*\{([^}]*)\}/)[1];
    expect(sub).toMatch(/margin-left:\s*8px/);
    expect(sub).toMatch(/padding-left:\s*12px/);
    expect(sub).toMatch(/border-left:\s*1px solid/);
  });

  it('(c) 하드코딩 색은 변수 폴백 자리나 --g-* 변수 정의에만 있다(규칙 본문은 변수만 쓴다)', () => {
    const colorRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
    // var(--x, fallback) 의 폴백 안 색을 걷어낸다.
    const withoutVarFallbacks = CSS_NO_COMMENT.replace(/var\(--[\w-]+,\s*(?:var\([^()]*(?:\([^()]*\)[^()]*)*\)|[^()]*)\)/g, 'var(--x)');
    const offenders = withoutVarFallbacks.split('\n').filter((line) => colorRe.test(line) && !/^\s*--g-[\w-]+:/.test(line) && !/\[data-theme="dark"\]\s+\.gnb\s*\{\s*--g-accent:/.test(line));
    expect(offenders).toEqual([]);
    // 폴백 체인은 페이지의 두 변수 계열을 모두 받는다.
    expect(CSS).toContain('--g-text: var(--text, var(--color-text,');
    expect(CSS).toContain('--g-muted: var(--text-muted, var(--color-text-muted,');
    expect(CSS).toContain('--g-accent: var(--accent, var(--color-primary,');
    expect(CSS).toContain('--g-border: var(--border, var(--color-border,');
    // 현재 위치 색: 라이트는 accent 에 본문색을 섞어(color-mix) 어둡게 해 4.5:1 을 확보하고, 다크는 accent(#86aff9) 를 그대로 쓴다.
    expect(CSS).toMatch(/\[data-theme="dark"\]\s+\.gnb\s*\{\s*--g-accent:\s*#86aff9/);
    expect(CSS).toMatch(/--g-current:\s*color-mix\(in srgb,\s*var\(--g-accent\)\s*70%,\s*var\(--g-text\)\)/);
    expect(CSS).toMatch(/\[data-theme="dark"\]\s+\.gnb\s*\{\s*--g-current:\s*var\(--g-accent\)/);
    // 현재 위치 규칙은 --g-current 를 쓴다(--g-accent 아님).
    expect(CSS_NO_COMMENT).toMatch(/\[aria-current\]\s*\{[^}]*color:\s*var\(--g-current\)/);
  });

  it('(c2) 새 JS·인라인 스크립트·onclick·!important 가 없다', () => {
    expect(CSS).not.toMatch(/<script|onclick|javascript:|!important/i);
  });

  it('(g) 키보드 포커스 링(:focus-visible)과 움직임 줄이기(prefers-reduced-motion)를 포함한다', () => {
    expect(CSS_NO_COMMENT).toMatch(/:focus-visible/);
    expect(CSS_NO_COMMENT).toContain('prefers-reduced-motion: reduce');
  });
});

describe.each(PAGES)('%s', (file) => {
  const html = read(file);

  it('(d) 인라인 <style> 뒤에 shared/gnb-desktop.css 를 정확히 한 번 링크한다', () => {
    const link = '<link rel="stylesheet" href="' + (ROOT_PAGES.includes(file) ? '' : '../') + 'shared/gnb-desktop.css">';
    expect(count(html, /shared\/gnb-desktop\.css/g)).toBe(1);
    expect(html).toContain(link);
    expect(html.indexOf(link)).toBeGreaterThan(html.lastIndexOf('</style>'));
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
    expect(fs.existsSync(path.join(ROOT, path.dirname(file), ROOT_PAGES.includes(file) ? '' : '..', 'shared/gnb-desktop.css'))).toBe(true);
    // 드로어 CSS 바로 뒤에 온다(두 파일의 규칙은 서로 다른 미디어 범위라 순서와 무관하지만, 위치를 고정한다).
    expect(html.indexOf('shared/drawer.css')).toBeGreaterThan(-1);
    expect(html.indexOf('shared/drawer.css')).toBeLessThan(html.indexOf(link));
  });

  it('(d) gnb:start/end 마커가 각각 정확히 1개이고 로고 </a> 뒤, .gnb-actions 앞에 있다', () => {
    expect(count(html, /<!-- gnb:start -->/g)).toBe(1);
    expect(count(html, /<!-- gnb:end -->/g)).toBe(1);
    const start = html.indexOf('<!-- gnb:start -->');
    const end = html.indexOf('<!-- gnb:end -->');
    expect(start).toBeGreaterThan(html.indexOf('class="gnb-logo"'));
    expect(start).toBeGreaterThan(html.indexOf('</a>', html.indexOf('class="gnb-logo"')));
    const after = AFTER_MARKER[file] || 'class="gnb-actions"';
    expect(html.indexOf(after)).toBeGreaterThan(-1);
    expect(end).toBeLessThan(html.indexOf(after));
    expect(SYNC.readMarkerRegion(html, 'gnb').state).toBe('ok');
  });

  it('(d) 마커 구간은 생성기 결과와 바이트 동일하고 1차 탭 4개 + 2차 탭을 가진다(홈은 1차 탭 4개만, 현재 위치 없음)', () => {
    expect(SYNC.applyFragment(html, file)).toBe(html);
    const region = SYNC.readMarkerRegion(html, 'gnb').current;
    expect(count(region, /class="gnb-nav-link/g)).toBe(4);
    expect(region).toContain('aria-label="섹션 내비게이션"');
    if (file === HOME) {
      expect(region).not.toContain('gnb-subnav');
      expect(region).not.toContain('aria-current');
      return;
    }
    expect(region).toContain('<nav class="gnb-subnav" aria-label="세부 메뉴">');
    expect(count(region, /aria-current="page"/g)).toBe(1);
    expect(count(region, /aria-current="true"/g)).toBe(1);
  });

  it('(e) 마커 구간 안에 data-section 이 없다(현재 위치는 aria-current 로 표시)', () => {
    const region = SYNC.readMarkerRegion(html, 'gnb').current;
    expect(region).not.toContain('data-section');
    // 헤더 전체에도 남아 있지 않다.
    const open = HEADER_OPEN[file] || '<header class="gnb">';
    expect(html.indexOf(open)).toBeGreaterThan(-1);
    const header = html.slice(html.indexOf(open), html.indexOf('</header>'));
    expect(header).not.toContain('data-section');
    // 마커 구간 안에 .gnb-nav 는 정확히 1개(1차 탭), 마커 밖 헤더에는 .gnb-nav 가 없다(옛 탭이 남지 않음).
    expect(count(region, /<nav class="gnb-nav"/g)).toBe(1);
    const outside = header.replace(region, '');
    expect(outside).not.toMatch(/class="gnb-nav"/);
    expect(outside).not.toMatch(/class="gnb-nav-link/);
  });

  it('헤더의 다른 요소(로고·배지·테마 버튼·햄버거)는 그대로이고 로고 aria-label 이 정의와 같다', () => {
    const NAV = require('../shared/nav-definition.js');
    // 로고 <a> 는 gnb-logo 클래스 토큰 1개, aria-label 이 정의와 같고 href 는 사이트 루트다(속성 순서는 따지지 않는다).
    const logos = html.match(/<a\b[^>]*\bclass="[^"]*\bgnb-logo\b[^"]*"[^>]*>/g) || [];
    expect(logos.length).toBe(1);
    expect(logos[0]).toContain('aria-label="' + NAV.LOGO.ariaLabel + '"');
    expect(logos[0]).toContain('href="' + NAV.LOGO.href + '"');
    expect(count(html, new RegExp('id="' + (THEME_ID[file] || 'themeToggle') + '"', 'g'))).toBe(1);
    expect(count(html, /id="gnbHamburger"/g)).toBe(1);
    // 배지는 .gnb-actions 가 있는 쪽에만 있다(archive·lint·generator 는 원래 없다).
    expect(count(html, /class="gnb-badge"/g)).toBe(NO_BADGE.includes(file) ? 0 : 1);
    if (file === HOME) expect(html).toContain('<span class="gnb-badge">v2.0</span>');
  });

  it('생성기는 이 쪽을 in-sync 로 본다(gnb·drawer 마커 모두 ok)', () => {
    const r = SYNC.checkAll(ROOT).pages.find((p) => p.file === file);
    expect(r.status).toBe('in-sync');
    expect(r.semanticOk).toBe(true);
  });
});

describe('(f) 이 CSS 를 링크하지 않는 페이지는 영향 없음', () => {
  it.each(STYLE_CSS_PAGES)('%s 는 gnb-desktop.css 를 링크하지 않는다', (file) => {
    expect(read(file)).not.toContain('gnb-desktop.css');
  });

  it('gnb-desktop.css 를 링크하는 쪽은 정확히 이 9쪽뿐이다', () => {
    const all = [];
    const walk = (dir) => {
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((e) => {
        const rel = dir ? dir + '/' + e.name : e.name;
        if (e.isDirectory()) {
          if (['node_modules', 'graft', '.git', '.claude', 'offline-app', 'research'].includes(e.name)) return;
          walk(rel);
        } else if (e.name.endsWith('.html') && read(rel).includes('shared/gnb-desktop.css')) all.push(rel);
      });
    };
    walk('');
    expect(all.length).toBe(9);
    expect(PAGES.length).toBe(9);
    expect(all.sort()).toEqual(PAGES.slice().sort());
  });

  it('linksSharedDrawerCss 는 gnb-desktop.css 만으로는 드로어 마커를 요구하지 않는다(해당 없음)', () => {
    expect(SYNC.linksSharedDrawerCss('<link rel="stylesheet" href="../shared/gnb-desktop.css">')).toBe(false);
  });
});

// D3: 이 두 쪽만 헤더 구조·변수 공급이 다르다.
describe('lint.html 헤더 (D3)', () => {
  const html = read('lint.html');
  it('바깥 요소는 <header class="gnb" role="banner"> 이고 <nav class="gnb"> 는 없다(중첩 nav 랜드마크 해소)', () => {
    expect(html).toContain('<header class="gnb" role="banner">');
    expect(html).not.toMatch(/<nav\b[^>]*class="gnb"/);
    expect(html).not.toContain('aria-label="주 내비게이션"');
    const open = html.indexOf('<header class="gnb" role="banner">');
    expect(html.indexOf('</header>', open)).toBeGreaterThan(html.indexOf('<!-- gnb:end -->'));
    // <header> 안에는 <nav> 가 2개(1차·2차)뿐이고 서로 중첩되지 않는다.
    const header = html.slice(open, html.indexOf('</header>', open));
    expect(count(header, /<nav\b/g)).toBe(2);
    expect(count(header, /<\/nav>/g)).toBe(2);
  });
  it('페이지 부제(.gnb-subtitle)는 마커 밖에 그대로 있다', () => {
    const before = html.slice(0, html.indexOf('<!-- gnb:start -->'));
    expect(before).toContain('<span class="gnb-subtitle">UX 라이팅 린터</span>');
  });
  it('SYNC.inspectPage 가 nav-landmark·logo 사유를 내지 않는다', () => {
    const r = SYNC.inspectPage(html, 'lint.html', ROOT);
    expect(r.reasons).toEqual([]);
  });
});

describe('generator/index.html 헤더 (D3)', () => {
  const html = read('generator/index.html');
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const norm = inline.replace(/\/\*[\s\S]*?\*\//g, '');
  it('.site-header 가 gnb-desktop.css 의 --g-* 변수를 901px 이상에서 공급한다(공유 CSS 는 .gnb 위에서만 정의)', () => {
    const m = norm.match(/@media \(min-width: 901px\)\s*\{\s*\.site-header\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/--g-text:\s*var\(--color-text\)/);
    expect(m[1]).toMatch(/--g-muted:\s*var\(--krds-text-secondary\)/);
    expect(m[1]).toMatch(/--g-accent:\s*var\(--color-primary-50\)/);
    expect(m[1]).toMatch(/--g-border:\s*var\(--color-border\)/);
    expect(m[1]).toMatch(/--g-current:\s*var\(--g-accent\)/);
    expect(norm).toMatch(/\[data-theme="dark"\]\s+\.site-header\s*\{\s*--g-accent:\s*#86aff9/);
    expect(norm).toMatch(/\.site-header\s*\{\s*--g-current:\s*color-mix\(in srgb,\s*var\(--g-accent\)\s*70%,\s*var\(--g-text\)\)/);
    expect(norm).toMatch(/\[data-theme="dark"\]\s+\.site-header\s*\{\s*--g-current:\s*var\(--g-accent\)/);
    // 공급하는 페이지 변수가 실제로 정의돼 있다.
    ['--color-text', '--krds-text-secondary', '--color-primary-50', '--color-border'].forEach((v) => {
      expect(norm).toMatch(new RegExp(v + ':\\s*#'));
    });
  });
  it('.site-header .gnb-nav-link.active(명시도 0,3,0)가 없어 [aria-current] 의 굵기 700·밑줄·대비 색을 덮지 않는다', () => {
    expect(norm).not.toMatch(/\.gnb-nav-link\.active/);
  });
  it('로고에 gnb-logo 클래스는 한 곳뿐이고 이 페이지에 .gnb-logo 스타일 규칙은 없다', () => {
    expect(norm).not.toMatch(/\.gnb-logo/);
  });
});

// D4: 홈은 2차 탭이 없고 현재 위치 탭이 없으며, 인라인 .gnb-nav { flex:1 } 이 공유 CSS 를 이긴다.
describe('index.html 헤더 (D4)', () => {
  const html = read('index.html');
  it('옛 모바일 메뉴(#mobileMenu·#mobileMenuBtn·.mobile-menu)와 data-section 탭이 없다', () => {
    expect(html).not.toMatch(/id="mobileMenu"|id="mobileMenuBtn"|class="(?:[^"]*\s)?mobile-menu(?:\s[^"]*)?"|gnb-mobile-btn/);
    expect(html).not.toContain('data-section=');
  });
  it('햄버거는 헤더 안 첫 요소이고, aside 와 backdrop 은 </header> 바로 뒤에 온다', () => {
    const open = '<header class="gnb" id="gnb" role="banner">';
    const header = html.slice(html.indexOf(open), html.indexOf('</header>'));
    expect(header.replace(open, '').trimStart().startsWith('<button class="gnb-icon-btn gnb-hamburger"')).toBe(true);
    const after = html.slice(html.indexOf('</header>') + '</header>'.length).trimStart();
    expect(after).toMatch(/^<aside class="sidebar site-drawer" id="mainSidebar" aria-label="사이트 메뉴">/);
    expect(after).toMatch(/<\/aside>\s*<div class="sidebar-backdrop"><\/div>/);
  });
  it('로고는 정의와 같고 gnb:start 는 로고 뒤, .gnb-actions 앞에 있다', () => {
    expect(html).toContain('aria-label="UXW KRDS UX Writing 가이드라인 홈"');
    expect(html.indexOf('<!-- gnb:end -->')).toBeLessThan(html.indexOf('class="gnb-actions"'));
  });
  it('인라인 CSS 에 옛 모바일 메뉴 규칙과 768px 의 .gnb-nav 숨김이 없다(drawer.css 의 900px 가 대신한다)', () => {
    const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    expect(inline).not.toMatch(/\.mobile-menu|\.gnb-mobile-btn/);
    expect(inline).not.toMatch(/@media \(max-width: 768px\)\s*\{\s*\.gnb-nav/);
    expect(inline).toMatch(/@media print\s*\{\s*\.gnb \{ display: none; \}/);
  });
});

// before-after.html: 일반(비현재) 탭 글자 대비 4.5:1. 헤더 합성 배경(오프화이트)에서 --text-muted(#6d7882)는 4.25:1 이라
// 헤더 탭 전용 변수 --g-muted 만 라이트에서 gray-60 으로 덮는다. 대비 수치는 합성 배경이 있어야 정확하므로
// 브라우저(Playwright)에서 재고, 여기서는 규칙의 존재·범위·--text-muted 불변만 고정한다.
describe('before-after.html 헤더 일반 탭 대비', () => {
  const html = read('before-after.html');
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  // @media (min-width: 901px) { … } 블록 본문(중괄호 균형으로 추출)
  const mediaBodies = [];
  for (const m of inline.matchAll(/@media\s*\(\s*min-width:\s*901px\s*\)\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < inline.length && depth > 0) {
      if (inline[i] === '{') depth += 1;
      else if (inline[i] === '}') depth -= 1;
      i += 1;
    }
    mediaBodies.push(inline.slice(start, i - 1));
  }
  const media = mediaBodies.join('\n');

  it('min-width: 901px 안에서 header.gnb 의 --g-muted 를 더 진한 gray-60 으로 덮는다(.gnb 단독은 gnb-desktop.css 에 진다)', () => {
    expect(media).toMatch(/header\.gnb\s*\{\s*--g-muted:\s*var\(--color-gray-60\)\s*;?\s*\}/);
    expect(inline).toMatch(/--color-gray-60:\s*#58616a/);
  });
  it('다크는 기존 값(--text-muted)을 그대로 쓴다 — 다크 대비가 내려가지 않는다', () => {
    expect(media).toMatch(/\[data-theme="dark"\]\s+header\.gnb\s*\{\s*--g-muted:\s*var\(--text-muted\)\s*;?\s*\}/);
  });
  it('1차 탭도 같은 변수를 읽는다: 901px 안에서 .gnb-nav-link { color: var(--g-muted) } (명시도 0,1,0 이라 :hover·[aria-current] 색을 덮지 않는다)', () => {
    expect(media).toMatch(/(?:^|[}\s])\.gnb-nav-link\s*\{\s*color:\s*var\(--g-muted\)\s*;?\s*\}/);
  });
  it('--g-muted 덮어쓰기는 모두 min-width: 901px 안에만 있다(모바일·최상위에 새지 않는다)', () => {
    const outside = inline.replace(media, '');
    expect(outside).not.toMatch(/--g-muted\s*:/);
    expect((inline.match(/--g-muted\s*:/g) || []).length).toBe(2);
  });
  it('--text-muted 값은 건드리지 않았다(본문 .page-hero-desc 등이 계속 gray-50 / 다크 gray-40 을 쓴다)', () => {
    expect(inline).toMatch(/:root\s*\{[^}]*--text-muted:\s*var\(--color-gray-50\)/);
    expect(inline).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--text-muted:\s*var\(--color-gray-40\)/);
    expect(inline).toMatch(/--color-gray-50:\s*#6d7882/);
    expect(inline).toMatch(/--color-gray-40:\s*#8a949e/);
    expect((inline.match(/--text-muted\s*:/g) || []).length).toBe(2);
  });
  it('공유 gnb-desktop.css 는 이 페이지의 인라인 <style> 뒤에 링크된다(그래서 명시도를 높였다)', () => {
    expect(html.indexOf('</style>')).toBeLessThan(html.indexOf('shared/gnb-desktop.css'));
  });
});
