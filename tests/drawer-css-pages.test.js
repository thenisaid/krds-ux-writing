// shared/drawer.css 와 이를 링크하는 4쪽(dictionary 2쪽·corpus·case-studies)의 모바일 드로어 계약.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '..');
const SYNC = require('../scripts/sync-site-nav.js');

const PAGES = ['dictionary/index.html', 'dictionary/full.html', 'corpus/index.html', 'case-studies/index.html'];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const count = (text, re) => (text.match(re) || []).length;
const DRAWER_CSS = read('shared/drawer.css');

describe('shared/drawer.css', () => {
  it('(a) @media 중단점은 max-width: 900px 하나뿐이다(700/480/640 없음)', () => {
    const queries = [...DRAWER_CSS.matchAll(/@media\s*\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
    const widths = queries.filter((q) => /width/.test(q));
    expect(widths.length).toBeGreaterThan(0);
    widths.forEach((q) => expect(q).toBe('max-width: 900px'));
    [700, 480, 640].forEach((n) => expect(DRAWER_CSS).not.toMatch(new RegExp('\\b' + n + 'px')));
  });

  it('(b) 드로어 링크 min-height 44px, 햄버거 44×44px, prefers-reduced-motion, :focus-visible 을 포함한다', () => {
    expect(DRAWER_CSS).toMatch(/\.drawer-link,\s*\.drawer-sublink\s*\{[^}]*min-height:\s*44px/);
    expect(DRAWER_CSS).toMatch(/\.gnb-hamburger\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/);
    expect(DRAWER_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(DRAWER_CSS).toMatch(/:focus-visible/);
    expect(DRAWER_CSS).toMatch(/:focus-visible[^{]*\{[^}]*outline-offset:\s*-2px/);
  });

  it('현재 위치 [aria-current] 는 굵기 700 + 2px 밑줄이다(색 단독 금지)', () => {
    const rule = DRAWER_CSS.match(/\.drawer-link\[aria-current\][^{]*\{([^}]*)\}/)[1];
    expect(rule).toMatch(/font-weight:\s*700/);
    expect(rule).toMatch(/text-decoration:\s*underline/);
    expect(rule).toMatch(/text-decoration-thickness:\s*2px/);
  });

  it('901px 이상 기본 규칙: 햄버거·드로어·backdrop 이 화면에서 빠진다', () => {
    const base = DRAWER_CSS.slice(0, DRAWER_CSS.indexOf('@media (max-width: 900px)'));
    expect(base).toMatch(/\.gnb-hamburger\s*\{\s*display:\s*none/);
    expect(base).toMatch(/\.site-drawer\s*\{\s*display:\s*none/);
    expect(base).toMatch(/\.sidebar-backdrop\s*\{\s*display:\s*none/);
    expect(base).toMatch(/\.drawer-nav\s*\{\s*display:\s*none/);
  });

  it('900px 이하 블록: 햄버거 표시, .gnb-nav·.gnb-subnav 숨김, 드로어 fixed 오버레이(264px, translateX(-110%))', () => {
    const media = DRAWER_CSS.slice(DRAWER_CSS.indexOf('@media (max-width: 900px)'), DRAWER_CSS.indexOf('@media (prefers-reduced-motion'));
    expect(media).toMatch(/\.gnb-nav\s*\{\s*display:\s*none/);
    expect(media).toMatch(/\.gnb-subnav\s*\{\s*display:\s*none/);
    expect(media).toMatch(/\.drawer-nav\s*\{\s*display:\s*block/);
    expect(media).toMatch(/\.site-drawer\s*\{[^}]*position:\s*fixed[^}]*width:\s*264px/);
    expect(media).toMatch(/translateX\(-110%\)/);
    expect(media).toMatch(/\.site-drawer\.open\s*\{[^}]*transform:\s*none/);
    expect(media).toMatch(/\.sidebar-backdrop\.open\s*\{\s*display:\s*block/);
  });

  it('색을 하드코딩하지 않고 두 가지 변수 이름 체계(--bg/--text… 와 --color-*)를 폴백 체인으로 받는다', () => {
    expect(DRAWER_CSS).toMatch(/--d-text:\s*var\(--text,\s*var\(--color-text,/);
    expect(DRAWER_CSS).toMatch(/--d-accent:\s*var\(--accent,\s*var\(--color-primary,/);
    expect(DRAWER_CSS).toMatch(/--d-bg:\s*var\(--surface,\s*var\(--color-surface,/);
  });

  it('드로어·backdrop 은 헤더(.gnb, z-index 200)보다 낮거나 같아 헤더의 햄버거를 가리지 않는다', () => {
    expect(DRAWER_CSS).toMatch(/\.gnb\s*\{\s*z-index:\s*200/);
    expect(DRAWER_CSS).toMatch(/\.site-drawer\s*\{[^}]*z-index:\s*160/);
    expect(DRAWER_CSS).toMatch(/\.sidebar-backdrop\s*\{[^}]*z-index:\s*150/);
  });

  it('@media print: 햄버거·드로어·backdrop 은 인쇄에서 숨긴다', () => {
    const print = DRAWER_CSS.slice(DRAWER_CSS.indexOf('@media print'));
    expect(print).toMatch(/\.gnb-hamburger,\s*\.site-drawer,\s*\.sidebar-backdrop\s*\{\s*display:\s*none\s*!important/);
  });

  it('햄버거 기본 모양(:where, 명시도 0)은 .gnb-icon-btn 정의가 없는 페이지용이라 C1 페이지의 규칙을 덮지 않는다', () => {
    expect(DRAWER_CSS).toMatch(/:where\(\.gnb-hamburger\)\s*\{[^}]*color:\s*var\(--d-text\)[^}]*background:\s*none[^}]*border:\s*0/);
  });

  it('새 JS·인라인 스크립트·onclick 이 없다(CSS 파일)', () => {
    expect(DRAWER_CSS).not.toMatch(/<script|onclick|javascript:/i);
  });
});

describe.each(PAGES)('%s', (file) => {
  const html = read(file);

  it('(c) 인라인 <style> 뒤에 ../shared/drawer.css 를 정확히 한 번 링크한다', () => {
    const link = '<link rel="stylesheet" href="../shared/drawer.css">';
    expect(count(html, /shared\/drawer\.css/g)).toBe(1);
    expect(html).toContain(link);
    const lastStyleEnd = html.lastIndexOf('</style>');
    expect(html.indexOf(link)).toBeGreaterThan(lastStyleEnd);
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
    expect(fs.existsSync(path.join(ROOT, path.dirname(file), '../shared/drawer.css'))).toBe(true);
  });

  it('(d) #gnbHamburger(aria-controls=mainSidebar)·aside#mainSidebar·.sidebar-backdrop·드로어 마커가 각각 정확히 1개', () => {
    expect(count(html, /id="gnbHamburger"/g)).toBe(1);
    const btn = html.match(/<button[^>]*id="gnbHamburger"[^>]*>/)[0];
    expect(btn).toContain('aria-controls="mainSidebar"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-label="메뉴 열기"');
    expect(btn).toContain('type="button"');
    expect(btn).toMatch(/class="gnb-icon-btn gnb-hamburger"/);
    expect(count(html, /<aside\b[^>]*id="mainSidebar"/g)).toBe(1);
    expect(html).toMatch(/<aside class="sidebar site-drawer" id="mainSidebar" aria-label="사이트 메뉴">/);
    expect(count(html, /class="sidebar-backdrop"/g)).toBe(1);
    expect(count(html, /<!-- drawer-nav:start -->/g)).toBe(1);
    expect(count(html, /<!-- drawer-nav:end -->/g)).toBe(1);
  });

  it('햄버거는 헤더 안 첫 요소, aside 와 backdrop 은 </header> 바로 뒤', () => {
    const header = html.slice(html.indexOf('<header class="gnb">'), html.indexOf('</header>'));
    expect(header.replace('<header class="gnb">', '').trimStart().startsWith('<button class="gnb-icon-btn gnb-hamburger"')).toBe(true);
    const afterHeader = html.slice(html.indexOf('</header>') + '</header>'.length);
    expect(afterHeader.trimStart().startsWith('<aside class="sidebar site-drawer" id="mainSidebar"')).toBe(true);
    expect(afterHeader).toMatch(/<\/aside>\s*<div class="sidebar-backdrop"><\/div>/);
  });

  it('드로어 마커 구간은 생성기 결과와 바이트 동일하다', () => {
    const drawer = SYNC.readMarkerRegion(html, 'drawer');
    expect(drawer.state).toBe('ok');
    expect(SYNC.applyDrawerFragment(html, file)).toBe(html);
  });

  it('(e) gnb 마커가 각각 정확히 1개 있고(D1: 데스크톱 헤더 탭 통일), 마커 구간 안에 .gnb-nav 가 정확히 1개, 구간 밖에는 없다', () => {
    expect(count(html, /<!-- gnb:start -->/g)).toBe(1);
    expect(count(html, /<!-- gnb:end -->/g)).toBe(1);
    expect(count(html, /<nav class="gnb-nav"/g)).toBe(1);
    const gnb = SYNC.readMarkerRegion(html, 'gnb');
    expect(gnb.state).toBe('ok');
    expect(gnb.current).toContain('<nav class="gnb-nav"');
    expect(SYNC.applyFragment(html, file)).toBe(html);
  });

  it('(CSP) 새 인라인 스크립트·onclick 이 없고 shared/nav.js 는 한 번만 로드한다', () => {
    expect(count(html, /shared\/nav\.js/g)).toBe(1);
    expect(html).not.toMatch(/\sonclick=/);
  });

  it('일반 .sidebar 규칙이 인라인 CSS 에 없어 .site-drawer 와 충돌하지 않는다', () => {
    const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    expect(inline).not.toMatch(/(^|[\s,}])\.sidebar\b/);
  });
});

describe('생성기 ↔ drawer.css', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drawer-css-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  const inspectWith = (html) => {
    fs.mkdirSync(path.join(tmp, 'shared'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'shared/drawer.css'), path.join(tmp, 'shared/drawer.css'));
    fs.copyFileSync(path.join(ROOT, 'shared/style.css'), path.join(tmp, 'shared/style.css'));
    return SYNC.inspectPage(html, 'lint.html', tmp);
  };

  it('(f) drawer.css 를 링크하면 .gnb-nav 숨김을 감지해, 모바일 메뉴 링크가 없으면 mobile-menu 사유를 낸다', () => {
    const r = inspectWith('<link rel="stylesheet" href="shared/drawer.css"><header class="gnb"><nav class="gnb-nav"></nav></header>');
    expect(r.reasons).toContain('mobile-menu');
    expect(r.details.mobileMissing).toEqual(['원칙', '사전', '사례', '도구']);
  });

  it('(f) drawer.css 를 링크하지 않으면 숨김을 감지하지 않는다(같은 HTML, 링크만 없음)', () => {
    const r = inspectWith('<header class="gnb"><nav class="gnb-nav"></nav></header>');
    expect(r.details.mobileMissing).toEqual([]);
  });

  it('(f) drawer.css 가 숨기는 1차 탭 4개가 드로어 링크에 모두 있으면 mobile-menu 사유가 없다', () => {
    const links = SYNC.renderDrawerFragment('lint.html').join('\n');
    const r = inspectWith('<link rel="stylesheet" href="shared/drawer.css"><header class="gnb"><nav class="gnb-nav"></nav></header>' + links);
    expect(r.details.mobileMissing).toEqual([]);
    expect(r.reasons).not.toContain('mobile-menu');
  });

  it('실제 4쪽은 drawer.css 로 .gnb-nav 가 숨겨지고 드로어에 1차 탭 4개가 모두 있어 [11] 에 걸리지 않는다', () => {
    PAGES.forEach((file) => {
      const r = SYNC.inspectPage(read(file), file, ROOT);
      expect(r.details.mobileMissing, file).toEqual([]);
      expect(r.reasons, file).not.toContain('mobile-menu');
    });
  });

  it('drawer.css 가 없으면(파일 읽기 실패) 인라인만 보고 예외 없이 지나간다', () => {
    expect(() => SYNC.inspectPage('<link rel="stylesheet" href="../shared/drawer.css"><nav class="gnb-nav"></nav>', 'lint.html', tmp)).not.toThrow();
  });

  it('linksSharedDrawerCss: style.css·drawer.css 는 true, 링크 없으면 false', () => {
    expect(SYNC.linksSharedDrawerCss('<link href="shared/style.css">')).toBe(true);
    expect(SYNC.linksSharedDrawerCss('<link href="../shared/drawer.css">')).toBe(true);
    expect(SYNC.linksSharedDrawerCss('<link href="shared/other.css">')).toBe(false);
    expect(SYNC.linksSharedDrawerCss('<p>x</p>')).toBe(false);
  });
});

// C2: nav.js 를 로드하지 않아 shared/drawer.js 로 열고 닫는 루트 쪽 2쪽. 위 4쪽의 단언과 별개다.
const ROOT_PAGES = ['archive.html', 'before-after.html'];

describe.each(ROOT_PAGES)('%s (drawer.js 쪽)', (file) => {
  const html = read(file);

  it('인라인 <style> 뒤에 shared/drawer.css 를 정확히 한 번 링크한다', () => {
    const link = '<link rel="stylesheet" href="shared/drawer.css">';
    expect(count(html, /shared\/drawer\.css/g)).toBe(1);
    expect(html).toContain(link);
    expect(html.indexOf(link)).toBeGreaterThan(html.lastIndexOf('</style>'));
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
  });

  it('#gnbHamburger(aria-controls=mainSidebar)·aside#mainSidebar·.sidebar-backdrop·드로어 마커가 각각 정확히 1개', () => {
    const btn = html.match(/<button[^>]*id="gnbHamburger"[^>]*>/)[0];
    expect(btn).toContain('aria-controls="mainSidebar"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-label="메뉴 열기"');
    expect(btn).toContain('type="button"');
    expect(btn).toMatch(/class="gnb-icon-btn gnb-hamburger"/);
    expect(count(html, /id="gnbHamburger"/g)).toBe(1);
    expect(count(html, /<aside\b[^>]*id="mainSidebar"/g)).toBe(1);
    expect(html).toMatch(/<aside class="sidebar site-drawer" id="mainSidebar" aria-label="사이트 메뉴">/);
    expect(count(html, /class="sidebar-backdrop"/g)).toBe(1);
    expect(count(html, /<!-- drawer-nav:start -->/g)).toBe(1);
    expect(count(html, /<!-- drawer-nav:end -->/g)).toBe(1);
  });

  it('햄버거는 헤더 안 첫 요소(archive 는 .gnb-inner 안), aside·backdrop 은 </header> 바로 뒤', () => {
    const open = html.match(/<header class="gnb"[^>]*>/)[0];
    let inner = html.slice(html.indexOf(open) + open.length, html.indexOf('</header>')).trimStart();
    if (inner.startsWith('<div class="gnb-inner">')) inner = inner.slice('<div class="gnb-inner">'.length).trimStart();
    expect(inner.startsWith('<button class="gnb-icon-btn gnb-hamburger"')).toBe(true);
    const after = html.slice(html.indexOf('</header>') + '</header>'.length);
    expect(after.trimStart().startsWith('<aside class="sidebar site-drawer" id="mainSidebar"')).toBe(true);
    expect(after).toMatch(/<\/aside>\s*<div class="sidebar-backdrop"><\/div>/);
  });

  it('드로어 마커 구간은 생성기 결과와 바이트 동일하다', () => {
    expect(SYNC.readMarkerRegion(html, 'drawer').state).toBe('ok');
    expect(SYNC.applyDrawerFragment(html, file)).toBe(html);
  });

  it('gnb 마커가 각각 정확히 1개 있고(D2: 데스크톱 헤더 탭 통일), 마커 구간 안에 .gnb-nav 가 정확히 1개, 구간 밖에는 없다', () => {
    expect(count(html, /<!-- gnb:start -->/g)).toBe(1);
    expect(count(html, /<!-- gnb:end -->/g)).toBe(1);
    expect(count(html, /<nav class="gnb-nav"/g)).toBe(1);
    const gnb = SYNC.readMarkerRegion(html, 'gnb');
    expect(gnb.state).toBe('ok');
    expect(gnb.current).toContain('<nav class="gnb-nav"');
    expect(SYNC.applyFragment(html, file)).toBe(html);
  });

  it('nav.js 는 로드하지 않고(이중 토글 방지) 테마 토글 id 는 하나다', () => {
    expect(html).not.toMatch(/shared\/nav\.js/);
    expect(count(html, /id="themeToggle"/g)).toBe(1);
  });

  it('일반 .sidebar 규칙이 인라인 CSS 에 없어 .site-drawer 와 충돌하지 않는다', () => {
    const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    expect(inline).not.toMatch(/(^|[\s,}])\.sidebar\b/);
  });

  it('드로어 배경이 투명·흰색으로 떨어지지 않도록 --surface 를 페이지 배경(--bg)으로 정의한다', () => {
    const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    expect(inline).toMatch(/--surface:\s*var\(--bg\)/);
  });

  it('drawer.css 가 .gnb-nav 를 숨기고 드로어에 1차 탭 4개가 모두 있어 [11] 에 걸리지 않는다', () => {
    const r = SYNC.inspectPage(html, file, ROOT);
    expect(r.details.mobileMissing).toEqual([]);
    expect(r.reasons).not.toContain('mobile-menu');
  });
});

describe('archive.html 모바일 헤더(2줄) 보정', () => {
  const html = read('archive.html');
  it('600px 이하에서 헤더가 2줄이 되므로 드로어 상단 여백을 aside.site-drawer 규칙으로 늘린다', () => {
    const media = html.slice(html.indexOf('@media (max-width: 600px)'), html.indexOf('/* ── 스킵 링크 ── */'));
    expect(media).toMatch(/aside\.site-drawer\s*\{\s*padding-top:\s*108px/);
  });
});

// C3: lint.html·generator/index.html — 인라인 CSS 의 선택자가 drawer.css 와 충돌해 보정 규칙을 둔 2쪽.
const C3_PAGES = [
  { file: 'lint.html', css: 'shared/drawer.css', header: /<header class="gnb" role="banner">/, themeId: 'themeToggle' },
  { file: 'generator/index.html', css: '../shared/drawer.css', header: /<header class="site-header">/, themeId: 'genThemeToggle' },
];

describe.each(C3_PAGES)('$file (C3 drawer.js 쪽)', ({ file, css, header, themeId }) => {
  const html = read(file);
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  it('인라인 <style> 뒤에 drawer.css 를 정확히 한 번 링크한다', () => {
    const link = '<link rel="stylesheet" href="' + css + '">';
    expect(count(html, /href="[^"]*shared\/drawer\.css"/g)).toBe(1);
    expect(html).toContain(link);
    expect(html.indexOf(link)).toBeGreaterThan(html.lastIndexOf('</style>'));
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
  });

  it('햄버거(aria-controls=mainSidebar)는 헤더 안 첫 요소, aside·backdrop 은 헤더 바로 뒤', () => {
    const btn = html.match(/<button[^>]*id="gnbHamburger"[^>]*>/)[0];
    expect(btn).toContain('aria-controls="mainSidebar"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-label="메뉴 열기"');
    expect(btn).toContain('type="button"');
    expect(btn).toMatch(/class="gnb-icon-btn gnb-hamburger"/);
    const open = html.match(header)[0];
    let inner = html.slice(html.indexOf(open) + open.length).trimStart();
    if (file === 'generator/index.html') inner = inner.replace(/^<div class="inner">\s*/, '');
    expect(inner.startsWith('<button class="gnb-icon-btn gnb-hamburger"')).toBe(true);
    const closing = file === 'lint.html' ? '</header>\n\n<aside' : '</header>\n\n  <aside';
    expect(html).toContain(closing + ' class="sidebar site-drawer" id="mainSidebar" aria-label="사이트 메뉴">');
    expect(html).toMatch(/<\/aside>\s*<div class="sidebar-backdrop"><\/div>/);
  });

  it('드로어 마커 구간은 생성기 결과와 바이트 동일하다', () => {
    expect(SYNC.readMarkerRegion(html, 'drawer').state).toBe('ok');
    expect(SYNC.applyDrawerFragment(html, file)).toBe(html);
  });

  it('gnb 마커 1쌍이 있고 구간 안 .gnb-nav 는 1개이며 구간은 생성기 결과와 바이트 동일하다(D3)', () => {
    expect(count(html, /<!-- gnb:start -->/g)).toBe(1);
    expect(count(html, /<!-- gnb:end -->/g)).toBe(1);
    expect(SYNC.readMarkerRegion(html, 'gnb').state).toBe('ok');
    const region = SYNC.readMarkerRegion(html, 'gnb').current;
    expect(count(region, /<nav class="gnb-nav"/g)).toBe(1);
    expect(count(html, /<nav class="gnb-nav"/g)).toBe(1);
    expect(SYNC.applyFragment(html, file)).toBe(html);
  });

  it('nav.js 는 로드하지 않고 테마 토글 id 는 하나다', () => {
    expect(html).not.toMatch(/shared\/nav\.js/);
    expect(count(html, new RegExp('id="' + themeId + '"', 'g'))).toBe(1);
  });

  it('인라인 CSS 에 일반 .sidebar 규칙이 없어 .site-drawer 와 충돌하지 않는다', () => {
    expect(inline).not.toMatch(/(^|[\s,}])\.sidebar\b/);
  });

  it('drawer.css 가 .gnb-nav 를 숨기고 드로어에 1차 탭 4개가 모두 있어 [11] 에 걸리지 않는다', () => {
    const r = SYNC.inspectPage(html, file, ROOT);
    expect(r.details.mobileMissing).toEqual([]);
    expect(r.reasons).not.toContain('mobile-menu');
  });
});

describe('lint.html 드로어 보정', () => {
  const html = read('lint.html');
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  it('드로어 배경이 투명·흰색으로 떨어지지 않도록 --surface 를 페이지 배경(--bg)으로 정의한다', () => {
    expect(inline).toMatch(/--surface:\s*var\(--bg\)/);
  });

  it('641~900px 에서도 .gnb-nav 가 숨은 뒤 테마 버튼을 오른쪽 끝으로 민다(900px 블록)', () => {
    expect(inline).toMatch(/@media \(max-width: 900px\) \{\s*\.gnb-theme-btn \{ margin-left: auto; \}\s*\}/);
  });

  it('인라인 .gnb-nav 선택자는 단일 클래스(0,1,0)라 drawer.css 의 숨김 규칙이 순서만으로 이긴다', () => {
    const selectors = [...inline.matchAll(/(^|\})\s*([^{}@]*\.gnb-nav\b[^{}]*)\{/g)].map((m) => m[2].trim());
    selectors.forEach((sel) => expect(sel, sel).not.toMatch(/\.[\w-]+\s+\.gnb-nav\b/));
  });
});

describe('generator/index.html 드로어 보정', () => {
  const html = read('generator/index.html');
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const block = inline.slice(inline.indexOf('@media (max-width: 900px)'), inline.indexOf('/* ===== 화면 전환 ===== */'));

  it('.site-header .gnb-nav 의 명시도(0,2,0)가 drawer.css 를 이기므로 900px 이하에서 같은 명시도로 숨긴다', () => {
    expect(inline).toMatch(/\.site-header \.gnb-nav \{\s*display: flex;/);
    expect(block).toMatch(/\.site-header \.gnb-nav \{ display: none; \}/);
  });

  it('.site-header 를 드로어(160)·backdrop(150) 위로 올려 열린 채로도 햄버거·테마 버튼이 눌린다', () => {
    const z = Number(block.match(/\.site-header \{ z-index: (\d+); \}/)[1]);
    expect(z).toBeGreaterThan(160);
  });

  it('탭이 숨은 뒤 테마 버튼이 오른쪽 끝을 맡는다', () => {
    expect(block).toMatch(/\.site-header #genThemeToggle \{ margin-left: auto; \}/);
  });

  it('인쇄에서는 .site-header 가 그대로 숨는다(드로어 요소는 drawer.css 가 숨김)', () => {
    expect(inline).toMatch(/@media print \{\s*\.site-header,/);
  });
});
