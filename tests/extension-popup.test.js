import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'krds-extension/popup.js'), 'utf8');
const HTML = fs.readFileSync(path.join(process.cwd(), 'krds-extension/popup.html'), 'utf8');
const ROOT = process.cwd();

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
    toString() {
      return [...classes].join(' ');
    },
  };
}

function createElement(options = {}) {
  const listeners = new Map();
  const attributes = new Map(Object.entries(options.attributes || {}));
  let className = options.className || '';
  let textContent = options.textContent || '';
  const element = {
    id: options.id || '',
    tagName: (options.tagName || 'div').toUpperCase(),
    value: options.value || '',
    innerHTML: options.innerHTML || '',
    title: options.title || '',
    dataset: { ...(options.dataset || {}) },
    style: options.style || {},
    parentElement: null,
    children: [],
    classList: createClassList(className.split(/\s+/).filter(Boolean)),
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'class') {
        element.className = String(value);
      }
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
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
    focus: vi.fn(),
    blur: vi.fn(),
    closest(selector) {
      if (selector.startsWith('.')) {
        return element.classList.contains(selector.slice(1)) ? element : null;
      }
      return null;
    },
    querySelectorAll(selector) {
      const matches = [];
      function visit(node) {
        node.children.forEach((child) => {
          if (selector.startsWith('.')) {
            if (child.classList.contains(selector.slice(1))) matches.push(child);
          }
          visit(child);
        });
      }
      visit(element);
      return matches;
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
  };

  Object.defineProperty(element, 'className', {
    get() {
      return className;
    },
    set(value) {
      className = String(value);
      element.classList = createClassList(className.split(/\s+/).filter(Boolean));
    },
  });

  Object.defineProperty(element, 'textContent', {
    get() {
      return textContent;
    },
    set(value) {
      textContent = String(value);
      element.children = [];
    },
  });

  Object.defineProperty(element, 'nextElementSibling', {
    get() {
      if (!element.parentElement) return null;
      const idx = element.parentElement.children.indexOf(element);
      return element.parentElement.children[idx + 1] || null;
    },
  });

  Object.defineProperty(element, 'previousElementSibling', {
    get() {
      if (!element.parentElement) return null;
      const idx = element.parentElement.children.indexOf(element);
      return idx > 0 ? element.parentElement.children[idx - 1] : null;
    },
  });

  return element;
}

function buildPopupContext() {
  const chips = [
    createElement({ className: 'chip', dataset: { section: 'button' } }),
    createElement({ className: 'chip', dataset: { section: 'error' } }),
  ];
  const categoryChips = createElement({ id: 'categoryChips' });
  chips.forEach((chip) => categoryChips.appendChild(chip));

  const elements = {
    searchInput: createElement({ id: 'searchInput' }),
    clearBtn: createElement({ id: 'clearBtn', className: 'search-clear' }),
    resultsList: createElement({ id: 'resultsList' }),
    resultsView: createElement({ id: 'resultsView', style: { display: 'none' } }),
    tipsView: createElement({ id: 'tipsView', style: { display: 'block' } }),
    fullGuideBtn: createElement({ id: 'fullGuideBtn' }),
    openFullBtn: createElement({ id: 'openFullBtn' }),
    categoryChips,
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.chip') return chips;
      return [];
    },
    createElement(tagName) {
      return createElement({ tagName });
    },
  };

  const chrome = {
    tabs: {
      create: vi.fn(),
    },
  };

  const context = {
    document,
    chrome,
    URL,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, chrome, elements, chips };
}

