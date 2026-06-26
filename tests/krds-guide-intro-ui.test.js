import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'krds-guide-intro.html'), 'utf8');
const INLINE_SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const SOURCE = INLINE_SCRIPTS[0] || '';

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
  const element = {
    id: options.id || '',
    style: options.style || {},
    dataset: options.dataset || {},
    classList: createClassList(options.classes || []),
    children: [],
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    removeEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((entry) => entry !== handler));
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
    appendChild(child) {
      element.children.push(child);
      return child;
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
    querySelectorAll(selector) {
      if (selector === '.b') return options.buildItems || [];
      return [];
    },
    focus: vi.fn(),
    setAttribute() {},
  };
  return element;
}

function buildContext(options = {}) {
  const documentListeners = new Map();
  const stage = createElement({ id: 'stage', style: {} });
  const container = createElement({ id: 'sc', style: {} });
  const progressBar = createElement({ id: 'pbar', style: {} });
  const slideNumber = createElement({ id: 'snum' });
  const dots = createElement({ id: 'dots' });
  const slideConfigs = options.slides || [
    { dataset: { slide: '0' }, buildItems: [] },
    { dataset: { slide: '1' }, buildItems: [] },
  ];
  const slides = slideConfigs.map((slideConfig, index) => createElement({
    classes: ['slide'],
    dataset: slideConfig.dataset || { slide: String(index) },
    buildItems: slideConfig.buildItems || [],
  }));

  const document = {
    activeElement: null,
    querySelectorAll(selector) {
      if (selector === '.slide') return slides;
      return [];
    },
    getElementById(id) {
      if (id === 'sc') return container;
      if (id === 'stage') return stage;
      if (id === 'pbar') return progressBar;
      if (id === 'snum') return slideNumber;
      if (id === 'dots') return dots;
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
    createElement() {
      return createElement();
    },
  };

  const windowListeners = new Map();
  const history = {
    replaceState: vi.fn(),
  };
  const location = {
    hash: options.hash || '',
  };
  const context = {
    document,
    window: {
      innerWidth: 1024,
      innerHeight: 576,
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
    history,
    location,
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

  return { context, document, container, history };
}

describe('guide intro slides', () => {
  it('reveals all build items when a deep slide hash is loaded on startup', () => {
    const finalBuildItems = [
      createElement({ classes: ['b'] }),
      createElement({ classes: ['b'] }),
    ];
    const { context, container } = buildContext({
      hash: '#slide-3',
      slides: [
        { dataset: { slide: '0' }, buildItems: [] },
        { dataset: { slide: '1' }, buildItems: [] },
        { dataset: { slide: '2' }, buildItems: finalBuildItems },
      ],
    });

    vm.runInNewContext(SOURCE, context);

    expect(container.style.transform).toBe('translateX(-200%)');
    expect(finalBuildItems[0].classList.contains('shown')).toBe(true);
    expect(finalBuildItems[1].classList.contains('shown')).toBe(true);
  });

  it('reveals all build items when navigation happens through a slide hash change', async () => {
    const targetBuildItems = [
      createElement({ classes: ['b'] }),
      createElement({ classes: ['b'] }),
    ];
    const { context, container } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems: [] },
        { dataset: { slide: '1' }, buildItems: targetBuildItems },
      ],
    });

    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#slide-2';
    context.window.dispatch('hashchange');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.style.transform).toBe('translateX(-100%)');
    expect(targetBuildItems[0].classList.contains('shown')).toBe(true);
    expect(targetBuildItems[1].classList.contains('shown')).toBe(true);
  });

  it('reveals the final slide builds when End is pressed after arriving on the last slide', async () => {
    const finalBuildItems = [
      createElement({ classes: ['b'] }),
      createElement({ classes: ['b'] }),
    ];
    const { context, document } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems: [] },
        { dataset: { slide: '1' }, buildItems: [] },
        { dataset: { slide: '2' }, buildItems: finalBuildItems },
      ],
    });
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(finalBuildItems[0].classList.contains('shown')).toBe(false);
    expect(finalBuildItems[1].classList.contains('shown')).toBe(false);

    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'End', preventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preventDefault).toHaveBeenCalled();
    expect(finalBuildItems[0].classList.contains('shown')).toBe(true);
    expect(finalBuildItems[1].classList.contains('shown')).toBe(true);
  });

  it('removes transition fallback listeners after slide movement completes without a transitionend event', async () => {
    const { context, document, container } = buildContext();
    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'ArrowRight', preventDefault });
    await Promise.resolve();
    await Promise.resolve();

    expect(preventDefault).toHaveBeenCalled();
    expect(container.listenerCount('transitionend')).toBe(0);
  });

  it('advances to the next slide when the user swipes left (negative dx > 50)', async () => {
    const { context, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    container.dispatch('pointerdown', { clientX: 300 });
    container.dispatch('pointerup', { clientX: 200 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('ignores a swipe whose absolute dx is 50 px or less (below the threshold)', () => {
    const { context, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    container.dispatch('pointerdown', { clientX: 200 });
    container.dispatch('pointerup', { clientX: 150 });

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('skips the keyboard handler when the event target is an interactive element', () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn(), target: { tagName: 'BUTTON', isContentEditable: false } });

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('navigates to the first slide when Home is pressed after advancing', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    history.replaceState.mockClear();

    document.dispatch('keydown', { key: 'Home', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-1');
  });

  it('reveals build items on the current slide when the hashchange target matches the active slide', async () => {
    const buildItems = [
      createElement({ classes: ['b'] }),
      createElement({ classes: ['b'] }),
    ];
    const { context } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems },
        { dataset: { slide: '1' }, buildItems: [] },
      ],
    });
    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#slide-1';
    context.window.dispatch('hashchange');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(buildItems[0].classList.contains('shown')).toBe(true);
    expect(buildItems[1].classList.contains('shown')).toBe(true);
  });

  it('advances the slide with the Space key', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: ' ', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('does not throw when guide-intro DOM elements are missing (early-return guard)', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelectorAll() { return []; },
      },
      window: { innerWidth: 1024, innerHeight: 576, addEventListener() {} },
      history: { replaceState: vi.fn() },
      location: { hash: '' },
      requestAnimationFrame(fn) { fn(); return 1; },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Promise,
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('reveals the next build item instead of advancing the slide when next() is called on a slide with hidden builds', async () => {
    const buildItem = createElement({ classes: ['b'], dataset: { build: '0' } });
    const { context, document, history } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems: [] },
        { dataset: { slide: '1' }, buildItems: [buildItem] },
        { dataset: { slide: '2' }, buildItems: [] },
      ],
    });
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '#slide-2');
    expect(buildItem.classList.contains('shown')).toBe(false);

    history.replaceState.mockClear();

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(buildItem.classList.contains('shown')).toBe(true);
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('moves to the previous slide when ArrowLeft is pressed', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    history.replaceState.mockClear();

    document.dispatch('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-1');
  });

  it('does not navigate backward when ArrowLeft is pressed on the first slide', () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() });

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('does not advance when ArrowRight is pressed on the last slide with no build items (cur >= total-1 branch in next())', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
    history.replaceState.mockClear();

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('skips the keyboard handler when the event target is an INPUT element (isInteractiveTarget A/INPUT/SELECT/TEXTAREA/SUMMARY tag branch)', () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      target: { tagName: 'INPUT', isContentEditable: false },
    });

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('skips the keyboard handler when the event target is a contenteditable div (isInteractiveTarget isContentEditable branch)', () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    // tagName is 'DIV' — not in the hardcoded tag list — but isContentEditable is true
    document.dispatch('keydown', {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      target: { tagName: 'DIV', isContentEditable: true },
    });

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('moves to the previous slide when the user swipes right (positive dx > 50)', async () => {
    const { context, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    container.dispatch('pointerdown', { clientX: 300 });
    container.dispatch('pointerup', { clientX: 200 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
    history.replaceState.mockClear();

    container.dispatch('pointerdown', { clientX: 200 });
    container.dispatch('pointerup', { clientX: 400 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-1');
  });

  it('navigates to the dot-clicked slide index via the dot click handler', async () => {
    const { context, container, history } = buildContext();
    const dotsEl = context.document.getElementById('dots');

    vm.runInNewContext(SOURCE, context);

    dotsEl.children[1].dispatch('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
    expect(container.style.transform).toBe('translateX(-100%)');
  });

  it('does not navigate when hashchange fires with a hash that does not match the slide pattern', () => {
    const { context, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#section-title';
    context.window.dispatch('hashchange');

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('advances the slide when ArrowDown is pressed (same keydown branch as ArrowRight)', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'ArrowDown', preventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preventDefault).toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('moves to the previous slide when ArrowUp is pressed (same keydown branch as ArrowLeft)', async () => {
    const { context, document, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    history.replaceState.mockClear();

    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'ArrowUp', preventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preventDefault).toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-1');
  });

  it('ignores a second next() call when an animation is already in progress (anim guard)', async () => {
    // Use 3 slides so we can call next() twice without hitting the last-slide boundary.
    // Defer rAF so goTo(1) suspends with anim=true when the second keydown fires.
    const { context, document, history } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems: [] },
        { dataset: { slide: '1' }, buildItems: [] },
        { dataset: { slide: '2' }, buildItems: [] },
      ],
    });
    const rafQueue = [];
    context.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
    vm.runInNewContext(SOURCE, context);

    // Drain the init rAF (startup updateUI) so the IIFE completes its setup
    const initFns = [...rafQueue];
    rafQueue.length = 0;
    initFns.forEach((fn) => fn());

    // First ArrowRight: goTo(1) starts, anim=true, suspends waiting for rAF
    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    // Second ArrowRight while anim=true: next() hits `if(anim)return` and is ignored
    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });

    // Release the deferred rAF so goTo(1) can continue to history.replaceState
    const pending = [...rafQueue];
    rafQueue.length = 0;
    pending.forEach((fn) => fn());
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Exactly one slide advance; the second keydown was blocked by the anim guard
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('sets the progress bar to 100% when there is only one slide (total=1 ternary branch)', () => {
    const progressBar = createElement({ id: 'pbar', style: {} });

    const document = {
      activeElement: null,
      querySelectorAll(selector) {
        if (selector === '.slide') return [createElement({ classes: ['slide'], buildItems: [] })];
        return [];
      },
      getElementById(id) {
        if (id === 'sc') return createElement({ id: 'sc', style: {} });
        if (id === 'stage') return createElement({ id: 'stage', style: {} });
        if (id === 'pbar') return progressBar;
        if (id === 'snum') return createElement({ id: 'snum' });
        if (id === 'dots') return createElement({ id: 'dots' });
        return null;
      },
      addEventListener() {},
      createElement() { return createElement(); },
    };

    const context = {
      document,
      window: {
        innerWidth: 1024,
        innerHeight: 576,
        addEventListener() {},
      },
      history: { replaceState: vi.fn() },
      location: { hash: '' },
      requestAnimationFrame(fn) { fn(); return 1; },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Promise,
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    // With one slide, pct = total > 1 ? ... : 100 → 100%
    expect(progressBar.style.width).toBe('100%');
  });
});
