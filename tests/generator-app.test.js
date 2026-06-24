import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'generator/app.js'), 'utf8');

function createClassList() {
  const classes = new Set();
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
    value: options.value || '',
    textContent: options.textContent || '',
    innerHTML: options.innerHTML || '',
    disabled: !!options.disabled,
    hidden: !!options.hidden,
    dataset: options.dataset || {},
    style: options.style || {},
    classList: createClassList(),
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
        target: element,
        currentTarget: element,
        ...event,
      }));
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    focus: vi.fn(),
    select: vi.fn(),
    click() {
      element.dispatch('click');
    },
    querySelector(selector) {
      if (selector === '.dl-menu-item') return options.menuItems ? options.menuItems[0] || null : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.dl-menu-item') return options.menuItems || [];
      return [];
    },
    closest(selector) {
      if (selector === '.dl-menu-item' && element.classList.contains('dl-menu-item')) return element;
      if (selector === '.dl-btn-group' && options.inDownloadGroup) return options.downloadGroup || null;
      return null;
    },
  };

  if (options.classes) {
    options.classes.forEach((value) => element.classList.add(value));
  }

  return element;
}

function buildGeneratorContext({ fetchImpl, menuItems, manualTimers = false } = {}) {
  const screens = [
    createElement({ classes: ['screen', 'active'] }),
    createElement({ classes: ['screen'] }),
    createElement({ classes: ['screen'] }),
  ];

  const dlMenuItems = menuItems || [
    createElement({ dataset: { format: 'html' }, classes: ['dl-menu-item'] }),
    createElement({ dataset: { format: 'hwp' }, classes: ['dl-menu-item'] }),
  ];

  const elements = {
    'generator-form': createElement(),
    'submit-btn': createElement({ disabled: true }),
    'page-subtitle': createElement(),
    'generator-mode': createElement({ value: 'guide-draft' }),
    'mode-help': createElement(),
    'agency-name': createElement({ value: '테스트 기관' }),
    'agency-type': createElement({ value: '지방자치단체' }),
    'screen-type': createElement(),
    'tone-target': createElement(),
    'tone-target-group': createElement({ style: {} }),
    'task-brief': createElement(),
    'task-brief-help': createElement(),
    'samples-legend': createElement(),
    'samples-help': createElement(),
    'sample-1-label': createElement(),
    'sample-2-label': createElement(),
    'sample-3-label': createElement(),
    'sample-1': createElement({ value: '첫 번째 문장' }),
    'sample-2': createElement(),
    'sample-3': createElement(),
    'form-alert': createElement(),
    'stream-output': createElement(),
    'generating-status': createElement(),
    'generating-error': createElement(),
    'fallback-area': createElement({ style: { display: 'none' } }),
    'cancel-btn': createElement({ textContent: '취소하기' }),
    'fallback-btn': createElement(),
    'output-title': createElement(),
    'output-content': createElement(),
    'quality-review': createElement({ hidden: true }),
    'quality-score': createElement(),
    'quality-errors': createElement(),
    'quality-warnings': createElement(),
    'quality-infos': createElement(),
    'quality-gates': createElement(),
    'quality-issues-list': createElement(),
    'quality-empty': createElement({ hidden: true }),
    'usage-guide': createElement(),
    'copy-md-btn': createElement({ textContent: '텍스트 복사' }),
    'download-btn': createElement(),
    'restart-btn': createElement(),
    'download-error': createElement(),
    'dl-chevron': createElement({ attributes: { 'aria-expanded': 'false' } }),
    'dl-menu': createElement({ menuItems: dlMenuItems }),
    'agency-name-error': createElement(),
    'agency-type-error': createElement(),
    'sample-1-error': createElement(),
    'screen-input': screens[0],
    'screen-generating': screens[1],
    'screen-output': screens[2],
  };

  const documentListeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const document = {
    body: {
      style: {},
      appendChild() {},
      removeChild() {},
    },
    documentElement: {
      setAttribute() {},
      getAttribute() { return 'light'; },
    },
    activeElement: null,
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.screen') return screens;
      return [];
    },
    querySelector(selector) {
      if (selector === '.has-error') return null;
      return null;
    },
    addEventListener(type, handler) {
      const arr = documentListeners.get(type) || [];
      arr.push(handler);
      documentListeners.set(type, arr);
    },
    createElement() {
      return createElement();
    },
  };

  const context = {
    document,
    window: {
      scrollTo() {},
    },
    navigator: {},
    fetch: fetchImpl || vi.fn(),
    AbortController,
    TextDecoder,
    Blob,
    URL,
    Array,
    JSON,
    console,
    setTimeout(fn, delay) {
      if (manualTimers) {
        const id = nextTimerId++;
        timers.set(id, { fn, delay });
        return id;
      }
      if (delay <= 50) fn();
      return delay;
    },
    clearTimeout(id) {
      if (manualTimers) timers.delete(id);
    },
    globalThis: null,
  };
  context.globalThis = context;

  return { context, elements, screens, timers };
}

