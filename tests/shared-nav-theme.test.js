import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/nav.js'), 'utf8');

function createElement(options = {}) {
  const listeners = new Map();
  const attributes = new Map(Object.entries(options.attributes || {}));
  return {
    innerHTML: options.innerHTML || '',
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((handler) => handler.call(this, {
        preventDefault() {},
        stopPropagation() {},
        target: this,
        currentTarget: this,
        ...event,
      }));
    },
    querySelectorAll() {
      return [];
    },
    focus() {},
  };
}

function makeContext(options = {}) {
  const listeners = new Map();
  const themeBtn = options.themeBtn || null;
  const mediaQuery = {
    matches: !!options.prefersDark,
    addEventListener: vi.fn((type, handler) => {
      if (type !== 'change') return;
      mediaQuery._handler = handler;
    }),
    addListener: vi.fn((handler) => {
      mediaQuery._handler = handler;
    }),
    _handler: null,
  };
  const localStorageState = new Map();
  if (options.storedTheme) localStorageState.set('krds-theme', options.storedTheme);

  const documentElement = {
    theme: options.initialTheme || 'light',
    setAttribute(name, value) {
      if (name === 'data-theme') this.theme = String(value);
    },
    getAttribute(name) {
      return name === 'data-theme' ? this.theme : null;
    },
  };

  const document = {
    documentElement,
    body: { style: {} },
    activeElement: null,
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    getElementById(id) {
      if (id === 'themeToggle') return themeBtn;
      return null;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
  };

  const localStorage = {
    getItem: vi.fn((key) => (localStorageState.has(key) ? localStorageState.get(key) : null)),
    setItem: vi.fn((key, value) => {
      localStorageState.set(key, String(value));
    }),
  };

  const context = {
    window: {
      location: {
        pathname: options.pathname || '/krds-ux-writing/case-studies/',
      },
      matchMedia: vi.fn(() => mediaQuery),
    },
    document,
    localStorage,
    IntersectionObserver: function () {
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
    Array,
    JSON,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(SOURCE, context);

  return {
    documentElement,
    themeBtn,
    mediaQuery,
    localStorage,
  };
}

describe('shared nav theme behavior', () => {
  it('does not persist a theme preference during initial hydration', () => {
    const themeBtn = createElement();
    const ctx = makeContext({
      themeBtn,
      prefersDark: true,
      initialTheme: 'dark',
    });

    expect(ctx.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(ctx.localStorage.setItem).not.toHaveBeenCalled();
    expect(themeBtn.getAttribute('aria-label')).toBe('라이트 모드로 전환');
    expect(themeBtn.innerHTML).toContain('<circle cx="8" cy="8" r="4"');
  });

  it('follows system theme changes when no explicit preference is stored', () => {
    const themeBtn = createElement();
    const ctx = makeContext({
      themeBtn,
      prefersDark: false,
      initialTheme: 'light',
    });

    ctx.mediaQuery.matches = true;
    ctx.mediaQuery._handler({ matches: true });

    expect(ctx.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(ctx.localStorage.setItem).not.toHaveBeenCalled();
    expect(themeBtn.getAttribute('aria-label')).toBe('라이트 모드로 전환');
  });

  it('does not override an explicitly stored theme when the system theme changes', () => {
    const themeBtn = createElement();
    const ctx = makeContext({
      themeBtn,
      prefersDark: false,
      storedTheme: 'light',
      initialTheme: 'light',
    });

    ctx.mediaQuery.matches = true;
    ctx.mediaQuery._handler({ matches: true });

    expect(ctx.documentElement.getAttribute('data-theme')).toBe('light');
    expect(ctx.localStorage.setItem).not.toHaveBeenCalled();
    expect(themeBtn.getAttribute('aria-label')).toBe('다크 모드로 전환');
  });

  it('persists the user-selected theme on toggle', () => {
    const themeBtn = createElement();
    const ctx = makeContext({
      themeBtn,
      prefersDark: false,
      initialTheme: 'light',
    });

    themeBtn.dispatch('click');

    expect(ctx.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(ctx.localStorage.setItem).toHaveBeenCalledWith('krds-theme', 'dark');
    expect(themeBtn.getAttribute('aria-label')).toBe('라이트 모드로 전환');
  });

  it('falls back to the legacy addListener API when addEventListener is not available on the media query', () => {
    const addListenerCalls = [];
    const mediaQuery = {
      matches: true,
      addListener: vi.fn((handler) => { addListenerCalls.push(handler); }),
    };

    const documentElement = {
      theme: 'dark',
      setAttribute(name, value) {
        if (name === 'data-theme') this.theme = String(value);
      },
      getAttribute(name) {
        return name === 'data-theme' ? this.theme : null;
      },
    };

    const context = {
      window: {
        location: { pathname: '/case-studies/' },
        matchMedia: () => mediaQuery,
      },
      document: {
        documentElement,
        body: { style: {} },
        activeElement: null,
        querySelectorAll() { return []; },
        querySelector() { return null; },
        getElementById() { return null; },
        addEventListener() {},
      },
      localStorage: {
        getItem() { return null; },
        setItem() {},
      },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array,
      JSON,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(mediaQuery.addListener).toHaveBeenCalled();
    mediaQuery.matches = false;
    addListenerCalls[0]({ matches: false });
    expect(documentElement.getAttribute('data-theme')).toBe('light');
  });
});
