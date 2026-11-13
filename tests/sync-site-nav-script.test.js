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

function copyFromRepo(file) {
  const dest = path.join(tmpRoot, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, file), dest);
  return dest;
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

function capture(argv) {
  const lines = [];
  const code = SYNC.main(argv, (t) => lines.push(t));
  return { code, text: lines.join('\n') };
}

const PAGE = (body) => `<!doctype html><html lang="ko"><body>\n  <header class="gnb">\n    ${body}\n  </header>\n</body></html>\n`;
const MARKED = (inner) => PAGE(`<!-- gnb:start -->\n    ${inner}\n    <!-- gnb:end -->`);

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-site-nav-'));
});
afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('renderFragment', () => {
  it('분류되지 않은 파일은 null', () => {
    expect(SYNC.renderFragment('nope.html')).toBeNull();
    expect(SYNC.renderFragment('sema_p1.html')).toBeNull();
  });

  it('홈은 활성 탭도 aria-current 도 없고 2차 탭도 없다', () => {
    const text = SYNC.renderFragment('index.html').join('\n');
    expect(text).not.toContain('aria-current');
    expect(text).not.toContain('active');
    expect(text).not.toContain('gnb-subnav');
  });

  it('도구 페이지는 1차 true + 2차 page 를 정적으로 굽는다', () => {
    const text = SYNC.renderFragment('lint.html').join('\n');
    expect(text.match(/aria-current="true"/g)).toHaveLength(1);
    expect(text.match(/aria-current="page"/g)).toHaveLength(1);
    expect(text).toContain('<nav class="gnb-subnav" aria-label="세부 메뉴">');
  });

  it('원칙 랜딩은 page, 하위 페이지는 true 이고 2차 nav 는 없다', () => {
    expect(SYNC.renderFragment('principles/index.html').join('\n')).toContain('aria-current="page">원칙');
    const sub = SYNC.renderFragment('principles/foundation/index.html').join('\n');
    expect(sub).toContain('aria-current="true">원칙');
    expect(sub).not.toContain('gnb-subnav');
  });

  it('모든 분류 페이지의 1차 nav 는 정의 라벨 순서와 aria-label 을 따른다', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const text = SYNC.renderFragment(file).join('\n');
      expect(text, file).toContain('aria-label="' + NAV.NAV_ARIA_LABEL + '"');
      const labels = [...text.split('<nav class="gnb-subnav"')[0].matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]);
      expect(labels, file).toEqual(NAV.PRIMARY_TABS.map((t) => t.label));
    });
  });

  it('CSP 위반 마크업을 만들지 않는다 (script·on* 핸들러·style 속성·javascript: 없음)', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      const text = SYNC.renderFragment(file).join('\n');
      expect(text, file).not.toMatch(/<script/i);
      expect(text, file).not.toMatch(/\son[a-z]+\s*=/i);
      expect(text, file).not.toMatch(/\sstyle\s*=/i);
      expect(text, file).not.toMatch(/javascript:/i);
      expect(text, file).not.toMatch(/innerHTML/);
    });
  });
});

describe('마커 구간', () => {
  it('마커가 없으면 none, 정상이면 ok, 짝이 안 맞으면 malformed', () => {
    expect(SYNC.readMarkerRegion('<p>x</p>').state).toBe('none');
    expect(SYNC.readMarkerRegion(MARKED('x')).state).toBe('ok');
    expect(SYNC.readMarkerRegion('<!-- gnb:start -->').state).toBe('malformed');
    expect(SYNC.readMarkerRegion('<!-- gnb:end --><!-- gnb:start -->').state).toBe('malformed');
    expect(SYNC.readMarkerRegion('<!-- gnb:start --><!-- gnb:end --><!-- gnb:start --><!-- gnb:end -->').state).toBe('malformed');
  });

  it('applyFragment 는 마커 구간만 바꾸고 바깥은 바이트 그대로 둔다', () => {
    const html = MARKED('<nav>old</nav>');
    const next = SYNC.applyFragment(html, 'lint.html');
    expect(next).not.toBe(html);
    expect(next.startsWith(html.slice(0, html.indexOf('<!-- gnb:start -->')))).toBe(true);
    expect(next.endsWith('<!-- gnb:end -->\n  </header>\n</body></html>\n')).toBe(true);
    expect(next).toContain('>린터</a>');
    expect(next).not.toContain('<nav>old</nav>');
  });

  it('applyFragment 는 멱등이다', () => {
    const once = SYNC.applyFragment(MARKED('<nav>old</nav>'), 'lint.html');
    expect(SYNC.applyFragment(once, 'lint.html')).toBe(once);
  });

  it('applyFragment 는 마커 없음·깨짐·미분류 파일이면 null', () => {
    expect(SYNC.applyFragment('<p>x</p>', 'lint.html')).toBeNull();
    expect(SYNC.applyFragment('<!-- gnb:start -->', 'lint.html')).toBeNull();
    expect(SYNC.applyFragment(MARKED('x'), 'nope.html')).toBeNull();
  });

  it('치환 결과의 $ 패턴이 해석되지 않는다 (함수 치환 사용)', () => {
    // 마커 앞 들여쓰기에 '$&' 같은 패턴이 끼어도 그대로 보존되어야 한다.
    const html = 'a $& b\n<!-- gnb:start -->\nold\n<!-- gnb:end -->\n';
    const next = SYNC.applyFragment(html, 'index.html');
    expect(next.startsWith('a $& b\n<!-- gnb:start -->')).toBe(true);
    expect(next).not.toContain('old');
  });
});

