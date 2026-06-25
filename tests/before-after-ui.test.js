import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'before-after.html'), 'utf8');
const INLINE_SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const SOURCE = INLINE_SCRIPTS[1] || '';

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
  const queryMap = options.queryMap || {};

  return {
    id: options.id || '',
    value: options.value || '',
    textContent: options.textContent || '',
    innerHTML: options.innerHTML || '',
    disabled: !!options.disabled,
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
    click() {
      this.dispatch('click');
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    querySelector(selector) {
      const value = queryMap[selector];
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    },
    querySelectorAll(selector) {
      const value = queryMap[selector];
      return Array.isArray(value) ? value : value ? [value] : [];
    },
    focus: vi.fn(),
  };
}

function createDocument(elements, querySelectorAllMap = {}) {
  const listeners = new Map();
  const documentElement = {
    theme: 'light',
    setAttribute(name, value) {
      if (name === 'data-theme') this.theme = String(value);
    },
    getAttribute(name) {
      return name === 'data-theme' ? this.theme : null;
    },
  };

  return {
    body: {
      style: {},
    },
    activeElement: null,
    documentElement,
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      return querySelectorAllMap[selector] || [];
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
  };
}

function buildContext(options = {}) {
  const panelA = createElement({ id: 'panel-a', classes: ['tab-panel', 'active'], queryMap: { 'mark.diff': [] } });
  const tabA = createElement({
    id: 'tab-a',
    classes: ['tab-btn', 'active'],
    attributes: { 'aria-controls': 'panel-a', 'aria-selected': 'true' },
  });

  const elements = {
    themeToggle: createElement({ id: 'themeToggle' }),
    themeIcon: createElement({ id: 'themeIcon' }),
    'tab-a': tabA,
    'panel-a': panelA,
    lintInput: createElement({ id: 'lintInput' }),
    lintRunBtn: createElement({ id: 'lintRunBtn' }),
    lintClearBtn: createElement({ id: 'lintClearBtn' }),
    lintResults: createElement({ id: 'lintResults' }),
    seminarBtn: createElement({ id: 'seminarBtn' }),
    seminarOverlay: createElement({ id: 'seminarOverlay', queryMap: { 'mark.diff': [] } }),
    seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
    seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
    seminarCounter: createElement({ id: 'seminarCounter' }),
    seminarPrev: createElement({ id: 'seminarPrev' }),
    seminarNext: createElement({ id: 'seminarNext' }),
    seminarClose: createElement({ id: 'seminarClose' }),
  };

  const document = createDocument(elements, {
    '.tab-btn': [tabA],
    '.tab-panel': [panelA],
    '.pair': [],
  });

  const context = {
    document,
    window: {},
    localStorage: {
      setItem() {},
    },
    KRDSLint: {
      lint: vi.fn(() => options.lintResult || ({
        score: 71,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          severity: 'error',
          category: '행정어',
          match: '귀하',
          message: '"귀하"는 어려운 표현입니다.',
          suggestion: '→ 신청인',
        }],
      })),
    },
    setTimeout(fn) {
      fn();
      return 1;
    },
    clearTimeout() {},
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, elements, document };
}

