// shared/drawer.js — nav.js 를 로드하지 않는 페이지(archive.html, before-after.html …)의 드로어 열기·닫기.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'shared/drawer.js'), 'utf8');

function createClassList() {
  const classes = new Set();
  return {
    add(...v) { v.forEach((x) => classes.add(x)); },
    remove(...v) { v.forEach((x) => classes.delete(x)); },
    contains(v) { return classes.has(v); },
  };
}

function createElement(options = {}) {
  const listeners = new Map();
  const attributes = new Map(Object.entries(options.attributes || {}));
  const el = {
    classList: createClassList(),
    offsetParent: options.offsetParent === undefined ? {} : options.offsetParent,
    addEventListener(type, handler) { listeners.set(type, [...(listeners.get(type) || []), handler]); },
    removeEventListener(type, handler) { listeners.set(type, (listeners.get(type) || []).filter((h) => h !== handler)); },
    listenerCount(type) { return (listeners.get(type) || []).length; },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).slice().forEach((h) => h.call(el, { preventDefault() {}, ...event }));
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    querySelectorAll(selector) {
      return selector.includes('a[href]') && selector.includes('button:not([disabled])') ? (options.focusables || []) : [];
    },
    focus: vi.fn(),
  };
  el.focus = vi.fn(() => { options.doc && (options.doc.activeElement = el); });
  return el;
}

function makeContext({ drawer = true, backdrop = true, hamburger = true, links = 3, innerWidth = 480 } = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const doc = { activeElement: null };
  const focusables = Array.from({ length: links }, () => createElement({ doc }));
  const drawerEl = drawer ? createElement({ doc, focusables }) : null;
  const backdropEl = backdrop ? createElement({ doc }) : null;
  const hamburgerEl = hamburger ? createElement({
    doc,
    attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
  }) : null;
  const htmlAttrs = new Map();
  Object.assign(doc, {
    documentElement: {
      hasAttribute: (n) => htmlAttrs.has(n),
      setAttribute: (n, v) => htmlAttrs.set(n, String(v)),
      getAttribute: (n) => (htmlAttrs.has(n) ? htmlAttrs.get(n) : null),
    },
    body: { style: {} },
    querySelector(selector) {
      if (selector === '.site-drawer') return drawerEl;
      if (selector === '.sidebar-backdrop') return backdropEl;
      return null;
    },
    getElementById(id) { return id === 'gnbHamburger' ? hamburgerEl : null; },
    addEventListener(type, handler) { documentListeners.set(type, [...(documentListeners.get(type) || []), handler]); },
    dispatch(type, event = {}) {
      (documentListeners.get(type) || []).slice().forEach((h) => h({ preventDefault() {}, ...event }));
    },
  });
  const win = {
    innerWidth,
    addEventListener(type, handler) { windowListeners.set(type, [...(windowListeners.get(type) || []), handler]); },
    dispatch(type) { (windowListeners.get(type) || []).slice().forEach((h) => h({})); },
  };
  const context = { window: win, document: doc, Array, console };
  const run = () => vm.runInNewContext(SOURCE, context);
  run();
  return { context, run, doc, win, drawerEl, backdropEl, hamburgerEl, focusables, htmlAttrs, documentListeners, windowListeners };
}

