import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── 공통: 인라인 <script> 와 CSP 해시 ──────────────────────────────
// 실행되지 않는 데이터 블록(JSON 등)은 CSP script-src 의 대상이 아니다.
const DATA_TYPE = /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap|speculationrules|text\/template)/i;

function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1]) && !DATA_TYPE.test(m[1]))
    .map((m) => m[2]);
}

function cspScriptSrc(html) {
  const meta = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!content) return null;
  return (content[2].match(/script-src[^;]*/) || [''])[0];
}

const sha256 = (body) => crypto.createHash('sha256').update(body).digest('base64');

// ── (a)(b)(d) generator/index.html 계약 ─────────────────────────────
describe('generator/index.html — 테마 토글이 CSP 에 막히지 않는다', () => {
  const html = read('generator/index.html');

  it('인라인 <script>(src 없음)는 <head> 의 테마 초기화 하나뿐이다', () => {
    const scripts = inlineScripts(html);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("localStorage.getItem('krds-theme')");
    // 그 하나는 <head> 안에 있다.
    const headEnd = html.indexOf('</head>');
    expect(html.indexOf(scripts[0])).toBeGreaterThan(-1);
    expect(html.indexOf(scripts[0])).toBeLessThan(headEnd);
  });

  it('모든 인라인 <script> 의 sha256 이 CSP script-src 에 있다 (허용 목록에 없는 스크립트는 브라우저가 실행하지 않는다)', () => {
    const ss = cspScriptSrc(html);
    expect(ss).toBeTruthy();
    expect(ss).not.toContain("'unsafe-inline'");
    inlineScripts(html).forEach((body) => {
      expect(ss, 'sha256-' + sha256(body)).toContain("'sha256-" + sha256(body) + "'");
    });
  });

  it('CSP 는 해시 하나와 \'self\' 를 허용하고, 새로 해시를 늘리지 않았다', () => {
    const ss = cspScriptSrc(html);
    expect(ss).toContain("'self'");
    expect((ss.match(/sha256-/g) || []).length).toBe(1);
  });

  it('theme-toggle.js 를 한 번 로드하고, app.js 뒤 · drawer.js 앞이다 (drawer.js 가 마지막 외부 스크립트)', () => {
    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    expect(srcs.filter((s) => s === 'theme-toggle.js')).toHaveLength(1);
    const at = (name) => srcs.indexOf(name);
    expect(at('app.js')).toBeGreaterThanOrEqual(0);
    expect(at('theme-toggle.js')).toBeGreaterThan(at('app.js'));
    expect(at('../shared/drawer.js')).toBe(srcs.length - 1);
    expect(at('theme-toggle.js')).toBeLessThan(at('../shared/drawer.js'));
    expect(fs.existsSync(path.join(ROOT, 'generator/theme-toggle.js'))).toBe(true);
  });

  it('shared/nav.js 는 로드하지 않는다 (테마 이중 처리 방지)', () => {
    expect(html).not.toMatch(/shared\/nav\.js/);
  });

  it('#genThemeToggle · 두 아이콘이 하나씩 있다', () => {
    expect((html.match(/id="genThemeToggle"/g) || []).length).toBe(1);
    expect((html.match(/gen-icon-moon/g) || []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/gen-icon-sun/g) || []).length).toBeGreaterThanOrEqual(1);
  });
});

describe('generator/theme-toggle.js — 소스 안전성', () => {
  const src = read('generator/theme-toggle.js');

  it('innerHTML·eval·new Function·onclick 이 없다', () => {
    expect(src).not.toMatch(/innerHTML|\beval\s*\(|new\s+Function|onclick/);
  });

  it('app.js 와 같은 버튼을 다루지 않는다 (generator/app.js 에 genThemeToggle 이 없다)', () => {
    expect(read('generator/app.js')).not.toContain('genThemeToggle');
  });
});

// ── (c) vm 가짜 DOM 으로 theme-toggle.js 실행 ─────────────────────
function runToggle({ stored, prefersDark = false, withButton = true, storageThrows = false } = {}) {
  const store = new Map();
  if (stored !== undefined) store.set('krds-theme', stored);
  const attrs = new Map();
  const handlers = [];
  const btnAttrs = new Map();
  const btn = {
    setAttribute: (k, v) => btnAttrs.set(k, v),
    getAttribute: (k) => (btnAttrs.has(k) ? btnAttrs.get(k) : null),
    addEventListener: (type, fn) => { if (type === 'click') handlers.push(fn); },
  };
  const moon = { style: {} };
  const sun = { style: {} };
  const document = {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    },
    getElementById: (id) => (id === 'genThemeToggle' && withButton ? btn : null),
    querySelector: (sel) => (withButton ? (sel === '.gen-icon-moon' ? moon : sel === '.gen-icon-sun' ? sun : null) : null),
  };
  const localStorage = storageThrows
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const window = { matchMedia: (q) => ({ matches: prefersDark && /prefers-color-scheme:dark/.test(q) }) };
  const ctx = vm.createContext({ document, localStorage, window });
  ctx.window.document = document;
  vm.runInContext(read('generator/theme-toggle.js'), ctx);
  return {
    theme: () => attrs.get('data-theme'),
    stored: () => (store.has('krds-theme') ? store.get('krds-theme') : null),
    label: () => btnAttrs.get('aria-label'),
    moon: () => moon.style.display,
    sun: () => sun.style.display,
    click: () => handlers.forEach((h) => h({})),
    handlerCount: () => handlers.length,
  };
}