describe('before-after page interactions', () => {
  it('synchronizes the theme toggle label and icon with the restored theme on load and click', () => {
    const { context, elements, document } = buildContext();
    document.documentElement.setAttribute('data-theme', 'dark');

    vm.runInNewContext(SOURCE, context);

    expect(elements.themeIcon.getAttribute('d')).toBe('M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('라이트모드 전환');

    elements.themeToggle.dispatch('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeIcon.getAttribute('d')).toBe('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('다크모드 전환');
  });

  it('invalidates stale lint output when the source text changes after analysis', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('71');
    expect(elements.lintResults.innerHTML).toContain('귀하');

    elements.lintInput.value = '수정된 문장입니다.';
    elements.lintInput.dispatch('input');

    expect(elements.lintResults.classList.contains('visible')).toBe(false);
    expect(elements.lintResults.innerHTML).toBe('');
  });

  it('replaces stale lint output with an engine error message when KRDSLint throws', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('71');
    expect(elements.lintResults.innerHTML).toContain('귀하');

    context.KRDSLint.lint = vi.fn(() => {
      throw new Error('engine exploded');
    });

    expect(() => elements.lintRunBtn.dispatch('click')).not.toThrow();
    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('린팅 엔진 오류가 발생했습니다. 다시 시도해 주세요.');
    expect(elements.lintResults.innerHTML).not.toContain('71');
    expect(elements.lintResults.innerHTML).not.toContain('귀하');
  });

  it('treats malformed lint-engine responses as recoverable errors instead of throwing', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    context.KRDSLint.lint = vi.fn(() => ({
      score: 71,
      summary: null,
      issues: null,
    }));

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';

    expect(() => elements.lintRunBtn.dispatch('click')).not.toThrow();
    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('린팅 엔진 오류가 발생했습니다. 다시 시도해 주세요.');
  });

  it('prevents the textarea newline side effect when Ctrl+Enter runs linting', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';
    const preventDefault = vi.fn();
    elements.lintInput.dispatch('keydown', { key: 'Enter', ctrlKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('71');
    expect(elements.lintResults.innerHTML).toContain('귀하');
  });

  it('prevents default arrow-key behavior while switching tabs', () => {
    const panelA = createElement({ id: 'panel-a', classes: ['tab-panel', 'active'], queryMap: { 'mark.diff': [] } });
    const panelB = createElement({ id: 'panel-b', classes: ['tab-panel'], queryMap: { 'mark.diff': [] } });
    const tabA = createElement({
      id: 'tab-a',
      classes: ['tab-btn', 'active'],
      attributes: { 'aria-controls': 'panel-a', 'aria-selected': 'true' },
    });
    const tabB = createElement({
      id: 'tab-b',
      classes: ['tab-btn'],
      attributes: { 'aria-controls': 'panel-b', 'aria-selected': 'false' },
    });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      'tab-a': tabA,
      'tab-b': tabB,
      'panel-a': panelA,
      'panel-b': panelB,
      seminarOverlay: createElement({ id: 'seminarOverlay', queryMap: { 'mark.diff': [] } }),
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
    };
    const document = createDocument(elements, {
      '.tab-btn': [tabA, tabB],
      '.tab-panel': [panelA, panelB],
      '.pair': [],
    });
    const context = {
      document,
      window: {},
      localStorage: {
        setItem() {},
      },
      setTimeout(fn) {
        fn();
        return 1;
      },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    tabA.dispatch('keydown', { key: 'ArrowRight', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(tabB.focus).toHaveBeenCalled();
    expect(tabA.getAttribute('aria-selected')).toBe('false');
    expect(tabB.getAttribute('aria-selected')).toBe('true');
    expect(panelA.classList.contains('active')).toBe(false);
    expect(panelB.classList.contains('active')).toBe(true);
  });

  it('does not throw when seminar or lint result containers are missing', () => {
    const lintInput = createElement({ id: 'lintInput' });
    const lintClearBtn = createElement({ id: 'lintClearBtn' });
    const seminarBtn = createElement({ id: 'seminarBtn' });
    const tabA = createElement({
      id: 'tab-a',
      classes: ['tab-btn', 'active'],
      attributes: { 'aria-controls': 'panel-a', 'aria-selected': 'true' },
    });
    const panelA = createElement({ id: 'panel-a', classes: ['tab-panel', 'active'], queryMap: { 'mark.diff': [] } });
    const elements = {
      lintInput,
      lintClearBtn,
      seminarBtn,
      'panel-a': panelA,
      'tab-a': tabA,
    };
    const document = createDocument(elements, {
      '.tab-btn': [tabA],
      '.tab-panel': [panelA],
      '.pair': [],
    });
    const context = {
      document,
      window: {},
      localStorage: {
        setItem() {},
      },
      setTimeout(fn) {
        fn();
        return 1;
      },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(() => seminarBtn.dispatch('click')).not.toThrow();
    expect(() => lintClearBtn.dispatch('click')).not.toThrow();
    expect(() => document.dispatch('keydown', { key: 'Escape' })).not.toThrow();
  });

  it('does not open a blank seminar overlay when there are no before-after pairs to present', () => {
    const { context, elements, document } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.seminarBtn.dispatch('click');

    expect(elements.seminarOverlay.classList.contains('active')).toBe(false);
    expect(document.body.style.overflow).toBeUndefined();
    expect(elements.seminarClose.focus).not.toHaveBeenCalled();
  });

  it('traps keyboard focus inside the seminar dialog while it is open', () => {
    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      classes: ['active'],
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [
          seminarClose,
          seminarPrev,
          seminarNext,
        ],
        'mark.diff': [],
      },
    });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev,
      seminarNext,
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose,
    };
    const document = createDocument(elements, {
      '.tab-btn': [],
      '.tab-panel': [],
      '.pair': [],
    });
    const context = {
      document,
      window: {},
      localStorage: {
        setItem() {},
      },
      setTimeout(fn) {
        fn();
        return 1;
      },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    document.activeElement = seminarNext;
    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(seminarClose.focus).toHaveBeenCalled();
  });

  it('shows the clean-text success message when the lint engine returns no issues', () => {
    const { context, elements } = buildContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '신청이 완료되었습니다.';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('원칙 위반이 없습니다');
    expect(elements.lintResults.innerHTML).toContain('100');
  });

  it('shows the empty-input prompt when run is clicked with no text', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '  ';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('텍스트를 입력해 주세요.');
  });

  it('shows the engine-loading message when KRDSLint is not available in the context', () => {
    const { context, elements } = buildContext();
    delete context.KRDSLint;
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.classList.contains('visible')).toBe(true);
    expect(elements.lintResults.innerHTML).toContain('린팅 엔진을 불러오는 중입니다.');
  });

  it('applies the "bad" score class when the lint score is below 50', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 30,
        summary: { errors: 3, warnings: 0, infos: 0 },
        issues: [{ severity: 'error', category: '행정어', match: '귀하', message: '어려운 표현', suggestion: '신청인' }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.lintInput.value = '귀하의 신청이 완료되었습니다.';
    elements.lintRunBtn.dispatch('click');

    expect(elements.lintResults.innerHTML).toContain('lint-score-num bad');
    expect(elements.lintResults.innerHTML).toContain('>30<');
  });

  it('calls preventDefault and returns without focusing when the seminar overlay has no focusable elements', () => {
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      classes: ['active'],
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [],
        'mark.diff': [],
      },
    });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev: createElement({ id: 'seminarPrev' }),
      seminarNext: createElement({ id: 'seminarNext' }),
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose: createElement({ id: 'seminarClose' }),
    };
    const document = createDocument(elements, { '.tab-btn': [], '.tab-panel': [], '.pair': [] });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements.seminarClose.focus).not.toHaveBeenCalled();
    expect(elements.seminarNext.focus).not.toHaveBeenCalled();
  });

  it('wraps focus from the first to the last element on Shift+Tab when the first element is active', () => {
    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      classes: ['active'],
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [
          seminarClose,
          seminarPrev,
          seminarNext,
        ],
        'mark.diff': [],
      },
    });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev,
      seminarNext,
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose,
    };
    const document = createDocument(elements, { '.tab-btn': [], '.tab-panel': [], '.pair': [] });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    document.activeElement = seminarClose;
    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(seminarNext.focus).toHaveBeenCalled();
    expect(seminarClose.focus).not.toHaveBeenCalled();
  });

  it('wraps Tab forward to the first element when the active element is not in the focusable list', () => {
    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      classes: ['active'],
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [
          seminarClose,
          seminarPrev,
          seminarNext,
        ],
        'mark.diff': [],
      },
    });
    const outsideEl = createElement({ id: 'outsideEl' });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev,
      seminarNext,
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose,
    };
    const document = createDocument(elements, { '.tab-btn': [], '.tab-panel': [], '.pair': [] });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    document.activeElement = outsideEl;
    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(seminarClose.focus).toHaveBeenCalled();
    expect(seminarNext.focus).not.toHaveBeenCalled();
  });

  it('wraps Shift+Tab backward to the last element when the active element is not in the focusable list', () => {
    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      classes: ['active'],
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [
          seminarClose,
          seminarPrev,
          seminarNext,
        ],
        'mark.diff': [],
      },
    });
    const outsideEl = createElement({ id: 'outsideEl' });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev,
      seminarNext,
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose,
    };
    const document = createDocument(elements, { '.tab-btn': [], '.tab-panel': [], '.pair': [] });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    document.activeElement = outsideEl;
    const preventDefault = vi.fn();
    document.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(seminarNext.focus).toHaveBeenCalled();
    expect(seminarClose.focus).not.toHaveBeenCalled();
  });

  it('falls back to the raw principle code when the slide principle is not in PRINCIPLE_NAMES', () => {
    const baTextBefore = createElement({ id: 'ba-text-before' });
    baTextBefore.innerHTML = '이전 텍스트';
    const baTextAfter = createElement({ id: 'ba-text-after' });
    baTextAfter.innerHTML = '이후 텍스트';

    const pairElement = {
      getAttribute(name) {
        if (name === 'data-context') return '테스트 상황';
        if (name === 'data-principle') return 'D';
        return null;
      },
      querySelector(selector) {
        if (selector === '.ba-card.before .ba-text') return baTextBefore;
        if (selector === '.ba-card.after .ba-text') return baTextAfter;
        return null;
      },
    };

    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarSlide = createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } });
    const seminarPrinciple = createElement({ id: 'seminarPrinciple' });
    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [],
        'mark.diff': [],
      },
    });
    const seminarBtn = createElement({ id: 'seminarBtn' });

    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide,
      seminarPrinciple,
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev: createElement({ id: 'seminarPrev' }),
      seminarNext: createElement({ id: 'seminarNext' }),
      seminarBtn,
      seminarClose,
    };
    const document = createDocument(elements, {
      '.tab-btn': [],
      '.tab-panel': [],
      '.pair': [pairElement],
    });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    seminarBtn.dispatch('click');

    expect(seminarPrinciple.textContent).toContain('D — D');
  });

  it('advances to the next slide when ArrowDown is pressed and returns to the previous slide when ArrowUp is pressed', () => {
    const makePair = (ctx, principle) => {
      const beforeEl = { innerHTML: '<p>before</p>' };
      const afterEl = { innerHTML: '<p>after</p>' };
      return {
        getAttribute(name) {
          if (name === 'data-context') return ctx;
          if (name === 'data-principle') return principle;
          return null;
        },
        querySelector(selector) {
          if (selector === '.ba-card.before .ba-text') return beforeEl;
          if (selector === '.ba-card.after .ba-text') return afterEl;
          return null;
        },
      };
    };

    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [],
        'mark.diff': [],
      },
    });
    const seminarCounter = createElement({ id: 'seminarCounter' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const seminarClose = createElement({ id: 'seminarClose' });
    const seminarBtn = createElement({ id: 'seminarBtn' });

    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter,
      seminarPrev,
      seminarNext,
      seminarBtn,
      seminarClose,
      'panel-a': createElement({ id: 'panel-a', classes: ['tab-panel', 'active'], queryMap: { 'mark.diff': [] } }),
    };

    const document = createDocument(elements, {
      '.tab-btn': [],
      '.tab-panel': [],
      '.pair': [makePair('상황 A', 'A'), makePair('상황 B', 'B')],
    });

    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    seminarBtn.dispatch('click');
    expect(seminarCounter.textContent).toBe('1 / 2');

    document.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('2 / 2');

    document.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('1 / 2');
  });

  it('does not advance past the last slide when ArrowDown is pressed at the final slide', () => {
    const makePair = (ctx, principle) => ({
      getAttribute(name) {
        if (name === 'data-context') return ctx;
        if (name === 'data-principle') return principle;
        return null;
      },
      querySelector(selector) {
        if (selector === '.ba-card.before .ba-text') return { innerHTML: '<p>before</p>' };
        if (selector === '.ba-card.after .ba-text') return { innerHTML: '<p>after</p>' };
        return null;
      },
    });

    const seminarOverlay = createElement({
      id: 'seminarOverlay',
      queryMap: {
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])': [],
        'mark.diff': [],
      },
    });
    const seminarCounter = createElement({ id: 'seminarCounter' });
    const seminarPrev = createElement({ id: 'seminarPrev' });
    const seminarNext = createElement({ id: 'seminarNext' });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay,
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter,
      seminarPrev,
      seminarNext,
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose: createElement({ id: 'seminarClose' }),
      'panel-a': createElement({ id: 'panel-a', classes: ['tab-panel', 'active'], queryMap: { 'mark.diff': [] } }),
    };
    const document = createDocument(elements, {
      '.tab-btn': [],
      '.tab-panel': [],
      '.pair': [makePair('A', 'A'), makePair('B', 'B')],
    });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    elements.seminarBtn.dispatch('click');
    expect(seminarCounter.textContent).toBe('1 / 2');

    document.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('2 / 2');

    document.dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('2 / 2');

    document.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('1 / 2');

    document.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(seminarCounter.textContent).toBe('1 / 2');
  });

  it('does not call setTimeout for the initial mark animation when panel-a is absent from the DOM', () => {
    const setTimeoutSpy = vi.fn();
    const tabA = createElement({
      id: 'tab-a',
      classes: ['tab-btn', 'active'],
      attributes: { 'aria-controls': 'panel-a', 'aria-selected': 'true' },
    });
    const elements = {
      themeToggle: createElement({ id: 'themeToggle' }),
      themeIcon: createElement({ id: 'themeIcon' }),
      seminarOverlay: createElement({ id: 'seminarOverlay', queryMap: { 'mark.diff': [] } }),
      seminarSlide: createElement({ id: 'seminarSlide', queryMap: { 'mark.diff': [] } }),
      seminarPrinciple: createElement({ id: 'seminarPrinciple' }),
      seminarCounter: createElement({ id: 'seminarCounter' }),
      seminarPrev: createElement({ id: 'seminarPrev' }),
      seminarNext: createElement({ id: 'seminarNext' }),
      seminarBtn: createElement({ id: 'seminarBtn' }),
      seminarClose: createElement({ id: 'seminarClose' }),
      'tab-a': tabA,
    };
    const document = createDocument(elements, { '.tab-btn': [tabA], '.tab-panel': [], '.pair': [] });
    const context = {
      document,
      window: {},
      localStorage: { setItem() {} },
      setTimeout: setTimeoutSpy,
      clearTimeout() {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
