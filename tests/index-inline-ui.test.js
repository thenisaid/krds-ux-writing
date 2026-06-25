import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HTML = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const INLINE_SCRIPTS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const BASE_PATH_SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/base-path.js'), 'utf8');
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
  const element = {
    hidden: !!options.hidden,
    classList: createClassList(options.classes || []),
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
        currentTarget: element,
        target: element,
        ...event,
      }));
    },
    click() {
      element.dispatch('click');
    },
    focus: vi.fn(),
    setAttribute(name, value) {
      if (name === 'hidden') element.hidden = true;
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    querySelector() {
      return null;
    },
  };
  return element;
}

function runHomeScriptsInHtmlOrder(context) {
  const navScriptIndex = HTML.indexOf(SOURCE);
  const basePathScriptIndex = HTML.indexOf('shared/base-path.js');

  if (basePathScriptIndex !== -1 && basePathScriptIndex < navScriptIndex) {
    vm.runInNewContext(BASE_PATH_SOURCE, context);
    vm.runInNewContext(SOURCE, context);
    return;
  }

  vm.runInNewContext(SOURCE, context);
  if (basePathScriptIndex !== -1) {
    vm.runInNewContext(BASE_PATH_SOURCE, context);
  }
}

describe('index inline derived-guide tabs', () => {
  it('prevents default arrow-key behavior while switching tabs', () => {
    const firstTab = createElement({
      attributes: { 'aria-controls': 'dg-panel-jeongbu24', 'aria-selected': 'true', href: '/krds-ux-writing/' },
    });
    const secondTab = createElement({
      attributes: { 'aria-controls': 'dg-panel-hometax', 'aria-selected': 'false', href: '/krds-ux-writing/' },
    });
    const firstPanel = createElement({ hidden: false });
    const secondPanel = createElement({ hidden: true });
    const tabList = {
      querySelectorAll(selector) {
        return selector === '.dg-tab' ? [firstTab, secondTab] : [];
      },
    };

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [];
        if (selector === '.dg-panel') return [firstPanel, secondPanel];
        return [];
      },
      querySelector(selector) {
        if (selector === '.dg-tabs') return tabList;
        return null;
      },
      getElementById(id) {
        if (id === 'dg-panel-jeongbu24') return firstPanel;
        if (id === 'dg-panel-hometax') return secondPanel;
        return null;
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing/',
        },
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    firstTab.dispatch('keydown', { key: 'ArrowRight', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(secondTab.focus).toHaveBeenCalled();
    expect(firstTab.getAttribute('aria-selected')).toBe('false');
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    expect(firstPanel.hidden).toBe(true);
    expect(secondPanel.hidden).toBe(false);
  });

  it('marks the same-page case-studies nav link active when the current hash matches it', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing/',
          hash: '#case-studies',
        },
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(true);
  });

  it('does not mark the case-studies nav link active when the current query differs from the hash link target', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing/',
          search: '?view=recent',
          hash: '#case-studies',
        },
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(false);
  });

  it('marks the same-page case-studies nav link active when the site root is opened without a trailing slash', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing',
          hash: '#case-studies',
        },
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(true);
  });

  it('marks the same-page case-studies nav link active when the site root is opened via explicit index.html', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/krds-ux-writing/index.html',
          hash: '#case-studies',
        },
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(true);
  });

  it('marks the same-page case-studies nav link active on local preview paths after base-path rewriting', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });
    const currentScript = {
      src: 'https://example.com/preview/KRDS/shared/base-path.js',
      getAttribute(name) {
        return name === 'src' ? this.src : null;
      },
    };

    const document = {
      currentScript,
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        if (selector === '[href]') return [principlesLink, caseStudiesLink];
        if (selector === '[src]') return [];
        return [];
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
      getElementsByTagName() {
        return [currentScript];
      },
    };

    const context = {
      document,
      window: {
        location: {
          pathname: '/preview/KRDS/index.html',
          href: 'https://example.com/preview/KRDS/index.html',
          hash: '#case-studies',
        },
      },
      URL,
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    runHomeScriptsInHtmlOrder(context);

    expect(principlesLink.classList.contains('active')).toBe(false);
    expect(caseStudiesLink.classList.contains('active')).toBe(true);
    expect(caseStudiesLink.getAttribute('href')).toBe('/preview/KRDS/#case-studies');
  });

  it('marks a path-only nav link active when the pathname matches without a hash', () => {
    const principlesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/principles/' },
    });
    const caseStudiesLink = createElement({
      classes: ['gnb-nav-link'],
      attributes: { href: '/krds-ux-writing/#case-studies' },
    });

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [principlesLink, caseStudiesLink];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() { return null; },
      getElementById() { return null; },
    };

    const context = {
      document,
      window: { location: { pathname: '/krds-ux-writing/principles/', hash: '' } },
      Array, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);

    expect(principlesLink.classList.contains('active')).toBe(true);
    expect(caseStudiesLink.classList.contains('active')).toBe(false);
  });

  it('toggles the FAQ item open class and aria attributes when the question button is clicked', () => {
    const faqQuestion = createElement({ attributes: { 'aria-expanded': 'false' } });
    const faqAnswer = createElement({ attributes: { 'aria-hidden': 'true' } });
    const faqItem = {
      classList: createClassList([]),
      querySelector(selector) {
        if (selector === '.faq-question') return faqQuestion;
        if (selector === '.faq-answer') return faqAnswer;
        return null;
      },
    };

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [faqItem];
        if (selector === '.gnb-nav-link') return [];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector() { return null; },
      getElementById() { return null; },
    };

    const context = {
      document,
      window: { location: { pathname: '/krds-ux-writing/', hash: '' } },
      Array, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);

    faqQuestion.dispatch('click');

    expect(faqItem.classList.contains('open')).toBe(true);
    expect(faqQuestion.getAttribute('aria-expanded')).toBe('true');
    expect(faqAnswer.getAttribute('aria-hidden')).toBe('false');

    faqQuestion.dispatch('click');

    expect(faqItem.classList.contains('open')).toBe(false);
    expect(faqQuestion.getAttribute('aria-expanded')).toBe('false');
    expect(faqAnswer.getAttribute('aria-hidden')).toBe('true');
  });

  it('navigates backward through tabs when ArrowLeft is pressed', () => {
    const firstTab = createElement({
      attributes: { 'aria-controls': 'dg-panel-jeongbu24', 'aria-selected': 'false', href: '/krds-ux-writing/' },
    });
    const secondTab = createElement({
      attributes: { 'aria-controls': 'dg-panel-hometax', 'aria-selected': 'true', href: '/krds-ux-writing/' },
    });
    const firstPanel = createElement({ hidden: true });
    const secondPanel = createElement({ hidden: false });
    const tabList = {
      querySelectorAll(selector) {
        return selector === '.dg-tab' ? [firstTab, secondTab] : [];
      },
    };

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [];
        if (selector === '.dg-panel') return [firstPanel, secondPanel];
        return [];
      },
      querySelector(selector) {
        if (selector === '.dg-tabs') return tabList;
        return null;
      },
      getElementById(id) {
        if (id === 'dg-panel-jeongbu24') return firstPanel;
        if (id === 'dg-panel-hometax') return secondPanel;
        return null;
      },
    };

    const context = {
      document,
      window: { location: { pathname: '/krds-ux-writing/' } },
      Array, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    secondTab.dispatch('keydown', { key: 'ArrowLeft', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(firstTab.focus).toHaveBeenCalled();
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
    expect(secondTab.getAttribute('aria-selected')).toBe('false');
    expect(firstPanel.hidden).toBe(false);
    expect(secondPanel.hidden).toBe(true);
  });

  it('does not crash when a tab click targets a panel id that is absent from the DOM', () => {
    const orphanTab = createElement({
      attributes: { 'aria-controls': 'nonexistent-panel', 'aria-selected': 'false', href: '/krds-ux-writing/' },
    });
    const tabList = {
      querySelectorAll(selector) {
        return selector === '.dg-tab' ? [orphanTab] : [];
      },
    };

    const document = {
      querySelectorAll(selector) {
        if (selector === '.faq-item') return [];
        if (selector === '.gnb-nav-link') return [];
        if (selector === '.dg-panel') return [];
        return [];
      },
      querySelector(selector) {
        if (selector === '.dg-tabs') return tabList;
        return null;
      },
      getElementById() { return null; },
    };

    const context = {
      document,
      window: { location: { pathname: '/krds-ux-writing/' } },
      Array, console, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(SOURCE, context);

    expect(() => orphanTab.dispatch('click')).not.toThrow();
    expect(orphanTab.getAttribute('aria-selected')).toBe('true');
  });
});
