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

  // D4: 홈의 모바일 메뉴는 shared/drawer.js(햄버거 드로어)로 이전했다. 그 동작은 tests/drawer-js.test.js 가 검증한다.
  it('모바일 메뉴 코드가 script.js 에서 사라졌다(drawer.js 로 이전)', () => {
    expect(SOURCE).not.toMatch(/mobileMenu|MobileMenu|mobile-menu|trapFocus|releaseFocus|closestIfPossible/);
  });

  it('#mobileMenu·#mobileMenuBtn 이 있어도 script.js 는 아무것도 바인딩하지 않는다(열리지 않고 포커스도 옮기지 않음)', () => {
    const { context, document, window, elements } = createEnvironment();
    const mobileMenu = createElement(document, { attributes: { 'aria-hidden': 'true' } });
    const mobileMenuBtn = createElement(document, {
      attributes: { 'aria-expanded': 'false', 'aria-label': '메뉴 열기' },
    });
    elements.mobileMenu = mobileMenu;
    elements.mobileMenuBtn = mobileMenuBtn;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    mobileMenuBtn.dispatch('click');
    document.dispatch('keydown', { key: 'Escape' });
    window.innerWidth = 1200;
    window.dispatch('resize');

    expect(mobileMenu.classList.contains('open')).toBe(false);
    expect(mobileMenu.getAttribute('aria-hidden')).toBe('true');
    expect(mobileMenuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(mobileMenuBtn.focus).not.toHaveBeenCalled();
    expect(document.body.style.overflow || '').toBe('');
  });

  it('script.js 는 document 의 keydown·window 의 resize 를 듣지 않는다(드로어 처리는 drawer.js 몫)', () => {
    const { context, document, window } = createEnvironment();
    const docAdd = vi.spyOn(document, 'addEventListener');
    const winAdd = vi.spyOn(window, 'addEventListener');
    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');
    expect(docAdd.mock.calls.map((c) => c[0])).not.toContain('keydown');
    expect(winAdd.mock.calls.map((c) => c[0])).not.toContain('resize');
  });

  it('drawer-link mobile-menu-link 클래스를 가진 링크도 같은 페이지 앵커이면 평소처럼 스크롤한다(제외 분기 삭제)', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const section = createElement(document, { rect: { top: 420 } });
    const link = createElement(document, {
      classes: ['drawer-link', 'mobile-menu-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    elements['case-studies'] = section;
    anchorLinks.push(link);
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    link.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 394, behavior: 'smooth' });
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

  it('focuses the skip-nav target without calling scrollTo when window.scrollTo is not a function', () => {
    const { context, document, elements, anchorLinks } = createEnvironment();
    const content = createElement(document, { rect: { top: 420 } });
    const skipLink = createElement(document, {
      classes: ['skip-nav'],
      attributes: { href: '#content' },
    });
    elements.content = content;
    anchorLinks.push(skipLink);
    context.window.scrollTo = undefined;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    skipLink.dispatch('click', { preventDefault: vi.fn() });

    expect(content.getAttribute('tabindex')).toBe('-1');
    expect(content.focus).toHaveBeenCalled();
  });

  it('focuses the skip-nav target without scrolling when the target has no getBoundingClientRect method', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const content = createElement(document, { rect: { top: 420 } });
    const skipLink = createElement(document, {
      classes: ['skip-nav'],
      attributes: { href: '#content' },
    });
    elements.content = content;
    anchorLinks.push(skipLink);

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    delete content.getBoundingClientRect;
    skipLink.dispatch('click', { preventDefault: vi.fn() });

    expect(content.focus).toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('sets tabindex and scrolls without throwing when the skip-nav target has no focus method', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const content = createElement(document, { rect: { top: 420 } });
    const skipLink = createElement(document, {
      classes: ['skip-nav'],
      attributes: { href: '#content' },
    });
    elements.content = content;
    anchorLinks.push(skipLink);
    window.scrollY = 60;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    content.focus = undefined;
    expect(() => skipLink.dispatch('click', { preventDefault: vi.fn() })).not.toThrow();

    expect(content.getAttribute('tabindex')).toBe('-1');
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

  it('does not scroll when a same-page anchor link target id is absent from the DOM', () => {
    const { context, document, window, anchorLinks } = createEnvironment();
    const link = createElement(document, {
      attributes: { href: '#nonexistent-anchor-target' },
    });
    anchorLinks.push(link);
    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    link.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not set tabindex on a skip-nav anchor target that already has a tabindex attribute', () => {
    const { context, document, elements, anchorLinks } = createEnvironment();
    const target = createElement(document, {
      attributes: { tabindex: '0' },
      rect: { top: 100 },
    });
    const link = createElement(document, {
      classes: ['skip-nav'],
      attributes: { href: '#pre-tabbed-target' },
    });
    elements['pre-tabbed-target'] = target;
    anchorLinks.push(link);

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    link.dispatch('click', { preventDefault: vi.fn() });

    expect(target.getAttribute('tabindex')).toBe('0');
    expect(target.focus).toHaveBeenCalled();
  });

  it('does not throw and still clears the input when clearButton is clicked and input.focus is not a function', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    const clearButton = createElement(document, { hidden: true, attributes: { hidden: '' } });
    const status = createElement(document);
    const emptyState = createElement(document, { hidden: true, attributes: { hidden: '' } });

    const card = createElement(document, {
      attributes: { 'data-filter-group': 'learn', 'data-filter-keywords': '원칙' },
    });
    const chips = [
      createElement(document, { textContent: '전체', attributes: { 'data-section-filter': 'all', 'aria-pressed': 'true' } }),
    ];

    elements.sectionSearchInput = searchInput;
    elements.sectionSearchClear = clearButton;
    elements.sectionFilterStatus = status;
    elements.sectionEditorialEmpty = emptyState;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [card];
    querySelectorAllMap['.section-filter-chip'] = chips;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    // Remove focus so typeof input.focus !== 'function' → false branch of the guard
    searchInput.focus = undefined;

    searchInput.value = '원칙';
    searchInput.dispatch('input');
    expect(clearButton.hidden).toBe(false);

    expect(() => clearButton.dispatch('click')).not.toThrow();
    expect(searchInput.value).toBe('');
    expect(clearButton.hidden).toBe(true);
  });

  it('does not throw and still resets filters when resetButton is clicked and input.focus is not a function', () => {
    const { context, document, elements, querySelectorAllMap } = createEnvironment();
    const searchInput = createElement(document, { attributes: { type: 'search' } });
    const clearButton = createElement(document, { hidden: true, attributes: { hidden: '' } });
    const resetButton = createElement(document);
    const status = createElement(document);
    const emptyState = createElement(document, { hidden: true, attributes: { hidden: '' } });

    const card = createElement(document, {
      attributes: { 'data-filter-group': 'learn', 'data-filter-keywords': '원칙' },
    });
    const chips = [
      createElement(document, { textContent: '전체', attributes: { 'data-section-filter': 'all', 'aria-pressed': 'true' } }),
    ];

    elements.sectionSearchInput = searchInput;
    elements.sectionSearchClear = clearButton;
    elements.sectionFilterReset = resetButton;
    elements.sectionFilterStatus = status;
    elements.sectionEditorialEmpty = emptyState;
    querySelectorAllMap['.editorial-item[data-filter-keywords]'] = [card];
    querySelectorAllMap['.section-filter-chip'] = chips;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    // Remove focus so typeof input.focus !== 'function' → false branch of the guard
    searchInput.focus = undefined;

    searchInput.value = '원칙';
    searchInput.dispatch('input');

    expect(() => resetButton.dispatch('click')).not.toThrow();
    expect(searchInput.value).toBe('');
  });

  it('does not intercept anchor click when window.location is null even though URL is available', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const target = createElement(document, { rect: { top: 300 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#hero' },
    });
    elements['hero'] = target;
    anchorLinks.push(gnbLink);
    context.window.location = null;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not intercept anchor click when window.location.href is absent even though URL is available', () => {
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const target = createElement(document, { rect: { top: 300 } });
    const gnbLink = createElement(document, {
      attributes: { href: '/krds-ux-writing/#hero' },
    });
    elements['hero'] = target;
    anchorLinks.push(gnbLink);
    context.window.location = { pathname: '/krds-ux-writing/' };

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    gnbLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing when Escape is pressed in the section search input while the value is already empty', () => {
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

    // input is empty → `if (e.key === 'Escape' && input.value)` is false → no-op
    searchInput.dispatch('keydown', { key: 'Escape' });

    expect(searchInput.value).toBe('');
    expect(item.hidden).toBe(false);
  });

  it('treats bare /index.html pathname as the site root when resolving same-page anchors (normalizePathname empty-after-strip branch)', () => {
    // normalizePathname('/index.html') → length>1, no trailing slash → replace '/index.html' → '' → return '' || '/' → '/'
    // Both target and current normalize to '/', so the anchor is treated as same-page.
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const hero = createElement(document, { rect: { top: 300 } });
    const link = createElement(document, {
      attributes: { href: '/index.html#hero' },
    });
    elements.hero = hero;
    anchorLinks.push(link);
    window.location.href = 'https://example.com/index.html';
    window.location.pathname = '/index.html';
    window.scrollY = 0;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    link.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 214, behavior: 'smooth' });
  });

  it('treats a double-slash pathname as the root when resolving same-page anchors (normalizePathname all-slashes-stripped branch)', () => {
    // normalizePathname('//') → length>1, replace trailing slashes: '' → '' || '/' → '/'
    // Both target and current pathname '//' normalize to '/', same page is detected.
    const { context, document, window, elements, anchorLinks } = createEnvironment();
    const section = createElement(document, { rect: { top: 200 } });
    const link = createElement(document, {
      attributes: { href: 'https://example.com//#section' },
    });
    elements.section = section;
    anchorLinks.push(link);
    window.location.href = 'https://example.com//';
    window.location.pathname = '//';
    window.scrollY = 0;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('DOMContentLoaded');

    const preventDefault = vi.fn();
    link.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 114, behavior: 'smooth' });
  });

  it('returns early from initSectionExplorer without throwing when input and status exist but there are no editorial items (!items.length branch)', () => {
    const { context, document, elements } = createEnvironment();
    const searchInput = createElement(document);
    const status = createElement(document);
    elements.sectionSearchInput = searchInput;
    elements.sectionFilterStatus = status;
    // querySelectorAllMap has no entry for '.editorial-item[data-filter-keywords]',
    // so items = [] → !items.length → early return before any filter logic runs

    vm.runInNewContext(SOURCE, context);
    expect(() => document.dispatch('DOMContentLoaded')).not.toThrow();
    // status.textContent remains unset (no "N개 섹션" message rendered)
    expect(status.textContent).toBe('');
  });

});
