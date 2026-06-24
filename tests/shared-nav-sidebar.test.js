import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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
  const element = {
    id: options.id || '',
    classList: createClassList(options.classes || []),
    style: options.style || {},
    offsetParent: options.offsetParent === undefined ? {} : options.offsetParent,
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
      handlers.forEach((handler) => handler.call(element, {
        preventDefault() {},
        stopPropagation() {},
        target: element,
        currentTarget: element,
        ...event,
      }));
    },
    setAttribute(name, value) {
      if (name === 'id') {
        element.id = String(value);
        return;
      }
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      if (name === 'id') return element.id || null;
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      if (name === 'id') {
        element.id = '';
        return;
      }
      attributes.delete(name);
    },
    hasAttribute(name) {
      return name === 'id' ? !!element.id : attributes.has(name);
    },
    querySelector(selector) {
      const value = options.queryMap ? options.queryMap[selector] : null;
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    },
    querySelectorAll(selector) {
      const queryValue = options.queryMap ? options.queryMap[selector] : null;
      if (Array.isArray(queryValue)) return queryValue;
      if (queryValue) return [queryValue];
      if (selector === '.sidebar-link') return options.sidebarLinks || [];
      if (selector.indexOf('a[href]') !== -1 && selector.indexOf('button:not([disabled])') !== -1) {
        return options.focusables || [];
      }
      return [];
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
    closest(selector) {
      if (options.closestMap && options.closestMap[selector]) return options.closestMap[selector];
      return null;
    },
    focus: vi.fn(),
    getBoundingClientRect() {
      return options.rect || { top: 0 };
    },
  };
  return element;
}

function makeContext(options = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const firstLink = createElement();
  const currentPath = options.currentPath || '/krds-ux-writing/principles/';
  const targetId = options.targetId || 'section-1';
  const sidebarTarget = createElement({
    id: targetId,
    rect: { top: options.targetTop === undefined ? 220 : options.targetTop },
  });
  const sidebarLink = createElement({
    attributes: {
      href: options.sidebarLinkHref || `#${targetId}`,
    },
  });
  const subLink = createElement({
    classes: ['lnb-sub-a'],
    attributes: {
      href: options.treeLinkHref || '',
    },
  });
  const sub = createElement({
    classes: ['lnb-sub'],
    queryMap: {
      '.lnb-sub-a': [subLink],
    },
  });
  const item = createElement({
    classes: ['lnb-item'],
    attributes: {
      'aria-expanded': 'false',
      'data-path': options.treeItemPath || '/principles/foundation/',
    },
    queryMap: {
      '.lnb-item-a, .lnb-sub-a': options.treeLinkHref ? [subLink] : [],
      '.lnb-sub': sub,
    },
  });
  subLink.closestMap = {
    '.lnb-item': item,
  };
  const tree = createElement({
    classes: ['lnb-tree'],
    queryMap: {
      '.lnb-item': options.treeLinkHref ? [item] : [],
      '.lnb-item-a, .lnb-tog, .lnb-sub-a': options.treeLinkHref ? [subLink] : [],
      '.lnb-sub-a': options.treeLinkHref ? [subLink] : [],
    },
  });
  const sidebar = createElement({
    focusables: options.treeLinkHref ? [firstLink, subLink] : [firstLink, sidebarLink],
    sidebarLinks: [sidebarLink],
  });
  const backdrop = createElement();
  const hamburger = createElement({
    attributes: {
      'aria-expanded': 'false',
      'aria-label': '메뉴 열기',
    },
  });

  const document = {
    documentElement: {
      setAttribute() {},
      getAttribute() { return 'light'; },
    },
    body: { style: {} },
    activeElement: null,
    querySelectorAll() {
      return [];
    },
    querySelector(selector) {
      if (selector === '.sidebar') return sidebar;
      if (selector === '.sidebar-backdrop') return backdrop;
      if (selector === '.lnb-tree') return options.treeLinkHref ? tree : null;
      return null;
    },
    getElementById(id) {
      if (id === 'gnbHamburger') return hamburger;
      if (id === targetId) return sidebarTarget;
      return null;
    },
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
        ...event,
      }));
    },
  };

  const context = {
    window: {
      innerWidth: 480,
      scrollY: options.scrollY === undefined ? 80 : options.scrollY,
      location: {
        pathname: currentPath,
        search: options.search || '',
      },
      scrollTo: vi.fn(),
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
    location: {
      pathname: currentPath,
      search: options.search || '',
      hash: '',
    },
    document,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
    },
    IntersectionObserver: options.intersectionObserver === undefined
      ? function () {
          return { observe() {}, unobserve() {}, disconnect() {} };
        }
      : options.intersectionObserver,
    Array,
    JSON,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(SOURCE, context);

  return { context, document, sidebar, backdrop, hamburger, firstLink, sidebarLink, sidebarTarget, subLink };
}

