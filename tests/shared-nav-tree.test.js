import { describe, expect, it } from 'vitest';
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
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'id') element.id = String(value);
    },
    getAttribute(name) {
      if (name === 'id') return element.id || null;
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'id') element.id = '';
    },
    hasAttribute(name) {
      return name === 'id' ? !!element.id : attributes.has(name);
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
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
    querySelector(selector) {
      const value = options.queryMap ? options.queryMap[selector] : null;
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    },
    querySelectorAll(selector) {
      const value = options.queryMap ? options.queryMap[selector] : null;
      return Array.isArray(value) ? value : value ? [value] : [];
    },
    closest() {
      return null;
    },
    focus() {},
  };
  return element;
}

function makeContext(options = {}) {
  const toggle = createElement({
    attributes: { 'aria-label': '1장 펼치기/접기' },
    classes: ['lnb-tog'],
  });
  const link = createElement({ classes: ['lnb-item-a'] });
  const subLink = createElement({ classes: ['lnb-sub-a'] });
  const sub = createElement({
    classes: ['lnb-sub'],
    queryMap: {
      '.lnb-sub-a': [subLink],
    },
  });
  const item = createElement({
    attributes: {
      'aria-expanded': 'false',
      'data-path': '/principles/foundation/',
    },
    classes: ['lnb-item'],
    queryMap: {
      '.lnb-tog': toggle,
      '.lnb-sub': sub,
      '.lnb-item-a': link,
      '.lnb-item-a, .lnb-sub-a': [link, subLink],
    },
  });
  const tree = createElement({
    classes: ['lnb-tree'],
    queryMap: {
      '.lnb-item': [item],
      '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, subLink],
      '.lnb-sub-a': [subLink],
    },
  });

  const document = {
    documentElement: {
      setAttribute() {},
      getAttribute() { return 'light'; },
    },
    body: { style: {} },
    activeElement: null,
    querySelector(selector) {
      if (selector === '.lnb-tree') return tree;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.lnb-footer-a') return [];
      return [];
    },
    getElementById(id) {
      if (id === sub.id) return sub;
      return null;
    },
    addEventListener() {},
  };

  const context = {
    window: {
      innerWidth: 1280,
      location: {
        pathname: options.currentPath || '/krds-ux-writing/principles/foundation/',
      },
    },
    location: {
      pathname: options.currentPath || '/krds-ux-writing/principles/foundation/',
      hash: '',
    },
    document,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    sessionStorage: {
      getItem() { return options.sessionStorageValue ?? null; },
      setItem() {},
    },
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

  return { toggle, sub, tree, document, item, link };
}

function makeHashContext(options = {}) {
  const toggle = createElement({
    attributes: { 'aria-label': '1장 펼치기/접기' },
    classes: ['lnb-tog'],
  });
  const link = createElement({ classes: ['lnb-item-a'] });
  const localSubLink = createElement({
    classes: ['lnb-sub-a'],
    attributes: { href: options.localHref || '/krds-ux-writing/principles/core-info/#overview' },
  });
  const remoteSubLink = createElement({
    classes: ['lnb-sub-a'],
    attributes: { href: options.remoteHref || '/krds-ux-writing/principles/safety-net/#overview' },
  });
  const overviewTarget = createElement({ id: 'overview' });
  const sub = createElement({
    classes: ['lnb-sub'],
    queryMap: {
      '.lnb-sub-a': [localSubLink, remoteSubLink],
    },
  });
  const item = createElement({
    attributes: {
      'aria-expanded': 'false',
      'data-path': '/principles/core-info/',
    },
    classes: ['lnb-item'],
    queryMap: {
      '.lnb-tog': toggle,
      '.lnb-sub': sub,
      '.lnb-item-a': link,
      '.lnb-item-a, .lnb-sub-a': [link, localSubLink, remoteSubLink],
    },
  });
  const tree = createElement({
    classes: ['lnb-tree'],
    queryMap: {
      '.lnb-item': [item],
      '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, localSubLink, remoteSubLink],
      '.lnb-sub-a': [localSubLink, remoteSubLink],
    },
  });

  let observerCallback = null;
  const observedTargets = [];
  const document = {
    documentElement: {
      setAttribute() {},
      getAttribute() { return 'light'; },
    },
    body: { style: {} },
    activeElement: null,
    querySelector(selector) {
      if (selector === '.lnb-tree') return tree;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.lnb-footer-a') return [];
      return [];
    },
    getElementById(id) {
      if (id === 'overview') return overviewTarget;
      if (id === sub.id) return sub;
      return null;
    },
    addEventListener() {},
  };

  const context = {
    window: {
      innerWidth: 1280,
      location: {
        pathname: options.currentPath || '/krds-ux-writing/principles/core-info/',
        search: options.search || '',
      },
    },
    location: {
      pathname: options.currentPath || '/krds-ux-writing/principles/core-info/',
      search: options.search || '',
      hash: options.hash || '',
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
    IntersectionObserver: function (callback) {
      observerCallback = callback;
      return {
        observe(target) {
          observedTargets.push(target);
        },
        unobserve() {},
        disconnect() {},
      };
    },
    Array,
    JSON,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(SOURCE, context);

  return { localSubLink, remoteSubLink, overviewTarget, observerCallback, observedTargets };
}

describe('shared nav tree relationships', () => {
  it('assigns aria-controls from each tree toggle to its submenu', () => {
    const { toggle, sub } = makeContext();

    expect(sub.id).toBeTruthy();
    expect(toggle.getAttribute('aria-controls')).toBe(sub.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('ignores corrupted non-array LNB session state instead of crashing during restore', () => {
    expect(() => makeContext({
      sessionStorageValue: '{"oops":true}',
    })).not.toThrow();
  });

  it('does not throw when tree keyboard events fire before an item has focus', () => {
    const { tree, document } = makeContext();
    document.activeElement = null;

    expect(() => tree.dispatch('keydown', { key: 'ArrowRight' })).not.toThrow();
    expect(() => tree.dispatch('keydown', { key: 'ArrowLeft' })).not.toThrow();
    expect(() => tree.dispatch('keydown', { key: 'Enter' })).not.toThrow();
  });

  it('auto-expands the current chapter when the principle page pathname omits the trailing slash', () => {
    const { item, toggle, link } = makeContext({
      currentPath: '/krds-ux-writing/principles/foundation',
    });

    expect(item.getAttribute('aria-expanded')).toBe('true');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(link.classList.contains('active')).toBe(true);
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('marks only the current-page hash link active on load when multiple pages share the same hash id', () => {
    const { localSubLink, remoteSubLink } = makeHashContext({
      hash: '#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
    expect(remoteSubLink.classList.contains('active')).toBe(false);
    expect(remoteSubLink.getAttribute('aria-current')).toBe(null);
  });

  it('keeps only the current-page hash link active when the local section intersects', () => {
    const { localSubLink, remoteSubLink, overviewTarget, observerCallback } = makeHashContext();

    expect(typeof observerCallback).toBe('function');

    observerCallback([
      { isIntersecting: true, target: overviewTarget },
    ]);

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
    expect(remoteSubLink.classList.contains('active')).toBe(false);
    expect(remoteSubLink.getAttribute('aria-current')).toBe(null);
  });

  it('does not treat query-changing hash links as current-page LNB links', () => {
    const { localSubLink, remoteSubLink, observedTargets } = makeHashContext({
      hash: '#overview',
      search: '?tab=details',
      localHref: '/krds-ux-writing/principles/core-info/?tab=summary#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(false);
    expect(localSubLink.getAttribute('aria-current')).toBe(null);
    expect(remoteSubLink.classList.contains('active')).toBe(false);
    expect(remoteSubLink.getAttribute('aria-current')).toBe(null);
    expect(observedTargets).toEqual([]);
  });
});
