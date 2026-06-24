import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const BASE_PATH_SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/base-path.js'), 'utf8');
const SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/nav.js'), 'utf8');

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
  };
}

function createNavLink(section) {
  const attributes = new Map([
    ['data-section', section],
  ]);

  return {
    classList: createClassList(),
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
  };
}

function makeContext(options = {}) {
  const listeners = new Map();
  const searchInput = options.searchInput || null;
  const searchBtn = options.searchBtn || null;
  const hrefNodes = [];
  const srcNodes = [];
  const navLinks = options.navLinks || [];
  const currentScript = {
    src: options.basePathScriptSrc || 'https://example.com/shared/base-path.js',
    getAttribute(name) {
      return name === 'src' ? this.src : null;
    },
  };

  const document = {
    documentElement: {
      setAttribute() {},
      getAttribute() { return 'light'; },
    },
    body: { style: {} },
    activeElement: null,
    currentScript,
    querySelectorAll(selector) {
      if (selector === '[href]') return hrefNodes;
      if (selector === '[src]') return srcNodes;
      if (selector === '.gnb-nav-link[data-section]') return navLinks;
      return [];
    },
    querySelector() { return null; },
    getElementsByTagName() { return [currentScript]; },
    getElementById(id) {
      if (id === 'gnbSearch') return searchBtn;
      if (id === 'searchInput') return searchInput;
      return null;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
  };

  const window = {
    location: {
      pathname: options.pathname || '/krds-ux-writing/',
      href: options.href || 'https://example.com/krds-ux-writing/',
    },
  };

  const context = {
    window,
    document,
    localStorage: { setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    IntersectionObserver: function () {
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
    Array,
    JSON,
    URL,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  if (options.withBasePath !== false) {
    vm.runInNewContext(BASE_PATH_SOURCE, context);
  }
  vm.runInNewContext(SOURCE, context);

  return {
    window,
    dispatchKeydown(event) {
      const handlers = listeners.get('keydown') || [];
      handlers.forEach((handler) => handler(event));
    },
  };
}

describe('shared nav section resolution', () => {
  it('marks only the current top-level section active on nested section pages', () => {
    const principlesLink = createNavLink('principles');
    const dictionaryLink = createNavLink('dictionary');
    const caseStudiesLink = createNavLink('case-studies');
    const promptLibraryLink = createNavLink('prompt-library');

    makeContext({
      pathname: '/krds-ux-writing/principles/foundation/',
      navLinks: [principlesLink, dictionaryLink, caseStudiesLink, promptLibraryLink],
    });

    expect(principlesLink.classList.contains('active')).toBe(true);
    expect(dictionaryLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(false);
    expect(promptLibraryLink.classList.contains('active')).toBe(false);
  });

  it('does not treat lookalike top-level file names as real section pages', () => {
    const principlesLink = createNavLink('principles');
    const dictionaryLink = createNavLink('dictionary');
    const caseStudiesLink = createNavLink('case-studies');
    const promptLibraryLink = createNavLink('prompt-library');
    const preventDefault = vi.fn();
    const ctx = makeContext({
      pathname: '/krds-ux-writing/principles-checker.html',
      href: 'https://example.com/krds-ux-writing/principles-checker.html',
      navLinks: [principlesLink, dictionaryLink, caseStudiesLink, promptLibraryLink],
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(dictionaryLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(false);
    expect(promptLibraryLink.classList.contains('active')).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('https://example.com/krds-ux-writing/principles-checker.html');
  });
});

describe('shared nav Ctrl+K behavior', () => {
  it('focuses the page search input instead of redirecting on searchable pages', () => {
    const focus = vi.fn();
    const select = vi.fn();
    const preventDefault = vi.fn();

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      href: 'https://example.com/krds-ux-writing/dictionary/',
      searchInput: { focus, select },
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(select).toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('https://example.com/krds-ux-writing/dictionary/');
  });

  it('redirects principles pages to the main page when no search UI exists', () => {
    const preventDefault = vi.fn();
    const ctx = makeContext({
      pathname: '/krds-ux-writing/principles/foundation/',
      href: 'https://example.com/krds-ux-writing/principles/foundation/',
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('/');
  });

  it('does not hijack Ctrl+K on pages without search or redirect behavior', () => {
    const preventDefault = vi.fn();
    const ctx = makeContext({
      pathname: '/krds-ux-writing/prompt-library.html',
      href: 'https://example.com/krds-ux-writing/prompt-library.html',
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('https://example.com/krds-ux-writing/prompt-library.html');
  });

  it('does not hijack Ctrl+K while typing in a text field', () => {
    const focus = vi.fn();
    const select = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { tagName: 'INPUT', focus, select };
    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      href: 'https://example.com/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({
      ctrlKey: true,
      metaKey: false,
      key: 'k',
      preventDefault,
      target: searchInput,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('https://example.com/krds-ux-writing/dictionary/');
  });

  it('redirects principles pages to the local site root when the preview runs under a custom subpath', () => {
    const preventDefault = vi.fn();
    const ctx = makeContext({
      pathname: '/preview/KRDS/principles/foundation/',
      href: 'https://example.com/preview/KRDS/principles/foundation/',
      basePathScriptSrc: 'https://example.com/preview/KRDS/shared/base-path.js',
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(ctx.window.location.href).toBe('/preview/KRDS/');
  });

  it('clicks the GNB search button when gnbSearch exists instead of focusing the page search input', () => {
    const click = vi.fn();
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchBtn = { click };
    const searchInput = { focus, select: vi.fn() };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/',
      href: 'https://example.com/krds-ux-writing/',
      searchBtn,
      searchInput,
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('treats a TEXTAREA target as a text-entry field and does not hijack Ctrl+K', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { focus, select: vi.fn() };
    const textareaTarget = { tagName: 'TEXTAREA' };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({
      ctrlKey: true, metaKey: false, key: 'k', preventDefault, target: textareaTarget,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('treats a contenteditable element with no tagName as a text-entry target and skips Ctrl+K', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { focus, select: vi.fn() };
    const editableTarget = { isContentEditable: true };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({
      ctrlKey: true, metaKey: false, key: 'k', preventDefault, target: editableTarget,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses the page search input when it does not expose a select method', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { focus };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({ ctrlKey: true, metaKey: false, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('treats a SELECT target as a text-entry field and does not hijack Ctrl+K', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { focus, select: vi.fn() };
    const selectTarget = { tagName: 'SELECT' };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({
      ctrlKey: true, metaKey: false, key: 'k', preventDefault, target: selectTarget,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('treats a contenteditable element with a tagName as a text-entry target and skips Ctrl+K', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const searchInput = { focus, select: vi.fn() };
    const editableDiv = { tagName: 'DIV', isContentEditable: true };

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      searchInput,
    });

    ctx.dispatchKeydown({
      ctrlKey: true, metaKey: false, key: 'k', preventDefault, target: editableDiv,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses the page search input when Command+K is pressed on Mac (metaKey branch)', () => {
    const focus = vi.fn();
    const select = vi.fn();
    const preventDefault = vi.fn();

    const ctx = makeContext({
      pathname: '/krds-ux-writing/dictionary/',
      href: 'https://example.com/krds-ux-writing/dictionary/',
      searchInput: { focus, select },
    });

    ctx.dispatchKeydown({ ctrlKey: false, metaKey: true, key: 'k', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(select).toHaveBeenCalled();
  });
});
