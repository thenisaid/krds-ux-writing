import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'lint-ui.js'), 'utf8');

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
    value: options.value || '',
    textContent: options.textContent || '',
    innerHTML: options.innerHTML || '',
    disabled: !!options.disabled,
    title: options.title || '',
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
    focus: vi.fn(),
    select: vi.fn(),
    closest(selector) {
      if (selector === '[data-idx]' && this.dataset.idx != null) return this;
      return null;
    },
  };
}

function buildContext(options = {}) {
  const optChips = [
    createElement({ dataset: { opt: 'checkAdminJargon' }, classes: ['opt-chip', 'active'] }),
    createElement({ dataset: { opt: 'checkPatterns' }, classes: ['opt-chip', 'active'] }),
  ];
  const filterTabs = [
    createElement({ dataset: { filter: 'all' }, classes: ['filter-tab', 'active'], attributes: { 'aria-pressed': 'true' } }),
    createElement({ dataset: { filter: 'error' }, classes: ['filter-tab'], attributes: { 'aria-pressed': 'false' } }),
    createElement({ dataset: { filter: 'warning' }, classes: ['filter-tab'], attributes: { 'aria-pressed': 'false' } }),
    createElement({ dataset: { filter: 'info' }, classes: ['filter-tab'], attributes: { 'aria-pressed': 'false' } }),
  ];
  const elements = {
    themeToggle: createElement(),
    inputText: createElement(),
    sampleBtn: createElement(),
    clearBtn: createElement(),
    scoreSection: createElement(),
    highlightCard: createElement({ style: { display: 'none' } }),
    issuesCard: createElement({ style: { display: 'none' } }),
    improvedCard: createElement({ style: { display: 'none' } }),
    highlightedText: createElement(),
    issuesList: createElement(),
    issuesTitle: createElement({ textContent: '이슈 목록' }),
    lintBtn: createElement(),
    copyBtn: createElement(),
    downloadBtn: createElement(),
    shareLinkBtn: createElement({ disabled: true }),
    improvedText: createElement(),
    copyImprovedBtn: createElement(),
    historyCard: createElement({ style: { display: 'none' } }),
    historyList: createElement(),
    clearHistoryBtn: createElement(),
    cliBanner: createElement({ style: { display: 'none' } }),
    cliBannerClose: createElement(),
    copyCliBtn: createElement(),
    charCount: createElement({ textContent: '0' }),
    toast: createElement(),
  };

  const storage = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const context = {
    document: {
      documentElement: {
        theme: 'light',
        setAttribute(name, value) {
          if (name === 'data-theme') this.theme = String(value);
        },
        getAttribute(name) {
          return name === 'data-theme' ? this.theme : null;
        },
      },
      body: {
        appendChild() {},
        removeChild() {},
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelectorAll(selector) {
        if (selector === '.opt-chip') return optChips;
        if (selector === '.filter-tab') return filterTabs;
        return [];
      },
      createElement() {
        return createElement();
      },
    },
    window: {
      location: {
        href: 'https://example.com/lint.html',
        search: '',
      },
      matchMedia() {
        return { matches: false };
      },
    },
    navigator: {},
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    URLSearchParams,
    URL: {
      createObjectURL() { return 'blob:test'; },
      revokeObjectURL() {},
    },
    Blob,
    KRDSLint: {
      lint: vi.fn(() => options.lintResult || ({
        score: 82,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '"귀하"는 어려운 표현입니다.',
          match: '귀하',
          suggestion: '→ 당신',
          type: 'admin-jargon',
        }],
      })),
      formatCLI: vi.fn(() => 'formatted'),
    },
    setTimeout(fn, delay) {
      if (options.manualTimers) {
        const id = nextTimerId++;
        timers.set(id, { fn, delay });
        return id;
      }
      fn();
      return 1;
    },
    clearTimeout(id) {
      if (options.manualTimers) timers.delete(id);
    },
    console,
    Array,
    JSON,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, elements, timers };
}

