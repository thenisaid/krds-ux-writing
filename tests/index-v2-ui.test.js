import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'index-v2.html'), 'utf8');
const INLINE_SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const SOURCE = INLINE_SCRIPTS[1] || '';
const SUN = 'M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z';
const MOON = 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z';

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(...values) {
      values.forEach((value) => classes.add(value));
    },
    remove(...values) {
      values.forEach((value) => classes.delete(value));
    },
    contains(value) {
      return classes.has(value);
    },
    toggle(value, force) {
      if (force === undefined) {
        if (classes.has(value)) {
          classes.delete(value);
          return false;
        }
        classes.add(value);
        return true;
      }
      if (force) classes.add(value);
      else classes.delete(value);
      return force;
    },
  };
}

function createElement(options = {}) {
  const listeners = new Map();
  const attributes = new Map(Object.entries(options.attributes || {}));
  const queryMap = options.queryMap || {};
  return {
    classList: createClassList(options.classes || []),
    style: options.style || {},
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    removeEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((entry) => entry !== handler));
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
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    querySelector(selector) {
      const value = queryMap[selector];
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    },
    querySelectorAll(selector) {
      const value = queryMap[selector];
      return Array.isArray(value) ? value : value ? [value] : [];
    },
    focus: vi.fn(),
  };
}

