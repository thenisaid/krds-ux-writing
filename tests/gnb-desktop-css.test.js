// shared/gnb-desktop.css 와 이를 링크하는 4쪽(dictionary 2쪽·corpus·case-studies)의 데스크톱 GNB 계약 (D0·D1).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '..');
const SYNC = require('../scripts/sync-site-nav.js');

const PAGES = ['dictionary/index.html', 'dictionary/full.html', 'corpus/index.html', 'case-studies/index.html'];
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
    // @media … { … } 블록을 모두 걷어낸 뒤 남는 것이 없어야 한다.
    let rest = CSS_NO_COMMENT;
    let prev;
    do {
      prev = rest;
      rest = rest.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    } while (rest !== prev);
    expect(rest.trim()).toBe('');
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
    // 다크에서는 accent 를 KRDS primary-30 으로 올린다.
    expect(CSS).toMatch(/\[data-theme="dark"\]\s+\.gnb\s*\{\s*--g-accent:\s*#86aff9/);
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

  it('(d) 인라인 <style> 뒤에 ../shared/gnb-desktop.css 를 정확히 한 번 링크한다', () => {
    const link = '<link rel="stylesheet" href="../shared/gnb-desktop.css">';
    expect(count(html, /shared\/gnb-desktop\.css/g)).toBe(1);
    expect(html).toContain(link);
    expect(html.indexOf(link)).toBeGreaterThan(html.lastIndexOf('</style>'));
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
    expect(fs.existsSync(path.join(ROOT, path.dirname(file), '../shared/gnb-desktop.css'))).toBe(true);
  });

  it('(d) gnb:start/end 마커가 각각 정확히 1개이고 로고 </a> 뒤, .gnb-actions 앞에 있다', () => {
    expect(count(html, /<!-- gnb:start -->/g)).toBe(1);
    expect(count(html, /<!-- gnb:end -->/g)).toBe(1);
    const start = html.indexOf('<!-- gnb:start -->');
    const end = html.indexOf('<!-- gnb:end -->');
    expect(start).toBeGreaterThan(html.indexOf('class="gnb-logo"'));
    expect(start).toBeGreaterThan(html.indexOf('</a>', html.indexOf('class="gnb-logo"')));
    expect(end).toBeLessThan(html.indexOf('class="gnb-actions"'));
    expect(SYNC.readMarkerRegion(html, 'gnb').state).toBe('ok');
  });

  it('(d) 마커 구간은 생성기 결과와 바이트 동일하고 1차 탭 4개 + 2차 탭을 가진다', () => {
    expect(SYNC.applyFragment(html, file)).toBe(html);
    const region = SYNC.readMarkerRegion(html, 'gnb').current;
    expect(count(region, /class="gnb-nav-link/g)).toBe(4);
    expect(region).toContain('aria-label="섹션 내비게이션"');
    expect(region).toContain('<nav class="gnb-subnav" aria-label="세부 메뉴">');
    expect(count(region, /aria-current="page"/g)).toBe(1);
    expect(count(region, /aria-current="true"/g)).toBe(1);
  });

  it('(e) 마커 구간 안에 data-section 이 없다(현재 위치는 aria-current 로 표시)', () => {
    const region = SYNC.readMarkerRegion(html, 'gnb').current;
    expect(region).not.toContain('data-section');
    // 헤더 전체에도 남아 있지 않다.
    const header = html.slice(html.indexOf('<header class="gnb">'), html.indexOf('</header>'));
    expect(header).not.toContain('data-section');
  });

  it('헤더의 다른 요소(로고·배지·테마 버튼·햄버거)는 그대로이고 로고 aria-label 이 정의와 같다', () => {
    const NAV = require('../shared/nav-definition.js');
    expect(html).toContain('class="gnb-logo" aria-label="' + NAV.LOGO.ariaLabel + '"');
    expect(count(html, /id="themeToggle"/g)).toBe(1);
    expect(count(html, /id="gnbHamburger"/g)).toBe(1);
    expect(count(html, /class="gnb-badge"/g)).toBe(1);
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

  it('D0·D1 범위 밖 쪽(index·archive·before-after·lint·generator)도 링크하지 않는다', () => {
    ['index.html', 'archive.html', 'before-after.html', 'lint.html', 'generator/index.html'].forEach((f) => {
      expect(read(f), f).not.toContain('gnb-desktop.css');
    });
  });

  it('gnb-desktop.css 를 링크하는 쪽은 정확히 이 4쪽뿐이다', () => {
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
    expect(all.sort()).toEqual(PAGES.slice().sort());
  });

  it('linksSharedDrawerCss 는 gnb-desktop.css 만으로는 드로어 마커를 요구하지 않는다(해당 없음)', () => {
    expect(SYNC.linksSharedDrawerCss('<link rel="stylesheet" href="../shared/gnb-desktop.css">')).toBe(false);
  });
});
