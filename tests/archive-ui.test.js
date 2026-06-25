import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'archive.js'), 'utf8');

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
    id: options.id || '',
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
    click() {
      this.dispatch('click');
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
  const markdown = options.markdown || [
    '## Cycle 1',
    '### H1 — 첫 번째 이슈 ★ [A]',
    '**원문**: 찾을단어가 포함된 문장',
    '**문제**: 설명',
    '**권장 개선안**: 개선',
    '',
    '### H2 — 두 번째 이슈 ★ [B]',
    '**원문**: 다른 문장',
    '**문제**: 설명',
    '**권장 개선안**: 개선',
  ].join('\n');
  const tabs = [
    createElement({ id: 'arc-tab-jeongbu24', attributes: { 'aria-selected': 'false', 'aria-controls': 'arc-panel-jeongbu24' }, classes: ['arc-tab'] }),
    createElement({ id: 'arc-tab-hometax', attributes: { 'aria-selected': 'true', 'aria-controls': 'arc-panel-hometax' }, classes: ['arc-tab'] }),
  ];
  const panels = [
    createElement({ id: 'arc-panel-jeongbu24', classes: ['arc-panel'] }),
    createElement({ id: 'arc-panel-hometax', classes: ['arc-panel'] }),
  ];

  const hometaxSearch = createElement({ id: 'arc-search-hometax', value: '찾을단어' });
  const elements = {
    themeToggle: createElement({ id: 'themeToggle' }),
    'arc-search-jeongbu24': createElement({ id: 'arc-search-jeongbu24', value: '' }),
    'arc-search-hometax': hometaxSearch,
    'arc-search-efamily': createElement({ id: 'arc-search-efamily', value: '' }),
    'arc-grid-jeongbu24': createElement({ id: 'arc-grid-jeongbu24' }),
    'arc-grid-hometax': createElement({ id: 'arc-grid-hometax' }),
    'arc-grid-efamily': createElement({ id: 'arc-grid-efamily' }),
    'arc-result-jeongbu24': createElement({ id: 'arc-result-jeongbu24' }),
    'arc-result-hometax': createElement({ id: 'arc-result-hometax' }),
    'arc-result-efamily': createElement({ id: 'arc-result-efamily' }),
    'arc-count-badge-jeongbu24': createElement({ id: 'arc-count-badge-jeongbu24' }),
    'arc-count-badge-hometax': createElement({ id: 'arc-count-badge-hometax' }),
    'arc-count-badge-efamily': createElement({ id: 'arc-count-badge-efamily' }),
    'arc-panel-jeongbu24': panels[0],
    'arc-panel-hometax': panels[1],
  };
  const filterBtns = [
    createElement({ dataset: { agency: 'jeongbu24', principle: 'all' }, classes: ['arc-filter', 'active'], attributes: { 'aria-pressed': 'true' } }),
    createElement({ dataset: { agency: 'hometax', principle: 'all' }, classes: ['arc-filter', 'active'], attributes: { 'aria-pressed': 'true' } }),
    createElement({ dataset: { agency: 'efamily', principle: 'all' }, classes: ['arc-filter', 'active'], attributes: { 'aria-pressed': 'true' } }),
  ];

  const document = {
    documentElement: {
      theme: 'light',
      setAttribute(name, value) {
        if (name === 'data-theme') this.theme = String(value);
      },
      getAttribute(name) {
        return name === 'data-theme' ? this.theme : null;
      },
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.arc-tab') return tabs;
      if (selector === '.arc-panel') return panels;
      const agencyMatch = selector.match(/^\[data-agency="([^"]+)"\]$/);
      if (agencyMatch) {
        return filterBtns.filter((btn) => btn.dataset.agency === agencyMatch[1]);
      }
      return [];
    },
  };

  const context = {
    document,
    window: {},
    fetch: vi.fn(async (url) => {
      if (!String(url).includes('hometax-guide.md')) {
        throw new Error('unexpected url ' + url);
      }
      return {
        ok: true,
        async text() {
          return markdown;
        },
      };
    }),
    localStorage: {
      setItem() {},
    },
    clearTimeout() {},
    setTimeout(fn) {
      fn();
      return 1;
    },
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  return { context, tabs, panels, elements, filterBtns };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('archive page initialization', () => {
  it('synchronizes the theme toggle label and icon with the restored theme on load and click', () => {
    const { context, elements } = buildContext();
    context.document.documentElement.setAttribute('data-theme', 'dark');
    vm.runInNewContext(SOURCE, context);

    expect(elements.themeToggle.textContent).toBe('☾');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('라이트모드 전환');

    elements.themeToggle.dispatch('click');

    expect(context.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(elements.themeToggle.textContent).toBe('☀');
    expect(elements.themeToggle.getAttribute('aria-label')).toBe('다크모드 전환');
  });

  it('does not throw when the archive DOM is incomplete', () => {
    const context = {
      document: {
        getElementById() { return null; },
        querySelectorAll() { return []; },
        documentElement: {
          setAttribute() {},
          getAttribute() { return 'light'; },
        },
      },
      window: {},
      localStorage: {
        setItem() {},
      },
      Array,
      console,
      globalThis: null,
    };
    context.globalThis = context;

    expect(() => vm.runInNewContext(SOURCE, context)).not.toThrow();
  });

  it('loads the currently selected tab and applies the restored search value on startup', async () => {
    const { context, tabs, panels, elements } = buildContext();
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(context.fetch).toHaveBeenCalledTimes(1);
    expect(String(context.fetch.mock.calls[0][0])).toContain('hometax-guide.md');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(panels[1].classList.contains('active')).toBe(true);
    expect(panels[0].classList.contains('active')).toBe(false);
    expect(elements['arc-count-badge-hometax'].textContent).toBe(2);
    expect(elements['arc-result-hometax'].textContent).toBe('1개 표시 / 전체 2개');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).not.toContain('H2');
  });

  it('keeps cycle labels aligned when the same issue id appears in multiple cycle sections', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### E229 — 첫 번째 이슈 ★ [A]',
        '**원문**: 첫 문장',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
        '',
        '## Cycle 2',
        '### E229 — 두 번째 이슈 ★★ [B]',
        '**원문**: 둘째 문장',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const cards = Array.from(
      elements['arc-grid-hometax'].innerHTML.matchAll(
        /arc-card-cycle">Cycle (\d+)<\/span><\/div><p class="arc-card-title">([^<]+)<\/p>/g
      )
    ).map((match) => ({ cycle: Number(match[1]), title: match[2] }));

    expect(cards).toEqual([
      { cycle: 1, title: '첫 번째 이슈' },
      { cycle: 2, title: '두 번째 이슈' },
    ]);
  });

  it('parses colon-style issue headings with long principle labels', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 6',
        '### H61: "내용보기" 링크 텍스트 중복 ★★ [원칙 B — 정보핵심화]',
        '**원문**: 내용보기',
        '**문제**: 같은 링크 문구가 반복됩니다.',
        '**개선안**: 맥락을 포함한 링크 텍스트로 바꿉니다.',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';

    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(elements['arc-count-badge-hometax'].textContent).toBe(1);
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H61');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('[B]');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('내용보기');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('같은 링크 문구가 반복됩니다.');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('맥락을 포함한 링크 텍스트로 바꿉니다.');
  });

  it('parses legacy quote-style issue blocks that store principles below the heading', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H1 — 검색창 어조 개선',
        '',
        '```',
        '🚫 현재:',
        'placeholder: 검색어를 입력하세요!',
        '',
        '✅ 개선:',
        'placeholder: 세금·서비스 이름을 입력하세요 (예: 부가세 신고, 환급 조회)',
        '```',
        '',
        '> 원칙: **B** 예시 힌트 추가, **A** 느낌표 제거 → 공공기관 어조',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';

    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(elements['arc-count-badge-hometax'].textContent).toBe(1);
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('[B/A]');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('placeholder: 검색어를 입력하세요!');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('placeholder: 세금·서비스 이름을 입력하세요');
  });

  it('parses legacy table-metadata issue blocks with inline severity rows', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 4',
        '### H48 — 날짜 약식 표기',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **위치** | 공지사항 제목 |',
        '| **원칙** | C (심리적 안전망) |',
        '| **심각도** | ★★★ |',
        '',
        '**현재 텍스트**',
        '```',
        "정부24 시스템 개선사항 안내('26.3.27.)",
        '```',
        '',
        '**문제**',
        '링크가 빈 href로 구현되어 클릭해도 동작하지 않습니다.',
        '',
        '**B/A 예시**',
        '| B (현재) | A (개선) |',
        '|----------|----------|',
        '| `<a href="">페이스북</a>` | 공유 미지원 시 버튼 제거 또는 비활성 표시 |',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';

    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(elements['arc-count-badge-hometax'].textContent).toBe(1);
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H48');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('★★★');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('[C]');
    expect(elements['arc-grid-hometax'].innerHTML).toContain("정부24 시스템 개선사항 안내('26.3.27.)");
    expect(elements['arc-grid-hometax'].innerHTML).toContain('링크가 빈 href로 구현되어 클릭해도 동작하지 않습니다.');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('공유 미지원 시 버튼 제거 또는 비활성 표시');
  });

  it('prevents default arrow-key behavior while switching archive tabs', () => {
    const { context, tabs } = buildContext();
    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    tabs[1].dispatch('keydown', { key: 'ArrowRight', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(tabs[0].focus).toHaveBeenCalled();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('updates archive filter buttons as pressed states', () => {
    const { context, filterBtns } = buildContext();
    const hometaxAll = filterBtns[1];
    const hometaxAlt = createElement({
      dataset: { agency: 'hometax', principle: 'A' },
      classes: ['arc-filter'],
      attributes: { 'aria-pressed': 'false' },
    });
    const originalQuerySelectorAll = context.document.querySelectorAll;
    context.document.querySelectorAll = function (selector) {
      if (selector === '[data-agency="hometax"]') return [hometaxAll, hometaxAlt];
      return originalQuerySelectorAll.call(this, selector);
    };

    vm.runInNewContext(SOURCE, context);

    hometaxAlt.dispatch('click');

    expect(hometaxAll.classList.contains('active')).toBe(false);
    expect(hometaxAll.getAttribute('aria-pressed')).toBe('false');
    expect(hometaxAlt.classList.contains('active')).toBe(true);
    expect(hometaxAlt.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not start duplicate fetches when the active archive tab is clicked during loading', () => {
    const { context, tabs, elements } = buildContext();
    context.fetch = vi.fn(() => new Promise(() => {}));
    elements['arc-grid-hometax'].innerHTML = '<div class="arc-state">이슈 불러오는 중...</div>';

    vm.runInNewContext(SOURCE, context);

    tabs[1].dispatch('click');
    tabs[1].dispatch('click');

    expect(context.fetch).toHaveBeenCalledTimes(1);
    expect(elements['arc-grid-hometax'].innerHTML).toContain('이슈 불러오는 중');
  });

  it('keeps the loading state visible when search changes before the selected archive finishes loading', () => {
    const { context, elements } = buildContext();
    context.fetch = vi.fn(() => new Promise(() => {}));
    elements['arc-grid-hometax'].innerHTML = '<div class="arc-state">이슈 불러오는 중...</div>';

    vm.runInNewContext(SOURCE, context);

    elements['arc-search-hometax'].value = '새 검색어';
    elements['arc-search-hometax'].dispatch('input');

    expect(elements['arc-grid-hometax'].innerHTML).toContain('이슈 불러오는 중');
    expect(elements['arc-grid-hometax'].innerHTML).not.toContain('검색 결과가 없습니다');
    expect(elements['arc-result-hometax'].textContent).toBe('');
  });

  it('escapes HTML in severity field parsed from table cell to prevent innerHTML injection', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H1 — XSS 테스트 이슈 [A]',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **원칙** | A |',
        '| **심각도** | <script>alert(1)</script> |',
        '',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';

    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('archive page — additional branch coverage', () => {
  it('shows "검색 결과가 없습니다." when no issues match the active search', async () => {
    const { context, elements } = buildContext();
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    elements['arc-search-hometax'].value = '일치하지않는검색어ZZZ';
    elements['arc-search-hometax'].dispatch('input');

    expect(elements['arc-grid-hometax'].innerHTML).toContain('검색 결과가 없습니다.');
  });

  it('displays "로딩 실패" when the fetch responds with a non-OK HTTP status', async () => {
    const { context, elements } = buildContext();
    context.fetch = vi.fn(async () => ({ ok: false, status: 503 }));
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(elements['arc-grid-hometax'].innerHTML).toContain('로딩 실패');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('HTTP 503');
    expect(elements['arc-grid-hometax'].innerHTML).not.toContain('<script>');
  });

  it('calls applyFilters without a new fetch when the same tab is clicked after its data is loaded', async () => {
    const { context, tabs, elements } = buildContext();
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const fetchCountBefore = context.fetch.mock.calls.length;
    tabs[1].dispatch('click');

    expect(context.fetch.mock.calls.length).toBe(fetchCountBefore);
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
  });

  it('matches issues by principle name when the search term is a Korean principle label like "무번역"', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H1 — 무번역 원칙 이슈 ★ [A]',
        '**원문**: 텍스트',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
        '',
        '### H2 — 정보핵심화 이슈 ★★ [B]',
        '**원문**: 다른 텍스트',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    elements['arc-search-hometax'].value = '무번역';
    elements['arc-search-hometax'].dispatch('input');

    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).not.toContain('H2');
  });

  it('renders a card with an empty principle bracket when severity is set but no principle code is found', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H99 — 원칙 없는 이슈',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **심각도** | ★★★ |',
        '',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).toContain('H99');
    expect(html).toContain('★★★');
    expect(html).toContain('[]');
  });

  it('omits the Cycle label when the issue has no cycle header (cycle 0)', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '### H10 — 사이클 없는 이슈 ★ [A]',
        '**원문**: 원문 텍스트',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).toContain('H10');
    expect(html).not.toContain('arc-card-cycle');
    expect(html).not.toContain('Cycle ');
  });

  it('omits the original row when the issue block has no original field', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H20 — 원문 없는 이슈 ★ [B]',
        '**문제**: 설명만 있습니다',
        '**권장 개선안**: 개선안',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).toContain('H20');
    expect(html).not.toContain('arc-card-label">원문');
  });

  it('falls back to sev-2 class for an unrecognized severity string', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H30 — 미분류 심각도 이슈',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **원칙** | A |',
        '| **심각도** | 높음 |',
        '',
        '**문제**: 설명',
        '**권장 개선안**: 개선',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).toContain('H30');
    expect(html).toContain('class="arc-card-sev sev-2"');
  });

  it('uses the "수정 제안" field as the recommendation fallback when "권장 개선안" is absent', async () => {
    const { context, elements } = buildContext({
      markdown: [
        '## Cycle 1',
        '### H50 — 수정 제안 필드 이슈 ★ [A]',
        '',
        '**원문**: 현재 텍스트',
        '**문제**: 문제 설명',
        '**수정 제안**: 수정 제안 내용',
      ].join('\n'),
    });
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    const html = elements['arc-grid-hometax'].innerHTML;
    expect(html).toContain('H50');
    expect(html).toContain('수정 제안 내용');
  });

  it('renders no countEl text when renderGrid receives a null count element', async () => {
    const { context, elements } = buildContext();
    delete elements['arc-result-hometax'];
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);

    await expect(Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve()).then(() => Promise.resolve())).resolves.toBeUndefined();

    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
  });

  it('clears the archive search and reapplies filters when Escape is pressed', async () => {
    const { context, elements } = buildContext();
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    elements['arc-search-hometax'].value = '찾을단어';
    elements['arc-search-hometax'].dispatch('input');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).not.toContain('H2');

    elements['arc-search-hometax'].dispatch('keydown', { key: 'Escape' });

    expect(elements['arc-search-hometax'].value).toBe('');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H2');
  });

  it('defaults filter to "all" when no filter button has the active class on init', async () => {
    const { context, elements, filterBtns } = buildContext();
    filterBtns.forEach((btn) => btn.classList.remove('active'));
    elements['arc-search-hometax'].value = '';
    vm.runInNewContext(SOURCE, context);
    await flushAsyncWork();

    expect(elements['arc-grid-hometax'].innerHTML).toContain('H1');
    expect(elements['arc-grid-hometax'].innerHTML).toContain('H2');
  });

  it('moves focus to the previous tab when ArrowLeft is pressed on the first tab (wraps to last)', () => {
    const { context, tabs } = buildContext();
    vm.runInNewContext(SOURCE, context);

    const preventDefault = vi.fn();
    tabs[0].dispatch('keydown', { key: 'ArrowLeft', preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(tabs[1].focus).toHaveBeenCalled();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });
});
