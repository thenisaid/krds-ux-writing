import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const NAV = require('../shared/nav-definition.js');
const SYNC = require('../scripts/sync-site-nav.js');

const ROOT = process.cwd();

// 시험은 항상 /tmp(os.tmpdir) 아래 사본에서만 쓴다. 레포 파일은 쓰지 않는다.
let tmpRoot;

function capture(argv) {
  const lines = [];
  const code = SYNC.main(argv, (t) => lines.push(t));
  return { code, text: lines.join('\n') };
}

function snapshot(dir) {
  const out = {};
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full);
    else out[path.relative(dir, full)] = fs.readFileSync(full, 'utf8');
  });
  walk(dir);
  return out;
}

const GNB = (inner) => `<header class="gnb">\n  <!-- gnb:start -->\n  ${inner}\n  <!-- gnb:end -->\n</header>\n`;
const DRAWER = (inner) => `<aside class="sidebar" id="mainSidebar">\n  <!-- drawer-nav:start -->\n  ${inner}\n  <!-- drawer-nav:end -->\n</aside>\n`;
const BOTH = (g, d) => `<body>\n${GNB(g)}${DRAWER(d)}</body>\n`;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-site-nav-drawer-'));
});
afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function put(file, html) {
  const dest = path.join(tmpRoot, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  return dest;
}

describe('renderDrawerFragment', () => {
  it('분류되지 않은 파일은 null', () => {
    expect(SYNC.renderDrawerFragment('nope.html')).toBeNull();
    expect(SYNC.renderDrawerFragment('sema_p1.html')).toBeNull();
  });

  it('1차 탭 4개를 정의의 라벨·순서·href 로 만든다 (모든 분류 페이지)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const text = SYNC.renderDrawerFragment(file).join('\n');
      expect(text, file).toContain('<nav class="drawer-nav" aria-label="사이트 메뉴">');
      const primary = [...text.matchAll(/<a href="([^"]*)" class="drawer-link mobile-menu-link"[^>]*>([^<]*)<\/a>/g)];
      expect(primary.map((m) => m[2]), file).toEqual(NAV.PRIMARY_TABS.map((t) => t.label));
      expect(primary.map((m) => m[1]), file).toEqual(NAV.PRIMARY_TABS.map((t) => t.href));
    });
  });

  it('2차 탭이 없는 섹션(원칙 하위)은 drawer-sublist 를 만들지 않고 1차에 aria-current="true"', () => {
    const text = SYNC.renderDrawerFragment('principles/foundation/index.html').join('\n');
    expect(text).not.toContain('drawer-sublist');
    expect(text).not.toContain('drawer-sublink');
    expect(text.match(/aria-current/g)).toHaveLength(1);
    expect(text).toContain('class="drawer-link mobile-menu-link" aria-current="true">원칙</a>');
  });

  it('원칙 랜딩 자신은 1차에 aria-current="page"', () => {
    const text = SYNC.renderDrawerFragment('principles/index.html').join('\n');
    expect(text).toContain('aria-current="page">원칙</a>');
    expect(text.match(/aria-current/g)).toHaveLength(1);
  });

  it('2차 탭이 있는 섹션은 해당 1차 항목 아래에만 2차를 펼친다 (도구: 4개, 현재 = page)', () => {
    const lines = SYNC.renderDrawerFragment('prompt-library.html');
    const text = lines.join('\n');
    expect(text.match(/<ul class="drawer-sublist">/g)).toHaveLength(1);
    const subs = [...text.matchAll(/<a href="([^"]*)" class="drawer-sublink"([^>]*)>([^<]*)<\/a>/g)];
    expect(subs.map((m) => m[3])).toEqual(NAV.SECONDARY_TABS.tools.map((s) => s.label));
    expect(subs.map((m) => m[1])).toEqual(NAV.SECONDARY_TABS.tools.map((s) => s.href));
    expect(subs.map((m) => m[2].trim())).toEqual(['aria-current="page"', '', '', '']);
    // 2차 목록은 '도구' 1차 항목 <li> 안에 있다
    const toolsItem = text.slice(text.indexOf('>도구</a>'));
    expect(toolsItem.indexOf('drawer-sublist')).toBeGreaterThan(0);
    expect(text.slice(0, text.indexOf('>도구</a>'))).not.toContain('drawer-sublist');
    // 1차 '도구' = true, 나머지 1차에는 aria-current 없음 → 전체 aria-current 는 true 1 + page 1
    expect(text).toContain('aria-current="true">도구</a>');
    expect(text.match(/aria-current="true"/g)).toHaveLength(1);
    expect(text.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('사전·사례 섹션도 각자의 2차 탭을 펼친다', () => {
    const dict = SYNC.renderDrawerFragment('corpus/index.html').join('\n');
    expect([...dict.matchAll(/class="drawer-sublink"[^>]*>([^<]*)</g)].map((m) => m[1]))
      .toEqual(NAV.SECONDARY_TABS.dictionary.map((s) => s.label));
    expect(dict).toContain('aria-current="page">코퍼스</a>');
    const cases = SYNC.renderDrawerFragment('archive.html').join('\n');
    expect([...cases.matchAll(/class="drawer-sublink"[^>]*>([^<]*)</g)].map((m) => m[1]))
      .toEqual(NAV.SECONDARY_TABS['case-studies'].map((s) => s.label));
    expect(cases).toContain('aria-current="page">이슈 아카이브</a>');
  });

  it('aria-current 값은 NAV.ariaCurrentFor 와 모든 페이지에서 일치한다', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const current = NAV.ariaCurrentFor(NAV.pathForFile(file));
      const text = SYNC.renderDrawerFragment(file).join('\n');
      const primaryCurrent = [...text.matchAll(/class="drawer-link mobile-menu-link"( aria-current="([^"]*)")?>/g)].map((m) => m[2] || null);
      expect(primaryCurrent, file).toEqual(NAV.PRIMARY_TABS.map((t) => (t.id === current.tabId ? current.tab : null)));
      const subCurrent = [...text.matchAll(/class="drawer-sublink"( aria-current="([^"]*)")?>/g)].map((m) => m[2] || null);
      const subs = current.tabId ? NAV.SECONDARY_TABS[current.tabId] : [];
      expect(subCurrent, file).toEqual(subs.map((s) => (s.id === current.subId ? current.sub : null)));
    });
  });

  it('홈(index.html, tab null)은 활성 탭도 aria-current 도 2차 목록도 없다', () => {
    const text = SYNC.renderDrawerFragment('index.html').join('\n');
    expect(text).not.toContain('aria-current');
    expect(text).not.toContain('drawer-sublist');
    expect(text.match(/mobile-menu-link/g)).toHaveLength(4);
  });

  it('gnb 조각과 달리 .active 클래스를 쓰지 않는다 (현재 위치는 aria-current 로만)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      expect(SYNC.renderDrawerFragment(file).join('\n'), file).not.toMatch(/\bactive\b/);
    });
  });

  it('CSP 위반 마크업을 만들지 않는다 (script·on* 핸들러·style 속성·javascript: 없음)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const text = SYNC.renderDrawerFragment(file).join('\n');
      expect(text, file).not.toMatch(/<script/i);
      expect(text, file).not.toMatch(/\son[a-z]+\s*=/i);
      expect(text, file).not.toMatch(/\sstyle\s*=/i);
      expect(text, file).not.toMatch(/javascript:/i);
      expect(text, file).not.toMatch(/innerHTML/);
    });
  });

  it('모든 분류 페이지의 조각은 같은 라벨을 데스크톱 GNB 조각과 공유한다 (정의에서만 읽는다)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const gnb = SYNC.renderFragment(file).join('\n');
      const drawer = SYNC.renderDrawerFragment(file).join('\n');
      NAV.PRIMARY_TABS.forEach((t) => {
        expect(gnb, file).toContain('>' + t.label + '</a>');
        expect(drawer, file).toContain('>' + t.label + '</a>');
      });
    });
  });

  it('드로어 랜드마크 라벨은 GNB 1차·2차 라벨과 겹치지 않는다', () => {
    expect(['사이트 메뉴']).not.toContain(NAV.NAV_ARIA_LABEL);
    expect(['사이트 메뉴']).not.toContain(NAV.SUBNAV_ARIA_LABEL);
  });
});