describe('CLI 모드', () => {
  it('기본 실행(dry-run)은 어떤 파일도 쓰지 않는다 — 마커가 있어도', () => {
    const file = 'lint.html';
    const dest = copyFromRepo(file);
    fs.writeFileSync(dest, MARKED('<nav>old</nav>'));
    const before = snapshot(tmpRoot);
    const { code, text } = capture(['--root', tmpRoot]);
    expect(code).toBe(0);
    expect(text).toContain('갱신 예정');
    expect(text).toContain('아무 파일도 쓰지 않았습니다');
    expect(snapshot(tmpRoot)).toEqual(before);
  });

  it('--dry-run 도 쓰지 않고, --check 도 쓰지 않는다', () => {
    const dest = copyFromRepo('lint.html');
    fs.writeFileSync(dest, MARKED('<nav>old</nav>'));
    const before = snapshot(tmpRoot);
    capture(['--dry-run', '--root', tmpRoot]);
    capture(['--check', '--root', tmpRoot]);
    expect(snapshot(tmpRoot)).toEqual(before);
  });

  it('--write 는 마커가 있는 파일만 쓰고, 마커 없는 파일은 그대로 둔다', () => {
    const marked = copyFromRepo('lint.html');
    fs.writeFileSync(marked, MARKED('<nav>old</nav>'));
    const unmarked = copyFromRepo('prompt-library.html');
    const unmarkedBefore = fs.readFileSync(unmarked, 'utf8');

    const { code, text } = capture(['--write', '--root', tmpRoot]);
    expect(code).toBe(0);
    expect(text).toContain('쓴 파일 1개: lint.html');
    expect(fs.readFileSync(marked, 'utf8')).toContain('aria-current="page">린터');
    expect(fs.readFileSync(unmarked, 'utf8')).toBe(unmarkedBefore);
  });

  it('--write 후 --check 는 그 파일을 동기화 완료로 본다', () => {
    const dest = copyFromRepo('lint.html');
    fs.writeFileSync(dest, MARKED('<nav>old</nav>'));
    capture(['--write', '--root', tmpRoot]);
    const result = SYNC.checkAll(tmpRoot);
    const page = result.pages.find((p) => p.file === 'lint.html');
    expect(page.status).toBe('in-sync');
  });

  it('--check 는 어긋남이 있으면 종료코드 1, 숫자와 목록을 출력한다', () => {
    copyFromRepo('prompt-library.html');
    const { code, text } = capture(['--check', '--root', tmpRoot]);
    expect(code).toBe(1);
    expect(text).toContain('정의와 의미가 어긋난 페이지');
    expect(text).toContain('- prompt-library.html');
  });

  it('--check --json 은 파싱 가능한 JSON 을 낸다', () => {
    copyFromRepo('prompt-library.html');
    const { text } = capture(['--check', '--json', '--root', tmpRoot]);
    const json = JSON.parse(text);
    expect(json.total).toBe(Object.keys(NAV.PAGE_MAP).length);
    expect(json.semanticMismatch).toContain('prompt-library.html');
  });

  it('--print 는 조각을 출력하고 미분류 파일은 오류(2)', () => {
    const ok = capture(['--print', 'lint.html']);
    expect(ok.code).toBe(0);
    expect(ok.text).toContain('<!-- gnb:start -->');
    expect(capture(['--print', 'sema_p1.html']).code).toBe(2);
  });

  it('알 수 없는 옵션·모드 중복은 오류(2)', () => {
    expect(capture(['--nope']).code).toBe(2);
    expect(capture(['--check', '--write']).code).toBe(2);
    expect(capture(['--root']).code).toBe(2);
    expect(capture(['--help']).code).toBe(0);
  });

  it('깨진 마커는 건너뛰고 --write 가 건드리지 않는다', () => {
    const dest = copyFromRepo('lint.html');
    fs.writeFileSync(dest, '<!-- gnb:start --><nav>x</nav>');
    const before = fs.readFileSync(dest, 'utf8');
    const { text } = capture(['--write', '--root', tmpRoot]);
    expect(text).toContain('마커 깨짐');
    expect(fs.readFileSync(dest, 'utf8')).toBe(before);
  });
});

