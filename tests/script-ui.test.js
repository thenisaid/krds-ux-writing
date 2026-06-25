import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'script.js'), 'utf8');
const DARK_ICON = 'M13.5 10A6 6 0 0 1 6 2.5a6.002 6.002 0 1 0 7.5 7.5z';
const LIGHT_ICON = 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z';

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

function createElement(documentRef, options = {}) {
  const listeners = new Map();
  const attributes = new Map(Object.entries(options.attributes || {}));
  const queryMap = options.queryMap || {};
  const element = {
    hidden: !!options.hidden,
    classList: createClassList(options.classes || []),
    style: options.style || {},
    dataset: options.dataset || {},
    textContent: options.textContent || '',
    innerHTML: options.innerHTML || '',
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    removeEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((item) => item !== handler));
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((handler) => handler.call(element, {
        preventDefault() {},
        stopPropagation() {},
        currentTarget: element,
        target: element,
        ...event,
      }));
    },
    setAttribute(name, value) {
      if (name === 'hidden') element.hidden = true;
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      if (name === 'hidden') element.hidden = false;
      attributes.delete(name);
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
    closest(selector) {
      if (!options.closestSelectors) return null;
      return options.closestSelectors.includes(selector) ? element : null;
    },
    focus: vi.fn(() => {
      documentRef.activeElement = element;
    }),
    getBoundingClientRect() {
      return options.rect || { top: 0 };
    },
  };
  return element;
}

function createEnvironment() {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const elements = {};
  const anchorLinks = [];
  const querySelectorAllMap = {};

  const document = {
    body: {
      style: {},
    },
    documentElement: {
      theme: 'light',
      setAttribute(name, value) {
        if (name === 'data-theme') this.theme = String(value);
      },
      getAttribute(name) {
        return name === 'data-theme' ? this.theme : null;
      },
    },
    activeElement: null,
    addEventListener(type, handler) {
      const arr = documentListeners.get(type) || [];
      arr.push(handler);
      documentListeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const handlers = documentListeners.get(type) || [];
      handlers.forEach((handler) => handler({
        preventDefault() {},
        stopPropagation() {},
        target: null,
        currentTarget: null,
        ...event,
      }));
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === 'a[href]' || selector === 'a[href^="#"]') return anchorLinks;
      if (querySelectorAllMap[selector]) return querySelectorAllMap[selector];
      return [];
    },
  };

  const window = {
    scrollY: 0,
    innerWidth: 1280,
    innerHeight: 720,
    location: {
      href: 'https://example.com/krds-ux-writing/',
      pathname: '/krds-ux-writing/',
    },
    matchMedia() {
      return { matches: false };
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
    scrollTo: vi.fn(),
  };

  const context = {
    document,
    window,
    URL,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    console,
    Array,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, document, window, elements, anchorLinks, querySelectorAllMap };
}

