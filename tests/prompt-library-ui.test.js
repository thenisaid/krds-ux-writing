import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'prompt-library.html'), 'utf8');
const INLINE_SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const COPY_SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/prompt-copy.js'), 'utf8');
const FILTER_SOURCE = INLINE_SCRIPTS[1] || '';

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
  return {
    id: options.id || '',
    textContent: options.textContent || '',
    dataset: options.dataset || {},
    style: options.style || {},
    classList: createClassList(options.classes || []),
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((handler) => handler.call(this, {
        preventDefault() {},
        stopPropagation() {},
        target: this,
        currentTarget: this,
        ...event,
      }));
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    closest(selector) {
      if (selector.startsWith('.')) {
        return this.classList.contains(selector.slice(1)) ? this : null;
      }
      return null;
    },
    select() {},
  };
}

function buildContext({
  withCount = true,
  clipboard = { writeText() { return Promise.resolve(); } },
  execCommandResult = false,
  manualTimers = false,
} = {}) {
  const allChip = createElement({
    dataset: { filter: 'all' },
    classes: ['pl-chip', 'active'],
    attributes: { 'aria-pressed': 'true' },
  });
  const generalChip = createElement({
    dataset: { filter: 'general' },
    classes: ['pl-chip'],
    attributes: { 'aria-pressed': 'false' },
  });
  const copyBtn = createElement({
    dataset: { target: 'prompt-01' },
    classes: ['pl-copy-btn'],
    textContent: '복사',
  });
  const generalCard = createElement({ dataset: { category: 'general' }, style: { display: '' } });
  const safetyCard = createElement({ dataset: { category: 'safety-net' }, style: { display: '' } });
  const elements = {
    'prompt-01': createElement({ id: 'prompt-01', textContent: '테스트 프롬프트' }),
  };
  if (withCount) {
    elements['pl-visible-count'] = createElement({ textContent: '2' });
  }
  const documentListeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;

  const document = {
    body: {
      appendChild() {},
      removeChild() {},
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
        target: event.target || null,
        currentTarget: document,
        ...event,
      }));
    },
    createElement() {
      return createElement({ style: {} });
    },
    execCommand() {
      return execCommandResult;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.pl-chip') return [allChip, generalChip];
      if (selector === '.pl-card') return [generalCard, safetyCard];
      return [];
    },
  };

  const context = {
    document,
    navigator: {
      clipboard,
    },
    setTimeout(fn, delay) {
      if (manualTimers) {
        const id = nextTimerId++;
        timers.set(id, { fn, delay });
        return id;
      }
      return 1;
    },
    clearTimeout(id) {
      if (manualTimers) timers.delete(id);
    },
    Promise,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return {
    context,
    document,
    allChip,
    generalChip,
    copyBtn,
    generalCard,
    safetyCard,
    countEl: elements['pl-visible-count'] || null,
    timers,
  };
}

function runPageScripts(context) {
  vm.runInNewContext(COPY_SOURCE, context);
  vm.runInNewContext(FILTER_SOURCE, context);
}

describe('prompt library filters', () => {
  it('filters cards and updates the visible count', () => {
    const { context, allChip, generalChip, generalCard, safetyCard, countEl } = buildContext();
    runPageScripts(context);

    generalChip.dispatch('click');

    expect(allChip.classList.contains('active')).toBe(false);
    expect(generalChip.classList.contains('active')).toBe(true);
    expect(allChip.getAttribute('aria-pressed')).toBe('false');
    expect(generalChip.getAttribute('aria-pressed')).toBe('true');
    expect(generalCard.style.display).toBe('');
    expect(safetyCard.style.display).toBe('none');
    expect(countEl.textContent).toBe('1');
  });

  it('keeps filtering working when the count element is missing', () => {
    const { context, generalChip, generalCard, safetyCard } = buildContext({ withCount: false });
    runPageScripts(context);

    expect(() => generalChip.dispatch('click')).not.toThrow();
    expect(generalCard.style.display).toBe('');
    expect(safetyCard.style.display).toBe('none');
  });

  it('falls back safely when clipboard.writeText is not a function', () => {
    const { context, document, copyBtn } = buildContext({
      clipboard: {},
      execCommandResult: true,
    });
    runPageScripts(context);

    expect(() => document.dispatch('click', { target: copyBtn })).not.toThrow();
    expect(copyBtn.textContent).toBe('복사됨!');
    expect(copyBtn.classList.contains('copied')).toBe(true);
  });

  it('shows a failure state when clipboard copy and fallback copy both fail', async () => {
    const { context, document, copyBtn } = buildContext({
      clipboard: {
        writeText: vi.fn(() => Promise.reject(new Error('denied'))),
      },
      execCommandResult: false,
    });
    runPageScripts(context);

    document.dispatch('click', { target: copyBtn });
    await Promise.resolve();
    await Promise.resolve();

    expect(copyBtn.textContent).toBe('복사 실패');
    expect(copyBtn.classList.contains('copied')).toBe(false);
  });

  it('ignores non-element copy click targets without throwing', () => {
    const { context, document, copyBtn } = buildContext();
    runPageScripts(context);

    expect(() => document.dispatch('click', { target: { nodeType: 3 } })).not.toThrow();
    expect(copyBtn.textContent).toBe('복사');
    expect(copyBtn.classList.contains('copied')).toBe(false);
  });

  it('falls back to execCommand when clipboard rejects but execCommand succeeds', async () => {
    const { context, document, copyBtn } = buildContext({
      clipboard: {
        writeText: vi.fn(() => Promise.reject(new Error('denied'))),
      },
      execCommandResult: true,
    });
    runPageScripts(context);

    document.dispatch('click', { target: copyBtn });
    await Promise.resolve();
    await Promise.resolve();

    expect(copyBtn.textContent).toBe('복사됨!');
    expect(copyBtn.classList.contains('copied')).toBe(true);
  });

  it('does nothing when the copy target element is not in the DOM', () => {
    const { context, document, copyBtn } = buildContext();
    copyBtn.dataset.target = 'nonexistent-prompt';
    runPageScripts(context);

    expect(() => document.dispatch('click', { target: copyBtn })).not.toThrow();
    expect(copyBtn.textContent).toBe('복사');
  });

  it('keeps the latest copy feedback visible when the prompt is copied repeatedly', async () => {
    const { context, document, copyBtn, timers } = buildContext({ manualTimers: true });
    runPageScripts(context);

    document.dispatch('click', { target: copyBtn });
    await Promise.resolve();
    await Promise.resolve();

    const firstResetTimerId = [...timers.entries()].find(([, timer]) => timer.delay === 1800)?.[0];
    expect(firstResetTimerId).toBeDefined();
    expect(copyBtn.textContent).toBe('복사됨!');
    expect(copyBtn.classList.contains('copied')).toBe(true);

    document.dispatch('click', { target: copyBtn });
    await Promise.resolve();
    await Promise.resolve();

    const staleResetTimer = timers.get(firstResetTimerId);
    if (staleResetTimer) {
      timers.delete(firstResetTimerId);
      staleResetTimer.fn();
    }

    expect(copyBtn.textContent).toBe('복사됨!');
    expect(copyBtn.classList.contains('copied')).toBe(true);

    const latestResetTimer = [...timers.entries()].find(([, timer]) => timer.delay === 1800);
    expect(latestResetTimer).toBeDefined();
    latestResetTimer[1].fn();

    expect(copyBtn.textContent).toBe('복사');
    expect(copyBtn.classList.contains('copied')).toBe(false);
  });
});
