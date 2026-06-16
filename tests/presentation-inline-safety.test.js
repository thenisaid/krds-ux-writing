import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const SEMA_FILES = [
  'sema_p1.html',
  'sema_p2.html',
  'sema_p3.html',
  'sema_p4.html',
];
const SLIDE_FILES = [
  ...SEMA_FILES,
  'demo-slides.html',
  'krds-guide-intro.html',
];

function readHtml(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function readInlineScript(relPath) {
  const html = readHtml(relPath);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (scripts.length === 0) {
    throw new Error(`No inline script found in ${relPath}`);
  }
  return scripts[scripts.length - 1];
}

function createContext() {
  const documentListeners = new Map();
  const document = {
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      const arr = documentListeners.get(type) || [];
      arr.push(handler);
      documentListeners.set(type, arr);
    },
    createElement() {
      return {
        className: '',
        onclick: null,
        appendChild() {},
        addEventListener() {},
        classList: {
          add() {},
          remove() {},
          toggle() {},
        },
      };
    },
  };
  const window = {
    addEventListener() {},
    innerWidth: 1280,
    innerHeight: 720,
  };
  const context = {
    window,
    document,
    history: {
      replaceState() {},
    },
    location: {
      hash: '',
    },
    requestAnimationFrame(fn) {
      fn();
      return 1;
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    Promise,
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;
  return context;
}

function createDeckNode(tagName = 'div') {
  const attributes = new Map();
  const children = [];
  const listeners = new Map();
  let className = '';
  return {
    tagName: String(tagName || 'div').toUpperCase(),
    children,
    style: {},
    disabled: false,
    textContent: '',
    onclick: null,
    classList: {
      add(value) {
        if (!className.split(/\s+/).includes(value)) {
          className = [className, value].filter(Boolean).join(' ');
        }
      },
      remove(value) {
        className = className.split(/\s+/).filter((entry) => entry && entry !== value).join(' ');
      },
      toggle(value, force) {
        const has = className.split(/\s+/).includes(value);
        const next = force === undefined ? !has : !!force;
        if (next && !has) this.add(value);
        if (!next && has) this.remove(value);
        return next;
      },
    },
    set className(value) {
      className = String(value);
    },
    get className() {
      return className;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
      if (type === 'click') this.onclick = handler;
    },
    removeEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((entry) => entry !== handler));
      if (type === 'click' && this.onclick === handler) this.onclick = null;
    },
    querySelectorAll(selector) {
      if (selector === '.dot') {
        return children.filter((child) => (child.className || '').split(/\s+/).includes('dot'));
      }
      return [];
    },
  };
}

function createDeckContext(sourceRelPath, options = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const slideCount = options.slideCount || 2;
  const slides = Array.from({ length: slideCount }, () => createDeckNode('section'));
  slides[0].classList.add('active');
  const wrapper = createDeckNode('div');
  const counter = createDeckNode('span');
  counter.textContent = options.initialCounterText || '';
  const btnPrev = createDeckNode('button');
  const btnNext = createDeckNode('button');
  const dots = createDeckNode('div');
  const stage = createDeckNode('div');
  const pbar = createDeckNode('div');
  const snum = createDeckNode('div');
  const sc = createDeckNode('div');

  const elements = {
    wrapper,
    counter,
    'btn-prev': btnPrev,
    'btn-next': btnNext,
    dots,
    stage,
    pbar,
    snum,
    sc,
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === '.slide-stage') return stage;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.slide') return slides;
      return [];
    },
    addEventListener(type, handler) {
      const arr = documentListeners.get(type) || [];
      arr.push(handler);
      documentListeners.set(type, arr);
    },
    createElement(tagName) {
      return createDeckNode(tagName);
    },
  };

  const context = {
    window: {
      addEventListener(type, handler) {
        const arr = windowListeners.get(type) || [];
        arr.push(handler);
        windowListeners.set(type, arr);
      },
      innerWidth: 1280,
      innerHeight: 720,
    },
    document,
    history: {
      replaceState() {},
    },
    location: {
      hash: '',
    },
    requestAnimationFrame(fn) {
      fn();
      return 1;
    },
    setTimeout(fn) {
      fn();
      return 1;
    },
    clearTimeout() {},
    Promise,
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  if (sourceRelPath === 'krds-guide-intro.html') {
    elements.sc = sc;
    elements.stage = stage;
    elements.pbar = pbar;
    elements.snum = snum;
    elements.dots = dots;
  }

  function dispatchDocument(type, event = {}) {
    const handlers = documentListeners.get(type) || [];
    handlers.forEach((handler) => handler({
      preventDefault() {},
      target: null,
      currentTarget: document,
      ...event,
    }));
  }

  function dispatchWindow(type, event = {}) {
    const handlers = windowListeners.get(type) || [];
    handlers.forEach((handler) => handler({
      preventDefault() {},
      ...event,
    }));
  }

  return { context, counter, dots, slides, sc, pbar, snum, dispatchDocument, dispatchWindow };
}