describe('shared/drawer.js 동작', () => {
  it('(a) 햄버거 클릭 → .open·aria-expanded=true·aria-label 변경·body overflow hidden·첫 포커스', () => {
    const t = makeContext();
    expect(t.hamburgerEl.getAttribute('aria-expanded')).toBe('false');
    t.hamburgerEl.dispatch('click');
    expect(t.drawerEl.classList.contains('open')).toBe(true);
    expect(t.backdropEl.classList.contains('open')).toBe(true);
    expect(t.hamburgerEl.getAttribute('aria-expanded')).toBe('true');
    expect(t.hamburgerEl.getAttribute('aria-label')).toBe('메뉴 닫기');
    expect(t.doc.body.style.overflow).toBe('hidden');
    expect(t.focusables[0].focus).toHaveBeenCalledTimes(1);
    expect(t.doc.activeElement).toBe(t.focusables[0]);
  });

  it('(b) 다시 클릭 → 닫힘, 포커스는 햄버거로 복귀', () => {
    const t = makeContext();
    t.hamburgerEl.dispatch('click');
    t.hamburgerEl.dispatch('click');
    expect(t.drawerEl.classList.contains('open')).toBe(false);
    expect(t.backdropEl.classList.contains('open')).toBe(false);
    expect(t.hamburgerEl.getAttribute('aria-expanded')).toBe('false');
    expect(t.hamburgerEl.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(t.doc.body.style.overflow).toBe('');
    expect(t.doc.activeElement).toBe(t.hamburgerEl);
  });

  it('(c) Esc 로 닫히고 포커스가 햄버거로 돌아온다. 닫힌 상태의 Esc 는 아무 일도 하지 않는다', () => {
    const t = makeContext();
    t.doc.dispatch('keydown', { key: 'Escape' });
    expect(t.hamburgerEl.focus).not.toHaveBeenCalled();
    t.hamburgerEl.dispatch('click');
    t.doc.dispatch('keydown', { key: 'Escape' });
    expect(t.drawerEl.classList.contains('open')).toBe(false);
    expect(t.doc.activeElement).toBe(t.hamburgerEl);
  });

  it('(d) backdrop 클릭으로 닫히고 포커스가 햄버거로 돌아온다', () => {
    const t = makeContext();
    t.hamburgerEl.dispatch('click');
    t.backdropEl.dispatch('click');
    expect(t.drawerEl.classList.contains('open')).toBe(false);
    expect(t.backdropEl.classList.contains('open')).toBe(false);
    expect(t.doc.body.style.overflow).toBe('');
    expect(t.doc.activeElement).toBe(t.hamburgerEl);
  });

  it('(e) Tab 은 마지막 → 첫째, Shift+Tab 은 첫째 → 마지막으로 순환한다. 가운데에서는 가로채지 않는다', () => {
    const t = makeContext({ links: 3 });
    t.hamburgerEl.dispatch('click');
    const [first, middle, last] = t.focusables;
    const prevent = vi.fn();

    t.doc.activeElement = last;
    t.drawerEl.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault: prevent });
    expect(prevent).toHaveBeenCalledTimes(1);
    expect(t.doc.activeElement).toBe(first);

    t.doc.activeElement = first;
    t.drawerEl.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: prevent });
    expect(prevent).toHaveBeenCalledTimes(2);
    expect(t.doc.activeElement).toBe(last);

    t.doc.activeElement = middle;
    t.drawerEl.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault: prevent });
    t.drawerEl.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: prevent });
    t.drawerEl.dispatch('keydown', { key: 'Enter', preventDefault: prevent });
    expect(prevent).toHaveBeenCalledTimes(2);
    expect(t.doc.activeElement).toBe(middle);
  });

  it('닫으면 포커스 가두기 리스너가 제거된다(열고 닫기를 반복해도 쌓이지 않음)', () => {
    const t = makeContext();
    for (let i = 0; i < 3; i += 1) {
      t.hamburgerEl.dispatch('click');
      expect(t.drawerEl.listenerCount('keydown')).toBe(1);
      t.hamburgerEl.dispatch('click');
      expect(t.drawerEl.listenerCount('keydown')).toBe(0);
    }
  });

  it('(f) innerWidth > 900 으로 resize 하면 닫히되 포커스를 옮기지 않는다. 900 이하 resize 는 열린 채 둔다', () => {
    const t = makeContext();
    t.hamburgerEl.dispatch('click');
    t.hamburgerEl.focus.mockClear();
    t.win.innerWidth = 900;
    t.win.dispatch('resize');
    expect(t.drawerEl.classList.contains('open')).toBe(true);
    t.win.innerWidth = 901;
    t.win.dispatch('resize');
    expect(t.drawerEl.classList.contains('open')).toBe(false);
    expect(t.backdropEl.classList.contains('open')).toBe(false);
    expect(t.doc.body.style.overflow).toBe('');
    expect(t.hamburgerEl.getAttribute('aria-expanded')).toBe('false');
    expect(t.hamburgerEl.focus).not.toHaveBeenCalled();
  });

  it('(g) .site-drawer 가 없으면 에러 없이 return 하고 아무것도 바인딩하지 않는다', () => {
    let t;
    expect(() => { t = makeContext({ drawer: false }); }).not.toThrow();
    expect(t.documentListeners.size).toBe(0);
    expect(t.windowListeners.size).toBe(0);
    expect(t.hamburgerEl.listenerCount('click')).toBe(0);
    expect(t.htmlAttrs.has('data-krds-drawer')).toBe(false);
  });

  it('backdrop·햄버거가 없어도 에러 없이 열고 닫힌다', () => {
    const t = makeContext({ backdrop: false, hamburger: false });
    expect(() => {
      t.doc.dispatch('keydown', { key: 'Escape' });
      t.win.innerWidth = 1280;
      t.win.dispatch('resize');
    }).not.toThrow();
    expect(t.drawerEl.classList.contains('open')).toBe(false);
  });

  it('포커스 가능한 요소가 없으면 열리되 가두기 리스너는 만들지 않는다', () => {
    const t = makeContext({ links: 0 });
    t.hamburgerEl.dispatch('click');
    expect(t.drawerEl.classList.contains('open')).toBe(true);
    expect(t.drawerEl.listenerCount('keydown')).toBe(0);
  });

  it('(h) 중복 로드 가드: 두 번째 실행은 data-krds-drawer 를 보고 바인딩하지 않는다', () => {
    const t = makeContext();
    expect(t.htmlAttrs.has('data-krds-drawer')).toBe(true);
    t.run();
    expect(t.hamburgerEl.listenerCount('click')).toBe(1);
    expect(t.backdropEl.listenerCount('click')).toBe(1);
    expect(t.documentListeners.get('keydown').length).toBe(1);
    expect(t.windowListeners.get('resize').length).toBe(1);
    t.hamburgerEl.dispatch('click');
    expect(t.drawerEl.classList.contains('open')).toBe(true);
  });

  it('테마를 건드리지 않는다: localStorage·data-theme·#themeToggle 에 접근하지 않는다', () => {
    expect(SOURCE).not.toMatch(/localStorage|data-theme|themeToggle|krds-theme/);
  });
});