describe('inspectPage: 현재 마크업 대조', () => {
  it('정의와 같은 마크업(생성 결과)은 어긋남 사유가 없다', () => {
    const file = 'lint.html';
    const frag = SYNC.renderFragment(file).join('\n');
    const html = `<header class="gnb"><a class="gnb-logo" href="/krds-ux-writing/" aria-label="${NAV.LOGO.ariaLabel}">K</a>\n${frag}</header>`;
    expect(SYNC.inspectPage(html, file, ROOT).reasons).toEqual([]);
  });

  it('탭 라벨을 바꾸면 labels 사유가 잡힌다', () => {
    const file = 'lint.html';
    const frag = SYNC.renderFragment(file).join('\n').replace('>사전<', '>용어집<');
    const html = `<header class="gnb"><a class="gnb-logo" href="/krds-ux-writing/" aria-label="x">K</a>\n${frag}</header>`;
    expect(SYNC.inspectPage(html, file, ROOT).reasons).toContain('labels');
  });

  it('중첩 nav 와 상대경로 href 를 잡는다', () => {
    const html = '<nav class="gnb" aria-label="주 내비게이션"><nav class="gnb-nav" aria-label="주요 메뉴">' +
      '<a href="./principles/" class="gnb-nav-link">원칙</a></nav></nav>';
    const reasons = SYNC.inspectPage(html, 'lint.html', ROOT).reasons;
    expect(reasons).toContain('nav-landmark');
    expect(reasons).toContain('aria-label');
    expect(reasons).toContain('labels');
    expect(reasons).toContain('hrefs');
  });

  it('모바일 메뉴 별칭 라벨을 잡는다', () => {
    const html = '<div id="mobileMenu"><a class="mobile-menu-link" href="/x">사례 연구</a></div>';
    const { reasons, details } = SYNC.inspectPage(html, 'index.html', ROOT);
    expect(reasons).toContain('mobile-menu');
    expect(details.mobileAliases).toEqual(['사례 연구']);
  });

  it('모바일에서 .gnb-nav 를 숨기는데 모바일 메뉴가 없으면 4개 탭 모두 누락으로 센다', () => {
    const html = '<style>@media (max-width: 480px) { .gnb-nav { display: none; } }</style>' +
      '<header class="gnb"><nav class="gnb-nav" aria-label="섹션 내비게이션"></nav></header>';
    const { reasons, details } = SYNC.inspectPage(html, 'lint.html', ROOT);
    expect(reasons).toContain('mobile-menu');
    expect(details.mobileMissing).toEqual(NAV.PRIMARY_TABS.map((t) => t.label));
  });

  it('모바일에서 숨기지 않으면 모바일 메뉴가 없어도 위반이 아니다', () => {
    const html = '<header class="gnb"><nav class="gnb-nav" aria-label="섹션 내비게이션"></nav></header>';
    expect(SYNC.inspectPage(html, 'lint.html', ROOT).details.mobileMissing).toEqual([]);
  });

  it('resolveHref: 상대경로·절대경로·외부 링크·해시를 정규화한다', () => {
    expect(SYNC.resolveHref('generator/index.html', '../lint.html')).toBe('/lint');
    expect(SYNC.resolveHref('lint.html', './index.html')).toBe('/');
    expect(SYNC.resolveHref('lint.html', '/krds-ux-writing/generator/')).toBe('/generator');
    expect(SYNC.resolveHref('index.html', '/krds-ux-writing/#case-studies')).toBe('/#case-studies');
    expect(SYNC.resolveHref('index.html', 'https://www.krds.go.kr/')).toBeNull();
  });

  it('hasGnbMarkup: gnb 계열 클래스 유무', () => {
    expect(SYNC.hasGnbMarkup('<div class="a gnb-nav">')).toBe(true);
    expect(SYNC.hasGnbMarkup('<header class="gnb">')).toBe(true);
    expect(SYNC.hasGnbMarkup('<div class="nav-gnbx">')).toBe(false);
  });
});