describe('드로어 마커 구간 읽기', () => {
  it('드로어 마커가 없으면 none, 정상이면 ok', () => {
    expect(SYNC.readMarkerRegion('<p>x</p>', 'drawer').state).toBe('none');
    const html = DRAWER('<nav>x</nav>');
    const region = SYNC.readMarkerRegion(html, 'drawer');
    expect(region.state).toBe('ok');
    expect(region.indent).toBe('  ');
    // current 는 기존 gnb 구간과 같이 들여쓰기를 포함한 매치 전체다
    expect(region.current.trimStart().startsWith('<!-- drawer-nav:start -->')).toBe(true);
    expect(region.current.endsWith('<!-- drawer-nav:end -->')).toBe(true);
  });

  it('시작만 있거나 끝만 있으면 malformed', () => {
    expect(SYNC.readMarkerRegion('<!-- drawer-nav:start -->', 'drawer').state).toBe('malformed');
    expect(SYNC.readMarkerRegion('<!-- drawer-nav:end -->', 'drawer').state).toBe('malformed');
  });

  it('순서가 뒤바뀌면 malformed', () => {
    expect(SYNC.readMarkerRegion('<!-- drawer-nav:end --><!-- drawer-nav:start -->', 'drawer').state).toBe('malformed');
  });

  it('쌍이 2개면 malformed', () => {
    const two = '<!-- drawer-nav:start --><!-- drawer-nav:end --><!-- drawer-nav:start --><!-- drawer-nav:end -->';
    expect(SYNC.readMarkerRegion(two, 'drawer').state).toBe('malformed');
  });

  it('gnb 마커와 drawer 마커는 서로의 판정에 영향을 주지 않는다', () => {
    const html = BOTH('<nav>g</nav>', '<nav>d</nav>');
    expect(SYNC.readMarkerRegion(html, 'gnb').state).toBe('ok');
    expect(SYNC.readMarkerRegion(html, 'drawer').state).toBe('ok');
    // gnb 만 있는 파일: drawer 는 none
    expect(SYNC.readMarkerRegion(GNB('x'), 'drawer').state).toBe('none');
    // drawer 만 있는 파일: gnb 는 none
    expect(SYNC.readMarkerRegion(DRAWER('x'), 'gnb').state).toBe('none');
    // gnb 가 깨져도 drawer 는 ok
    const gnbBroken = '<!-- gnb:start -->' + DRAWER('x');
    expect(SYNC.readMarkerRegion(gnbBroken, 'gnb').state).toBe('malformed');
    expect(SYNC.readMarkerRegion(gnbBroken, 'drawer').state).toBe('ok');
  });

  it('kind 를 생략하면 기존처럼 gnb 마커를 읽는다 (기존 호출 호환)', () => {
    expect(SYNC.readMarkerRegion(GNB('x')).state).toBe('ok');
    expect(SYNC.readMarkerRegion(DRAWER('x')).state).toBe('none');
    expect(SYNC.readMarkerRegion('<!-- gnb:start -->').state).toBe('malformed');
  });

  it('readAllMarkers: 어느 한쪽이라도 깨지면 malformed, 둘 다 없으면 none, 하나라도 ok 면 ok', () => {
    expect(SYNC.readAllMarkers('<p>x</p>').state).toBe('none');
    expect(SYNC.readAllMarkers(GNB('x')).state).toBe('ok');
    expect(SYNC.readAllMarkers(DRAWER('x')).state).toBe('ok');
    expect(SYNC.readAllMarkers(BOTH('x', 'y')).state).toBe('ok');
    expect(SYNC.readAllMarkers(GNB('x') + '<!-- drawer-nav:start -->').state).toBe('malformed');
    expect(SYNC.readAllMarkers('<!-- gnb:start -->' + DRAWER('x')).state).toBe('malformed');
  });

  it('readAllMarkers: 두 구간이 겹치면 malformed', () => {
    const overlapped = '<!-- gnb:start --><!-- drawer-nav:start --><!-- gnb:end --><!-- drawer-nav:end -->';
    expect(SYNC.readAllMarkers(overlapped).state).toBe('malformed');
  });
});

