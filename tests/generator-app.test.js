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
});