describe('index-v2 theme toggle', () => {
  it('synchronizes the theme icon with the restored theme on load and click', () => {
    const themeToggle = createElement();
    const themeIcon = createElement({ attributes: { d: MOON } });
    const documentElement = {
      theme: 'dark',
      setAttribute(name, value) {
        if (name === 'data-theme') this.theme = String(value);
      },
      getAttribute(name) {
        return name === 'data-theme' ? this.theme : null;
      },
    };
    const document = {
      documentElement,
      getElementById(id) {
        if (id === 'themeToggle') return themeToggle;
        if (id === 'themeIcon') return themeIcon;
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
    const context = {
      document,
      window: {
        location: {
          pathname: '/index-v2.html',
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(themeIcon.getAttribute('d')).toBe(SUN);
    expect(themeToggle.getAttribute('aria-label')).toBe('라이트모드 전환');

    themeToggle.dispatch('click');

    expect(documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeIcon.getAttribute('d')).toBe(MOON);
    expect(themeToggle.getAttribute('aria-label')).toBe('다크모드 전환');
  });

  it('opens and closes the mobile menu with synced labels and focus handling', () => {
    const firstLink = createElement();
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': firstLink,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [firstLink],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const listeners = new Map();
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, handler) {
        const arr = listeners.get(type) || [];
        arr.push(handler);
        listeners.set(type, arr);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({
          preventDefault() {},
          stopPropagation() {},
          ...event,
        }));
      },
    };
    const context = {
      document,
      window: {
        location: {
          pathname: '/index-v2.html',
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    mobileMenuBtn.dispatch('click');

    expect(mobileMenu.classList.contains('open')).toBe(true);
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-label')).toBe('메뉴 닫기');
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('false');
    expect(document.body.style.overflow).toBe('hidden');
    expect(firstLink.focus).toHaveBeenCalled();

    document.dispatch('keydown', { key: 'Escape' });

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(mobileMenuBtn.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('');
    expect(mobileMenuBtn.focus).toHaveBeenCalled();
  });

  it('does not move focus when Escape is pressed while the mobile menu is already closed', () => {
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': null,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const listeners = new Map();
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, handler) {
        const arr = listeners.get(type) || [];
        arr.push(handler);
        listeners.set(type, arr);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({
          preventDefault() {},
          stopPropagation() {},
          ...event,
        }));
      },
    };
    const context = {
      document,
      window: {
        location: {
          pathname: '/index-v2.html',
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'Escape' });

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the mobile menu when the viewport grows past the mobile breakpoint', () => {
    const firstLink = createElement();
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': firstLink,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [firstLink],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const listeners = new Map();
    const windowListeners = new Map();
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, handler) {
        const arr = listeners.get(type) || [];
        arr.push(handler);
        listeners.set(type, arr);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({
          preventDefault() {},
          stopPropagation() {},
          ...event,
        }));
      },
    };
    const context = {
      document,
      window: {
        innerWidth: 480,
        location: {
          pathname: '/index-v2.html',
        },
        addEventListener(type, handler) {
          const arr = windowListeners.get(type) || [];
          arr.push(handler);
          windowListeners.set(type, arr);
        },
        dispatch(type, event = {}) {
          const handlers = windowListeners.get(type) || [];
          handlers.forEach((handler) => handler(event));
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    mobileMenuBtn.dispatch('click');

    expect(mobileMenu.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    context.window.innerWidth = 1200;
    context.window.dispatch('resize');

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
  });

  it('ignores non-element mobile menu click targets without throwing', () => {
    const firstLink = createElement();
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': firstLink,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [firstLink],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const listeners = new Map();
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, handler) {
        const arr = listeners.get(type) || [];
        arr.push(handler);
        listeners.set(type, arr);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({
          preventDefault() {},
          stopPropagation() {},
          ...event,
        }));
      },
    };
    const context = {
      document,
      window: {
        innerWidth: 480,
        location: {
          pathname: '/index-v2.html',
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(() => {
      mobileMenu.dispatch('click', { target: { nodeType: 3 } });
    }).not.toThrow();
    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
  });

  it('traps focus inside the open mobile menu when tabbing forward from the last link', () => {
    const firstLink = createElement();
    const lastLink = createElement();
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': firstLink,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [firstLink, lastLink],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const listeners = new Map();
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      activeElement: null,
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, handler) {
        const arr = listeners.get(type) || [];
        arr.push(handler);
        listeners.set(type, arr);
      },
      dispatch(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({
          preventDefault() {},
          stopPropagation() {},
          ...event,
        }));
      },
    };
    firstLink.focus = vi.fn(() => {
      document.activeElement = firstLink;
    });
    lastLink.focus = vi.fn(() => {
      document.activeElement = lastLink;
    });
    mobileMenuBtn.focus = vi.fn();

    const context = {
      document,
      window: {
        location: {
          pathname: '/index-v2.html',
        },
      },
      localStorage: {
        setItem() {},
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    mobileMenuBtn.dispatch('click');
    document.activeElement = lastLink;

    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(firstLink.focus).toHaveBeenCalledTimes(2);
  });

  it('marks the current section nav link active when the pathname omits the trailing slash', () => {
    const principlesLink = createElement({
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const dictionaryLink = createElement({
      attributes: { href: '/krds-ux-writing/dictionary/' },
    });
    const caseStudiesLink = createElement({
      attributes: { href: '/krds-ux-writing/case-studies/' },
    });
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      getElementById() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-link') {
          return [principlesLink, dictionaryLink, caseStudiesLink];
        }
        return [];
      },
      addEventListener() {},
    };
    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing/principles',
        },
      },
      localStorage: {
        setItem() {},
      },
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(true);
    expect(dictionaryLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(false);
  });

  it('does not install a trap handler when the mobile menu has no focusable elements', () => {
    const mobileMenu = createElement({
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        '.mobile-menu-link': null,
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])': [],
      },
    });
    const mobileMenuBtn = createElement({
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    const documentElement = {
      setAttribute() {},
      getAttribute() { return 'light'; },
    };
    const document = {
      documentElement,
      body: { style: {} },
      activeElement: null,
      getElementById(id) {
        if (id === 'themeToggle') return null;
        if (id === 'themeIcon') return null;
        if (id === 'mobileMenuBtn') return mobileMenuBtn;
        if (id === 'mobileMenu') return mobileMenu;
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
    };

    const context = {
      document,
      window: { location: { pathname: '/index-v2.html' } },
      localStorage: { setItem() {} },
      Array, console, globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    mobileMenuBtn.dispatch('click');
    expect(mobileMenu.classList.contains('open')).toBe(true);

    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(mobileMenu.classList.contains('open')).toBe(true);
  });
});