describe('script.js live index interactions', () => {
  it('does not throw when optional page chrome is missing', () => {
    const { context, document } = createEnvironment();

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
    expect(() => document.dispatch('DOMContentLoaded')).not.toThrow();
  });

  it('syncs the stored theme on load and toggles it on click', () => {
    const { context, document, elements } = createEnvironment();
    const stored = new Map([['krds-theme', 'dark']]);
    context.localStorage = {
      getItem(key) {
        return stored.has(key) ? stored.get(key) : null;
      },
      setItem(key, value) {
        stored.set(key, String(value));
      },
    };
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: LIGHT_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(elements.themeIcon.getAttribute('d')).toBe(DARK_ICON);
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('라이트모드로 전환');

    elements.themeToggle.dispatch('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeIcon.getAttribute('d')).toBe(LIGHT_ICON);
    expect(stored.get('krds-theme')).toBe('light');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('다크모드로 전환');
  });

  it('normalizes unexpected stored theme values back to light on load', () => {
    const { context, document, elements } = createEnvironment();
    context.localStorage = {
      getItem() {
        return 'solarized';
      },
      setItem() {},
    };
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: DARK_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeIcon.getAttribute('d')).toBe(LIGHT_ICON);
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('다크모드로 전환');
  });

  it('applies dark theme on init when no theme is stored and the system prefers dark', () => {
    const { context, document, elements } = createEnvironment();
    context.localStorage = { getItem() { return null; }, setItem() {} };
    context.window.matchMedia = () => ({ matches: true });
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: LIGHT_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('라이트모드로 전환');
  });

  it('applies light theme on init when matchMedia is unavailable and no theme is stored', () => {
    const { context, document, elements } = createEnvironment();
    context.localStorage = { getItem() { return null; }, setItem() {} };
    context.window.matchMedia = undefined;
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: DARK_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('다크모드로 전환');
  });

  it('opens and closes the mobile menu with focus and body scroll state updates', () => {
    const { context, document, elements } = createEnvironment();
    const firstLink = createElement(document);
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');

    expect(mobileMenu.classList.contains('open')).toBe(true);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('false');
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-label')).toBe('메뉴 닫기');
    expect(document.body.style.overflow).toBe('hidden');
    expect(firstLink.focus).toHaveBeenCalled();

    document.dispatch('keydown', { key: 'Escape' });

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(mobileMenuBtn.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(document.body.style.overflow).toBe('');
    expect(mobileMenuBtn.focus).toHaveBeenCalled();
  });

  it('does not move focus when Escape is pressed while the mobile menu is already closed', () => {
    const { context, document, elements } = createEnvironment();
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    document.dispatch('keydown', { key: 'Escape' });

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
    expect(document.body.style.overflow || '').toBe('');
  });

  it('closes the mobile menu when the viewport grows past the mobile breakpoint', () => {
    const { context, document, window, elements } = createEnvironment();
    const firstLink = createElement(document);
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');

    expect(mobileMenu.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    window.innerWidth = 1200;
    window.dispatch('resize');

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
  });

  it('ignores non-element mobile menu click targets without throwing', () => {
    const { context, document, elements } = createEnvironment();
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(() => {
      mobileMenu.dispatch('click', { target: { nodeType: 3 } });
    }).not.toThrow();
    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
  });

  it('focuses the skip target instead of only scrolling past it', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const content = createElement(document, { rect: { top: 240 } });
    const skipLink = createElement(document, {
      classes: ['skip-nav'],
      attributes: { href: '#content' },
    });
    elements.content = content;
    anchorLinks.push(skipLink);
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    skipLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(content.getAttribute('tabindex')).toBe('-1');
    expect(content.focus).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' });
  });

  it('smoothly scrolls absolute same-page anchors with the header offset', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = caseStudies;
    anchorLinks.push(gnbLink);
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 394, behavior: 'smooth' });
  });

  it('treats trailing-slash variants of the site root as the same page for anchor scrolling', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = caseStudies;
    anchorLinks.push(gnbLink);
    window.location.href = 'https://example.com/krds-ux-writing';
    window.location.pathname = '/krds-ux-writing';
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 394, behavior: 'smooth' });
  });

  it('treats explicit index.html root URLs as the same page for anchor scrolling', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = caseStudies;
    anchorLinks.push(gnbLink);
    window.location.href = 'https://example.com/krds-ux-writing/index.html';
    window.location.pathname = '/krds-ux-writing/index.html';
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 394, behavior: 'smooth' });
  });

  it('does not scroll or focus when the anchor href is a bare hash "#"', () => {
    const { context, document, window, anchorLinks } = createEnvironment();
    const bareHashLink = createElement(document, { attributes: { href: '#' } });
    anchorLinks.push(bareHashLink);

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    bareHashLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll or focus when the URL constructor is not available for an absolute anchor href', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = createElement(document, { rect: { top: 300 } });
    anchorLinks.push(gnbLink);
    context.URL = undefined;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll or focus when the URL constructor throws for an anchor href', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = createElement(document, { rect: { top: 300 } });
    anchorLinks.push(gnbLink);
    context.URL = function () { throw new TypeError('Invalid URL'); };

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not intercept anchor links that change the current query string', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/archive.html?agency=jeongbu24#case-studies' },
    });
    elements['case-studies'] = caseStudies;
    anchorLinks.push(gnbLink);
    window.location.href = 'https://example.com/krds-ux-writing/archive.html?agency=hometax';
    window.location.pathname = '/krds-ux-writing/archive.html';

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(caseStudies.focus).not.toHaveBeenCalled();
  });

  it('does not intercept cross-origin anchor links even when they contain a hash', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const section = createElement(document, { rect: { top: 300 } });
    const externalLink = createElement(document, {
      attributes: { href: 'https://external.example.com/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = section;
    anchorLinks.push(externalLink);
    window.location.href = 'https://example.com/krds-ux-writing/';
    window.location.pathname = '/krds-ux-writing/';

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    externalLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not intercept absolute anchor links that point to a different page path', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const section = createElement(document, { rect: { top: 300 } });
    const crossPageLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/other-page/#case-studies' },
    });
    elements['case-studies'] = section;
    anchorLinks.push(crossPageLink);
    window.location.href = 'https://example.com/krds-ux-writing/';
    window.location.pathname = '/krds-ux-writing/';

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    crossPageLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not intercept absolute anchor links that have no hash fragment', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const section = createElement(document, { rect: { top: 300 } });
    const noHashLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/' },
    });
    elements['case-studies'] = section;
    anchorLinks.push(noHashLink);
    window.location.href = 'https://example.com/krds-ux-writing/';
    window.location.pathname = '/krds-ux-writing/';

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    noHashLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('moves focus to same-page mobile menu targets instead of restoring focus to the opener only', () => {
    const { context, document, window, elements } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const samePageLink = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [samePageLink],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;
    elements['case-studies'] = caseStudies;
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');

    const preventDefault = vi.fn();
    mobileMenu.dispatch('click', { target: samePageLink, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
    expect(caseStudies.getAttribute('tabindex')).toBe('-1');
    expect(caseStudies.focus).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 480, behavior: 'auto' });
  });

  it('treats explicit index.html root URLs as same-page mobile menu targets', () => {
    const { context, document, window, elements } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const samePageLink = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: {
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [samePageLink],
      },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;
    elements['case-studies'] = caseStudies;
    window.location.href = 'https://example.com/krds-ux-writing/index.html';
    window.location.pathname = '/krds-ux-writing/index.html';
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');

    const preventDefault = vi.fn();
    mobileMenu.dispatch('click', { target: samePageLink, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
    expect(caseStudies.getAttribute('tabindex')).toBe('-1');
    expect(caseStudies.focus).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 480, behavior: 'auto' });
  });

  it('filters the section explorer cards by inline search query and restores them with the clear button', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    const clearButton = createElement(document, { hidden: true, attributes: { hidden: '' } });
    const resetButton = createElement(document);
    const status = createElement(document);
    const emptyState = createElement(document, { hidden: true, attributes: { hidden: '' } });

    const principles = createElement(document, {
      attributes: {
        'data-filter-group': 'learn',
        'data-filter-keywords': '원칙 파운데이션 심리적안전망',
      },
    });
    const dictionary = createElement(document, {
      attributes: {
        'data-filter-group': 'terms',
        'data-filter-keywords': '사전 dictionary 행정용어 대체 표현',
      },
    });
    const cases = createElement(document, {
      attributes: {
        'data-filter-group': 'examples',
        'data-filter-keywords': '사례 연구 실전 적용',
      },
    });
    const prompts = createElement(document, {
      attributes: {
        'data-filter-group': 'ai',
        'data-filter-keywords': '프롬프트 prompt library ai',
      },
    });

    const chips = [
      createElement(document, { textContent: '전체', attributes: { 'data-section-filter': 'all', 'aria-pressed': 'true' } }),
      createElement(document, { textContent: '원칙부터', attributes: { 'data-section-filter': 'learn', 'aria-pressed': 'false' } }),
      createElement(document, { textContent: '용어 찾기', attributes: { 'data-section-filter': 'terms', 'aria-pressed': 'false' } }),
      createElement(document, { textContent: '실전 사례', attributes: { 'data-section-filter': 'examples', 'aria-pressed': 'false' } }),
      createElement(document, { textContent: 'AI 프롬프트', attributes: { 'data-section-filter': 'ai', 'aria-pressed': 'false' } }),
    ];

    elements.sectionSearchInput = searchInput;
    elements.sectionSearchClear = clearButton;
    elements.sectionFilterReset = resetButton;
    elements.sectionFilterStatus = status;
    elements.sectionEditorialEmpty = emptyState;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [principles, dictionary, cases, prompts];
    querySelectorAllMap['.section-filter-chip'] = chips;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(status.textContent).toBe('4개 섹션이 준비되어 있어요.');

    searchInput.value = '프롬프트';
    searchInput.dispatch('input');

    expect(principles.hidden).toBe(true);
    expect(dictionary.hidden).toBe(true);
    expect(cases.hidden).toBe(true);
    expect(prompts.hidden).toBe(false);
    expect(clearButton.hidden).toBe(false);
    expect(emptyState.hidden).toBe(true);
    expect(status.textContent).toBe('"프롬프트" 기준으로 1개 섹션이 보여요.');

    clearButton.dispatch('click');

    expect(searchInput.value).toBe('');
    expect(principles.hidden).toBe(false);
    expect(dictionary.hidden).toBe(false);
    expect(cases.hidden).toBe(false);
    expect(prompts.hidden).toBe(false);
    expect(clearButton.hidden).toBe(true);
    expect(status.textContent).toBe('4개 섹션이 준비되어 있어요.');
    expect(searchInput.focus).toHaveBeenCalled();
  });

  it('shows the empty state when a chip and query leave no section matches, then resets to all sections', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    const clearButton = createElement(document, { hidden: true, attributes: { hidden: '' } });
    const resetButton = createElement(document);
    const status = createElement(document);
    const emptyState = createElement(document, { hidden: true, attributes: { hidden: '' } });

    const principles = createElement(document, {
      attributes: {
        'data-filter-group': 'learn',
        'data-filter-keywords': '원칙 파운데이션 심리적안전망',
      },
    });
    const dictionary = createElement(document, {
      attributes: {
        'data-filter-group': 'terms',
        'data-filter-keywords': '사전 dictionary 행정용어 대체 표현',
      },
    });

    const chips = [
      createElement(document, { textContent: '전체', attributes: { 'data-section-filter': 'all', 'aria-pressed': 'true' } }),
      createElement(document, { textContent: '용어 찾기', attributes: { 'data-section-filter': 'terms', 'aria-pressed': 'false' } }),
    ];

    elements.sectionSearchInput = searchInput;
    elements.sectionSearchClear = clearButton;
    elements.sectionFilterReset = resetButton;
    elements.sectionFilterStatus = status;
    elements.sectionEditorialEmpty = emptyState;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [principles, dictionary];
    querySelectorAllMap['.section-filter-chip'] = chips;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    chips[1].dispatch('click');

    expect(principles.hidden).toBe(true);
    expect(dictionary.hidden).toBe(false);
    expect(status.textContent).toBe('용어 찾기 기준으로 1개 섹션이 보여요.');

    searchInput.value = '없는 검색어';
    searchInput.dispatch('input');

    expect(principles.hidden).toBe(true);
    expect(dictionary.hidden).toBe(true);
    expect(emptyState.hidden).toBe(false);
    expect(status.textContent).toBe('일치하는 섹션이 없어요. 검색어를 바꾸거나 전체 섹션을 다시 열어 보세요.');

    resetButton.dispatch('click');

    expect(searchInput.value).toBe('');
    expect(principles.hidden).toBe(false);
    expect(dictionary.hidden).toBe(false);
    expect(emptyState.hidden).toBe(true);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    expect(chips[1].getAttribute('aria-pressed')).toBe('false');
    expect(status.textContent).toBe('2개 섹션이 준비되어 있어요.');
  });

  it('shows combined chip label and query in the status when both a chip and a search term narrow results', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    const clearButton = createElement(document, { hidden: true, attributes: { hidden: '' } });
    const status = createElement(document);
    const emptyState = createElement(document, { hidden: true, attributes: { hidden: '' } });

    const principles = createElement(document, {
      attributes: {
        'data-filter-group': 'learn',
        'data-filter-keywords': '원칙 파운데이션',
      },
    });
    const dictionary = createElement(document, {
      attributes: {
        'data-filter-group': 'terms',
        'data-filter-keywords': '사전 dictionary 행정용어',
      },
    });

    const chips = [
      createElement(document, { textContent: '전체', attributes: { 'data-section-filter': 'all', 'aria-pressed': 'true' } }),
      createElement(document, { textContent: '용어 찾기', attributes: { 'data-section-filter': 'terms', 'aria-pressed': 'false' } }),
    ];

    elements.sectionSearchInput = searchInput;
    elements.sectionSearchClear = clearButton;
    elements.sectionFilterStatus = status;
    elements.sectionEditorialEmpty = emptyState;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [principles, dictionary];
    querySelectorAllMap['.section-filter-chip'] = chips;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    chips[1].dispatch('click');
    searchInput.value = '사전';
    searchInput.dispatch('input');

    expect(principles.hidden).toBe(true);
    expect(dictionary.hidden).toBe(false);
    expect(status.textContent).toBe('"사전" · 용어 찾기 기준으로 1개 섹션이 보여요.');
  });

  it('falls back to light theme when localStorage.getItem throws a security error', () => {
    const { context, document, elements } = createEnvironment();
    context.localStorage = {
      getItem() { throw new Error('security'); },
      setItem() {},
    };
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: DARK_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeIcon.getAttribute('d')).toBe(LIGHT_ICON);
  });

  it('applies the theme toggle even when localStorage.setItem throws a security error', () => {
    const { context, document, elements } = createEnvironment();
    context.localStorage = {
      getItem() { return null; },
      setItem() { throw new Error('security'); },
    };
    elements.themeToggle = createElement(document);
    elements.themeIcon = createElement(document, { attributes: { d: LIGHT_ICON } });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    elements.themeToggle.dispatch('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(elements.themeIcon.getAttribute('d')).toBe(DARK_ICON);
  });

  it('adds and removes the scrolled class on the GNB as the page scrolls past and back below 10 pixels', () => {
    const { context, document, window, elements } = createEnvironment();
    elements.gnb = createElement(document);

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    window.scrollY = 20;
    window.dispatch('scroll');
    expect(elements.gnb.classList.contains('scrolled')).toBe(true);

    window.scrollY = 5;
    window.dispatch('scroll');
    expect(elements.gnb.classList.contains('scrolled')).toBe(false);
  });

  it('wraps focus forward to the first menu element when Tab is pressed on the last focusable element', () => {
    const { context, document, elements } = createEnvironment();
    const firstLink = createElement(document, { attributes: { href: '#first' } });
    const lastLink = createElement(document, { attributes: { href: '#last' } });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink, lastLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    mobileMenuBtn.dispatch('click');

    document.activeElement = lastLink;
    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(firstLink.focus).toHaveBeenCalled();
  });

  it('wraps focus backward to the last menu element when Shift+Tab is pressed on the first focusable element', () => {
    const { context, document, elements } = createEnvironment();
    const firstLink = createElement(document, { attributes: { href: '#first' } });
    const lastLink = createElement(document, { attributes: { href: '#last' } });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink, lastLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    mobileMenuBtn.dispatch('click');

    document.activeElement = firstLink;
    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(lastLink.focus).toHaveBeenCalled();
  });

  it('does not intercept Tab when the focused element is not the last focusable element in the mobile menu', () => {
    const { context, document, elements } = createEnvironment();
    const firstLink = createElement(document, { attributes: { href: '#first' } });
    const lastLink = createElement(document, { attributes: { href: '#last' } });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink, lastLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    mobileMenuBtn.dispatch('click');

    document.activeElement = firstLink;
    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(lastLink.focus).not.toHaveBeenCalled();
  });

  it('does not intercept Shift+Tab when the focused element is not the first focusable element in the mobile menu', () => {
    const { context, document, elements } = createEnvironment();
    const firstLink = createElement(document, { attributes: { href: '#first' } });
    const lastLink = createElement(document, { attributes: { href: '#last' } });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [firstLink, lastLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    mobileMenuBtn.dispatch('click');

    document.activeElement = lastLink;
    const preventDefault = vi.fn();
    mobileMenu.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(lastLink.focus).not.toHaveBeenCalled();
  });

  it('opens the mobile menu without installing a focus trap when all candidate links are aria-hidden', () => {
    const { context, document, elements } = createEnvironment();
    const ariaHiddenLink = createElement(document, {
      attributes: { href: '#', 'aria-hidden': 'true' },
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [ariaHiddenLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    mobileMenuBtn.dispatch('click');

    expect(mobileMenu.classList.contains('open')).toBe(true);
    ariaHiddenLink.focus.mockClear();
    expect(() => mobileMenu.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault: vi.fn() })).not.toThrow();
    expect(ariaHiddenLink.focus).not.toHaveBeenCalled();
  });

  it('focuses the anchor target without calling scrollTo when window.scrollTo is not a function', () => {
    const { context, document, elements } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const samePageLink = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [samePageLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;
    elements['case-studies'] = caseStudies;
    context.window.scrollTo = undefined;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');
    mobileMenu.dispatch('click', { target: samePageLink, preventDefault: vi.fn() });

    expect(caseStudies.getAttribute('tabindex')).toBe('-1');
    expect(caseStudies.focus).toHaveBeenCalled();
  });

  it('focuses the anchor target without scrolling when the target has no getBoundingClientRect method', () => {
    const { context, document, window, elements } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const samePageLink = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [samePageLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;
    elements['case-studies'] = caseStudies;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    delete caseStudies.getBoundingClientRect;
    mobileMenuBtn.dispatch('click');
    mobileMenu.dispatch('click', { target: samePageLink, preventDefault: vi.fn() });

    expect(caseStudies.focus).toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('sets tabindex and scrolls without throwing when the anchor target has no focus method', () => {
    const { context, document, window, elements } = createEnvironment();
    const caseStudies = createElement(document, { rect: { top: 420 } });
    const samePageLink = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [samePageLink] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;
    elements['case-studies'] = caseStudies;
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    caseStudies.focus = undefined;
    mobileMenuBtn.dispatch('click');
    expect(() => mobileMenu.dispatch('click', { target: samePageLink, preventDefault: vi.fn() })).not.toThrow();

    expect(caseStudies.getAttribute('tabindex')).toBe('-1');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 480, behavior: 'auto' });
  });

  it('clears the search input and reapplies filters when Escape is pressed while the input has a value', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    searchInput.value = '';
    const status = createElement(document);
    const item = createElement(document, {
      attributes: { 'data-filter-keywords': '원칙 파운데이션' },
    });

    elements.sectionSearchInput = searchInput;
    elements.sectionFilterStatus = status;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [item];
    querySelectorAllMap['.section-filter-chip'] = [];

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    searchInput.value = '원칙';
    searchInput.dispatch('input');
    expect(item.hidden).toBe(false);

    searchInput.value = '없는검색어';
    searchInput.dispatch('input');
    expect(item.hidden).toBe(true);

    searchInput.dispatch('keydown', { key: 'Escape' });

    expect(searchInput.value).toBe('');
    expect(item.hidden).toBe(false);
  });

  it('returns early from the anchor click handler when the link has the mobile-menu-link class', () => {
    const { context, document, elements, anchorLinks } = createEnvironment();
    const target = createElement(document, { rect: { top: 200 } });
    const link = createElement(document, {
      classes: ['mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#section' },
    });
    elements.section = target;
    anchorLinks.push(link);

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    link.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('calls closeMobileMenu when the mobile menu item href resolves to an id not found in the DOM', () => {
    const { context, document, elements } = createEnvironment();
    const menuItem = createElement(document, {
      classes: ['mobile-menu-item'],
      attributes: { href: '/krds-ux-writing/#ghost-section' },
      closestSelectors: ['.mobile-menu-item, .mobile-menu-link'],
    });
    const mobileMenu = createElement(document, {
      attributes: { 'aria-hidden': 'true' },
      queryMap: { 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])': [menuItem] },
    });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');
    expect(mobileMenu.classList.contains('open')).toBe(true);

    mobileMenu.dispatch('click', { target: menuItem, preventDefault: vi.fn() });

    expect(mobileMenu.classList.contains('open')).toBe(false);
  });
});
