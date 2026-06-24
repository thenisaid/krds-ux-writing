import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/prompt-copy.js'), 'utf8');

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
  const attributes = new Map(Object.entries(options.attributes || {}));
  const element = {
    textContent: options.textContent || '',
    value: options.value || '',
    dataset: options.dataset || {},
    style: options.style || {},
    classList: createClassList(options.classes || []),
    select: vi.fn(),
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    closest(selector) {
      if (selector === '.pl-copy-btn' && element.classList.contains('pl-copy-btn')) {
        return element;
      }
      return null;
    },
  };
  return element;
}

function createEnvironment({ clipboardImpl, execCommandResult = false, manualTimers = false } = {}) {
  const listeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const button = createElement({
    textContent: '복사',
    dataset: { target: 'prompt-1' },
    classes: ['pl-copy-btn'],
  });
  const prompt = createElement({ textContent: '프롬프트 본문' });

  const document = {
    body: {
      appendChild() {},
      removeChild() {},
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((handler) => handler({
        preventDefault() {},
        stopPropagation() {},
        ...event,
      }));
    },
    getElementById(id) {
      if (id === 'prompt-1') return prompt;
      return null;
    },
    createElement() {
      return createElement();
    },
    execCommand: vi.fn(() => execCommandResult),
  };

  const context = {
    document,
    navigator: {
      clipboard: {
        writeText: clipboardImpl || vi.fn(() => Promise.resolve()),
      },
    },
    clearTimeout(id) {
      if (manualTimers) timers.delete(id);
    },
    setTimeout(fn, delay) {
      if (manualTimers) {
        const id = nextTimerId++;
        timers.set(id, { fn, delay });
        return id;
      }
      fn();
      return 1;
    },
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, document, button, prompt, timers };
}

describe('shared prompt copy behavior', () => {
  it('keeps the latest successful copy feedback when an older async copy attempt fails later', async () => {
    let settleFirst;
    let callCount = 0;
    const clipboardImpl = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((resolve, reject) => {
          settleFirst = { resolve, reject };
        });
      }
      return Promise.resolve();
    });

    const { context, document, button } = createEnvironment({
      clipboardImpl,
      execCommandResult: false,
      manualTimers: true,
    });

    vm.runInNewContext(SOURCE, context);

    document.dispatch('click', { target: button });
    document.dispatch('click', { target: button });
    await Promise.resolve();

    expect(button.textContent).toBe('복사됨!');

    settleFirst.reject(new Error('denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(button.textContent).toBe('복사됨!');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('shows "복사 실패" when both clipboard and execCommand fallback fail', async () => {
    const { context, document, button } = createEnvironment({
      clipboardImpl: vi.fn(() => Promise.reject(new Error('denied'))),
      execCommandResult: false,
      manualTimers: true,
    });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: button });
    await Promise.resolve();
    await Promise.resolve();

    expect(button.textContent).toBe('복사 실패');
  });

  it('succeeds via execCommand fallback when clipboard API is unavailable', () => {
    const { context, document, button } = createEnvironment({
      execCommandResult: true,
      manualTimers: true,
    });
    context.navigator = {};

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: button });

    expect(button.textContent).toBe('복사됨!');
  });

  it('does nothing when the clicked element is not a copy button', () => {
    const { context, document, button } = createEnvironment();
    const nonButton = createElement({ textContent: '일반 텍스트' });

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: nonButton });

    expect(button.textContent).toBe('복사');
  });

  it('does nothing when the prompt element referenced by the button does not exist in the DOM', () => {
    const { context, document, button } = createEnvironment();
    button.dataset.target = 'nonexistent-prompt';

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: button });

    expect(button.textContent).toBe('복사');
  });

  it('shows "복사 실패" when clipboard is unavailable and execCommand also fails', () => {
    const { context, document, button } = createEnvironment({
      execCommandResult: false,
      manualTimers: true,
    });
    context.navigator = {};

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: button });

    expect(button.textContent).toBe('복사 실패');
  });

  it('returns false immediately from fallbackCopy when document.body is missing', async () => {
    const { context, document, button } = createEnvironment({
      clipboardImpl: vi.fn(() => Promise.reject(new Error('denied'))),
      execCommandResult: false,
      manualTimers: true,
    });
    context.document.body = null;

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: button });
    await Promise.resolve();
    await Promise.resolve();

    expect(button.textContent).toBe('복사 실패');
  });

  it('does nothing when the click target has no closest method', () => {
    const { context, document, button } = createEnvironment();
    const bareTarget = { textContent: '링크' };

    vm.runInNewContext(SOURCE, context);
    document.dispatch('click', { target: bareTarget });

    expect(button.textContent).toBe('복사');
  });
});