describe('presentation inline script safety', () => {
  it('does not throw when required DOM nodes are missing', () => {
    SLIDE_FILES.forEach((relPath) => {
      const source = readInlineScript(relPath);
      const context = createContext();

      expect(() => vm.runInNewContext(source, context), relPath).not.toThrow();
    });
  });

  it('keeps seminar deck navigation globals callable as no-ops when markup is incomplete', () => {
    SEMA_FILES.forEach((relPath) => {
      const source = readInlineScript(relPath);
      const context = createContext();

      vm.runInNewContext(source, context);

      expect(typeof context.window.go, relPath).toBe('function');
      expect(typeof context.window.goTo, relPath).toBe('function');
      expect(() => context.window.go(1), relPath).not.toThrow();
      expect(() => context.window.goTo(0), relPath).not.toThrow();
    });
  });

  it('builds accessible dot buttons for the slide decks', () => {
    [...SEMA_FILES, 'krds-guide-intro.html'].forEach((relPath) => {
      const source = readInlineScript(relPath);
      const { context, dots } = createDeckContext(relPath);

      vm.runInNewContext(source, context);

      expect(dots.children.length, relPath).toBeGreaterThan(0);
      dots.children.forEach((dot, index) => {
        expect(dot.tagName, `${relPath} dot ${index + 1}`).toBe('BUTTON');
        expect(dot.type || dot.getAttribute('type'), `${relPath} dot ${index + 1}`).toBe('button');
        expect(dot.getAttribute('aria-label'), `${relPath} dot ${index + 1}`).toBe(`${index + 1}번 슬라이드로 이동`);
      });
      expect(dots.children[0].getAttribute('aria-current'), relPath).toBe('true');
    });
  });

  it('synchronizes the seminar deck counter from the live slide count on first render', () => {
    SEMA_FILES.forEach((relPath) => {
      const source = readInlineScript(relPath);
      const html = readHtml(relPath);
      const slideCount = (html.match(/class="slide(?![\w-])/g) || []).length;
      const { context, counter } = createDeckContext(relPath, {
        slideCount,
        initialCounterText: '01 / 00',
      });

      vm.runInNewContext(source, context);

      expect(counter.textContent, relPath).toBe(`01 / ${String(slideCount).padStart(2, '0')}`);
    });
  });

  it('does not hijack keyboard shortcuts when a slide button already has focus', async () => {
    for (const relPath of [...SEMA_FILES, 'krds-guide-intro.html']) {
      const source = readInlineScript(relPath);
      const { context, dots, slides, sc, dispatchDocument } = createDeckContext(relPath);

      vm.runInNewContext(source, context);

      const preventDefault = vi.fn();
      dispatchDocument('keydown', {
        key: ' ',
        target: dots.children[0],
        preventDefault,
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(preventDefault, relPath).not.toHaveBeenCalled();
      if (relPath === 'krds-guide-intro.html') {
        expect(sc.style.transform, relPath).toBe('translateX(-0%)');
      } else {
        expect(slides[0].className, relPath).toContain('active');
        expect(slides[1].className, relPath).not.toContain('active');
      }
    }
  });

  it('ignores out-of-range slide hashes in the intro deck', async () => {
    const relPath = 'krds-guide-intro.html';
    const source = readInlineScript(relPath);
    const { context, sc, pbar, snum, dispatchWindow } = createDeckContext(relPath);

    vm.runInNewContext(source, context);
    await Promise.resolve();
    await Promise.resolve();

    expect(sc.style.transform, relPath).toBe('translateX(-0%)');
    expect(pbar.style.width, relPath).toBe('0%');
    expect(snum.textContent, relPath).toBe('01 / 02');

    context.location.hash = '#slide-999';
    dispatchWindow('hashchange');
    await Promise.resolve();
    await Promise.resolve();

    expect(sc.style.transform, relPath).toBe('translateX(-0%)');
    expect(pbar.style.width, relPath).toBe('0%');
    expect(snum.textContent, relPath).toBe('01 / 02');
  });

  it('clamps invalid initial slide hashes in the intro deck', async () => {
    const relPath = 'krds-guide-intro.html';
    const source = readInlineScript(relPath);
    const { context, sc, pbar, snum } = createDeckContext(relPath);
    context.location.hash = '#slide-0';

    vm.runInNewContext(source, context);
    await Promise.resolve();
    await Promise.resolve();

    expect(sc.style.transform, relPath).toBe('translateX(-0%)');
    expect(pbar.style.width, relPath).toBe('0%');
    expect(snum.textContent, relPath).toBe('01 / 02');
  });

  it('prevents default Home and End scrolling while navigating the intro deck', async () => {
    const relPath = 'krds-guide-intro.html';
    const source = readInlineScript(relPath);
    const { context, sc, pbar, snum, dispatchDocument } = createDeckContext(relPath);

    vm.runInNewContext(source, context);
    await Promise.resolve();
    await Promise.resolve();

    const endPreventDefault = vi.fn();
    dispatchDocument('keydown', { key: 'End', preventDefault: endPreventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(endPreventDefault).toHaveBeenCalled();
    expect(sc.style.transform, relPath).toBe('translateX(-100%)');
    expect(pbar.style.width, relPath).toBe('100%');
    expect(snum.textContent, relPath).toBe('02 / 02');

    const homePreventDefault = vi.fn();
    dispatchDocument('keydown', { key: 'Home', preventDefault: homePreventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(homePreventDefault).toHaveBeenCalled();
    expect(sc.style.transform, relPath).toBe('translateX(-0%)');
    expect(pbar.style.width, relPath).toBe('0%');
    expect(snum.textContent, relPath).toBe('01 / 02');
  });
});