describe('lint-ui stale result handling', () => {
  it('does not throw when the lint page DOM is incomplete', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelectorAll() { return []; },
      },
      window: {
        matchMedia() {
          return { matches: false };
        },
      },
      localStorage: {
        getItem() { return null; },
      },
      Array,
      JSON,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('invalidates stale analysis when the input text changes after linting', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.shareLinkBtn.disabled).toBe(false);
    expect(elements.scoreSection.innerHTML).toContain('82');
    expect(elements.highlightCard.style.display).toBe('block');
    expect(elements.issuesCard.style.display).toBe('block');
    expect(elements.improvedCard.style.display).toBe('block');

    elements.inputText.value = '수정된 문장입니다.';
    elements.inputText.dispatch('input');

    expect(elements.shareLinkBtn.disabled).toBe(true);
    expect(elements.shareLinkBtn.title).toBe('텍스트가 변경되었습니다. 다시 검사해 주세요');
    expect(elements.scoreSection.innerHTML).toContain('텍스트를 입력하고 검사해 주세요');
    expect(elements.highlightCard.style.display).toBe('none');
    expect(elements.issuesCard.style.display).toBe('none');
    expect(elements.improvedCard.style.display).toBe('none');
    expect(elements.issuesTitle.textContent).toBe('이슈 목록');
  });

  it('clears stale lint results and shows an error toast when the lint engine throws', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.scoreSection.innerHTML).toContain('82');
    expect(elements.highlightCard.style.display).toBe('block');
    expect(elements.issuesCard.style.display).toBe('block');
    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.shareLinkBtn.disabled).toBe(false);

    context.KRDSLint.lint = vi.fn(() => {
      throw new Error('engine exploded');
    });

    expect(() => elements.lintBtn.dispatch('click')).not.toThrow();
    expect(elements.scoreSection.innerHTML).toContain('텍스트를 입력하고 검사해 주세요');
    expect(elements.highlightCard.style.display).toBe('none');
    expect(elements.issuesCard.style.display).toBe('none');
    expect(elements.improvedCard.style.display).toBe('none');
    expect(elements.shareLinkBtn.disabled).toBe(true);
    expect(elements.toast.textContent).toBe('❌ 검사 중 오류가 발생했습니다. 다시 시도해 주세요');
  });

  it('treats malformed lint-engine responses as recoverable failures', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.scoreSection.innerHTML).toContain('82');
    expect(elements.highlightCard.style.display).toBe('block');
    expect(elements.issuesCard.style.display).toBe('block');
    expect(elements.improvedCard.style.display).toBe('block');

    context.KRDSLint.lint = vi.fn(() => ({
      score: 82,
      summary: null,
      issues: null,
    }));

    expect(() => elements.lintBtn.dispatch('click')).not.toThrow();
    expect(elements.scoreSection.innerHTML).toContain('텍스트를 입력하고 검사해 주세요');
    expect(elements.highlightCard.style.display).toBe('none');
    expect(elements.issuesCard.style.display).toBe('none');
    expect(elements.improvedCard.style.display).toBe('none');
    expect(elements.shareLinkBtn.disabled).toBe(true);
    expect(elements.toast.textContent).toBe('❌ 검사 중 오류가 발생했습니다. 다시 시도해 주세요');
  });

  it('synchronizes the theme toggle label and icon with the restored theme on load', () => {
    const { context, elements } = buildContext();
    context.localStorage.setItem('krds-theme', 'dark');

    vm.runInNewContext(SOURCE, context);

    expect(context.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(elements.themeToggle.textContent).toBe('☀️');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('라이트모드 전환');
  });

  it('hides the CLI recommendation banner after the source text changes', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 42,
        summary: { errors: 3, warnings: 1, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '"귀하"는 어려운 표현입니다.',
          match: '귀하',
          suggestion: '→ 당신',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    expect(elements.cliBanner.style.display).toBe('block');

    elements.inputText.value = '수정된 문장입니다.';
    elements.inputText.dispatch('input');

    expect(elements.cliBanner.style.display).toBe('none');
  });

  it('treats severity filters as pressed buttons and updates the filtered list', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 60,
        summary: { errors: 1, warnings: 1, infos: 1 },
        issues: [
          {
            line: 1,
            col: 1,
            severity: 'error',
            category: '행정어',
            message: '"귀하"는 어려운 표현입니다.',
            match: '귀하',
            suggestion: '→ 당신',
            type: 'admin-jargon',
          },
          {
            line: 2,
            col: 1,
            severity: 'warning',
            category: '패턴',
            message: '"되어지다"는 이중 피동 표현입니다.',
            match: '되어지다',
            suggestion: '→ 되다',
            type: 'double-passive',
          },
          {
            line: 3,
            col: 1,
            severity: 'info',
            category: '안내',
            message: '"잠시" 표현을 구체화해 보세요.',
            match: '잠시',
            suggestion: '→ 3분 뒤',
            type: 'vague-time',
          },
        ],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하\n되어지다\n잠시';
    elements.lintBtn.dispatch('click');

    const warningTab = context.document.querySelectorAll('.filter-tab')[2];
    warningTab.dispatch('click');

    expect(warningTab.classList.contains('active')).toBe(true);
    expect(warningTab.getAttribute('aria-pressed')).toBe('true');
    expect(context.document.querySelectorAll('.filter-tab')[0].getAttribute('aria-pressed')).toBe('false');
    expect(elements.issuesList.innerHTML).toContain('되어지다');
    expect(elements.issuesList.innerHTML).not.toContain('귀하');
    expect(elements.issuesList.innerHTML).not.toContain('잠시');
  });

  it('falls back safely when clipboard.writeText is unavailable and reports copy failure truthfully', () => {
    const { context, elements } = buildContext();
    context.navigator.clipboard = {};
    context.document.execCommand = vi.fn(() => false);

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    expect(() => elements.copyImprovedBtn.dispatch('click')).not.toThrow();
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
    expect(elements.toast.textContent).toBe('❌ 개선문 복사에 실패했습니다');
  });

  it('keeps the latest copy-button feedback visible when the result is copied repeatedly', async () => {
    const { context, elements, timers } = buildContext({ manualTimers: true });
    context.navigator.clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
    };

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    elements.copyBtn.dispatch('click');
    await Promise.resolve();

    const firstResetTimerId = [...timers.entries()].find(([, timer]) => timer.delay === 2000)?.[0];
    expect(firstResetTimerId).toBeDefined();
    expect(elements.copyBtn.textContent).toBe('✅ 복사됨');

    elements.copyBtn.dispatch('click');
    await Promise.resolve();

    const staleResetTimer = timers.get(firstResetTimerId);
    if (staleResetTimer) {
      timers.delete(firstResetTimerId);
      staleResetTimer.fn();
    }

    expect(elements.copyBtn.textContent).toBe('✅ 복사됨');

    const latestResetTimer = [...timers.entries()].find(([, timer]) => timer.delay === 2000);
    expect(latestResetTimer).toBeDefined();
    latestResetTimer[1].fn();

    expect(elements.copyBtn.innerHTML).toBe('<span aria-hidden="true">📋</span> 결과 복사');
  });

  it('keeps the latest successful result-copy feedback when an older async copy fails later', async () => {
    let settleFirst;
    let callCount = 0;
    const { context, elements } = buildContext({ manualTimers: true });
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

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    elements.copyBtn.dispatch('click');
    elements.copyBtn.dispatch('click');
    await Promise.resolve();

    expect(elements.copyBtn.textContent).toBe('✅ 복사됨');

    settleFirst.reject(new Error('denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(elements.copyBtn.textContent).toBe('✅ 복사됨');
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('falls back to a built-in text formatter when KRDSLint.formatCLI is unavailable', async () => {
    const { context, elements } = buildContext();
    context.navigator.clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
    };

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    context.KRDSLint.formatCLI = undefined;

    await expect(async () => {
      elements.copyBtn.dispatch('click');
      await Promise.resolve();
    }).not.toThrow();

    expect(context.navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(context.navigator.clipboard.writeText.mock.calls[0][0]).toContain('KRDS UX Writing 검사 결과');
    expect(context.navigator.clipboard.writeText.mock.calls[0][0]).toContain('품질 점수: 82/100');
    expect(elements.copyBtn.textContent).toBe('✅ 복사됨');
  });

  it('uses only the first slash-separated suggestion when rendering improved text', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 3,
          severity: 'error',
          category: '과도한 경어',
          message: '행정어/금지어: "하여야 합니다"',
          match: '하여야 합니다',
          suggestion: '→ 해야 합니다 / 하세요',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '납부하여야 합니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('납부해야 합니다.');
  });

  it('replaces only the detected jargon occurrence when the same term appears multiple times', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "귀하"',
          match: '귀하',
          suggestion: '→ 고객님',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하 안내 후 귀하 서명해 주세요.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('고객님 안내 후 귀하 서명해 주세요.');
  });

  it('does not split replacement text on commas that are inside explanatory parentheses', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '전문 용어',
          message: '행정어/금지어: "창설적 신분행위"',
          match: '창설적 신분행위',
          suggestion: '→ 법적 신분 변경 (결혼, 입양 등)',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '창설적 신분행위가 필요합니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('법적 신분 변경 (결혼, 입양 등)이 필요합니다.');
  });

  it('keeps the particle "로" after replacement text that ends with final rieul', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "서류"',
          match: '서류',
          suggestion: '→ 파일',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '서류로 제출해 주세요.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('파일로 제출해 주세요.');
  });

  it('corrects particle from "가" to "이" when the replacement text ends with a consonant batchim', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "귀하"',
          match: '귀하',
          suggestion: '→ 신청인',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하가 제출해 주세요.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('신청인이 제출해 주세요.');
  });

  it('leaves particle unchanged when the replacement text ends with a vowel syllable and no batchim', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "파기"',
          match: '파기',
          suggestion: '→ 삭제',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '파기가 필요합니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('삭제가 필요합니다.');
  });

  it('corrects particle from "로" to "으로" when the replacement ends with a non-rieul consonant batchim', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "귀하"',
          match: '귀하',
          suggestion: '→ 신청인',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    // '신청인' ends with '인' (ㄴ batchim, jongseong 4), so '로' → '으로'
    elements.inputText.value = '귀하로 연락주세요.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('신청인으로 연락주세요.');
  });

  it('corrects particle from "를" to "을" when the replacement ends with a consonant batchim', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "귀하"',
          match: '귀하',
          suggestion: '→ 신청인',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    // '신청인' has ㄴ batchim → '를' → '을'
    elements.inputText.value = '귀하를 도와드리겠습니다.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    expect(elements.improvedText.textContent).toBe('신청인을 도와드리겠습니다.');
  });

  it('leaves the particle unchanged when the replacement text ends with a non-Korean character', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어/금지어: "파일"',
          match: '파일',
          suggestion: '→ PDF',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '파일를 제출해 주세요.';
    elements.lintBtn.dispatch('click');

    expect(elements.improvedCard.style.display).toBe('block');
    // 'PDF' ends with a non-Korean char → particle '를' returned unchanged
    expect(elements.improvedText.textContent).toBe('PDF를 제출해 주세요.');
  });

  it('shows a failure toast when CSV download APIs are unavailable', () => {
    const { context, elements } = buildContext();
    context.URL = {
      revokeObjectURL() {},
    };

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    expect(() => elements.downloadBtn.dispatch('click')).not.toThrow();
    expect(elements.toast.textContent).toBe('❌ CSV 다운로드에 실패했습니다');
  });

  it('shows a failure toast when link sharing falls back and copy still fails', async () => {
    const { context, elements } = buildContext();
    context.navigator.clipboard = {
      writeText: vi.fn(() => Promise.reject(new Error('denied'))),
    };
    context.document.execCommand = vi.fn(() => false);

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.shareLinkBtn.dispatch('click');

    await Promise.resolve();
    await Promise.resolve();

    expect(context.navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
    expect(elements.toast.textContent).toBe('❌ 링크 복사에 실패했습니다');
  });

  it('builds share URLs from the page location without leaving the query string behind the hash', async () => {
    const { context, elements } = buildContext();
    context.window.location.href = 'https://example.com/lint.html#examples';
    context.window.location.search = '';
    context.navigator.clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
    };

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.shareLinkBtn.dispatch('click');

    await Promise.resolve();

    expect(context.navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/lint.html?t=' + encodeURIComponent('귀하의 신청이 접수되었습니다.'),
    );
    expect(elements.toast.textContent).toBe('✅ 링크가 클립보드에 복사되었습니다');
  });

  it('keeps the latest successful toast when an older async copy action fails later', async () => {
    let settleFirst;
    let callCount = 0;
    const { context, elements } = buildContext({ manualTimers: true });
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

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    elements.copyImprovedBtn.dispatch('click');
    elements.copyImprovedBtn.dispatch('click');
    await Promise.resolve();

    expect(elements.toast.textContent).toBe('✅ 개선문이 복사되었습니다');

    settleFirst.reject(new Error('denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(elements.toast.textContent).toBe('✅ 개선문이 복사되었습니다');
    expect(context.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('recovers from corrupted saved history and stores the latest lint result', () => {
    const { context, elements } = buildContext();
    context.localStorage.setItem('krds-lint-history', '{"oops":true}');

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    const history = JSON.parse(context.localStorage.getItem('krds-lint-history'));
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].fullText).toBe('귀하의 신청이 접수되었습니다.');
    expect(history[0].text).toBe('귀하의 신청이 접수되었습니다.');
    expect(elements.historyCard.style.display).toBe('block');
    expect(elements.historyList.innerHTML).toContain('이슈 1개');
  });

  it('escapes HTML special characters in the history date field to prevent localStorage injection', () => {
    const { context, elements } = buildContext();
    context.localStorage.setItem('krds-lint-history', JSON.stringify([
      {
        date: '<script>alert(1)</script>',
        score: 90,
        text: '안전한 텍스트',
        fullText: '안전한 텍스트',
        issueCount: 0,
      },
    ]));

    vm.runInNewContext(SOURCE, context);

    expect(elements.historyList.innerHTML).not.toContain('<script>');
    expect(elements.historyList.innerHTML).toContain('&lt;script&gt;');
  });

  it('ignores non-element history click targets without throwing', () => {
    const { context, elements } = buildContext();
    context.localStorage.setItem('krds-lint-history', JSON.stringify([
      {
        date: '2026. 6. 9.',
        score: 82,
        text: '귀하의 신청이 접수되었습니다.',
        fullText: '귀하의 신청이 접수되었습니다.',
        issueCount: 1,
      },
    ]));

    vm.runInNewContext(SOURCE, context);

    expect(() => {
      elements.historyList.dispatch('click', { target: { nodeType: 3 } });
    }).not.toThrow();
    expect(elements.inputText.value).toBe('');
  });

  it('loads history item text into the textarea and updates charCount when a history entry is clicked', () => {
    const { context, elements } = buildContext();
    const storedText = '귀하의 신청이 접수되었습니다. 민원 처리 결과를 확인하세요.';
    context.localStorage.setItem('krds-lint-history', JSON.stringify([
      {
        date: '2026. 6. 9.',
        score: 75,
        text: storedText.slice(0, 80),
        fullText: storedText,
        issueCount: 2,
      },
    ]));

    vm.runInNewContext(SOURCE, context);

    const historyBtn = createElement({ dataset: { idx: '0' } });
    elements.historyList.dispatch('click', { target: historyBtn });

    expect(elements.inputText.value).toBe(storedText);
    expect(elements.charCount.textContent).toBe(storedText.length);
  });

  it('escapes HTML special characters in the unmatched tail when rendering the highlight view', () => {
    const { context, elements } = buildContext();
    const text = '이루어지다 <script>alert(1)</script>';
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 70,
        summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
        issues: [{
          type: 'double-passive',
          category: '이중피동',
          severity: 'error',
          line: 1,
          col: 1,
          match: '이루어지다',
          message: '"이루어지다" 이중피동 표현',
          suggestion: '이루어진다',
        }],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = text;
    elements.lintBtn.dispatch('click');

    const html = elements.highlightedText.innerHTML;
    expect(html).toContain('<mark');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in the matched token inside a highlight mark when an issue covers user-supplied text', () => {
    const { context, elements } = buildContext();
    const xssText = '이루어지다 <img src=x onerror=alert(1)>';
    context.KRDSLint = {
      lint: vi.fn(() => ({
        score: 70,
        summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
        issues: [{
          type: 'double-passive',
          category: '이중피동',
          severity: 'error',
          line: 1,
          col: 1,
          match: '이루어지다',
          message: '"이루어지다" 이중피동',
          suggestion: '이루어진다',
        }],
      })),
    };
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = xssText;
    elements.lintBtn.dispatch('click');

    const html = elements.highlightedText.innerHTML;
    expect(html).toContain('<mark');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('clears history from localStorage and hides the card when the clear button is clicked', () => {
    const { context, elements } = buildContext();
    context.localStorage.setItem('krds-lint-history', JSON.stringify([
      {
        date: '2026. 6. 9.',
        score: 90,
        text: '테스트 텍스트',
        fullText: '테스트 텍스트',
        issueCount: 0,
      },
    ]));

    vm.runInNewContext(SOURCE, context);

    expect(elements.historyCard.style.display).toBe('block');

    elements.clearHistoryBtn.dispatch('click');

    expect(context.localStorage.getItem('krds-lint-history')).toBeNull();
    expect(elements.historyCard.style.display).toBe('none');
  });

  it('shows the CLI banner when text length exceeds 300 characters even if the lint score is high', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 95,
        summary: { errors: 0, warnings: 0, infos: 0 },
        issues: [],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '가'.repeat(301);
    elements.lintBtn.dispatch('click');

    expect(elements.cliBanner.style.display).toBe('block');
  });

  it('disables the share button with a 500-char message when the input exceeds 500 characters', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 95,
        summary: { errors: 0, warnings: 0, infos: 0 },
        issues: [],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '가'.repeat(501);
    elements.lintBtn.dispatch('click');

    expect(elements.shareLinkBtn.disabled).toBe(true);
    expect(elements.shareLinkBtn.title).toBe('텍스트가 500자를 초과하면 URL 공유를 사용할 수 없습니다');
  });

  it('shows a toast and skips copying when the share button is clicked with text exceeding 500 characters', async () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 95,
        summary: { errors: 0, warnings: 0, infos: 0 },
        issues: [],
      },
    });
    context.navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하'.repeat(260);
    elements.lintBtn.dispatch('click');
    elements.shareLinkBtn.dispatch('click');

    await Promise.resolve();

    expect(context.navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(elements.toast.textContent).toBe('⚠️ 500자 이하 텍스트만 링크로 공유할 수 있습니다');
  });

  it('silently ignores copyImprovedBtn click when improved text is empty', () => {
    const { context, elements } = buildContext();
    context.navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };
    vm.runInNewContext(SOURCE, context);

    // No lintBtn click — improvedText.textContent is empty
    expect(() => elements.copyImprovedBtn.dispatch('click')).not.toThrow();
    expect(context.navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('silently ignores copyBtn click when no lint result is available yet', () => {
    const { context, elements } = buildContext();
    context.navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };
    vm.runInNewContext(SOURCE, context);

    // No lintBtn click — lastResult is null
    expect(() => elements.copyBtn.dispatch('click')).not.toThrow();
    expect(context.navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('silently ignores downloadBtn click when no lint result is available yet', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    // No lintBtn click — lastResult is null
    expect(() => elements.downloadBtn.dispatch('click')).not.toThrow();
    expect(elements.toast.textContent).toBe('');
  });

  it('silently ignores downloadBtn click when lint result has no issues', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 100,
        summary: { errors: 0, warnings: 0, infos: 0 },
        issues: [],
      },
    });
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '깨끗한 문장입니다.';
    elements.lintBtn.dispatch('click');

    expect(() => elements.downloadBtn.dispatch('click')).not.toThrow();
    expect(elements.toast.textContent).toBe('');
  });

  it('downloads a CSV file via anchor.click() when the download APIs are all available', () => {
    const { context, elements } = buildContext();
    const clickMock = vi.fn();
    context.document.createElement = vi.fn(() => ({
      href: '',
      download: '',
      click: clickMock,
      style: {},
      value: '',
      select: vi.fn(),
    }));

    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.downloadBtn.dispatch('click');

    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(elements.toast.textContent).toBe('');
  });

  it('shows a failure toast when document.body is null and skips both finally cleanups', () => {
    const { context, elements } = buildContext();
    context.document.body = null;
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.downloadBtn.dispatch('click');

    expect(elements.toast.textContent).toBe('❌ CSV 다운로드에 실패했습니다');
  });

  it('shows a failure toast and revokes the blob URL when the created anchor has no click method', () => {
    const { context, elements } = buildContext();
    const revokeCall = vi.fn();
    context.URL = {
      createObjectURL() { return 'blob:test-no-click'; },
      revokeObjectURL: revokeCall,
    };
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.downloadBtn.dispatch('click');

    expect(elements.toast.textContent).toBe('❌ CSV 다운로드에 실패했습니다');
    expect(revokeCall).toHaveBeenCalledWith('blob:test-no-click');
  });

  it('shows a failure toast and revokes the blob URL when document.createElement returns null', () => {
    const { context, elements } = buildContext();
    const revokeCall = vi.fn();
    context.URL = {
      createObjectURL() { return 'blob:null-anchor'; },
      revokeObjectURL: revokeCall,
    };
    context.document.createElement = vi.fn(() => null);
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    elements.downloadBtn.dispatch('click');

    expect(elements.toast.textContent).toBe('❌ CSV 다운로드에 실패했습니다');
    expect(revokeCall).toHaveBeenCalledWith('blob:null-anchor');
  });

  it('silently swallows a removeChild error in the finally block and still revokes the blob URL', () => {
    const { context, elements } = buildContext();
    const revokeCall = vi.fn();
    context.URL = {
      createObjectURL() { return 'blob:remove-throws'; },
      revokeObjectURL: revokeCall,
    };
    context.document.body = {
      appendChild() {},
      removeChild() { throw new Error('DOM mutation error'); },
    };
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');
    expect(() => elements.downloadBtn.dispatch('click')).not.toThrow();
    expect(revokeCall).toHaveBeenCalledWith('blob:remove-throws');
  });

  it('sets share button title to dirty message after text changes following a successful lint', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '귀하의 신청이 접수되었습니다.';
    elements.lintBtn.dispatch('click');

    // shareLinkBtn should now be enabled (text ≤ 500, result exists)
    expect(elements.shareLinkBtn.disabled).toBe(false);

    // Simulate user editing the text — clears lastResult and marks dirty
    elements.inputText.value = '귀하의 신청이 수정됩니다.';
    elements.inputText.dispatch('input');

    // Share button should now reflect the dirty state
    expect(elements.shareLinkBtn.disabled).toBe(true);
    expect(elements.shareLinkBtn.title).toBe('텍스트가 변경되었습니다. 다시 검사해 주세요');
  });

  it('focuses the input field and skips analysis when the lint button is clicked with empty text', () => {
    const { context, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);

    elements.inputText.value = '';
    elements.lintBtn.dispatch('click');

    expect(elements.inputText.focus).toHaveBeenCalled();
    expect(context.KRDSLint.lint).not.toHaveBeenCalled();
  });

  it('auto-loads and lints text from the URL t= query parameter without showing a toast on failure', () => {
    const { context, elements } = buildContext();
    context.window.location.search = '?t=' + encodeURIComponent('귀하의 신청이 접수되었습니다.');

    context.KRDSLint.lint = vi.fn(() => ({
      score: 82,
      summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
      issues: [{ line: 1, col: 1, severity: 'error', category: '행정어', message: '"귀하" 사용', match: '귀하', suggestion: '→ 고객님', type: 'admin-jargon' }],
    }));

    vm.runInNewContext(SOURCE, context);

    expect(elements.inputText.value).toBe('귀하의 신청이 접수되었습니다.');
    expect(context.KRDSLint.lint).toHaveBeenCalledWith('귀하의 신청이 접수되었습니다.', expect.anything());
  });

  it('suppresses the error toast when URL param lint fails due to lint engine unavailability', () => {
    const { context, elements } = buildContext();
    context.window.location.search = '?t=' + encodeURIComponent('귀하의 신청이 접수되었습니다.');
    context.KRDSLint = undefined;

    vm.runInNewContext(SOURCE, context);

    expect(elements.toast.textContent).toBe('');
    expect(elements.inputText.value).toBe('귀하의 신청이 접수되었습니다.');
  });

  it('silently skips admin-jargon issues with out-of-range coordinates and leaves improved text unchanged', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 0,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어',
          match: '귀하',
          suggestion: '→ 고객님',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);
    elements.inputText.value = '귀하의 서류';
    elements.lintBtn.dispatch('click');
    expect(elements.improvedText.textContent).toBe('귀하의 서류');
  });

  it('silently skips an admin-jargon issue whose line number exceeds the input text line count', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 99,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어',
          match: '귀하',
          suggestion: '→ 고객님',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);
    elements.inputText.value = '귀하의 서류';
    elements.lintBtn.dispatch('click');
    expect(elements.improvedText.textContent).toBe('귀하의 서류');
  });

  it('silently skips an admin-jargon issue when the match text no longer appears at the expected column', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 1, warnings: 0, infos: 0 },
        issues: [{
          line: 1,
          col: 1,
          severity: 'error',
          category: '행정어',
          message: '행정어',
          match: '귀하',
          suggestion: '→ 고객님',
          type: 'admin-jargon',
        }],
      },
    });
    vm.runInNewContext(SOURCE, context);
    elements.inputText.value = '안녕하세요';
    elements.lintBtn.dispatch('click');
    expect(elements.improvedText.textContent).toBe('안녕하세요');
  });

  it('skips an overlapping issue in the highlight view when its start falls inside the previous mark', () => {
    const { context, elements } = buildContext({
      lintResult: {
        score: 61,
        summary: { errors: 2, warnings: 0, infos: 0 },
        issues: [
          {
            line: 1,
            col: 1,
            severity: 'error',
            category: '패턴',
            message: '첫 번째 이슈',
            match: 'ERROR',
            suggestion: '',
            type: 'pattern',
          },
          {
            line: 1,
            col: 3,
            severity: 'error',
            category: '패턴',
            message: '두 번째 이슈 (중복)',
            match: 'ROR',
            suggestion: '',
            type: 'pattern',
          },
        ],
      },
    });
    vm.runInNewContext(SOURCE, context);
    elements.inputText.value = 'ERROR CODE';
    elements.lintBtn.dispatch('click');
    const html = elements.highlightedText.innerHTML;
    expect((html.match(/<mark/g) || []).length).toBe(1);
  });
});