function readHtmlIds(relPath) {
  const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  return new Set([...html.matchAll(/\sid=(['"])(.*?)\1/g)].map((match) => match[2]));
}

function getSectionRoutes() {
  const match = SOURCE.match(/const SECTION_ROUTES = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error('SECTION_ROUTES block not found');
  return vm.runInNewContext('({' + match[1] + '\n})');
}

function resolveRouteTarget(route) {
  const [pathname, hash] = route.split('#');
  let relPath = pathname || '';
  if (!relPath || relPath === '/') relPath = 'index.html';
  if (!relPath.endsWith('.html') && !relPath.endsWith('/')) relPath += '/';
  if (relPath.endsWith('/')) relPath += 'index.html';
  return { relPath, hash: hash || '' };
}

describe('krds extension popup', () => {
  it('uses real buttons for quick actions instead of fake hash links', () => {
    expect(HTML).not.toContain('href="#"');
    expect(HTML).toContain('<button class="chip" type="button"');
    expect(HTML).toContain('<button class="btn-full-guide" id="fullGuideBtn" type="button"');
  });

  it('does not throw when the popup DOM is incomplete', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelectorAll() { return []; },
      },
      chrome: {
        tabs: {
          create() {},
        },
      },
      URL,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('opens category chips on the current site routes instead of dead root anchors', () => {
    const { context, chrome, elements, chips } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.categoryChips.dispatch('click', { target: chips[1] });

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/principles/safety-net/#error-structure',
    });
  });

  it('keeps every quick-route target wired to a real site page and section', () => {
    const routes = getSectionRoutes();

    Object.entries(routes).forEach(([key, route]) => {
      const { relPath, hash } = resolveRouteTarget(route);
      const absolutePath = path.join(ROOT, relPath);

      expect(fs.existsSync(absolutePath), `${key}: ${route}`).toBe(true);

      if (hash) {
        expect(readHtmlIds(relPath).has(hash), `${key}: ${route}`).toBe(true);
      }
    });
  });

  it('announces the active quick chip as a pressed button', () => {
    const { context, elements, chips } = buildPopupContext();
    chips.forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    vm.runInNewContext(SOURCE, context);

    elements.categoryChips.dispatch('click', { target: chips[1] });

    expect(chips[0].classList.contains('active')).toBe(false);
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('opens search results on the mapped guide section URLs', () => {
    const { context, chrome, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    firstResult.dispatch('click');

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/principles/components/#button',
    });
  });

  it('highlights ampersands without breaking escaped entities in search results', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '&';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    const tag = firstResult.querySelector('.result-tag');
    expect(tag).not.toBeNull();
    expect(tag.innerHTML).toContain('<mark>&amp;</mark>');
    expect(tag.innerHTML).not.toContain('<mark>&</mark>amp;');
  });

  it('does not highlight inside escaped HTML entities when searching latin characters', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = 'a';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    const tag = firstResult.querySelector('.result-tag');
    const preview = firstResult.querySelector('.result-preview');
    expect(tag).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(tag.innerHTML).toContain('&amp; CT<mark>A</mark>');
    expect(tag.innerHTML).not.toContain('&<mark>a</mark>mp;');
    expect(preview.innerHTML).toContain('CT<mark>A</mark> 작성법');
    expect(preview.innerHTML).not.toContain('&<mark>a</mark>mp;');
  });

  it('opens a focused search result when activated with the space bar', () => {
    const { context, chrome, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();
    expect(firstResult.getAttribute('role')).toBe('button');

    const preventDefault = vi.fn();
    firstResult.dispatch('keydown', { key: ' ', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/principles/components/#button',
    });
  });

  it('clears stale results when the search query is reset', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();
    expect(elements.clearBtn.classList.contains('visible')).toBe(true);

    elements.clearBtn.dispatch('click');

    expect(elements.searchInput.value).toBe('');
    expect(elements.resultsView.style.display).toBe('none');
    expect(elements.tipsView.style.display).toBe('block');
    expect(elements.clearBtn.classList.contains('visible')).toBe(false);
    expect(elements.resultsList.querySelector('.result-item')).toBeNull();

    const preventDefault = vi.fn();
    elements.searchInput.dispatch('keydown', { key: 'ArrowDown', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(firstResult.focus).not.toHaveBeenCalled();
  });

  it('ignores non-element quick-chip click targets without throwing', () => {
    const { context, chrome, elements, chips } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    expect(() => {
      elements.categoryChips.dispatch('click', { target: { nodeType: 3 } });
    }).not.toThrow();
    expect(chips[0].classList.contains('active')).toBe(false);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('opens the root guide URL when the full guide button is clicked', () => {
    const { context, chrome, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.fullGuideBtn.dispatch('click', { preventDefault: () => {} });

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/',
    });
  });

  it('opens the root guide URL when the open-full button is clicked', () => {
    const { context, chrome, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.openFullBtn.dispatch('click');

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/',
    });
  });

  it('opens a search result when the Enter key is pressed on it', () => {
    const { context, chrome, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    const preventDefault = vi.fn();
    firstResult.dispatch('keydown', { key: 'Enter', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://thenisaid.github.io/krds-ux-writing/principles/components/#button',
    });
  });

  it('moves focus to the first result when ArrowDown is pressed in the search input with results', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    const preventDefault = vi.fn();
    elements.searchInput.dispatch('keydown', { key: 'ArrowDown', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(firstResult.focus).toHaveBeenCalled();
  });

  it('moves focus to the next result item when ArrowDown is pressed on a result', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    // 'a' matches 'button' (CTA) and 'accessibility' (aria) → 2+ results
    elements.searchInput.value = 'a';
    elements.searchInput.dispatch('input');

    const allResults = elements.resultsList.querySelectorAll('.result-item');
    expect(allResults.length).toBeGreaterThan(1);

    const [first, second] = allResults;
    const preventDefault = vi.fn();
    first.dispatch('keydown', { key: 'ArrowDown', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(second.focus).toHaveBeenCalled();
  });

  it('returns focus to the search input when ArrowUp is pressed on the first result', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const firstResult = elements.resultsList.querySelector('.result-item');
    expect(firstResult).not.toBeNull();

    const preventDefault = vi.fn();
    firstResult.dispatch('keydown', { key: 'ArrowUp', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(elements.searchInput.focus).toHaveBeenCalled();
  });

  it('clears the search input and hides results when Escape is pressed', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');
    expect(elements.resultsView.style.display).toBe('block');

    elements.searchInput.dispatch('keydown', { key: 'Escape' });

    expect(elements.searchInput.value).toBe('');
    expect(elements.resultsView.style.display).toBe('none');
    expect(elements.tipsView.style.display).toBe('block');
  });

  it('does not move focus when ArrowDown is pressed on the last result item', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = '버튼';
    elements.searchInput.dispatch('input');

    const allResults = elements.resultsList.querySelectorAll('.result-item');
    expect(allResults.length).toBeGreaterThan(0);
    const lastResult = allResults[allResults.length - 1];
    const focusBefore = lastResult.focus.mock.calls.length;

    const preventDefault = vi.fn();
    lastResult.dispatch('keydown', { key: 'ArrowDown', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(lastResult.focus.mock.calls.length).toBe(focusBefore);
  });

  it('moves focus to the previous result when ArrowUp is pressed on a non-first result', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = 'a';
    elements.searchInput.dispatch('input');

    const allResults = elements.resultsList.querySelectorAll('.result-item');
    expect(allResults.length).toBeGreaterThan(1);
    const [first, second] = allResults;

    const focusBeforeDispatch = elements.searchInput.focus.mock.calls.length;

    const preventDefault = vi.fn();
    second.dispatch('keydown', { key: 'ArrowUp', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    expect(elements.searchInput.focus.mock.calls.length).toBe(focusBeforeDispatch);
  });

  it('shows the empty-state placeholder when the search query matches no entries', () => {
    const { context, elements } = buildPopupContext();
    vm.runInNewContext(SOURCE, context);

    elements.searchInput.value = 'zzzzzzz';
    elements.searchInput.dispatch('input');

    expect(elements.resultsView.style.display).toBe('block');
    const emptyState = elements.resultsList.querySelector('.empty-state');
    expect(emptyState).not.toBeNull();
    expect(emptyState.querySelector('.empty-icon').textContent).toBe('🔍');
    expect(emptyState.querySelector('.empty-text').textContent).toContain('에 대한 결과가 없습니다.');
  });
});