describe('generator/app.js', () => {
  it('does not crash when the generator DOM is incomplete', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelectorAll() { return []; },
      },
      window: { scrollTo() {} },
      Array,
      JSON,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('shows the partial output when the SSE stream ends without an explicit done event', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 테스트 기관 가이드"}'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-title'].textContent).toBe('테스트 기관 UX Writing 가이드라인');
    expect(elements['output-content'].innerHTML).toContain('# 테스트 기관 가이드');
    expect(elements['stream-output'].getAttribute('aria-busy')).toBe('false');
  });

  it('accepts SSE data lines without a space after the colon in the generator UI', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data:{"type":"chunk","text":"# 테스트 기관 가이드"}\n'),
            encoder.encode('data:{"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-title'].textContent).toBe('테스트 기관 UX Writing 가이드라인');
    expect(elements['output-content'].innerHTML).toContain('# 테스트 기관 가이드');
    expect(elements['stream-output'].getAttribute('aria-busy')).toBe('false');
  });

  it('shows the generating-error message when the SSE stream sends a type:error event', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 진행 중"}\n'),
            encoder.encode('data: {"type":"error","message":"업스트림 오류가 발생했습니다."}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[1].classList.contains('active')).toBe(true);
    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toBe('업스트림 오류가 발생했습니다.');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('sends mode and optional context fields and updates the output title for derivative guides', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async (url, options) => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 테스트 기관 Layer 3 파생 가이드 초안"}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-mode'].value = 'derivative-guide';
    elements['screen-type'].value = '에러/경고';
    elements['task-brief'].value = '로그인과 신청 흐름을 우선 반영해 주세요.';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.mode).toBe('derivative-guide');
    expect(requestBody.screenType).toBe('에러/경고');
    expect(requestBody.taskBrief).toBe('로그인과 신청 흐름을 우선 반영해 주세요.');
    expect(elements['output-title'].textContent).toBe('테스트 기관 Layer 3 파생 가이드 초안');
  });

  it('renders an automatic KRDS quality review when the lint engine is available', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 94,
        summary: { total: 1, errors: 0, warnings: 1, infos: 0 },
        issues: [
          {
            type: 'subjective-adverb',
            category: '주관적 부사',
            message: '주관적 부사 "빠르게" — 수치 또는 구체적 사실로 대체하세요.',
            suggestion: '→ "3영업일 이내"처럼 구체화',
          },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');

    expect(elements['quality-review'].hidden).toBe(false);
    expect(elements['quality-score'].textContent).toBe('94');
    expect(elements['quality-gates'].innerHTML).toContain('무번역');
    expect(elements['quality-issues-list'].innerHTML).toContain('주관적 부사');
  });

  it('returns focus to the format toggle after a menu item is activated', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const hwpItem = elements['dl-menu'].querySelectorAll('.dl-menu-item')[1];
    elements['dl-menu'].dispatch('click', { target: hwpItem });

    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
    expect(elements['dl-chevron'].focus).toHaveBeenCalledTimes(1);
    expect(elements['download-error'].classList.contains('visible')).toBe(true);
  });

  it('closes the format menu and moves focus out on Tab navigation', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    const firstItem = elements['dl-menu'].querySelectorAll('.dl-menu-item')[0];
    context.document.activeElement = firstItem;

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Tab', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
    expect(elements['restart-btn'].focus).toHaveBeenCalled();

    elements['dl-chevron'].dispatch('click');
    context.document.activeElement = firstItem;
    const shiftPreventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: shiftPreventDefault });

    expect(shiftPreventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].focus).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when clipboard.writeText is unavailable during markdown copy', () => {
    const { context, elements } = buildGeneratorContext();
    context.navigator.clipboard = {};
    context.document.execCommand = vi.fn(() => false);

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');

    expect(() => elements['copy-md-btn'].dispatch('click')).not.toThrow();
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
    expect(elements['copy-md-btn'].textContent).toBe('❌ 복사 실패');
  });

  it('falls back to plaintext when markdownit is available but DOMPurify is absent', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 마크다운 헤딩"}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    context.markdownit = function () {
      return { render: (text) => '<h1>' + text.trim() + '</h1>' };
    };

    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-content'].innerHTML).toContain('마크다운 헤딩');
  });

  it('sanitizes rendered markdown through DOMPurify when both markdownit and DOMPurify are available', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"## 섹션"}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    const sanitizeMock = vi.fn((html) => '<sanitized>' + html + '</sanitized>');
    context.markdownit = function () {
      return { render: (text) => '<h2>' + text.trim() + '</h2>' };
    };
    context.DOMPurify = { sanitize: sanitizeMock };

    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(sanitizeMock).toHaveBeenCalled();
    expect(elements['output-content'].innerHTML).toContain('<sanitized>');
  });

  it('shows a readable error message when HTML download fails', () => {
    const { context, elements } = buildGeneratorContext();
    context.URL = {
      revokeObjectURL() {},
    };

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');
    expect(() => elements['download-btn'].dispatch('click')).not.toThrow();

    expect(elements['download-error'].classList.contains('visible')).toBe(true);
    expect(elements['download-error'].textContent).toBe('HTML 다운로드에 실패했습니다. 다시 시도해 주세요.');
  });

  it('keeps the latest copy feedback visible when the copy button is pressed repeatedly', async () => {
    const { context, elements, timers } = buildGeneratorContext({ manualTimers: true });
    context.navigator.clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
    };

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');
    [...timers.entries()]
      .filter(([, timer]) => timer.delay === 50)
      .forEach(([id]) => timers.delete(id));

    elements['copy-md-btn'].dispatch('click');
    await Promise.resolve();

    const firstResetTimerId = [...timers.entries()].find(([, timer]) => timer.delay === 2000)?.[0];
    expect(firstResetTimerId).toBeDefined();
    expect(elements['copy-md-btn'].textContent).toBe('✅ 복사됨');

    elements['copy-md-btn'].dispatch('click');
    await Promise.resolve();

    const staleResetTimer = timers.get(firstResetTimerId);
    if (staleResetTimer) {
      timers.delete(firstResetTimerId);
      staleResetTimer.fn();
    }

    expect(elements['copy-md-btn'].textContent).toBe('✅ 복사됨');

    const latestResetTimer = [...timers.entries()].find(([, timer]) => timer.delay === 2000);
    expect(latestResetTimer).toBeDefined();
    latestResetTimer[1].fn();

    expect(elements['copy-md-btn'].textContent).toBe('텍스트 복사');
  });

  it('keeps the latest successful markdown-copy feedback when an older async copy fails later', async () => {
    let settleFirst;
    let callCount = 0;
    const { context, elements } = buildGeneratorContext({ manualTimers: true });
    context.navigator.clipboard = {
      writeText: vi.fn(() => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise((resolve, reject) => {
            settleFirst = { resolve, reject };
          });
        }
        return Promise.resolve();
      }),
    };
    context.document.execCommand = vi.fn(() => false);

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');
    elements['copy-md-btn'].dispatch('click');
    elements['copy-md-btn'].dispatch('click');
    await Promise.resolve();

    expect(elements['copy-md-btn'].textContent).toBe('✅ 복사됨');

    settleFirst.reject(new Error('denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(elements['copy-md-btn'].textContent).toBe('✅ 복사됨');
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('ignores stale stream completions after a cancelled request is followed by a new generation', async () => {
    const encoder = new TextEncoder();
    let staleResolve;
    let requestCount = 0;
    const fetchImpl = vi.fn(async (url, options) => {
      requestCount += 1;
      if (requestCount === 1) {
        let readCount = 0;
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                read() {
                  if (readCount === 0) {
                    readCount += 1;
                    return new Promise((resolve) => {
                      staleResolve = resolve;
                    });
                  }
                  return Promise.resolve({ done: true, value: undefined });
                },
              };
            },
          },
        };
      }

      const chunks = [
        encoder.encode('data: {"type":"chunk","text":"# 최신 가이드"}\n'),
        encoder.encode('data: {"type":"done"}\n'),
      ];
      let index = 0;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              async read() {
                if (index < chunks.length) {
                  return { done: false, value: chunks[index++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      };
    });

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(typeof staleResolve).toBe('function');

    elements['cancel-btn'].dispatch('click');
    expect(screens[0].classList.contains('active')).toBe(true);

    elements['agency-name'].value = '두 번째 기관';
    elements['sample-1'].value = '두 번째 샘플';
    elements['generator-form'].dispatch('submit');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-title'].textContent).toBe('두 번째 기관 UX Writing 가이드라인');
    expect(elements['output-content'].innerHTML).toContain('# 최신 가이드');

    staleResolve({
      done: false,
      value: encoder.encode('data: {"type":"chunk","text":"# 오래된 가이드"}\n' +
        'data: {"type":"done"}\n'),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['output-title'].textContent).toBe('두 번째 기관 UX Writing 가이드라인');
    expect(elements['output-content'].innerHTML).toContain('# 최신 가이드');
    expect(elements['output-content'].innerHTML).not.toContain('# 오래된 가이드');
  });

  it('keeps the current run marked busy when a cancelled earlier stream fails later', async () => {
    let staleReject;
    let requestCount = 0;
    const fetchImpl = vi.fn(async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                read() {
                  return new Promise((resolve, reject) => {
                    staleReject = reject;
                  });
                },
              };
            },
          },
        };
      }

      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              read() {
                return new Promise(() => {});
              },
            };
          },
        },
      };
    });

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(typeof staleReject).toBe('function');

    elements['cancel-btn'].dispatch('click');
    elements['agency-name'].value = '두 번째 기관';
    elements['sample-1'].value = '두 번째 샘플';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(screens[1].classList.contains('active')).toBe(true);
    expect(elements['stream-output'].getAttribute('aria-busy')).toBe('true');

    staleReject(new Error('stale stream disconnected'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[1].classList.contains('active')).toBe(true);
    expect(elements['stream-output'].getAttribute('aria-busy')).toBe('true');
    expect(elements['generating-error'].classList.contains('visible')).toBe(false);
  });

  it('does not restore focus to the hidden output title after restarting before the delayed focus timer fires', () => {
    const { context, elements, screens, timers } = buildGeneratorContext({ manualTimers: true });
    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');

    const outputFocusTimerId = [...timers.entries()].find(([, timer]) => timer.delay === 50)?.[0];
    expect(outputFocusTimerId).toBeDefined();
    expect(screens[2].classList.contains('active')).toBe(true);

    elements['restart-btn'].dispatch('click');
    expect(screens[0].classList.contains('active')).toBe(true);

    const staleFocusTimer = timers.get(outputFocusTimerId);
    if (staleFocusTimer) {
      timers.delete(outputFocusTimerId);
      staleFocusTimer.fn();
    }

    expect(elements['output-title'].focus).not.toHaveBeenCalled();
    expect(screens[0].classList.contains('active')).toBe(true);
  });

  it('does not crash when the format menu has no items to focus', () => {
    const { context, elements } = buildGeneratorContext({ menuItems: [] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    expect(() => {
      elements['dl-menu'].dispatch('keydown', { key: 'ArrowDown', preventDefault: vi.fn() });
    }).not.toThrow();

    const tabPreventDefault = vi.fn();
    expect(() => {
      elements['dl-menu'].dispatch('keydown', { key: 'Tab', preventDefault: tabPreventDefault });
    }).not.toThrow();
    expect(tabPreventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['restart-btn'].focus).toHaveBeenCalledTimes(1);
  });

  it('uses the site-root API path when the base-path helper is available under a custom preview subpath', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      async json() {
        return { error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.' };
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.window.KRDSBasePath = {
      buildSitePath: vi.fn((pathname) => '/preview/KRDS' + pathname),
    };

    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/preview/KRDS/api/generate');
    expect(context.window.KRDSBasePath.buildSitePath).toHaveBeenCalledWith('/api/generate');
  });

  it('renders quality-gate--warn class when a gate has 주의 status', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 85,
        summary: { total: 2, errors: 0, warnings: 2, infos: 0 },
        issues: [
          { type: 'double-passive', category: '이중피동', message: '이중피동 표현', suggestion: '단순형으로 수정' },
          { type: 'subjective-adverb', category: '주관적 부사', message: '빠르게', suggestion: '구체적 수치 사용' },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--warn');
  });

  it('renders quality-gate--fail class when a gate has 보완 필요 status', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 60,
        summary: { total: 5, errors: 3, warnings: 2, infos: 0 },
        issues: [
          { type: 'admin-jargon', category: '행정어', message: '접수하다', suggestion: '제출하다' },
          { type: 'admin-jargon', category: '행정어', message: '시행하다', suggestion: '실시하다' },
          { type: 'admin-jargon', category: '행정어', message: '검토하다', suggestion: '살펴보다' },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--fail');
  });

  it('shows the quality-empty fallback message when the lint engine is unavailable', () => {
    const { context, elements } = buildGeneratorContext();

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['quality-review'].hidden).toBe(false);
    expect(elements['quality-gates'].innerHTML).toContain('자동 검수 엔진을 불러오지 못했습니다');
  });

  it('renders quality-gate--pass class when all issues are zero and the output is clean', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--pass');
    expect(html).not.toContain('quality-gate--fail');
    expect(html).not.toContain('quality-gate--warn');
  });

  it('shows a lint-calculation error message in quality-gates when the lint engine throws', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => {
        throw new Error('lint engine internal error');
      }),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['quality-review'].hidden).toBe(false);
    expect(elements['quality-gates'].innerHTML).toContain('자동 검수 계산 중 오류가 발생했습니다');
  });

  it('shows rate-limit error message and fallback area when the server returns 429', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 429,
      async json() { return { error: '요청 한도를 초과했습니다.' }; },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toMatch(/1시간/);
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('shows the server error body message when the server returns a 400 with an error field', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      async json() { return { error: '기관명은 1~50자 사이여야 합니다.' }; },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('기관명은 1~50자');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('blocks form submission and marks agency-name field when the name exceeds 50 characters', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });

    vm.runInNewContext(SOURCE, context);

    elements['agency-name'].value = 'a'.repeat(51);
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(elements['agency-name'].classList.contains('has-error')).toBe(true);
  });

  it('blocks form submission and marks sample-1 field when the first sample is empty', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });

    vm.runInNewContext(SOURCE, context);

    elements['sample-1'].value = '';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(elements['sample-1'].classList.contains('has-error')).toBe(true);
  });

  it('strips code fences, 🚫 lines, and sample headers before passing text to the lint engine', async () => {
    const markdown = [
      '샘플 텍스트 1: 이 줄은 제거됩니다',
      '🚫 현재: 이 줄도 제거됩니다',
      '```',
      '코드 블록 내용은 제거됩니다',
      '```',
      '✅ 개선: 이 문장은 포함됩니다',
      '일반 문장도 포함됩니다',
    ].join('\n');

    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: markdown }) + '\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    let lintInput = null;
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = {
      lint: vi.fn((text) => {
        lintInput = text;
        return { score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] };
      }),
    };

    vm.runInNewContext(SOURCE, context);
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.KRDSLint.lint).toHaveBeenCalled();
    expect(lintInput).not.toContain('샘플 텍스트 1');
    expect(lintInput).not.toContain('🚫');
    expect(lintInput).not.toContain('코드 블록 내용');
    expect(lintInput).toContain('이 문장은 포함됩니다');
    expect(lintInput).toContain('일반 문장도 포함됩니다');
  });

  it('shows 심리적 안전망 주의 when safety issues are absent but text has no action or structure cues', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"무번역 원칙을 적용합니다."}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--warn');
    expect(html).not.toContain('quality-gate--fail');
  });

  it('shows 보이스·톤 주의 when exactly one voice-type issue is present with no emoji in text', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 90,
        summary: { total: 1, errors: 0, warnings: 1, infos: 0 },
        issues: [
          { type: 'excessive-honorific', category: '과잉 존칭', message: '처리되시겠습니다', suggestion: '→ 처리됩니다' },
        ],
      })),
    };
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--warn');
    expect(html).not.toContain('quality-gate--fail');
  });

  it('silently skips malformed JSON SSE lines and completes normally on the subsequent done event', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 가이드"}\n'),
            encoder.encode('data: {not valid json}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-content'].innerHTML).toContain('# 가이드');
  });

  it('ignores unknown SSE event types and continues streaming', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 결과"}\n'),
            encoder.encode('data: {"type":"ping"}\n'),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements, screens } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-content'].innerHTML).toContain('# 결과');
  });

  it('shows 정보핵심화 주의 when there is exactly one distillation issue and no long sentences', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 88,
        summary: { total: 1, errors: 0, warnings: 1, infos: 0 },
        issues: [
          { type: 'double-passive', category: '이중피동', message: '이중피동', suggestion: '단순형으로' },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--warn');
    expect(html).not.toContain('quality-gate--fail');
  });

  it('shows 정보핵심화 보완 필요 when there are more than two distillation issues', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 60,
        summary: { total: 3, errors: 0, warnings: 3, infos: 0 },
        issues: [
          { type: 'double-passive', category: '이중피동', message: 'm1', suggestion: 's1' },
          { type: 'subjective-adverb', category: '주관적부사', message: 'm2', suggestion: 's2' },
          { type: 'noun-chain', category: '명사체인', message: 'm3', suggestion: 's3' },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--fail');
  });

  it('shows 보이스·톤 보완 필요 when more than one voice-type issue is detected', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 75,
        summary: { total: 2, errors: 0, warnings: 2, infos: 0 },
        issues: [
          { type: 'excessive-honorific', category: '과잉존칭', message: 'm1', suggestion: 's1' },
          { type: 'excessive-honorific', category: '과잉존칭', message: 'm2', suggestion: 's2' },
        ],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--fail');
  });

  it('uses the rewrite fallback template when the generator mode is set to rewrite', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'rewrite';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['output-title'].textContent).toContain('재작성안');
  });

  it('uses the message-pack fallback template when the generator mode is set to message-pack', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'message-pack';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['output-title'].textContent).toContain('상태 메시지 개선안');
  });

  it('uses the tone-adjust fallback template when the generator mode is set to tone-adjust', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'tone-adjust';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['output-title'].textContent).toContain('톤 조정안');
  });

  it('uses the derivative-guide fallback template when the generator mode is set to derivative-guide', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'derivative-guide';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['output-title'].textContent).toContain('파생 가이드');
  });

  it('uses the generic guide-draft fallback template for unrecognized mode strings', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'unknown-mode-xyz';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['output-content'].innerHTML).toContain('무번역 원칙');
  });

  it('shows 심리적 안전망 통과 when mode is rewrite even if text has no action or structure cues', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    elements['generator-mode'].value = 'rewrite';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--pass');
    expect(html).not.toContain('quality-gate--warn');
    expect(html).not.toContain('quality-gate--fail');
  });

  it('flags 정보핵심화 as 주의 when the reviewed text contains one long sentence and no pattern issues', async () => {
    const longLine = 'a'.repeat(80);
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode(`data: {"type":"chunk","text":"${longLine}"}\n`),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--warn');
    expect(context.KRDSLint.lint).toHaveBeenCalled();
  });

  it('flags 정보핵심화 as 보완 필요 when the reviewed text has more than one long sentence', async () => {
    const longLine = 'a'.repeat(80);
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode(`data: {"type":"chunk","text":"${longLine}\\n${longLine}"}\n`),
            encoder.encode('data: {"type":"done"}\n'),
          ];
          let index = 0;
          return {
            async read() {
              if (index < chunks.length) return { done: false, value: chunks[index++] };
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('quality-gate--fail');
  });
});