describe('shared/drawer.js 정적 검사', () => {
  it("innerHTML·eval·new Function·onclick 이 없고 'use strict' 를 쓴다", () => {
    expect(SOURCE).not.toMatch(/innerHTML|\beval\s*\(|new\s+Function|onclick|javascript:/);
    expect(SOURCE).toContain("'use strict'");
  });
});

describe('페이지 계약', () => {
  const ALL_HTML = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'graft', '.git', 'research', 'offline-app', 'derived', '민원결과', '확인하기'].includes(name.name)) continue;
      if (name.name.startsWith('.')) continue;
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith('.html')) ALL_HTML.push(path.relative(ROOT, full));
    }
  })(ROOT);
  const count = (text, re) => (text.match(re) || []).length;
  const loadsNav = (html) => /<script\b[^>]*\bsrc="[^"]*shared\/nav\.js[^"]*"/.test(html);
  const loadsDrawer = (html) => /<script\b[^>]*\bsrc="[^"]*shared\/drawer\.js[^"]*"/.test(html);

  it('HTML 파일을 실제로 찾았다(빈 검사 방지)', () => {
    expect(ALL_HTML.length).toBeGreaterThan(10);
    expect(ALL_HTML).toContain('archive.html');
  });

  it('어떤 페이지도 nav.js 와 drawer.js 를 동시에 로드하지 않는다', () => {
    const both = ALL_HTML.filter((f) => {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return loadsNav(html) && loadsDrawer(html);
    });
    expect(both).toEqual([]);
  });

  it('drawer.js 를 로드하는 페이지는 archive.html·before-after.html 이다', () => {
    const pages = ALL_HTML.filter((f) => loadsDrawer(fs.readFileSync(path.join(ROOT, f), 'utf8'))).sort();
    expect(pages).toEqual(['archive.html', 'before-after.html']);
  });

  describe.each(['archive.html', 'before-after.html'])('%s', (file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');

    it('drawer.js 를 한 번, drawer.css 를 한 번 로드한다', () => {
      expect(count(html, /shared\/drawer\.js/g)).toBe(1);
      expect(count(html, /shared\/drawer\.css/g)).toBe(1);
      expect(fs.existsSync(path.join(ROOT, 'shared/drawer.js'))).toBe(true);
    });

    it('#gnbHamburger·aside#mainSidebar·.sidebar-backdrop·드로어 마커가 각각 정확히 1개', () => {
      expect(count(html, /id="gnbHamburger"/g)).toBe(1);
      expect(count(html, /<aside\b[^>]*id="mainSidebar"/g)).toBe(1);
      expect(count(html, /class="sidebar-backdrop"/g)).toBe(1);
      expect(count(html, /<!-- drawer-nav:start -->/g)).toBe(1);
      expect(count(html, /<!-- drawer-nav:end -->/g)).toBe(1);
    });

    it('drawer.js 는 외부 스크립트 한 줄로만 추가되고 onclick 이 없다', () => {
      expect(html).not.toMatch(/\sonclick=/);
      expect(html).toMatch(/<script src="shared\/drawer\.js"><\/script>/);
    });
  });
});