describe('shared nav sidebar toggle', () => {
  it('keeps the hamburger label synchronized with the open and closed sidebar states', () => {
    const { document, sidebar, backdrop, hamburger, firstLink } = makeContext();

    hamburger.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(true);
    expect(backdrop.classList.contains('open')).toBe(true);
    expect(hamburger.getAttribute('aria-expanded')).toBe('true');
    expect(hamburger.getAttribute('aria-label')).toBe('메뉴 닫기');
    expect(firstLink.focus).toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden');

    document.dispatch('keydown', { key: 'Escape' });

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(backdrop.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(document.body.style.overflow).toBe('');
  });

  it('releases the focus trap when the sidebar closes through an in-page link', () => {
    const { context, sidebar, hamburger, sidebarLink, sidebarTarget } = makeContext();

    hamburger.dispatch('click');
    expect(sidebar.listenerCount('keydown')).toBe(1);

    sidebarLink.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(hamburger.focus).not.toHaveBeenCalled();
    expect(sidebarTarget.getAttribute('tabindex')).toBe('-1');
    expect(sidebarTarget.focus).toHaveBeenCalled();
    expect(context.window.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' });
    expect(sidebar.listenerCount('keydown')).toBe(0);
  });

  it('moves focus to the target when a tree sublink uses an absolute same-page hash URL on mobile', () => {
    const currentPath = '/krds-ux-writing/principles/foundation/';
    const { context, sidebar, hamburger, sidebarTarget, subLink } = makeContext({
      currentPath,
      targetId: 'vision',
      treeLinkHref: `${currentPath}#vision`,
      treeItemPath: '/principles/foundation/',
    });
    const preventDefault = vi.fn();

    hamburger.dispatch('click');
    expect(sidebar.listenerCount('keydown')).toBe(1);

    subLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.focus).not.toHaveBeenCalled();
    expect(sidebarTarget.getAttribute('tabindex')).toBe('-1');
    expect(sidebarTarget.focus).toHaveBeenCalled();
    expect(context.window.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' });
    expect(sidebar.listenerCount('keydown')).toBe(0);
  });

  it('treats explicit index.html principle URLs as the same page for absolute tree sublinks on mobile', () => {
    const { context, sidebar, hamburger, sidebarTarget, subLink } = makeContext({
      currentPath: '/krds-ux-writing/principles/foundation/index.html',
      targetId: 'vision',
      treeLinkHref: '/krds-ux-writing/principles/foundation/#vision',
      treeItemPath: '/principles/foundation/',
    });
    const preventDefault = vi.fn();

    hamburger.dispatch('click');
    expect(sidebar.listenerCount('keydown')).toBe(1);

    subLink.dispatch('click', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.focus).not.toHaveBeenCalled();
    expect(sidebarTarget.getAttribute('tabindex')).toBe('-1');
    expect(sidebarTarget.focus).toHaveBeenCalled();
    expect(context.window.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' });
    expect(sidebar.listenerCount('keydown')).toBe(0);
  });

  it('does not intercept absolute tree sublinks that change the current query string', () => {
    const { context, sidebar, hamburger, sidebarTarget, subLink } = makeContext({
      currentPath: '/krds-ux-writing/principles/foundation/',
      search: '?chapter=1',
      targetId: 'vision',
      treeLinkHref: '/krds-ux-writing/principles/foundation/?chapter=2#vision',
      treeItemPath: '/principles/foundation/',
    });
    const preventDefault = vi.fn();

    hamburger.dispatch('click');
    expect(sidebar.listenerCount('keydown')).toBe(1);

    subLink.dispatch('click', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.focus).not.toHaveBeenCalled();
    expect(sidebarTarget.focus).not.toHaveBeenCalled();
    expect(context.window.scrollTo).not.toHaveBeenCalled();
    expect(sidebar.listenerCount('keydown')).toBe(0);
  });

  it('does not move focus when Escape is pressed while the sidebar is already closed', () => {
    const { document, sidebar, hamburger } = makeContext();

    document.dispatch('keydown', { key: 'Escape' });

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.focus).not.toHaveBeenCalled();
    expect(document.body.style.overflow || '').toBe('');
  });

  it('keeps sidebar initialization alive when IntersectionObserver is unavailable', () => {
    const { sidebarLink, hamburger } = makeContext({
      intersectionObserver: null,
    });

    expect(sidebarLink.listenerCount('click')).toBe(1);
    expect(hamburger.listenerCount('click')).toBe(1);
  });

  it('closes the mobile sidebar when the viewport grows past the mobile breakpoint', () => {
    const { context, document, sidebar, backdrop, hamburger } = makeContext();

    hamburger.dispatch('click');
    expect(sidebar.classList.contains('open')).toBe(true);
    expect(backdrop.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    context.window.innerWidth = 1200;
    context.window.dispatch('resize');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(backdrop.classList.contains('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(hamburger.focus).not.toHaveBeenCalled();
  });

  it('wraps Tab forward focus from the last to the first element when the sidebar focus trap is active', () => {
    const { document, sidebar, hamburger, firstLink, sidebarLink } = makeContext();

    hamburger.dispatch('click');

    const focusCallsBefore = firstLink.focus.mock.calls.length;
    document.activeElement = sidebarLink;
    const preventDefault = vi.fn();
    sidebar.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(firstLink.focus.mock.calls.length).toBe(focusCallsBefore + 1);
  });

  it('wraps Shift+Tab backward focus from the first to the last element when the sidebar focus trap is active', () => {
    const { document, sidebar, hamburger, firstLink, sidebarLink } = makeContext();

    hamburger.dispatch('click');

    document.activeElement = firstLink;
    const preventDefault = vi.fn();
    sidebar.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(sidebarLink.focus).toHaveBeenCalled();
  });

  it('ignores non-Tab keydown events in the sidebar focus trap and does not call preventDefault', () => {
    const { document, sidebar, hamburger, firstLink } = makeContext();

    hamburger.dispatch('click');

    document.activeElement = firstLink;
    const preventDefault = vi.fn();
    sidebar.dispatch('keydown', { key: 'ArrowDown', preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing tabindex when the sidebar anchor target already has one', () => {
    const { hamburger, sidebarLink, sidebarTarget } = makeContext();
    sidebarTarget.setAttribute('tabindex', '0');

    hamburger.dispatch('click');
    sidebarLink.dispatch('click');

    expect(sidebarTarget.getAttribute('tabindex')).toBe('0');
    expect(sidebarTarget.focus).toHaveBeenCalled();
  });

  it('closes the sidebar and restores hamburger state when the backdrop is clicked', () => {
    const { sidebar, backdrop, hamburger, document } = makeContext();

    hamburger.dispatch('click');
    expect(sidebar.classList.contains('open')).toBe(true);
    expect(backdrop.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    backdrop.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(backdrop.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(hamburger.getAttribute('aria-label')).toBe('메뉴 열기');
    expect(document.body.style.overflow).toBe('');
    expect(hamburger.focus).toHaveBeenCalled();
  });

  it('closes the sidebar without focusing the anchor target when the sidebar link points to a missing element', () => {
    const { hamburger, sidebar, sidebarLink, sidebarTarget } = makeContext({
      sidebarLinkHref: '#nonexistent-element',
      targetId: 'section-1',
    });

    hamburger.dispatch('click');
    sidebarLink.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(sidebarTarget.focus).not.toHaveBeenCalled();
  });

  it('closes the sidebar without focusing any target when the sidebar link href is exactly "#"', () => {
    const { hamburger, sidebar, sidebarLink, sidebarTarget } = makeContext({
      sidebarLinkHref: '#',
      targetId: 'section-1',
    });

    hamburger.dispatch('click');
    sidebarLink.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(sidebarTarget.focus).not.toHaveBeenCalled();
  });

  it('closes the sidebar without focusing any target when the sidebar link href has no hash fragment', () => {
    const { hamburger, sidebar, sidebarLink, sidebarTarget } = makeContext({
      sidebarLinkHref: '/principles/foundation/',
      targetId: 'section-1',
    });

    hamburger.dispatch('click');
    sidebarLink.dispatch('click');

    expect(sidebar.classList.contains('open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(sidebarTarget.focus).not.toHaveBeenCalled();
  });
});
