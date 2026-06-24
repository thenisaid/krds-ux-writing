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
      const elMap = element.queryMap;
      const optMap = options.queryMap;
      const value = (elMap && selector in elMap) ? elMap[selector] : (optMap ? optMap[selector] : null);
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    },
    querySelectorAll(selector) {
      const elMap = element.queryMap;
      const optMap = options.queryMap;
      const value = (elMap && selector in elMap) ? elMap[selector] : (optMap ? optMap[selector] : null);
      return Array.isArray(value) ? value : value ? [value] : [];
    },
    closest(selector) {
      const map = element.closestMap || options.closestMap;
      return (map && map[selector]) ? map[selector] : null;
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

  return { toggle, sub, tree, document, item, link, subLink };
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

  it('reuses the existing sub-menu id for aria-controls when the sub already has one', () => {
    const toggle = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
    const link = createElement({ classes: ['lnb-item-a'] });
    const subLink = createElement({ classes: ['lnb-sub-a'] });
    const sub = createElement({
      id: 'pre-existing-sub-id',
      classes: ['lnb-sub'],
      queryMap: { '.lnb-sub-a': [subLink] },
    });
    const item = createElement({
      attributes: { 'aria-expanded': 'false', 'data-path': '/principles/foundation/' },
      classes: ['lnb-item'],
      queryMap: { '.lnb-tog': toggle, '.lnb-sub': sub, '.lnb-item-a': link, '.lnb-item-a, .lnb-sub-a': [link, subLink] },
    });
    const tree = createElement({
      classes: ['lnb-tree'],
      queryMap: { '.lnb-item': [item], '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, subLink], '.lnb-sub-a': [subLink] },
    });
    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) { return selector === '.lnb-tree' ? tree : null; },
      querySelectorAll() { return []; },
      getElementById(id) { return id === 'pre-existing-sub-id' ? sub : null; },
      addEventListener() {},
    };
    const context = {
      window: { innerWidth: 1280, location: { pathname: '/krds-ux-writing/' } },
      location: { pathname: '/krds-ux-writing/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(sub.id).toBe('pre-existing-sub-id');
    expect(toggle.getAttribute('aria-controls')).toBe('pre-existing-sub-id');
  });

  it('generates a fallback sub-menu id using the item index when the item has no data-path attribute', () => {
    const toggle = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
    const link = createElement({ classes: ['lnb-item-a'] });
    const subLink = createElement({ classes: ['lnb-sub-a'] });
    const sub = createElement({ classes: ['lnb-sub'], queryMap: { '.lnb-sub-a': [subLink] } });
    const item = createElement({
      attributes: { 'aria-expanded': 'false' },
      classes: ['lnb-item'],
      queryMap: { '.lnb-tog': toggle, '.lnb-sub': sub, '.lnb-item-a': link, '.lnb-item-a, .lnb-sub-a': [link, subLink] },
    });
    const tree = createElement({
      classes: ['lnb-tree'],
      queryMap: { '.lnb-item': [item], '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, subLink], '.lnb-sub-a': [subLink] },
    });
    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) { return selector === '.lnb-tree' ? tree : null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: { innerWidth: 1280, location: { pathname: '/krds-ux-writing/' } },
      location: { pathname: '/krds-ux-writing/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(sub.id).toMatch(/^lnb-sub-section-\d+$/);
    expect(toggle.getAttribute('aria-controls')).toBe(sub.id);
  });

  it('ignores corrupted non-array LNB session state instead of crashing during restore', () => {
    expect(() => makeContext({
      sessionStorageValue: '{"oops":true}',
    })).not.toThrow();
  });

  it('silently skips sessionStorage restore when getItem throws a security error', () => {
    const toggle = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
    const link = createElement({ classes: ['lnb-item-a'] });
    const subLink = createElement({ classes: ['lnb-sub-a'] });
    const sub = createElement({ classes: ['lnb-sub'], queryMap: { '.lnb-sub-a': [subLink] } });
    const item = createElement({
      attributes: { 'aria-expanded': 'false', 'data-path': '/principles/foundation/' },
      classes: ['lnb-item'],
      queryMap: { '.lnb-tog': toggle, '.lnb-sub': sub, '.lnb-item-a': link, '.lnb-item-a, .lnb-sub-a': [link, subLink] },
    });
    const tree = createElement({
      classes: ['lnb-tree'],
      queryMap: { '.lnb-item': [item], '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, subLink], '.lnb-sub-a': [subLink] },
    });
    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) { return selector === '.lnb-tree' ? tree : null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: { innerWidth: 1280, location: { pathname: '/krds-ux-writing/' } },
      location: { pathname: '/krds-ux-writing/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: {
        getItem() { throw new Error('SecurityError: blocked'); },
        setItem() {},
      },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('silently swallows sessionStorage setItem throws when accordion state is saved after a toggle click', () => {
    const { toggle, item } = makeContext({ currentPath: '/krds-ux-writing/' });

    const savedSetItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
    const setItemSpy = vi.fn((key, value) => {
      if (key === 'krds-lnb-open') savedSetItem(key, value);
    });

    const context = (() => {
      const toggle2 = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
      const link2 = createElement({ classes: ['lnb-item-a'] });
      const subLink2 = createElement({ classes: ['lnb-sub-a'] });
      const sub2 = createElement({ classes: ['lnb-sub'], queryMap: { '.lnb-sub-a': [subLink2] } });
      const item2 = createElement({
        attributes: { 'aria-expanded': 'false', 'data-path': '/principles/foundation/' },
        classes: ['lnb-item'],
        queryMap: { '.lnb-tog': toggle2, '.lnb-sub': sub2, '.lnb-item-a': link2, '.lnb-item-a, .lnb-sub-a': [link2, subLink2] },
      });
      const tree2 = createElement({
        classes: ['lnb-tree'],
        queryMap: { '.lnb-item': [item2], '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link2, toggle2, subLink2], '.lnb-sub-a': [subLink2] },
      });
      const doc2 = {
        documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
        body: { style: {} },
        activeElement: null,
        querySelector(selector) { return selector === '.lnb-tree' ? tree2 : null; },
        querySelectorAll() { return []; },
        getElementById() { return null; },
        addEventListener() {},
      };
      const ctx = {
        window: { innerWidth: 1280, location: { pathname: '/krds-ux-writing/' } },
        location: { pathname: '/krds-ux-writing/', hash: '' },
        document: doc2,
        localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: {
          getItem() { return null; },
          setItem: savedSetItem,
        },
        IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
        Array, JSON, console, globalThis: null,
      };
      ctx.globalThis = ctx;
      vm.runInNewContext(SOURCE, ctx);
      return { toggle2, item2, savedSetItem };
    })();

    expect(() => context.toggle2.dispatch('click')).not.toThrow();
    expect(context.item2.getAttribute('aria-expanded')).toBe('true');
    expect(context.savedSetItem).toHaveBeenCalled();
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

  it('marks a pure fragment href active on load when the page hash matches', () => {
    const { localSubLink, remoteSubLink } = makeHashContext({
      hash: '#overview',
      localHref: '#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
    expect(remoteSubLink.classList.contains('active')).toBe(false);
  });

  it('does not update active state when the IntersectionObserver fires with isIntersecting false', () => {
    const { localSubLink, remoteSubLink, overviewTarget, observerCallback } = makeHashContext();

    expect(localSubLink.classList.contains('active')).toBe(false);

    observerCallback([
      { isIntersecting: false, target: overviewTarget },
    ]);

    expect(localSubLink.classList.contains('active')).toBe(false);
    expect(remoteSubLink.classList.contains('active')).toBe(false);
  });

  it('recognises an absolute same-origin https:// LNB sub-link as a same-page hash link on load', () => {
    const { localSubLink } = makeHashContext({
      hash: '#overview',
      localHref: 'https://example.com/krds-ux-writing/principles/core-info/#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
  });

  it('recognises a protocol-relative // LNB sub-link as a same-page hash link on load', () => {
    const { localSubLink } = makeHashContext({
      hash: '#overview',
      localHref: '//example.com/krds-ux-writing/principles/core-info/#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
  });

  it('does not mark an https:// LNB sub-link active when the URL has no path component', () => {
    const { localSubLink, remoteSubLink } = makeHashContext({
      hash: '#overview',
      localHref: 'https://example.com#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(false);
    expect(localSubLink.getAttribute('aria-current')).toBe(null);
    expect(remoteSubLink.classList.contains('active')).toBe(false);
  });

  it('does not mark a protocol-relative // LNB sub-link active when the URL has no path component', () => {
    const { localSubLink, remoteSubLink } = makeHashContext({
      hash: '#overview',
      localHref: '//example.com#overview',
    });

    expect(localSubLink.classList.contains('active')).toBe(false);
    expect(localSubLink.getAttribute('aria-current')).toBe(null);
    expect(remoteSubLink.classList.contains('active')).toBe(false);
  });

  it('uses location.search as a fallback when window.location.search is not a string', () => {
    const toggle = createElement({
      attributes: { 'aria-label': '1장 펼치기/접기' },
      classes: ['lnb-tog'],
    });
    const link = createElement({ classes: ['lnb-item-a'] });
    const localSubLink = createElement({
      classes: ['lnb-sub-a'],
      attributes: { href: '/krds-ux-writing/principles/core-info/#overview' },
    });
    const overviewTarget = createElement({ id: 'overview' });
    const sub = createElement({
      classes: ['lnb-sub'],
      queryMap: { '.lnb-sub-a': [localSubLink] },
    });
    const item = createElement({
      attributes: { 'aria-expanded': 'false', 'data-path': '/principles/core-info/' },
      classes: ['lnb-item'],
      queryMap: {
        '.lnb-tog': toggle,
        '.lnb-sub': sub,
        '.lnb-item-a': link,
        '.lnb-item-a, .lnb-sub-a': [link, localSubLink],
      },
    });
    const tree = createElement({
      classes: ['lnb-tree'],
      queryMap: {
        '.lnb-item': [item],
        '.lnb-item-a, .lnb-tog, .lnb-sub-a': [link, toggle, localSubLink],
        '.lnb-sub-a': [localSubLink],
      },
    });

    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
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
          pathname: '/krds-ux-writing/principles/core-info/',
          // search is intentionally absent — typeof window.location.search !== 'string'
        },
      },
      location: {
        pathname: '/krds-ux-writing/principles/core-info/',
        search: '',
        hash: '#overview',
      },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
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

    expect(localSubLink.classList.contains('active')).toBe(true);
    expect(localSubLink.getAttribute('aria-current')).toBe('location');
  });
});

describe('shared nav tree accordion toggle', () => {
  it('expands and collapses an item gracefully when it has no toggle button or sub-menu element', () => {
    const { toggle, item } = makeContext({ currentPath: '/krds-ux-writing/' });
    item.queryMap = {};

    expect(item.getAttribute('aria-expanded')).toBe('false');
    expect(() => toggle.dispatch('click')).not.toThrow();
    expect(item.getAttribute('aria-expanded')).toBe('true');

    expect(() => toggle.dispatch('click')).not.toThrow();
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses an empty base label when the toggle has no aria-label attribute', () => {
    const { toggle, item } = makeContext({ currentPath: '/krds-ux-writing/' });
    toggle.removeAttribute('aria-label');

    toggle.dispatch('click');

    const label = toggle.getAttribute('aria-label');
    expect(typeof label).toBe('string');
    expect(label).toContain('접기');
  });

  it('collapses an expanded accordion item when its toggle button is clicked', () => {
    const { toggle, item } = makeContext();
    expect(item.getAttribute('aria-expanded')).toBe('true');
    toggle.dispatch('click');
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands a collapsed accordion item when its toggle button is clicked', () => {
    const { toggle, item } = makeContext({ currentPath: '/krds-ux-writing/' });
    expect(item.getAttribute('aria-expanded')).toBe('false');
    toggle.dispatch('click');
    expect(item.getAttribute('aria-expanded')).toBe('true');
  });

  it('restores previously expanded accordion items from sessionStorage on load', () => {
    const { item } = makeContext({
      currentPath: '/krds-ux-writing/',
      sessionStorageValue: JSON.stringify(['/principles/foundation/']),
    });
    expect(item.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls handleMobileSidebarLinkClick when an LNB link is clicked on a narrow viewport', () => {
    const toggle = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
    const link = createElement({ classes: ['lnb-item-a'] });
    const subLink = createElement({ classes: ['lnb-sub-a'] });
    const sub = createElement({ classes: ['lnb-sub'], queryMap: { '.lnb-sub-a': [subLink] } });
    const item = createElement({
      attributes: { 'aria-expanded': 'true', 'data-path': '/principles/foundation/' },
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
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) { return selector === '.lnb-tree' ? tree : null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: { innerWidth: 480, location: { pathname: '/krds-ux-writing/principles/foundation/' } },
      location: { pathname: '/krds-ux-writing/principles/foundation/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    // nav.js sets sharedNav.handleMobileSidebarLinkClick on window.KRDSSharedNav;
    // replace it with a spy after the IIFE runs so the closure picks it up at call time.
    const spy = vi.fn();
    context.window.KRDSSharedNav.handleMobileSidebarLinkClick = spy;

    link.dispatch('click', { preventDefault() {} });
    expect(spy).toHaveBeenCalled();
  });

  it('skips handleMobileSidebarLinkClick when the viewport is wider than 900px', () => {
    const toggle = createElement({ attributes: { 'aria-label': '1장 펼치기/접기' }, classes: ['lnb-tog'] });
    const link = createElement({ classes: ['lnb-item-a'] });
    const subLink = createElement({ classes: ['lnb-sub-a'] });
    const sub = createElement({ classes: ['lnb-sub'], queryMap: { '.lnb-sub-a': [subLink] } });
    const item = createElement({
      attributes: { 'aria-expanded': 'true', 'data-path': '/principles/foundation/' },
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
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) { return selector === '.lnb-tree' ? tree : null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: { innerWidth: 1280, location: { pathname: '/krds-ux-writing/principles/foundation/' } },
      location: { pathname: '/krds-ux-writing/principles/foundation/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    const spy = vi.fn();
    context.window.KRDSSharedNav.handleMobileSidebarLinkClick = spy;

    link.dispatch('click', { preventDefault() {} });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('shared nav tree keyboard navigation', () => {
  it('moves focus to the next focusable element when ArrowDown is pressed', () => {
    const { toggle, tree, document, link } = makeContext({ currentPath: '/krds-ux-writing/' });
    toggle.focus = vi.fn();
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(toggle.focus).toHaveBeenCalled();
  });

  it('moves focus to the previous focusable element when ArrowUp is pressed', () => {
    const { tree, document, link, toggle } = makeContext({ currentPath: '/krds-ux-writing/' });
    link.focus = vi.fn();
    document.activeElement = toggle;
    tree.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(link.focus).toHaveBeenCalled();
  });

  it('collapses an expanded accordion item when Enter is pressed on its toggle button', () => {
    const { toggle, tree, document, item } = makeContext();
    toggle.click = () => toggle.dispatch('click');
    expect(item.getAttribute('aria-expanded')).toBe('true');
    document.activeElement = toggle;
    tree.dispatch('keydown', { key: 'Enter', preventDefault: vi.fn() });
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores unrelated keys and does not move focus in the tree', () => {
    const { toggle, tree, document, link } = makeContext({ currentPath: '/krds-ux-writing/' });
    toggle.focus = vi.fn();
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'Tab', preventDefault: vi.fn() });
    expect(toggle.focus).not.toHaveBeenCalled();
  });

  it('expands a collapsed accordion item when ArrowRight is pressed on its chapter link', () => {
    const { toggle, tree, document, item, link } = makeContext({ currentPath: '/krds-ux-writing/' });
    toggle.click = () => toggle.dispatch('click');
    link.closestMap = { '.lnb-item': item };
    expect(item.getAttribute('aria-expanded')).toBe('false');
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    expect(item.getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus to the first visible sub-link when ArrowRight is pressed on an expanded item', () => {
    const { toggle, tree, document, item, link, subLink } = makeContext();
    link.closestMap = { '.lnb-item': item };
    expect(item.getAttribute('aria-expanded')).toBe('true');
    document.activeElement = link;
    subLink.focus = vi.fn();
    item.queryMap = { '.lnb-sub:not([hidden]) .lnb-sub-a': subLink };
    tree.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    expect(subLink.focus).toHaveBeenCalled();
  });

  it('moves focus from a sub-link to the parent chapter link when ArrowLeft is pressed', () => {
    const { tree, document, item, link, subLink } = makeContext();
    subLink.closestMap = { '.lnb-item': item };
    link.focus = vi.fn();
    document.activeElement = subLink;
    tree.dispatch('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() });
    expect(link.focus).toHaveBeenCalled();
  });

  it('collapses an expanded accordion item when ArrowLeft is pressed on its chapter link', () => {
    const { toggle, tree, document, item, link } = makeContext();
    toggle.click = () => toggle.dispatch('click');
    link.closestMap = { '.lnb-item': item };
    expect(item.getAttribute('aria-expanded')).toBe('true');
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() });
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses an expanded accordion item when Space is pressed on its toggle button', () => {
    const { toggle, tree, document, item } = makeContext();
    toggle.click = () => toggle.dispatch('click');
    expect(item.getAttribute('aria-expanded')).toBe('true');
    document.activeElement = toggle;
    tree.dispatch('keydown', { key: ' ', preventDefault: vi.fn() });
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('calls preventDefault but does not move focus when ArrowDown is pressed at the last focusable element', () => {
    const { tree, document, subLink } = makeContext();
    const focusSpy = vi.fn();
    subLink.focus = focusSpy;
    document.activeElement = subLink;
    tree.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('calls preventDefault but does not move focus when ArrowUp is pressed at the first focusable element', () => {
    const { tree, document, link } = makeContext();
    const focusSpy = vi.fn();
    link.focus = focusSpy;
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('does not toggle a collapsed chapter when ArrowLeft is pressed on it', () => {
    const { toggle, tree, document, item, link } = makeContext({ currentPath: '/krds-ux-writing/' });
    const clickSpy = vi.fn();
    toggle.click = clickSpy;
    link.closestMap = { '.lnb-item': item };
    expect(item.getAttribute('aria-expanded')).toBe('false');
    document.activeElement = link;
    tree.dispatch('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() });
    expect(clickSpy).not.toHaveBeenCalled();
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not crash when ArrowRight is pressed on an expanded item with no visible sub-links', () => {
    const { tree, document, item, link } = makeContext();
    link.closestMap = { '.lnb-item': item };
    expect(item.getAttribute('aria-expanded')).toBe('true');
    document.activeElement = link;

    expect(() => tree.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() })).not.toThrow();
  });

  it('does not throw when sessionStorage contains malformed JSON for the LNB accordion state', () => {
    expect(() => makeContext({
      sessionStorageValue: 'this-is-not-valid-json',
    })).not.toThrow();
  });
});

describe('shared nav LNB footer link active state', () => {
  function makeFooterContext(options = {}) {
    const footerHref = 'footerHref' in options ? options.footerHref : '/krds-ux-writing/principles/';
    const footerLink = createElement({
      classes: ['lnb-footer-a'],
      attributes: { href: footerHref },
    });
    const tree = createElement({
      classes: ['lnb-tree'],
      queryMap: {
        '.lnb-item': [],
        '.lnb-item-a, .lnb-tog, .lnb-sub-a': [],
        '.lnb-sub-a': [],
      },
    });
    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelector(selector) {
        if (selector === '.lnb-tree') return tree;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.lnb-footer-a') return [footerLink];
        return [];
      },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: {
        innerWidth: 1280,
        location: { pathname: options.currentPath || '/krds-ux-writing/principles/foundation/' },
      },
      location: { pathname: options.currentPath || '/krds-ux-writing/principles/foundation/', hash: '' },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);
    return { footerLink };
  }

  it('marks a footer link active when the current path starts with its site-relative href', () => {
    const { footerLink } = makeFooterContext({
      currentPath: '/krds-ux-writing/principles/foundation/',
      footerHref: '/krds-ux-writing/principles/',
    });
    expect(footerLink.classList.contains('active')).toBe(true);
  });

  it('does not mark a footer link active when the current path is on a different section', () => {
    const { footerLink } = makeFooterContext({
      currentPath: '/krds-ux-writing/dictionary/',
      footerHref: '/krds-ux-writing/principles/',
    });
    expect(footerLink.classList.contains('active')).toBe(false);
  });

  it('does not mark a footer link active when its href is empty', () => {
    const { footerLink } = makeFooterContext({
      currentPath: '/krds-ux-writing/principles/foundation/',
      footerHref: '',
    });
    expect(footerLink.classList.contains('active')).toBe(false);
  });
});
