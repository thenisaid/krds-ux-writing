import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'demo-slides.html'), 'utf8');
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
      if (selector === '.build-item') return options.buildItems || [];
      return [];
    },
    focus: vi.fn(),
  };
  return element;
}

function buildContext(options = {}) {
  const documentListeners = new Map();
  const stage = createElement({ style: {} });
  const container = createElement({ id: 'slide-container', style: {} });
  const helpOverlay = createElement({ id: 'help-overlay', classes: [] });
  const helpBox = createElement({ id: 'help-box' });
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
    querySelector(selector) {
      if (selector === '.slide-stage') return stage;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.slide') return slides;
      return [];
    },
    getElementById(id) {
      if (id === 'slide-container') return container;
      if (id === 'help-overlay') return helpOverlay;
      if (id === 'help-box') return helpBox;
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

  const window = {
    innerWidth: 1024,
    innerHeight: 576,
    addEventListener() {},
  };

  const history = {
    replaceState: vi.fn(),
  };

  const location = {
    hash: '',
  };

  const context = {
    document,
    window,
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

  slides.forEach((slide) => {
    slide.focus = vi.fn(() => {
      document.activeElement = slide;
    });
  });
  helpBox.focus = vi.fn(() => {
    document.activeElement = helpBox;
  });

  return { context, document, container, helpOverlay, helpBox, history, slides };
}

describe('demo slides help overlay', () => {
  it('does not advance slides while the help overlay is visible', () => {
    const { context, document, container, helpOverlay, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    helpOverlay.classList.add('visible');
    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: ' ', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(container.style.transform || '').toBe('');
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('moves focus into the help dialog and restores it when closed', () => {
    const { context, document, helpOverlay, helpBox, slides } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.activeElement = slides[0];
    const openPreventDefault = vi.fn();
    document.dispatch('keydown', { key: '?', preventDefault: openPreventDefault });

    expect(openPreventDefault).toHaveBeenCalled();
    expect(helpOverlay.classList.contains('visible')).toBe(true);
    expect(helpBox.focus).toHaveBeenCalled();

    const tabPreventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', preventDefault: tabPreventDefault });

    expect(tabPreventDefault).toHaveBeenCalled();
    expect(helpBox.focus).toHaveBeenCalledTimes(2);

    const closePreventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Escape', preventDefault: closePreventDefault });

    expect(closePreventDefault).toHaveBeenCalled();
    expect(helpOverlay.classList.contains('visible')).toBe(false);
    expect(slides[0].focus).toHaveBeenCalled();
  });

  it('does not close the help overlay when the help box itself is clicked', () => {
    const { context, document, helpOverlay, helpBox, slides } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.activeElement = slides[0];
    document.dispatch('keydown', { key: '?', preventDefault: vi.fn() });

    expect(helpOverlay.classList.contains('visible')).toBe(true);

    helpOverlay.dispatch('click', { target: helpBox });

    expect(helpOverlay.classList.contains('visible')).toBe(true);
    expect(slides[0].focus).not.toHaveBeenCalled();

    helpOverlay.dispatch('click', { target: helpOverlay });

    expect(helpOverlay.classList.contains('visible')).toBe(false);
    expect(slides[0].focus).toHaveBeenCalled();
  });

  it('prevents browser Home/End scrolling while moving between the first and last slides', async () => {
    const { context, document, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    const endPreventDefault = vi.fn();
    document.dispatch('keydown', { key: 'End', preventDefault: endPreventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(endPreventDefault).toHaveBeenCalled();
    expect(container.style.transform).toBe('translateX(-100%)');
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '#slide-2');

    const homePreventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Home', preventDefault: homePreventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(homePreventDefault).toHaveBeenCalled();
    expect(container.style.transform).toBe('translateX(-0%)');
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '#slide-1');
  });

  it('reveals the final slide fragments when End is pressed after arriving on the last slide', async () => {
    const finalBuildItems = [
      createElement({ classes: ['build-item'], dataset: { build: '0' } }),
      createElement({ classes: ['build-item'], dataset: { build: '1' } }),
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

    const endPreventDefault = vi.fn();
    document.dispatch('keydown', { key: 'End', preventDefault: endPreventDefault });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(endPreventDefault).toHaveBeenCalled();
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

  it('advances to the next slide when the user swipes left (negative dx)', async () => {
    const { context, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    container.dispatch('pointerdown', { clientX: 300 });
    container.dispatch('pointerup', { clientX: 200 });
    await Promise.resolve();
    await Promise.resolve();

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('moves to the previous slide when the user swipes right (positive dx)', async () => {
    const { context, document, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.dispatch('keydown', { key: 'ArrowRight', preventDefault: vi.fn() });
    await Promise.resolve();
    await Promise.resolve();

    history.replaceState.mockClear();

    container.dispatch('pointerdown', { clientX: 200 });
    container.dispatch('pointerup', { clientX: 350 });
    await Promise.resolve();
    await Promise.resolve();

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-1');
  });

  it('ignores a swipe that is 50 px or less (below the movement threshold)', async () => {
    const { context, container, history } = buildContext();
    vm.runInNewContext(SOURCE, context);

    container.dispatch('pointerdown', { clientX: 200 });
    container.dispatch('pointerup', { clientX: 150 });
    await Promise.resolve();

    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('jumps to the correct slide when the hash changes to #slide-N', async () => {
    const windowListeners = new Map();
    const { context, history } = buildContext();
    context.window.addEventListener = (type, handler) => {
      const arr = windowListeners.get(type) || [];
      arr.push(handler);
      windowListeners.set(type, arr);
    };
    context.location = { hash: '' };
    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#slide-2';
    const handlers = windowListeners.get('hashchange') || [];
    handlers.forEach((h) => h());
    await Promise.resolve();
    await Promise.resolve();

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('closes the help overlay when "?" is pressed a second time', () => {
    const { context, document, helpOverlay, slides } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.activeElement = slides[0];
    document.dispatch('keydown', { key: '?', preventDefault: vi.fn() });
    expect(helpOverlay.classList.contains('visible')).toBe(true);

    helpOverlay.classList.add('visible');
    document.dispatch('keydown', { key: '?', preventDefault: vi.fn() });

    expect(helpOverlay.classList.contains('visible')).toBe(false);
  });

  it('falls back to the current slide for focus when lastHelpFocus is null on close', () => {
    const { context, document, helpOverlay, slides } = buildContext();
    vm.runInNewContext(SOURCE, context);

    document.activeElement = null;
    document.dispatch('keydown', { key: '?', preventDefault: vi.fn() });
    expect(helpOverlay.classList.contains('visible')).toBe(true);

    document.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });

    expect(helpOverlay.classList.contains('visible')).toBe(false);
    expect(slides[0].focus).toHaveBeenCalled();
  });

  it('navigates to the initial slide when the page loads with a hash already set', () => {
    const { context, container, history } = buildContext();
    context.location.hash = '#slide-2';

    vm.runInNewContext(SOURCE, context);

    expect(container.style.transform).toBe('translateX(-100%)');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#slide-2');
  });

  it('reveals current-slide build items and focuses the slide when hashchange lands on the same slide', () => {
    const buildItem = createElement({ classes: ['build-item'], dataset: { build: '0' } });
    const windowListeners = new Map();
    const { context, slides, history } = buildContext({
      slides: [
        { dataset: { slide: '0' }, buildItems: [buildItem] },
        { dataset: { slide: '1' }, buildItems: [] },
      ],
    });
    context.window.addEventListener = (type, handler) => {
      const arr = windowListeners.get(type) || [];
      arr.push(handler);
      windowListeners.set(type, arr);
    };

    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#slide-1';
    const handlers = windowListeners.get('hashchange') || [];
    handlers.forEach((h) => h());

    expect(buildItem.classList.contains('shown')).toBe(true);
    expect(slides[0].focus).toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('ignores a prev() call when already on the first slide (goTo index < 0)', () => {
    const windowListeners = new Map();
    const { context, container, history } = buildContext();
    context.window.addEventListener = (type, handler) => {
      const arr = windowListeners.get(type) || [];
      arr.push(handler);
      windowListeners.set(type, arr);
    };

    vm.runInNewContext(SOURCE, context);

    context.location.hash = '#slide-0';
    const handlers = windowListeners.get('hashchange') || [];
    handlers.forEach((h) => h());

    expect(container.style.transform || '').toBe('');
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
