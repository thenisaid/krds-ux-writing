import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/nav.js'), 'utf8');

function makeLink() {
  return { focus: vi.fn() };
}

function makeGnbNav(links) {
  const listeners = new Map();
  return {
    querySelectorAll(selector) {
      return selector === '.gnb-nav-link' ? links : [];
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((h) => h({ preventDefault() {}, ...event }));
    },
  };
}

function buildContext(options = {}) {
  const link1 = makeLink();
  const link2 = makeLink();
  const link3 = makeLink();
  const links = [link1, link2, link3];
  const gnbNav = makeGnbNav(links);

  const gnbBtnAttrs = new Map();
  const gnbBtn = {
    focus: vi.fn(),
    setAttribute(n, v) { gnbBtnAttrs.set(n, String(v)); },
    getAttribute(n) { return gnbBtnAttrs.has(n) ? gnbBtnAttrs.get(n) : null; },
  };
  const openItemClassList = { remove: vi.fn(), add() {}, contains() { return false; }, toggle() {} };
  const openItem = {
    classList: openItemClassList,
    querySelector(sel) { return sel === '.gnb-link' ? gnbBtn : null; },
  };

  const document = {
    documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
    body: { style: {} },
    activeElement: null,
    querySelectorAll() { return []; },
    querySelector(sel) {
      if (sel === '.gnb-nav') return gnbNav;
      if (sel === '.gnb-item.open') return options.hasOpenItem ? openItem : null;
      return null;
    },
    getElementById() { return null; },
    addEventListener() {},
  };

  const context = {
    window: {
      location: { pathname: '/krds-ux-writing/' },
      matchMedia: null,
      addEventListener() {},
    },
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
    Array,
    JSON,
    console,
    globalThis: null,
  };
  context.globalThis = context;
  vm.runInNewContext(SOURCE, context);

  return {
    gnbNav, link1, link2, link3, gnbBtn, openItem, document,
  };
}

describe('shared nav GNB keyboard navigation', () => {
  it('moves focus to the next link when ArrowRight is pressed', () => {
    const { gnbNav, link1, link2, document } = buildContext();
    document.activeElement = link1;
    const preventDefault = vi.fn();
    gnbNav.dispatch('keydown', { key: 'ArrowRight', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(link2.focus).toHaveBeenCalled();
  });

  it('calls preventDefault but does not move focus when ArrowRight is pressed at the last link', () => {
    const { gnbNav, link1, link2, link3, document } = buildContext();
    document.activeElement = link3;
    const preventDefault = vi.fn();
    gnbNav.dispatch('keydown', { key: 'ArrowRight', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(link1.focus).not.toHaveBeenCalled();
    expect(link2.focus).not.toHaveBeenCalled();
    expect(link3.focus).not.toHaveBeenCalled();
  });

  it('moves focus to the next link when ArrowDown is pressed (same as ArrowRight)', () => {
    const { gnbNav, link1, link2, document } = buildContext();
    document.activeElement = link1;
    gnbNav.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(link2.focus).toHaveBeenCalled();
  });

  it('moves focus to the previous link when ArrowLeft is pressed', () => {
    const { gnbNav, link1, link2, document } = buildContext();
    document.activeElement = link2;
    const preventDefault = vi.fn();
    gnbNav.dispatch('keydown', { key: 'ArrowLeft', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(link1.focus).toHaveBeenCalled();
  });

  it('calls preventDefault but does not move focus when ArrowLeft is pressed at the first link', () => {
    const { gnbNav, link1, link2, document } = buildContext();
    document.activeElement = link1;
    const preventDefault = vi.fn();
    gnbNav.dispatch('keydown', { key: 'ArrowLeft', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(link1.focus).not.toHaveBeenCalled();
    expect(link2.focus).not.toHaveBeenCalled();
  });

  it('moves focus to the previous link when ArrowUp is pressed (same as ArrowLeft)', () => {
    const { gnbNav, link1, link2, link3, document } = buildContext();
    document.activeElement = link3;
    gnbNav.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(link2.focus).toHaveBeenCalled();
  });

  it('closes an open GNB dropdown and focuses its toggle button when Escape is pressed', () => {
    const { gnbNav, gnbBtn, openItem } = buildContext({ hasOpenItem: true });
    gnbNav.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });
    expect(openItem.classList.remove).toHaveBeenCalledWith('open');
    expect(gnbBtn.getAttribute('aria-expanded')).toBe('false');
    expect(gnbBtn.focus).toHaveBeenCalled();
  });

  it('does nothing when Escape is pressed and no GNB dropdown is open', () => {
    const { gnbNav, gnbBtn } = buildContext({ hasOpenItem: false });
    gnbNav.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });
    expect(gnbBtn.focus).not.toHaveBeenCalled();
  });

  it('removes the open class from a GNB item even when it has no .gnb-link toggle button', () => {
    const removeClassSpy = vi.fn();
    const noButtonOpenItem = {
      classList: { remove: removeClassSpy, add() {}, contains() { return false; }, toggle() {} },
      querySelector() { return null; },
    };
    const links = [makeLink(), makeLink()];
    const gnbNav = makeGnbNav(links);
    const document = {
      documentElement: { setAttribute() {}, getAttribute() { return 'light'; } },
      body: { style: {} },
      activeElement: null,
      querySelectorAll() { return []; },
      querySelector(sel) {
        if (sel === '.gnb-nav') return gnbNav;
        if (sel === '.gnb-item.open') return noButtonOpenItem;
        return null;
      },
      getElementById() { return null; },
      addEventListener() {},
    };
    const context = {
      window: { location: { pathname: '/krds-ux-writing/' }, matchMedia: null, addEventListener() {} },
      document,
      localStorage: { getItem() { return null; }, setItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
      Array, JSON, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);

    expect(() => gnbNav.dispatch('keydown', { key: 'Escape' })).not.toThrow();
    expect(removeClassSpy).toHaveBeenCalledWith('open');
  });
});
