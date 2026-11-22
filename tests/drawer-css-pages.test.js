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

  it('(e) gnb 마커는 아직 없다(데스크톱 헤더 탭 통일은 후속 작업) — 헤더에 .gnb-nav 마크업은 그대로 있다', () => {
    expect(html).not.toContain('<!-- gnb:start -->');
    expect(html).not.toContain('<!-- gnb:end -->');
    expect(count(html, /<nav class="gnb-nav"/g)).toBe(1);
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
