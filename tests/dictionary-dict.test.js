import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'dictionary/dict.js'), 'utf8');

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
    focus: vi.fn(),
  };
}

function buildContext(options = {}) {
  const rows = [
    createElement({ dataset: { cat: 'admin' }, textContent: '귀하 내일까지 제출', style: {} }),
    createElement({ dataset: { cat: 'double' }, textContent: '미비하지 않으면 신청 가능', style: {} }),
  ];
  const filterBtns = [
    createElement({ dataset: { cat: 'all' }, classes: ['active'], attributes: { 'aria-pressed': 'true' } }),
    createElement({ dataset: { cat: 'admin' }, classes: [], attributes: { 'aria-pressed': 'false' } }),
  ];
  if (options.activeCategory === 'admin') {
    filterBtns[0].classList.remove('active');
    filterBtns[1].classList.add('active');
  }

  const elements = {
    searchInput: createElement({ value: options.searchValue || '' }),
    searchClear: createElement({ style: { display: 'none' } }),
    resultCount: createElement(),
    emptyState: createElement({ style: { display: 'none' } }),
  };
  const table = createElement({ style: { display: '' } });

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
        if (selector === '#dictBody tr') return rows;
        if (selector === '.filter-btn') return filterBtns;
        return [];
      },
    },
    window: {
      matchMedia() {
        return {
          matches: false,
          addEventListener() {},
        };
      },
    },
    localStorage: {
      getItem() { return null; },
    },
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, rows, filterBtns, elements, table };
}

describe('dictionary filter initialization', () => {
  it('does not throw when the dictionary DOM is incomplete', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        documentElement: { setAttribute() {} },
      },
      window: {},
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('applies the restored search value on initial load', () => {
    const { context, rows, elements } = buildContext({ searchValue: '귀하' });
    vm.runInNewContext(SOURCE, context);

    expect(rows[0].style.display).toBe('');
    expect(rows[1].style.display).toBe('none');
    expect(elements.searchClear.style.display).toBe('block');
    expect(elements.resultCount.innerHTML).toContain('<strong>1</strong>');
    expect(elements.emptyState.style.display).toBe('none');
  });

  it('respects the active category button on initial load', () => {
    const { context, rows, elements } = buildContext({ activeCategory: 'admin' });
    vm.runInNewContext(SOURCE, context);

    expect(rows[0].style.display).toBe('');
    expect(rows[1].style.display).toBe('none');
    expect(elements.resultCount.innerHTML).toContain('<strong>1</strong>');
  });

  it('announces the active dictionary category as a pressed button', () => {
    const { context, filterBtns } = buildContext();
    vm.runInNewContext(SOURCE, context);

    filterBtns[1].dispatch('click');

    expect(filterBtns[0].classList.contains('active')).toBe(false);
    expect(filterBtns[0].getAttribute('aria-pressed')).toBe('false');
    expect(filterBtns[1].classList.contains('active')).toBe(true);
    expect(filterBtns[1].getAttribute('aria-pressed')).toBe('true');
  });
});