describe('generator/theme-toggle.js — 동작', () => {
  it('저장값이 없고 시스템이 라이트면 light 로 시작하고 저장한다', () => {
    const t = runToggle();
    expect(t.theme()).toBe('light');
    expect(t.stored()).toBe('light');
    expect(t.moon()).toBe('block');
    expect(t.sun()).toBe('none');
    expect(t.label()).toBe('다크모드 전환');
  });

  it('클릭하면 light → dark → light 로 바뀌고 저장·아이콘·aria-label 이 따라간다', () => {
    const t = runToggle();
    expect(t.handlerCount()).toBe(1);
    t.click();
    expect(t.theme()).toBe('dark');
    expect(t.stored()).toBe('dark');
    expect(t.moon()).toBe('none');
    expect(t.sun()).toBe('block');
    expect(t.label()).toBe('라이트모드 전환');
    t.click();
    expect(t.theme()).toBe('light');
    expect(t.stored()).toBe('light');
    expect(t.moon()).toBe('block');
    expect(t.sun()).toBe('none');
    expect(t.label()).toBe('다크모드 전환');
  });

  it('저장된 값이 있으면 그 값으로 시작한다 (시스템 설정보다 우선)', () => {
    const dark = runToggle({ stored: 'dark', prefersDark: false });
    expect(dark.theme()).toBe('dark');
    expect(dark.sun()).toBe('block');
    expect(dark.label()).toBe('라이트모드 전환');
    const light = runToggle({ stored: 'light', prefersDark: true });
    expect(light.theme()).toBe('light');
    expect(light.moon()).toBe('block');
  });

  it('저장값이 없고 prefers-color-scheme: dark 면 dark 로 시작한다', () => {
    const t = runToggle({ prefersDark: true });
    expect(t.theme()).toBe('dark');
    expect(t.stored()).toBe('dark');
    expect(t.sun()).toBe('block');
  });

  it('#genThemeToggle 이 없어도 에러 없이 테마만 적용한다', () => {
    let t;
    expect(() => { t = runToggle({ withButton: false, stored: 'dark' }); }).not.toThrow();
    expect(t.theme()).toBe('dark');
    expect(t.handlerCount()).toBe(0);
  });

  it('localStorage 가 막혀 있어도 에러 없이 동작한다', () => {
    let t;
    expect(() => { t = runToggle({ storageThrows: true }); }).not.toThrow();
    expect(t.theme()).toBe('light');
    t.click();
    expect(t.theme()).toBe('dark');
  });
});

// ── 전수: 같은 사고가 다른 쪽에도 있는지 ────────────────────────────
// CSP meta 가 있고 script-src 에 'unsafe-inline' 이 없으면, 모든 인라인 <script> 본문의 sha256 이 CSP 에 있어야 한다.
// 허용 목록에 없는 인라인 스크립트는 브라우저가 실행하지 않는다(generator 테마 버튼이 그랬다).
// 목록은 줄어들기만 한다. 새 위반을 여기에 추가하지 않는다 — 고친다.
const KNOWN_VIOLATIONS = [
  // 내부 도구(웹 게시 제외: .vercelignore·_config.yml). CSP 의 해시가 현재 인라인 본문과 맞지 않는다.
  'term-graph.html',
];

describe('전체 HTML — 인라인 <script> 는 CSP 해시로 허용돼 있다', () => {
  const targets = walkHtmlFiles(ROOT)
    .sort()
    .map((rel) => {
      const html = read(rel);
      const ss = cspScriptSrc(html);
      if (ss === null || ss.includes("'unsafe-inline'")) return null;
      const missing = inlineScripts(html)
        .map(sha256)
        .filter((h) => !ss.includes("'sha256-" + h + "'"));
      return { rel, missing };
    })
    .filter(Boolean);

  it('검사 대상이 비어 있지 않고 generator/index.html 과 index.html 을 포함한다', () => {
    const names = targets.map((t) => t.rel);
    expect(names).toContain('generator/index.html');
    expect(names).toContain('index.html');
    expect(names).not.toContain('before-after.html'); // 'unsafe-inline' 이 있어 대상이 아니다
  });

  it('위반 목록이 KNOWN_VIOLATIONS 와 정확히 같다 (새 위반 금지, 고친 것은 목록에서 제거)', () => {
    const violating = targets.filter((t) => t.missing.length > 0).map((t) => t.rel);
    expect(violating).toEqual(KNOWN_VIOLATIONS);
  });

  it('generator/index.html 은 위반이 아니다', () => {
    expect(KNOWN_VIOLATIONS).not.toContain('generator/index.html');
    const g = targets.find((t) => t.rel === 'generator/index.html');
    expect(g.missing).toEqual([]);
  });
});
