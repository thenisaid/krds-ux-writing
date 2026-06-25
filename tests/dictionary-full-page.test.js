import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML_SOURCE = fs.readFileSync(path.join(process.cwd(), 'dictionary/full.html'), 'utf8');
const SCRIPT_SOURCE = fs.readFileSync(path.join(process.cwd(), 'dictionary/full.js'), 'utf8');

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
    querySelector(selector) {
      if (selector === '.count') return options.countNode || null;
      return null;
    },
    focus: vi.fn(),
  };
}

function createFilterButton(cat, isActive) {
  const countNode = createElement({ textContent: '0' });
  return createElement({
    dataset: { cat },
    classes: isActive ? ['active'] : [],
    attributes: { 'aria-pressed': isActive ? 'true' : 'false' },
    countNode,
  });
}

function buildContext(options = {}) {
  const filterBtns = [
    createFilterButton('all', true),
    createFilterButton('admin', false),
    createFilterButton('double', false),
    createFilterButton('foreign', false),
    createFilterButton('ornate', false),
    createFilterButton('formal', false),
  ];
  const elements = {
    searchInput: createElement({ value: options.searchValue || '' }),
    searchClear: createElement({ style: { display: 'none' } }),
    resultCount: createElement({ innerHTML: '' }),
    emptyState: createElement({ style: { display: 'none' } }),
    dictBody: createElement({ innerHTML: '' }),
    fullGlossaryTotal: createElement({ textContent: '' }),
    fullGlossaryCategoryCount: createElement({ textContent: '' }),
    fullGlossaryGenerated: createElement({ textContent: '' }),
  };
  const table = createElement({ style: { display: '' } });
  const dictData = options.dictData || {
    generated: '2026-06-10',
    entries: [
      { banned: '귀하', alt: '신청인', cat: '행정 관습어', context: '공통' },
      { banned: '인지대', alt: '재판 수수료', cat: '전문 용어', context: '법원' },
      { banned: '친절히 안내드리오니', alt: '안내합니다', cat: '과도한 경어', context: '안내문' },
      { banned: '관련 서류 일체', alt: '필요한 서류', cat: '과도한 수식', context: '공통' },
      { banned: '하지 않으시면 안 됩니다', alt: '반드시 해야 합니다', cat: '이중 부정', context: '안내문' },
    ],
  };

  const context = {
    document: {
      documentElement: {
        setAttribute() {},
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(selector) {
        if (selector === '.table-wrap table') return table;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.filter-btn') return filterBtns;
        return [];
      },
    },
    window: {
      KRDS_JARGON_DICT: dictData,
      matchMedia() {
        return {
          matches: false,
          addEventListener() {},
        };
      },
    },
    KRDS_JARGON_DICT: dictData,
    localStorage: {
      getItem() { return null; },
    },
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, elements, filterBtns, table };
}

describe('dictionary full page html', () => {
  it('exposes the full glossary shell and loads the generated dictionary before the renderer', () => {
    expect(HTML_SOURCE).toContain('행정어 대체어 사전 전체 공개본');
    expect(HTML_SOURCE).toContain('전체 공개본입니다.');
    expect(HTML_SOURCE).toContain('data-cat="ornate"');
    expect(HTML_SOURCE).toContain('/krds-ux-writing/corpus/');
    expect(HTML_SOURCE).toContain('/krds-ux-writing/jargon-dictionary.json');

    const dictIndex = HTML_SOURCE.indexOf('../jargon-dictionary.js');
    const fullIndex = HTML_SOURCE.indexOf('full.js');
    expect(dictIndex).toBeGreaterThanOrEqual(0);
    expect(fullIndex).toBeGreaterThan(dictIndex);
  });
});

describe('dictionary full page script', () => {
  it('renders the full glossary counts and rows from the generated dictionary asset', () => {
    const { context, elements, filterBtns } = buildContext();
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.fullGlossaryTotal.textContent).toBe('5');
    expect(elements.fullGlossaryCategoryCount.textContent).toBe('5');
    expect(elements.fullGlossaryGenerated.textContent).toBe('2026-06-10');
    expect(filterBtns[0].querySelector('.count').textContent).toBe('5');
    expect(filterBtns[1].querySelector('.count').textContent).toBe('1');
    expect(filterBtns[3].querySelector('.count').textContent).toBe('1');
    expect(filterBtns[4].querySelector('.count').textContent).toBe('1');
    expect(elements.resultCount.innerHTML).toContain('<strong>5</strong>');
    expect(elements.dictBody.innerHTML).toContain('귀하');
    expect(elements.dictBody.innerHTML).toContain('과도한수식');
  });

  it('filters by search and category while keeping pressed-button state in sync', () => {
    const { context, elements, filterBtns, table } = buildContext();
    vm.runInNewContext(SCRIPT_SOURCE, context);

    filterBtns[3].dispatch('click');

    expect(filterBtns[0].classList.contains('active')).toBe(false);
    expect(filterBtns[0].getAttribute('aria-pressed')).toBe('false');
    expect(filterBtns[3].classList.contains('active')).toBe(true);
    expect(filterBtns[3].getAttribute('aria-pressed')).toBe('true');
    expect(elements.resultCount.innerHTML).toContain('<strong>1</strong>');
    expect(elements.dictBody.innerHTML).toContain('인지대');
    expect(elements.dictBody.innerHTML).not.toContain('귀하');

    elements.searchInput.value = '없는 검색어';
    elements.searchInput.dispatch('input');

    expect(elements.resultCount.innerHTML).toContain('<strong>0</strong>');
    expect(elements.emptyState.style.display).toBe('block');
    expect(table.style.display).toBe('none');
    expect(elements.searchClear.style.display).toBe('block');

    elements.searchClear.dispatch('click');

    expect(elements.searchInput.value).toBe('');
    expect(elements.searchClear.style.display).toBe('none');
    expect(elements.emptyState.style.display).toBe('none');
    expect(table.style.display).toBe('');
  });

  it('maps 외래어 category to the foreign key (second switch case)', () => {
    const { context, elements } = buildContext({
      dictData: {
        generated: '2026-01-01',
        entries: [
          { banned: '인보이스', alt: '청구서', cat: '외래어', context: '공통' },
        ],
      },
    });
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.dictBody.innerHTML).toContain('cat-foreign');
    expect(elements.dictBody.innerHTML).toContain('외래어·전문용어');
  });

  it('maps an unrecognised category to admin via the default switch case', () => {
    const { context, elements } = buildContext({
      dictData: {
        generated: '2026-01-01',
        entries: [
          { banned: '미지정', alt: '기타', cat: '알 수 없는 분류', context: '공통' },
        ],
      },
    });
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.dictBody.innerHTML).toContain('cat-admin');
  });

  it('shows a dash for the generated date when rawData.generated is absent', () => {
    const { context, elements } = buildContext({
      dictData: {
        entries: [
          { banned: '귀하', alt: '신청인', cat: '행정 관습어', context: '공통' },
        ],
      },
    });
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.fullGlossaryGenerated.textContent).toBe('-');
  });

  it('renders no rows and shows zero count when rawData is null (buildEntries returns [])', () => {
    const { context, elements } = buildContext({
      dictData: null,
    });
    context.window.KRDS_JARGON_DICT = null;
    context.KRDS_JARGON_DICT = null;
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.resultCount.innerHTML).toContain('<strong>0</strong>');
    expect(elements.dictBody.innerHTML).toBe('');
  });

  it('does not throw and skips all setup when required DOM elements are missing', () => {
    const context = {
      document: {
        documentElement: { setAttribute() {} },
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
      },
      window: { KRDS_JARGON_DICT: null, matchMedia() { return { matches: false, addEventListener() {} }; } },
      KRDS_JARGON_DICT: null,
      localStorage: { getItem() { return null; } },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SCRIPT_SOURCE, context)).not.toThrow();
  });

  it('silently skips the badge update for a filter button whose querySelector returns no .count child', () => {
    const { context, elements, filterBtns } = buildContext();
    filterBtns[1].querySelector = () => null;

    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(filterBtns[0].querySelector('.count').textContent).toBe('5');
    expect(elements.dictBody.innerHTML).toContain('귀하');
  });

  it('reads KRDS_JARGON_DICT from globalThis when window.KRDS_JARGON_DICT is absent', () => {
    const { context, elements } = buildContext();
    context.window.KRDS_JARGON_DICT = null;

    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.dictBody.innerHTML).toContain('귀하');
    expect(elements.fullGlossaryTotal.textContent).toBe('5');
  });

  it('falls back to "공통" for the context column when entry.context is absent', () => {
    const { context, elements } = buildContext({
      dictData: {
        generated: '2026-01-01',
        entries: [
          { banned: '귀하', alt: '신청인', cat: '행정 관습어' },
        ],
      },
    });
    vm.runInNewContext(SCRIPT_SOURCE, context);

    expect(elements.dictBody.innerHTML).toContain('공통');
  });
});