describe('드로어 마커 구간 갱신', () => {
  it('applyDrawerFragment 는 드로어 구간만 바꾸고 바깥은 바이트 그대로 둔다', () => {
    const html = DRAWER('<nav>old</nav>');
    const next = SYNC.applyDrawerFragment(html, 'prompt-library.html');
    expect(next).not.toBe(html);
    expect(next.startsWith('<aside class="sidebar" id="mainSidebar">\n  <!-- drawer-nav:start -->\n')).toBe(true);
    expect(next.endsWith('  <!-- drawer-nav:end -->\n</aside>\n')).toBe(true);
    expect(next).not.toContain('<nav>old</nav>');
    expect(next).toContain('>프롬프트</a>');
    // 마커 들여쓰기가 조각 줄에도 적용된다
    expect(next).toContain('\n  <nav class="drawer-nav"');
  });

  it('applyDrawerFragment 는 멱등이다', () => {
    const once = SYNC.applyDrawerFragment(DRAWER('<nav>old</nav>'), 'lint.html');
    expect(SYNC.applyDrawerFragment(once, 'lint.html')).toBe(once);
  });

  it('applyDrawerFragment 는 마커 없음·깨짐·미분류 파일이면 null', () => {
    expect(SYNC.applyDrawerFragment('<p>x</p>', 'lint.html')).toBeNull();
    expect(SYNC.applyDrawerFragment('<!-- drawer-nav:start -->', 'lint.html')).toBeNull();
    expect(SYNC.applyDrawerFragment(DRAWER('x'), 'nope.html')).toBeNull();
  });

  it('applyDrawerFragment 는 gnb 구간을 건드리지 않고, applyFragment 는 드로어 구간을 건드리지 않는다', () => {
    const html = BOTH('<nav>g-old</nav>', '<nav>d-old</nav>');
    const drawerOnly = SYNC.applyDrawerFragment(html, 'lint.html');
    expect(drawerOnly).toContain('<nav>g-old</nav>');
    expect(drawerOnly).not.toContain('<nav>d-old</nav>');
    const gnbOnly = SYNC.applyFragment(html, 'lint.html');
    expect(gnbOnly).toContain('<nav>d-old</nav>');
    expect(gnbOnly).not.toContain('<nav>g-old</nav>');
  });

  it('치환 결과의 $ 패턴이 해석되지 않는다 (함수 치환 사용)', () => {
    const html = 'a $& b\n<!-- drawer-nav:start -->\nold\n<!-- drawer-nav:end -->\n';
    const next = SYNC.applyDrawerFragment(html, 'index.html');
    expect(next.startsWith('a $& b\n<!-- drawer-nav:start -->')).toBe(true);
    expect(next).not.toContain('old');
  });

  it('applyAll: 두 구간을 함께 갱신하고, 멱등이며, 한쪽만 있는 파일은 있는 쪽만 갱신한다', () => {
    const both = SYNC.applyAll(BOTH('<nav>g</nav>', '<nav>d</nav>'), 'lint.html');
    expect(both).toContain('class="gnb-nav"');
    expect(both).toContain('class="drawer-nav"');
    expect(SYNC.applyAll(both, 'lint.html')).toBe(both);

    const gnbOnly = SYNC.applyAll(GNB('<nav>g</nav>'), 'lint.html');
    expect(gnbOnly).toContain('class="gnb-nav"');
    expect(gnbOnly).not.toContain('drawer');

    const drawerOnly = SYNC.applyAll(DRAWER('<nav>d</nav>'), 'lint.html');
    expect(drawerOnly).toContain('class="drawer-nav"');
    expect(drawerOnly).not.toContain('gnb-nav');
  });

  it('applyAll: 마커 없음·깨짐·미분류면 null', () => {
    expect(SYNC.applyAll('<p>x</p>', 'lint.html')).toBeNull();
    expect(SYNC.applyAll(GNB('x') + '<!-- drawer-nav:start -->', 'lint.html')).toBeNull();
    expect(SYNC.applyAll(BOTH('x', 'y'), 'nope.html')).toBeNull();
  });
});

