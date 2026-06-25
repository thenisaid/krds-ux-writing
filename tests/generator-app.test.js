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
      handlers.forEach((handler) => handler.call(element, {
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

  it('shows the generic error fallback text when a type:error SSE event has no message field', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"error"}\n'),
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
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('가이드라인 생성 중 오류가 발생했습니다');
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

  it('skips focus when the output-screen element is absent when the delayed focus timer fires', () => {
    const { context, elements, timers } = buildGeneratorContext({ manualTimers: true });
    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');

    // Remove the screen-output element so getElementById returns null inside the timer
    delete elements['screen-output'];

    // Fire the 50ms focus timer
    const focusTimer = [...timers.entries()].find(([, t]) => t.delay === 50);
    expect(focusTimer).toBeDefined();
    focusTimer[1].fn();

    expect(elements['output-title'].focus).not.toHaveBeenCalled();
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

  it('shows a generic server-error message with the status code when the upstream returns a 5xx response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      async json() { return {}; },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('503');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('shows the fallback input-check message when a 400 response body cannot be parsed as JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      async json() { throw new Error('not json'); },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('입력값을 확인해 주세요');
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

  it('clears the agency-name error class when the user types in the field after a validation failure', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['agency-name'].value = 'a'.repeat(51);
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(elements['agency-name'].classList.contains('has-error')).toBe(true);

    elements['agency-name'].value = '테스트 기관';
    elements['agency-name'].dispatch('input');
    expect(elements['agency-name'].classList.contains('has-error')).toBe(false);
  });

  it('does not crash when the error-message element is absent from the DOM during field validation', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    // Remove error message elements so setFieldError's !msg guard fires
    delete elements['agency-name-error'];
    delete elements['sample-1-error'];

    vm.runInNewContext(SOURCE, context);

    elements['agency-name'].value = '';
    expect(() => elements['generator-form'].dispatch('submit')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls focus on the first invalid field when document.querySelector returns a has-error element', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    const focusMock = vi.fn();
    context.document.querySelector = (selector) => {
      if (selector === '.has-error') return { focus: focusMock };
      return null;
    };

    vm.runInNewContext(SOURCE, context);

    elements['agency-name'].value = '';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalledTimes(1);
  });

  it('silently skips an SSE data line that parses to a JSON null value', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: null\n'),
            encoder.encode('data: {"type":"chunk","text":"결과"}\n'),
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-content'].innerHTML).toContain('결과');
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

  it('silently skips valid-JSON null SSE payloads and completes normally on the subsequent done event', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: {"type":"chunk","text":"# 가이드"}\n'),
            encoder.encode('data: null\n'),
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

  it('shows 보이스·톤 보완 필요 when emoji characters appear in the reviewed text', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 90,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };

    vm.runInNewContext(SOURCE, context);

    // fallback-btn generates markdown without emojis; trigger via custom stream with emoji
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: '## 안내\n감사합니다 😊 이용해 주세요.' }) + '\n'),
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

    const { context: ctx2, elements: els2 } = buildGeneratorContext({ fetchImpl });
    ctx2.KRDSLint = {
      lint: vi.fn(() => ({
        score: 90,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };

    vm.runInNewContext(SOURCE, ctx2);
    els2['generator-form'].dispatch('submit');

    return new Promise((resolve) => {
      setTimeout(async () => {
        await new Promise((r) => setTimeout(r, 0));
        const html = els2['quality-gates'].innerHTML;
        const hasWarnOrFail = html.includes('quality-gate--warn') || html.includes('quality-gate--fail');
        expect(hasWarnOrFail).toBe(true);
        resolve();
      }, 0);
    });
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

  it('renders 심리적 안전망 as 주의 when safetyCount is 0 but text has no action/structure cues and mode is derivative-guide', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    elements['generator-mode'].value = 'derivative-guide';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    // 심리적 안전망 is 주의 (no safety errors, but no action/structure cue and mode ≠ rewrite/tone-adjust)
    expect(html).toContain('quality-gate--warn');
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

  it('shows a stream-incomplete error when the SSE stream ends without any chunks or a done event', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              return { done: true, value: undefined };
            },
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('응답을 끝까지 받지 못했습니다');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('shows a stream-unavailable error when the successful response has no readable body', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: null,
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('응답 스트림을 읽을 수 없습니다');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('shows a network error message when the fetch itself throws a non-abort error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('네트워크 오류');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('shows a disconnection error message when the response stream reader throws a non-abort error', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              throw new Error('socket hang up');
            },
            cancel: vi.fn(),
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('연결이 끊겼습니다');
    expect(elements['fallback-area'].style.display).toBe('block');
  });

  it('includes s2 and s3 sample texts in the request body when the user has filled them in', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [encoder.encode('data: {"type":"done"}\n')];
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
    vm.runInNewContext(SOURCE, context);

    elements['sample-2'].value = '두 번째 샘플 문장';
    elements['sample-3'].value = '세 번째 샘플 문장';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.samples).toContain('두 번째 샘플 문장');
    expect(requestBody.samples).toContain('세 번째 샘플 문장');
  });

  it('does not throw when the copy button is clicked before any content has been generated', () => {
    const { context, elements } = buildGeneratorContext();
    context.navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };
    vm.runInNewContext(SOURCE, context);

    expect(() => elements['copy-md-btn'].dispatch('click')).not.toThrow();
    expect(context.navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows the fallback empty message when the lint engine is available but markdown produces no reviewable text', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({ score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] })),
    };

    vm.runInNewContext(SOURCE, context);

    // Trigger fallback with markdown that is entirely code — extractReviewText returns ''
    elements['generator-mode'].value = 'rewrite';
    // Directly set currentMarkdown to all-code-block content by overriding showOutput indirectly:
    // use fallback-btn which passes getFallbackMarkdown() — but the rewrite template has real text.
    // Instead, simulate via quality-gate rendering with empty reviewText:
    // We override the output element and call renderQualityReview with code-only markdown.
    // The easiest path: set output-content innerHTML to a code-block-only string then trigger a
    // stream-done event with that content via a stub fetch.
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: '```\n코드만 있는 내용\n```' }) + '\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
          ];
          let index = 0;
          return { async read() { if (index < chunks.length) return { done: false, value: chunks[index++] }; return { done: true, value: undefined }; } };
        },
      },
    }));

    const { context: ctx2, elements: els2 } = buildGeneratorContext({ fetchImpl });
    ctx2.KRDSLint = context.KRDSLint;
    vm.runInNewContext(SOURCE, ctx2);
    els2['generator-form'].dispatch('submit');

    return new Promise((resolve) => {
      setTimeout(async () => {
        await new Promise((r) => setTimeout(r, 0));
        expect(els2['quality-gates'].innerHTML).toContain('자동 검수 엔진을 불러오지 못했습니다');
        expect(ctx2.KRDSLint.lint).not.toHaveBeenCalled();
        resolve();
      }, 0);
    });
  });

  it('extracts table cell content and skips the first column when the first cell is a source marker', () => {
    const { context, elements } = buildGeneratorContext();
    let lintInput = null;
    context.KRDSLint = {
      lint: vi.fn((text) => {
        lintInput = text;
        return { score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] };
      }),
    };

    const markdown = [
      '| 현재 표현 | 권장 문안 | 원칙 |',
      '|---|---|---|',
      '| 처리되시겠습니다 | 처리됩니다 | 보이스·톤 |',
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
          return { async read() { if (index < chunks.length) return { done: false, value: chunks[index++] }; return { done: true, value: undefined }; } };
        },
      },
    }));

    const { context: ctx2, elements: els2 } = buildGeneratorContext({ fetchImpl });
    ctx2.KRDSLint = context.KRDSLint;
    vm.runInNewContext(SOURCE, ctx2);
    els2['generator-form'].dispatch('submit');

    return new Promise((resolve) => {
      setTimeout(async () => {
        await new Promise((r) => setTimeout(r, 0));
        expect(ctx2.KRDSLint.lint).toHaveBeenCalled();
        // header row separator |---|---|---| is skipped; first row: "현재 표현" → skips first cell
        // data row: first cell "처리되시겠습니다" is NOT "현재/원문/문제/before" → ≥3 cells → skip first
        expect(lintInput).toContain('처리됩니다');
        expect(lintInput).not.toContain('현재 표현');
        expect(lintInput).not.toContain('처리되시겠습니다');
        resolve();
      }, 0);
    });
  });

  it('uses issue.type as the category label when the category field is absent from a lint issue', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 88,
        summary: { total: 1, errors: 0, warnings: 1, infos: 0 },
        issues: [{ type: 'no-category-field', message: '타입만 있습니다', suggestion: '' }],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['quality-issues-list'].innerHTML).toContain('no-category-field');
  });

  it('fills sample fields from TYPE_SAMPLES when agencyType changes and all sample fields are empty', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['agency-type'].value = '지방자치단체';

    vm.runInNewContext(SOURCE, context);

    elements['agency-type'].dispatch('change');

    expect(elements['sample-1'].value).not.toBe('');
    expect(elements['sample-1'].value).toContain('주민등록');
  });

  it('does not overwrite sample fields when agencyType changes and sample-1 already has a value', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '사용자가 직접 입력한 문장입니다.';
    elements['agency-type'].value = '지방자치단체';

    vm.runInNewContext(SOURCE, context);

    elements['agency-type'].dispatch('change');

    expect(elements['sample-1'].value).toBe('사용자가 직접 입력한 문장입니다.');
  });

  it('falls back to 기타공공기관 samples when agencyType changes to an unrecognized value and all sample fields are empty', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['agency-type'].value = '알 수 없는 기관 유형';

    vm.runInNewContext(SOURCE, context);

    elements['agency-type'].dispatch('change');

    // TYPE_SAMPLES['알 수 없는 기관 유형'] is undefined → falls back to TYPE_SAMPLES['기타공공기관']
    expect(elements['sample-1'].value).toContain('신청이 접수되었습니다');
  });

  it('updates sample placeholders and mode help text when the generator-mode changes', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '기존 샘플 텍스트';
    elements['generator-mode'].value = 'guide-draft';

    vm.runInNewContext(SOURCE, context);

    elements['generator-mode'].value = 'rewrite';
    elements['generator-mode'].dispatch('change');

    expect(elements['mode-help'].textContent).not.toBe('');
  });

  it('fills sample fields with message-pack defaults when mode is message-pack and all samples are empty', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['generator-mode'].value = 'message-pack';

    vm.runInNewContext(SOURCE, context);

    // applyModeUi('message-pack', false) is called at init; samples empty → getModeSamples('message-pack') fills them
    expect(elements['sample-1'].value).toContain('ERROR');
  });

  it('fills sample fields with 기타공공기관 defaults when an unrecognized mode is initialised with empty samples', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['generator-mode'].value = 'unknown-future-mode';

    vm.runInNewContext(SOURCE, context);

    // getModeSamples default fallback → TYPE_SAMPLES['기타공공기관']
    expect(elements['sample-1'].value).toContain('신청이 접수되었습니다');
  });

  it('fills sample fields with tone-adjust defaults when mode is tone-adjust and all samples are empty', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['generator-mode'].value = 'tone-adjust';

    vm.runInNewContext(SOURCE, context);

    expect(elements['sample-1'].value).toContain('확인하여야 합니다');
  });

  it('preserves existing sample values when mode changes and samples are already filled', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '사용자가 미리 입력한 문장';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['generator-mode'].value = 'tone-adjust';

    vm.runInNewContext(SOURCE, context);

    elements['generator-mode'].value = 'message-pack';
    elements['generator-mode'].dispatch('change');

    expect(elements['sample-1'].value).toBe('사용자가 미리 입력한 문장');
  });

  it('uses window.KRDSLint as the lint engine when the global KRDSLint identifier is not defined', () => {
    const { context, elements } = buildGeneratorContext();
    const lintMock = vi.fn(() => ({
      score: 92,
      summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
      issues: [],
    }));
    context.window.KRDSLint = { lint: lintMock };
    // No top-level KRDSLint in context — getLintEngine() must fall through to window.KRDSLint

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(lintMock).toHaveBeenCalled();
    expect(elements['quality-review'].hidden).toBe(false);
  });

  it('closes the format dropdown when the toggle button is clicked while the menu is already open', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('true');

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the format dropdown and restores focus when Escape is pressed with items present', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    elements['dl-menu'].dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });

    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
    expect(elements['dl-chevron'].focus).toHaveBeenCalled();
  });

  it('does nothing when the format dropdown is clicked outside any menu item', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const nonItemTarget = createElement();
    expect(() => elements['dl-menu'].dispatch('click', { target: nonItemTarget })).not.toThrow();
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);
    expect(elements['download-error'].classList.contains('visible')).toBe(false);
  });

  it('closes the format dropdown and restores focus when Escape is pressed with no items in the menu', () => {
    const { context, elements } = buildGeneratorContext({ menuItems: [] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Escape', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
    expect(elements['dl-chevron'].focus).toHaveBeenCalled();
  });

  it('moves focus to the previous item when ArrowUp is pressed in the format dropdown', () => {
    const item1 = createElement({ dataset: { format: 'html' }, classes: ['dl-menu-item'] });
    const item2 = createElement({ dataset: { format: 'hwp' }, classes: ['dl-menu-item'] });
    const { context, elements } = buildGeneratorContext({ menuItems: [item1, item2] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    context.document.activeElement = item2;

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'ArrowUp', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(item1.focus).toHaveBeenCalled();
  });

  it('closes the format dropdown and moves focus to the next element when Tab is pressed with no menu items', () => {
    const { context, elements } = buildGeneratorContext({ menuItems: [] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
    expect(elements['restart-btn'].focus).toHaveBeenCalled();
  });

  it('closes the format dropdown and restores focus to the chevron when Shift+Tab is pressed with no menu items', () => {
    const { context, elements } = buildGeneratorContext({ menuItems: [] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].focus).toHaveBeenCalled();
  });

  it('closes the format dropdown and moves focus to the next element when Tab is pressed with menu items', () => {
    const item1 = createElement({ dataset: { format: 'html' }, classes: ['dl-menu-item'] });
    const { context, elements } = buildGeneratorContext({ menuItems: [item1] });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const preventDefault = vi.fn();
    elements['dl-menu'].dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['restart-btn'].focus).toHaveBeenCalled();
  });

  it('shows a "Word 변환에 실패했습니다" error for unrecognised non-HWP download formats', () => {
    const docxItem = createElement({ dataset: { format: 'docx' }, classes: ['dl-menu-item'] });
    const { context, elements } = buildGeneratorContext({
      menuItems: [docxItem],
    });
    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    elements['dl-menu'].dispatch('click', { target: docxItem });

    expect(elements['download-error'].classList.contains('visible')).toBe(true);
    expect(elements['download-error'].textContent).toContain('Word 변환에 실패했습니다');
  });

  it('blocks form submission and marks agency-type field when agency type is empty', async () => {
    const fetchImpl = vi.fn();
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['agency-type'].value = '';
    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(elements['agency-type'].classList.contains('has-error')).toBe(true);
  });

  it('closes the format dropdown when a document click event fires on an element outside the button group', () => {
    const { context, elements } = buildGeneratorContext();
    const docListeners = new Map();
    context.document.addEventListener = (type, handler) => {
      const arr = docListeners.get(type) || [];
      arr.push(handler);
      docListeners.set(type, arr);
    };

    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const clickHandlers = docListeners.get('click') || [];
    clickHandlers.forEach((h) => h({ target: elements['agency-name'] }));

    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
    expect(elements['dl-chevron'].getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the format dropdown when a document click target has no closest method', () => {
    const { context, elements } = buildGeneratorContext();
    const docListeners = new Map();
    context.document.addEventListener = (type, handler) => {
      const arr = docListeners.get(type) || [];
      arr.push(handler);
      docListeners.set(type, arr);
    };

    vm.runInNewContext(SOURCE, context);

    elements['dl-chevron'].dispatch('click');
    expect(elements['dl-menu'].classList.contains('open')).toBe(true);

    const clickHandlers = docListeners.get('click') || [];
    clickHandlers.forEach((h) => h({ target: { textContent: 'no closest method' } }));

    expect(elements['dl-menu'].classList.contains('open')).toBe(false);
  });

  it('silently skips an SSE payload that is valid JSON but not an object (e.g. a number)', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: 42\n'),
            encoder.encode('data: {"type":"chunk","text":"# 결과"}\n'),
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

  it('does not crash when the cancel button is clicked before any generation has started', () => {
    const { context, elements, screens } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    expect(screens[0].classList.contains('active')).toBe(true);

    elements['cancel-btn'].dispatch('click');

    expect(screens[0].classList.contains('active')).toBe(true);
  });

  it('returns early from renderQualityReview when the quality-review element is absent', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['quality-review']; // qualityReviewEl initialises to null
    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');

    // renderQualityReview returned at the guard without writing to quality-gates
    expect(elements['quality-gates'].innerHTML).toBe('');
  });

  it('skips an all-blank-cell table row (|| pattern) and still passes other lines to lint', () => {
    let lintInput = null;
    const { context } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn((text) => { lintInput = text; return { score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] }; }),
    };

    const markdown = '개선 표현\n||\n다음 조치';
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true, status: 200,
      body: { getReader() {
        const chunks = [
          encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: markdown }) + '\n'),
          encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
        ];
        let i = 0;
        return { async read() { if (i < chunks.length) return { done: false, value: chunks[i++] }; return { done: true, value: undefined }; } };
      } },
    }));

    const { context: ctx2 } = buildGeneratorContext({ fetchImpl });
    ctx2.KRDSLint = context.KRDSLint;
    vm.runInNewContext(SOURCE, ctx2);
    ctx2.document.getElementById('generator-form').dispatch('submit');

    return new Promise((resolve) => {
      setTimeout(async () => {
        await new Promise((r) => setTimeout(r, 0));
        expect(ctx2.KRDSLint.lint).toHaveBeenCalled();
        expect(lintInput).toContain('개선 표현');
        expect(lintInput).toContain('다음 조치');
        resolve();
      }, 0);
    });
  });

  it('skips a single source-marker cell row (| 현재 |) that leaves no reviewable content after slicing', () => {
    let lintInput = null;
    const { context } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn((text) => { lintInput = text; return { score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] }; }),
    };

    const markdown = '개선 표현\n| 현재 |\n다음 조치';
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true, status: 200,
      body: { getReader() {
        const chunks = [
          encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: markdown }) + '\n'),
          encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
        ];
        let i = 0;
        return { async read() { if (i < chunks.length) return { done: false, value: chunks[i++] }; return { done: true, value: undefined }; } };
      } },
    }));

    const { context: ctx2 } = buildGeneratorContext({ fetchImpl });
    ctx2.KRDSLint = context.KRDSLint;
    vm.runInNewContext(SOURCE, ctx2);
    ctx2.document.getElementById('generator-form').dispatch('submit');

    return new Promise((resolve) => {
      setTimeout(async () => {
        await new Promise((r) => setTimeout(r, 0));
        expect(ctx2.KRDSLint.lint).toHaveBeenCalled();
        expect(lintInput).toContain('개선 표현');
        expect(lintInput).toContain('다음 조치');
        expect(lintInput).not.toContain('현재');
        resolve();
      }, 0);
    });
  });

  it('discards the onSuccess callback of a stale copy operation when a newer copy has already completed', async () => {
    let settleFirst;
    let callCount = 0;
    const { context, elements, timers } = buildGeneratorContext({ manualTimers: true });
    context.navigator.clipboard = {
      writeText: vi.fn(() => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise((resolve) => { settleFirst = resolve; });
        }
        return Promise.resolve();
      }),
    };

    vm.runInNewContext(SOURCE, context);

    elements['fallback-btn'].dispatch('click');
    [...timers.entries()].filter(([, t]) => t.delay === 50).forEach(([id]) => timers.delete(id));

    // Second click resolves immediately → sets btn to '✅' with its own reset timer
    elements['copy-md-btn'].dispatch('click');
    elements['copy-md-btn'].dispatch('click');
    await Promise.resolve();

    const timerCountAfterSecond = [...timers.entries()].filter(([, t]) => t.delay === 2000).length;
    expect(timerCountAfterSecond).toBe(1);
    expect(elements['copy-md-btn'].textContent).toBe('✅ 복사됨');

    // First copy resolves — its stale onSuccess must NOT add another reset timer
    settleFirst();
    await Promise.resolve();

    const timerCountAfterFirst = [...timers.entries()].filter(([, t]) => t.delay === 2000).length;
    expect(timerCountAfterFirst).toBe(1); // same timer, no extra added
  });

  it('shows a stream-unavailable error when the response body has no getReader method', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {},
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('응답 스트림을 읽을 수 없습니다');
  });

  it('silently skips non-data SSE lines and processes subsequent data lines normally', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('event: content_block_start\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: '결과 텍스트' }) + '\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
          ];
          let i = 0;
          return {
            async read() {
              if (i < chunks.length) return { done: false, value: chunks[i++] };
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screens[2].classList.contains('active')).toBe(true);
    expect(elements['output-content'].innerHTML).toContain('결과 텍스트');
  });

  it('silently ignores an AbortError thrown by fetch when the user cancels the request', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchImpl = vi.fn(async () => { throw abortError; });

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(false);
  });

  it('silently ignores an AbortError thrown during stream reading when the user cancels mid-stream', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() { throw abortError; },
            cancel: vi.fn(),
          };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(false);
  });

  it('uses a 5xx error body message when the server returns an error field in the response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      async json() { return { error: '상류 서비스가 일시적으로 중단되었습니다.' }; },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('상류 서비스가 일시적으로 중단되었습니다.');
  });

  it('shows the generic server-error message with the status code when a 5xx response has no parseable error body', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 502,
      async json() { throw new Error('not json'); },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(elements['generating-error'].classList.contains('visible')).toBe(true);
    expect(elements['generating-error'].textContent).toContain('서버 오류가 발생했습니다');
    expect(elements['generating-error'].textContent).toContain('502');
  });

  it('defaults to guide-draft mode when the generator-mode element is absent from the DOM', () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { getReader() { return { async read() { return { done: true }; } }; } },
    }));
    const { context, elements } = buildGeneratorContext({ fetchImpl });
    // Remove the optional mode element so getCurrentMode() falls back to 'guide-draft'
    elements['generator-mode'] = null;

    elements['agency-name'].value = '기관';
    elements['agency-type'].value = '지방자치단체';
    elements['sample-1'].value = '문장 하나';

    vm.runInNewContext(SOURCE, context);
    elements['generator-form'].dispatch('submit');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"mode":"guide-draft"'),
      }),
    );
  });

  it('does not crash in applyModeUi when the tone-target-group element is absent from the DOM', () => {
    const { context, elements } = buildGeneratorContext();
    // Remove the optional element — the if (toneTargetGroup) guard should prevent any error
    elements['tone-target-group'] = null;

    vm.runInNewContext(SOURCE, context);

    // Changing mode still works without the optional element
    elements['generator-mode'].value = 'tone-adjust';
    expect(() => elements['generator-mode'].dispatch('change')).not.toThrow();
  });

  it('shows 심리적 안전망 통과 and "다음 행동 신호" description when structureCue is present in reviewed text', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    // message-pack mode fallback contains '이유' and '다음 행동' which triggers structureCue
    elements['generator-mode'].value = 'message-pack';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    expect(html).toContain('다음 행동 신호가 포함되어 있습니다');
    expect(html).not.toContain('직접적인 오류 구조 표지');
  });

  it('falls back to "검수 항목" as the category label when both category and type are absent from a lint issue', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 80,
        summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
        issues: [{ message: '분류 없는 이슈', suggestion: '수정 제안 없음' }],
      })),
    };

    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    expect(elements['quality-issues-list'].innerHTML).toContain('검수 항목');
  });

  it('shows 심리적 안전망 통과 when mode is tone-adjust even if text has no action or structure cues', () => {
    const { context, elements } = buildGeneratorContext();
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };
    elements['generator-mode'].value = 'tone-adjust';
    vm.runInNewContext(SOURCE, context);
    elements['fallback-btn'].dispatch('click');

    const html = elements['quality-gates'].innerHTML;
    // mode === 'tone-adjust' makes the 심리적 안전망 condition pass even without action/structure cues
    expect(html).not.toContain('quality-gate--warn');
    expect(html).not.toContain('quality-gate--fail');
  });

  it('parses SSE lines where data: has no trailing space (data:{...} without a space)', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data:{"type":"chunk","text":"# 공백 없음"}\n'),
            encoder.encode('data:{"type":"done"}\n'),
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
    expect(elements['output-content'].innerHTML).toContain('# 공백 없음');
  });

  it('fills samples with 기타공공기관 defaults when mode is an unrecognized value and samples are empty', () => {
    const { context, elements } = buildGeneratorContext();
    elements['sample-1'].value = '';
    elements['sample-2'].value = '';
    elements['sample-3'].value = '';
    elements['generator-mode'].value = 'unknown-mode';

    vm.runInNewContext(SOURCE, context);

    elements['generator-mode'].dispatch('change');

    // getModeSamples falls back to TYPE_SAMPLES['기타공공기관'] for unrecognised modes
    expect(elements['sample-1'].value).toContain('신청이 접수되었습니다');
  });

  it('does not crash in renderQualityReview when quality-empty element is absent and lint engine is unavailable', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['quality-empty'];

    vm.runInNewContext(SOURCE, context);

    expect(() => elements['fallback-btn'].dispatch('click')).not.toThrow();
    expect(elements['quality-gates'].innerHTML).toContain('자동 검수 엔진을 불러오지 못했습니다');
  });

  it('does not crash in renderQualityReview when quality-empty element is absent and lint engine throws', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['quality-empty'];
    context.KRDSLint = {
      lint: vi.fn(() => { throw new Error('lint fail'); }),
    };

    vm.runInNewContext(SOURCE, context);

    expect(() => elements['fallback-btn'].dispatch('click')).not.toThrow();
    expect(elements['quality-gates'].innerHTML).toContain('자동 검수 계산 중 오류가 발생했습니다');
  });

  it('does not crash in renderQualityReview when quality-empty is absent and there are no issues (topIssues empty path)', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['quality-empty'];
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 100,
        summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
        issues: [],
      })),
    };

    vm.runInNewContext(SOURCE, context);

    expect(() => elements['fallback-btn'].dispatch('click')).not.toThrow();
    expect(elements['quality-gates'].innerHTML).toContain('quality-gate--pass');
  });

  it('does not crash in renderQualityReview when quality-empty is absent and there are issues (qualityEmptyEl.hidden = true path)', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['quality-empty'];
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 80,
        summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
        issues: [{ type: 'admin-jargon', category: '행정어', message: '귀하', suggestion: '고객님' }],
      })),
    };

    vm.runInNewContext(SOURCE, context);

    expect(() => elements['fallback-btn'].dispatch('click')).not.toThrow();
    expect(elements['quality-issues-list'].innerHTML).toContain('행정어');
  });

  it('hides the tone-target-group when the mode has showToneTarget false (guide-draft init)', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'guide-draft';

    vm.runInNewContext(SOURCE, context);

    expect(elements['tone-target-group'].style.display).toBe('none');
  });

  it('shows the tone-target-group when the mode is tone-adjust (showToneTarget true)', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'tone-adjust';
    elements['sample-1'].value = '';

    vm.runInNewContext(SOURCE, context);

    expect(elements['tone-target-group'].style.display).toBe('');
  });

  it('hides the tone-target-group again when switching away from tone-adjust to guide-draft', () => {
    const { context, elements } = buildGeneratorContext();
    elements['generator-mode'].value = 'tone-adjust';
    elements['sample-1'].value = '';

    vm.runInNewContext(SOURCE, context);
    expect(elements['tone-target-group'].style.display).toBe('');

    elements['generator-mode'].value = 'guide-draft';
    elements['generator-mode'].dispatch('change');

    expect(elements['tone-target-group'].style.display).toBe('none');
  });

  it('does not throw in showScreen when the target screen element is absent from the DOM', () => {
    const { context, elements } = buildGeneratorContext();
    vm.runInNewContext(SOURCE, context);

    // Remove screen-input so getElementById returns null when restart-btn is clicked
    delete elements['screen-input'];

    expect(() => elements['restart-btn'].dispatch('click')).not.toThrow();
  });

  it('does not throw in setTextIfPresent when the optional mode-help element is absent from the DOM', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['mode-help'];

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('does not throw in setHtmlIfPresent when the optional page-subtitle element is absent from the DOM', () => {
    const { context, elements } = buildGeneratorContext();
    delete elements['page-subtitle'];

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('falls back to window.KRDSLint when the KRDSLint global has a non-function lint property', async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: '# 가이드라인 내용' }) + '\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
          ];
          let i = 0;
          return { async read() { if (i < chunks.length) return { done: false, value: chunks[i++] }; return { done: true, value: undefined }; } };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = { lint: 'not-a-function' };
    const lintMock = vi.fn(() => ({ score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] }));
    context.window.KRDSLint = { lint: lintMock };

    vm.runInNewContext(SOURCE, context);
    elements['generator-form'].dispatch('submit');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(lintMock).toHaveBeenCalled();
  });

  it('shows the quality unavailable message when the streamed content produces an empty reviewText', async () => {
    const encoder = new TextEncoder();
    const allFilteredContent = '샘플 텍스트 1: 원문 내용\n🚫 금지 표현\n- 현재: 이 표현';
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          const chunks = [
            encoder.encode('data: ' + JSON.stringify({ type: 'chunk', text: allFilteredContent }) + '\n'),
            encoder.encode('data: ' + JSON.stringify({ type: 'done' }) + '\n'),
          ];
          let i = 0;
          return { async read() { if (i < chunks.length) return { done: false, value: chunks[i++] }; return { done: true, value: undefined }; } };
        },
      },
    }));

    const { context, elements } = buildGeneratorContext({ fetchImpl });
    context.KRDSLint = {
      lint: vi.fn(() => ({ score: 100, summary: { total: 0, errors: 0, warnings: 0, infos: 0 }, issues: [] })),
    };
    vm.runInNewContext(SOURCE, context);

    elements['generator-form'].dispatch('submit');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(elements['quality-gates'].innerHTML).toContain('자동 검수 엔진을 불러오지 못했습니다');
  });
});