describe('CLI: 드로어 마커 인식', () => {
  it('--print-drawer 는 드로어 조각을 마커와 함께 출력하고 미분류 파일은 오류(2)', () => {
    const ok = capture(['--print-drawer', 'prompt-library.html']);
    expect(ok.code).toBe(0);
    expect(ok.text.startsWith('<!-- drawer-nav:start -->\n<nav class="drawer-nav"')).toBe(true);
    expect(ok.text.endsWith('<!-- drawer-nav:end -->')).toBe(true);
    expect(capture(['--print-drawer', 'sema_p1.html']).code).toBe(2);
    expect(capture(['--print-drawer']).code).toBe(2);
  });

  it('--print 의 기존 출력은 그대로다 (gnb 조각)', () => {
    const out = capture(['--print', 'lint.html']);
    expect(out.text.startsWith('<!-- gnb:start -->\n<nav class="gnb-nav"')).toBe(true);
    expect(out.text.endsWith('<!-- gnb:end -->')).toBe(true);
    expect(out.text).not.toContain('drawer');
  });

  it('--print 와 --print-drawer 를 함께 쓰면 모드 중복 오류(2)', () => {
    expect(capture(['--print', 'lint.html', '--print-drawer', 'lint.html']).code).toBe(2);
  });

  it('--write 는 드로어 마커가 있는 파일의 드로어 구간만 갱신한다', () => {
    const dest = put('prompt-library.html', DRAWER('<nav>old</nav>'));
    const { code, text } = capture(['--write', '--root', tmpRoot]);
    expect(code).toBe(0);
    expect(text).toContain('쓴 파일 1개: prompt-library.html');
    const written = fs.readFileSync(dest, 'utf8');
    expect(written).toContain('aria-current="page">프롬프트</a>');
    expect(written).not.toContain('<nav>old</nav>');
  });

  it('--write 는 드로어 마커가 없는 파일을 건드리지 않는다 (건너뜀)', () => {
    put('lint.html', '<header class="gnb"><nav>x</nav></header>\n');
    const before = snapshot(tmpRoot);
    const { text } = capture(['--write', '--root', tmpRoot]);
    expect(text).toContain('[건너뜀(마커 없음)] lint.html');
    expect(snapshot(tmpRoot)).toEqual(before);
  });

  it('--write 는 gnb·drawer 마커가 둘 다 있으면 둘 다 갱신한다', () => {
    const dest = put('lint.html', BOTH('<nav>g</nav>', '<nav>d</nav>'));
    capture(['--write', '--root', tmpRoot]);
    const written = fs.readFileSync(dest, 'utf8');
    expect(written).toContain('class="gnb-nav"');
    expect(written).toContain('class="drawer-nav"');
  });

  it('드로어 마커만 깨졌으면 gnb 마커가 정상이어도 --write 는 건너뛴다', () => {
    const dest = put('lint.html', GNB('<nav>g</nav>') + '<!-- drawer-nav:start -->\n');
    const before = fs.readFileSync(dest, 'utf8');
    const { text } = capture(['--write', '--root', tmpRoot]);
    expect(text).toContain('마커 깨짐');
    expect(fs.readFileSync(dest, 'utf8')).toBe(before);
  });

  it('--dry-run 과 --check 는 드로어 마커가 있어도 아무것도 쓰지 않는다', () => {
    put('lint.html', BOTH('<nav>g</nav>', '<nav>d</nav>'));
    const before = snapshot(tmpRoot);
    capture(['--dry-run', '--root', tmpRoot]);
    capture(['--check', '--root', tmpRoot]);
    expect(snapshot(tmpRoot)).toEqual(before);
  });

  // 판정 규칙: in-sync = gnb 마커 ok + 생성 결과와 동일, 그리고 shared/style.css·drawer.css 를 링크하면 드로어 마커도 ok + 동일.
  const STYLE_LINK = '<link rel="stylesheet" href="shared/style.css">\n';
  const DRAWER_LINK = '<link rel="stylesheet" href="shared/drawer.css">\n';
  const statusOf = (file) => SYNC.checkAll(tmpRoot).pages.find((p) => p.file === file);

  it('--check: gnb·드로어 둘 다 있고 style.css 를 링크할 때, 드로어 구간이 어긋나면 drift, 둘 다 최신이면 in-sync', () => {
    const gnbHtml = SYNC.applyFragment(GNB('x'), 'lint.html');
    put('lint.html', STYLE_LINK + gnbHtml + DRAWER('<nav>stale</nav>'));
    let page = statusOf('lint.html');
    expect(page.status).toBe('drift');
    expect(page.reasons).toContain('sync');

    put('lint.html', SYNC.applyAll(STYLE_LINK + gnbHtml + DRAWER('<nav>stale</nav>'), 'lint.html'));
    page = statusOf('lint.html');
    expect(page.status).toBe('in-sync');
  });

  it('--check: 드로어 마커만 있고 drawer.css 를 링크하면 partial(gnb 마커 없음) — in-sync·drift 가 아니다', () => {
    put('lint.html', DRAWER_LINK + SYNC.applyDrawerFragment(DRAWER('x'), 'lint.html'));
    const page = statusOf('lint.html');
    expect(page.status).toBe('partial');
    expect(page.reasons).toContain('markers');
    expect(page.reasons).toContain('gnb-marker-missing');
    expect(page.reasons).not.toContain('drawer-marker-missing');
    expect(page.reasons).not.toContain('sync');
  });

  it('--check: 드로어 마커만 있고 공유 CSS 링크가 없어도 gnb 마커가 없으면 partial', () => {
    put('lint.html', SYNC.applyDrawerFragment(DRAWER('x'), 'lint.html'));
    const page = statusOf('lint.html');
    expect(page.status).toBe('partial');
    expect(page.reasons).toContain('gnb-marker-missing');
  });

  it('--check: gnb 마커만 있고 style.css 를 링크하면 partial(드로어 마커 없음)', () => {
    put('lint.html', STYLE_LINK + SYNC.applyFragment(GNB('x'), 'lint.html'));
    const page = statusOf('lint.html');
    expect(page.status).toBe('partial');
    expect(page.reasons).toContain('markers');
    expect(page.reasons).toContain('drawer-marker-missing');
    expect(page.reasons).not.toContain('gnb-marker-missing');
  });

  it('--check: gnb 마커만 있고 drawer.css 를 링크해도 partial(드로어 마커 없음)', () => {
    put('lint.html', DRAWER_LINK + SYNC.applyFragment(GNB('x'), 'lint.html'));
    expect(statusOf('lint.html').status).toBe('partial');
  });

  it('--check: gnb 마커만 있고 어떤 공유 CSS 도 링크하지 않으면 드로어 마커를 요구하지 않아 in-sync (index.html 같은 경우)', () => {
    put('lint.html', SYNC.applyFragment(GNB('x'), 'lint.html'));
    const page = statusOf('lint.html');
    expect(page.status).toBe('in-sync');
    expect(page.reasons).not.toContain('markers');
  });

  it('--check: 마커가 하나도 없으면 링크와 무관하게 unmarked', () => {
    put('lint.html', STYLE_LINK + '<p>x</p>');
    expect(statusOf('lint.html').status).toBe('unmarked');
    put('lint.html', '<p>x</p>');
    expect(statusOf('lint.html').status).toBe('unmarked');
  });

  it('--check: 한쪽 마커가 깨지면 다른 쪽이 정상이어도 malformed', () => {
    put('lint.html', STYLE_LINK + SYNC.applyFragment(GNB('x'), 'lint.html') + '<!-- drawer-nav:start -->\n');
    expect(statusOf('lint.html').status).toBe('malformed');
    put('lint.html', STYLE_LINK + '<!-- gnb:start -->\n' + DRAWER('x'));
    expect(statusOf('lint.html').status).toBe('malformed');
  });

  it('--check: partial 은 동기화 미완료로 세고, 요약·사유 집계에 사유 라벨이 나온다', () => {
    put('lint.html', DRAWER_LINK + SYNC.applyDrawerFragment(DRAWER('x'), 'lint.html'));
    const result = SYNC.checkAll(tmpRoot);
    const summary = SYNC.summarize(result);
    expect(summary.notInSync.map((p) => p.file)).toContain('lint.html');
    expect(summary.reasonCounts['gnb-marker-missing']).toBe(1);
    const report = SYNC.formatCheckReport(result);
    expect(report).toContain('gnb 마커 없음');
    expect(report).toMatch(/\[(마커|어긋남)\] lint\.html/);
  });

  it('--write 는 partial 페이지의 갱신 동작이 이전과 같다(있는 마커 구간만 갱신, 없는 마커는 삽입하지 않음)', () => {
    const dest = put('lint.html', DRAWER_LINK + DRAWER('<nav>old</nav>'));
    capture(['--write', '--root', tmpRoot]);
    const written = fs.readFileSync(dest, 'utf8');
    expect(written).toContain('class="drawer-nav"');
    expect(written).not.toContain('gnb:start');
  });
});

describe('기존 gnb 마커 동작 회귀', () => {
  it('gnb 마커만 있는 파일의 판정·갱신 결과는 이전과 같다', () => {
    expect(SYNC.readMarkerRegion('<p>x</p>').state).toBe('none');
    expect(SYNC.readMarkerRegion(GNB('x')).state).toBe('ok');
    expect(SYNC.readMarkerRegion('<!-- gnb:start -->').state).toBe('malformed');
    expect(SYNC.readMarkerRegion('<!-- gnb:end --><!-- gnb:start -->').state).toBe('malformed');
    expect(SYNC.readMarkerRegion('<!-- gnb:start --><!-- gnb:end --><!-- gnb:start --><!-- gnb:end -->').state).toBe('malformed');
    const html = GNB('<nav>old</nav>');
    expect(SYNC.applyAll(html, 'lint.html')).toBe(SYNC.applyFragment(html, 'lint.html'));
  });

  it('저장소의 실제 HTML 중 shared/style.css 또는 shared/drawer.css 를 링크하는 페이지만 드로어 마커를 갖는다(나머지는 none)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const migrated = /shared\/(style|drawer)\.css/.test(html);
      expect(SYNC.readMarkerRegion(html, 'drawer').state, file).toBe(migrated ? 'ok' : 'none');
    });
  });

  it('저장소의 실제 HTML 에 대해 readAllMarkers 는 gnb 단독 판정과 같다. 단 gnb 마커 없이 드로어 마커만 가진 페이지(C1 의 4쪽)는 ok', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const gnb = SYNC.readMarkerRegion(html, 'gnb').state;
      const drawer = SYNC.readMarkerRegion(html, 'drawer').state;
      const expected = gnb === 'none' && drawer === 'ok' ? 'ok' : gnb;
      expect(SYNC.readAllMarkers(html).state, file).toBe(expected);
    });
  });

  it('저장소의 실제 HTML: gnb 마커 없이 드로어 마커만 가진 페이지는 in-sync 가 아니라 partial 이다', () => {
    const result = SYNC.checkAll(ROOT);
    result.pages.forEach((p) => {
      const html = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
      const gnb = SYNC.readMarkerRegion(html, 'gnb').state;
      const drawer = SYNC.readMarkerRegion(html, 'drawer').state;
      if (gnb !== 'ok' && drawer === 'ok') {
        expect(p.status, p.file).toBe('partial');
        expect(p.reasons, p.file).toContain('gnb-marker-missing');
      }
    });
  });
});
