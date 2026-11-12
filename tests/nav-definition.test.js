import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const require = createRequire(import.meta.url);
const NAV = require('../shared/nav-definition.js');

const ROOT = process.cwd();

describe('nav-definition: 정의 자체 검증 (즉시 강제)', () => {
  it('1차 탭은 4개이며 id 가 고유하다', () => {
    const ids = NAV.PRIMARY_TABS.map((t) => t.id);
    expect(ids).toEqual(['principles', 'dictionary', 'case-studies', 'tools']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('1차 탭 라벨은 원칙·사전·사례·도구 순서이고 홈 탭이 없다', () => {
    expect(NAV.PRIMARY_TABS.map((t) => t.label)).toEqual(['원칙', '사전', '사례', '도구']);
    expect(NAV.PRIMARY_TABS.some((t) => t.label === '홈')).toBe(false);
  });

  it('모든 라벨(1차+2차)이 2자 이상이고 영문 단독이 아니다 (Before/After 는 TODO 로 일시 허용)', () => {
    const offenders = NAV.allLabels()
      .map((label) => ({ label, problems: NAV.labelProblems(label) }))
      .filter((r) => r.problems.length > 0);
    expect(offenders).toEqual([]);
  });

  it('1차 탭 라벨은 서로 고유하다', () => {
    const labels = NAV.PRIMARY_TABS.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('2차 탭 id 는 전체에서 고유하고, 같은 그룹 안에서 라벨도 고유하다', () => {
    const ids = [];
    Object.values(NAV.SECONDARY_TABS).forEach((group) => {
      const labels = group.map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
      group.forEach((s) => ids.push(s.id));
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SECONDARY_TABS 의 키는 1차 탭 id 와 정확히 일치한다', () => {
    expect(Object.keys(NAV.SECONDARY_TABS).sort()).toEqual(NAV.PRIMARY_TABS.map((t) => t.id).sort());
  });

  it('모든 href 는 절대 /krds-ux-writing/ 표기다 (상대경로·index.html 금지)', () => {
    const hrefs = [
      NAV.LOGO.href,
      ...NAV.PRIMARY_TABS.map((t) => t.href),
      ...Object.values(NAV.SECONDARY_TABS).flat().map((s) => s.href),
    ];
    hrefs.forEach((href) => {
      expect(href.startsWith('/krds-ux-writing/'), href).toBe(true);
      expect(/index\.html$/.test(href), href).toBe(false);
      expect(href.includes('#'), href).toBe(false);
    });
  });

  it('모든 탭·2차 탭 href 가 실제 파일을 가리킨다', () => {
    const hrefs = [
      ...NAV.PRIMARY_TABS.map((t) => t.href),
      ...Object.values(NAV.SECONDARY_TABS).flat().map((s) => s.href),
    ];
    hrefs.forEach((href) => {
      const rel = href.replace(/^\/krds-ux-writing\//, '');
      const candidates = rel === '' || rel.endsWith('/') ? [rel + 'index.html'] : [rel];
      expect(candidates.some((c) => fs.existsSync(path.join(ROOT, c))), href).toBe(true);
    });
  });

  it('도구 탭은 hubHref 를 갖고 기본값은 /krds-ux-writing/lint.html 이다 (TODO(오너 결정))', () => {
    const tools = NAV.getTab('tools');
    expect(tools.hubHref).toBe('/krds-ux-writing/lint.html');
    expect(tools.href).toBe(tools.hubHref);
  });

  it('Before/After 라벨은 아직 그대로이며 TODO 허용 목록에만 있다', () => {
    const labels = NAV.allLabels();
    expect(labels).toContain('Before/After');
    expect(Object.keys(NAV.LABEL_TODO_ALLOW)).toEqual(['Before/After']);
  });

  it('TODO 허용 목록에 미사용 항목이 남지 않는다 (한글화되면 허용 항목도 지울 것)', () => {
    const labels = NAV.allLabels();
    Object.keys(NAV.LABEL_TODO_ALLOW).forEach((label) => {
      expect(labels, label).toContain(label);
    });
  });

  it('labelProblems: 짧은 라벨과 영문 단독 라벨을 잡아낸다', () => {
    expect(NAV.labelProblems('원')).toContain('2자 미만');
    expect(NAV.labelProblems('Lint')).toContain('영문 단독 라벨');
    expect(NAV.labelProblems('린터')).toEqual([]);
    expect(NAV.labelProblems('Before/After')).toEqual([]);
    expect(NAV.labelProblems('')).toContain('2자 미만');
  });

  it('GNB aria-label 은 단일값이고 2차 탭 라벨과 다르다', () => {
    expect(NAV.NAV_ARIA_LABEL).toBe('섹션 내비게이션');
    expect(NAV.SUBNAV_ARIA_LABEL).not.toBe(NAV.NAV_ARIA_LABEL);
  });

  it('로고 규칙: 사이트 루트 href 와 비어 있지 않은 aria-label', () => {
    expect(NAV.LOGO.href).toBe('/krds-ux-writing/');
    expect(NAV.LOGO.ariaLabel.length).toBeGreaterThan(0);
  });

  it('권고 배치: 코퍼스는 사전 하위, 이슈 아카이브는 사례 하위 2차 탭', () => {
    expect(NAV.SECONDARY_TABS.dictionary.map((s) => s.id)).toContain('corpus');
    expect(NAV.SECONDARY_TABS['case-studies'].map((s) => s.id)).toContain('archive');
  });

  it('정의는 동결되어 있어 실수로 바뀌지 않는다', () => {
    expect(Object.isFrozen(NAV.PRIMARY_TABS)).toBe(true);
    expect(Object.isFrozen(NAV.PRIMARY_TABS[0])).toBe(true);
    expect(Object.isFrozen(NAV.PAGE_MAP)).toBe(true);
  });
});

describe('nav-definition: 페이지 소속과 분류', () => {
  it('PAGE_MAP 의 탭/2차 탭 id 는 모두 정의에 존재한다', () => {
    Object.entries(NAV.PAGE_MAP).forEach(([file, entry]) => {
      if (entry.tab === null) return;
      expect(NAV.getTab(entry.tab), file).not.toBeNull();
      if (entry.sub) {
        const subs = NAV.SECONDARY_TABS[entry.tab].map((s) => s.id);
        expect(subs, file).toContain(entry.sub);
      }
    });
  });

  it('PAGE_MAP 의 모든 파일 경로가 실제로 존재한다', () => {
    Object.keys(NAV.PAGE_MAP).forEach((file) => {
      expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
    });
  });

  it('PAGE_MAP 과 NAV_EXEMPT 는 겹치지 않는다', () => {
    const overlap = Object.keys(NAV.NAV_EXEMPT).filter((f) => f in NAV.PAGE_MAP);
    expect(overlap).toEqual([]);
  });

  it('NAV_EXEMPT 는 모두 사유 문자열을 갖는다', () => {
    Object.entries(NAV.NAV_EXEMPT).forEach(([file, reason]) => {
      expect(typeof reason, file).toBe('string');
      expect(reason.trim().length, file).toBeGreaterThan(0);
    });
  });

  it('PAGE_MAP 에 적힌 페이지는 정의의 activeTabFor/activeSubFor 와 모순되지 않는다', () => {
    Object.entries(NAV.PAGE_MAP).forEach(([file, entry]) => {
      const url = NAV.pathForFile(file);
      expect(NAV.activeTabFor(url), file).toBe(entry.tab);
      expect(NAV.activeSubFor(url), file).toBe(entry.sub);
    });
  });

  it('레포의 모든 HTML 이 PAGE_MAP 또는 NAV_EXEMPT 로 분류되어 있다', () => {
    const files = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] }).map((f) => f.split(path.sep).join('/'));
    const unclassified = files.filter((f) => !(f in NAV.PAGE_MAP) && !(f in NAV.NAV_EXEMPT));
    expect(unclassified).toEqual([]);
  });
});

describe('normalizePath', () => {
  it.each([
    ['/krds-ux-writing/', '/'],
    ['/krds-ux-writing', '/'],
    ['/', '/'],
    ['', '/'],
    ['/index.html', '/'],
    ['/krds-ux-writing/index.html', '/'],
    ['/krds-ux-writing/lint.html', '/lint'],
    ['/krds-ux-writing/lint.html?x=1#top', '/lint'],
    ['/krds-ux-writing/generator/', '/generator'],
    ['/krds-ux-writing/generator/index.html', '/generator'],
    ['/krds-ux-writing//principles//foundation/', '/principles/foundation'],
    ['/principles/', '/principles'],
    ['/krds-ux-writing-extra/lint.html', '/krds-ux-writing-extra/lint'],
  ])('%s → %s', (input, expected) => {
    expect(NAV.normalizePath(input)).toBe(expected);
  });

  it('null/undefined 는 홈으로 정규화한다', () => {
    expect(NAV.normalizePath(null)).toBe('/');
    expect(NAV.normalizePath(undefined)).toBe('/');
  });
});

describe('activeTabFor: 가장 긴 prefix 일치', () => {
  it.each([
    ['/krds-ux-writing/', null],
    ['/krds-ux-writing/index.html', null],
    ['/krds-ux-writing/principles/', 'principles'],
    ['/krds-ux-writing/principles/foundation/', 'principles'],
    ['/krds-ux-writing/principles/no-translation/index.html', 'principles'],
    ['/krds-ux-writing/dictionary/', 'dictionary'],
    ['/krds-ux-writing/dictionary/full.html', 'dictionary'],
    ['/krds-ux-writing/corpus/', 'dictionary'],
    ['/krds-ux-writing/case-studies/', 'case-studies'],
    ['/krds-ux-writing/archive.html', 'case-studies'],
    ['/krds-ux-writing/prompt-library.html', 'tools'],
    ['/krds-ux-writing/before-after.html', 'tools'],
    ['/krds-ux-writing/lint.html', 'tools'],
    ['/krds-ux-writing/generator/', 'tools'],
    ['/krds-ux-writing/generator/index.html', 'tools'],
    ['/krds-ux-writing/nowhere.html', null],
  ])('%s → %s', (url, expected) => {
    expect(NAV.activeTabFor(url)).toBe(expected);
  });

  it('prefix 는 세그먼트 단위로만 일치한다 (/lint 는 /linter-x 와 일치하지 않음)', () => {
    expect(NAV.activeTabFor('/krds-ux-writing/linter-x.html')).toBeNull();
    expect(NAV.activeTabFor('/krds-ux-writing/principles-draft/')).toBeNull();
  });

  it('여러 prefix 가 겹치면 더 긴 prefix 항목이 이긴다 (합성 데이터)', () => {
    const items = [
      { id: 'short', match: ['/tools'] },
      { id: 'long', match: ['/tools/lab'] },
    ];
    expect(NAV.longestMatch('/tools/lab/x', items).id).toBe('long');
    expect(NAV.longestMatch('/tools/other', items).id).toBe('short');
    expect(NAV.longestMatch('/toolsbox', items)).toBeNull();
  });
});

describe('activeSubFor / ariaCurrentFor', () => {
  it('홈은 활성 탭도 aria-current 도 없다', () => {
    expect(NAV.ariaCurrentFor('/krds-ux-writing/')).toEqual({ tabId: null, tab: null, subId: null, sub: null });
  });

  it('2차 탭이 일치하면 2차 항목이 page, 1차 탭은 true', () => {
    expect(NAV.ariaCurrentFor('/krds-ux-writing/lint.html')).toEqual({
      tabId: 'tools', tab: 'true', subId: 'lint', sub: 'page',
    });
    expect(NAV.ariaCurrentFor('/krds-ux-writing/archive.html')).toEqual({
      tabId: 'case-studies', tab: 'true', subId: 'archive', sub: 'page',
    });
  });

  it('2차 탭이 없는 원칙: 랜딩은 page, 하위 페이지는 true', () => {
    expect(NAV.ariaCurrentFor('/krds-ux-writing/principles/')).toEqual({
      tabId: 'principles', tab: 'page', subId: null, sub: null,
    });
    expect(NAV.ariaCurrentFor('/krds-ux-writing/principles/foundation/')).toEqual({
      tabId: 'principles', tab: 'true', subId: null, sub: null,
    });
  });

  it('미분류 경로는 모두 null', () => {
    expect(NAV.ariaCurrentFor('/krds-ux-writing/unknown.html').tabId).toBeNull();
    expect(NAV.activeSubFor('/krds-ux-writing/unknown.html')).toBeNull();
  });

  it('활성 1차 탭은 있으나 2차 일치가 없으면 activeSubFor 는 null', () => {
    // 사전 탭 아래이지만 어떤 2차 항목에도 속하지 않는 가상 하위 경로
    expect(NAV.activeTabFor('/krds-ux-writing/dictionary/')).toBe('dictionary');
    expect(NAV.activeSubFor('/krds-ux-writing/dictionary/')).toBe('dictionary-index');
    expect(NAV.activeSubFor('/krds-ux-writing/principles/')).toBeNull();
  });

  it('pathForFile: 파일 경로를 공개 URL 로 바꾼다', () => {
    expect(NAV.pathForFile('index.html')).toBe('/krds-ux-writing/');
    expect(NAV.pathForFile('lint.html')).toBe('/krds-ux-writing/lint.html');
    expect(NAV.pathForFile('principles/index.html')).toBe('/krds-ux-writing/principles/');
    expect(NAV.pathForFile('./dictionary/full.html')).toBe('/krds-ux-writing/dictionary/full.html');
  });
});

describe('페이지 이동 시나리오 (REPORT (c) 경로 A·B·C)', () => {
  // 사용자가 따라가는 URL 순서 → 각 단계에서 기대하는 활성 1차 탭
  const scenarios = {
    'A: 홈 → 린터 → 사례(이슈 아카이브) → 원칙 → 프롬프트': [
      ['/krds-ux-writing/', null],
      ['/krds-ux-writing/lint.html', 'tools'],
      ['/krds-ux-writing/archive.html', 'case-studies'],
      ['/krds-ux-writing/principles/', 'principles'],
      ['/krds-ux-writing/prompt-library.html', 'tools'],
    ],
    'B: 원칙 하위 → 사례 → 사전': [
      ['/krds-ux-writing/principles/foundation/', 'principles'],
      ['/krds-ux-writing/case-studies/', 'case-studies'],
      ['/krds-ux-writing/dictionary/', 'dictionary'],
    ],
    'C: 코퍼스 → 사전 → 사례 → 생성기 → 원칙': [
      ['/krds-ux-writing/corpus/', 'dictionary'],
      ['/krds-ux-writing/dictionary/', 'dictionary'],
      ['/krds-ux-writing/case-studies/', 'case-studies'],
      ['/krds-ux-writing/generator/', 'tools'],
      ['/krds-ux-writing/principles/', 'principles'],
    ],
  };

  Object.entries(scenarios).forEach(([name, steps]) => {
    it(name, () => {
      const seen = steps.map(([url]) => NAV.activeTabFor(url));
      expect(seen).toEqual(steps.map(([, expected]) => expected));
    });
  });

  it('어느 단계에서도 1차 탭 목록은 변하지 않는다 (탭이 변하는 문제의 재발 방지)', () => {
    const urls = Object.values(scenarios).flat().map(([url]) => url);
    const tabLists = urls.map(() => NAV.PRIMARY_TABS.map((t) => t.label).join('|'));
    expect(new Set(tabLists).size).toBe(1);
  });

  it('같은 "사례" 탭의 도착지는 단일 href 하나다', () => {
    const hrefs = NAV.PRIMARY_TABS.filter((t) => t.label === '사례').map((t) => t.href);
    expect(hrefs).toEqual(['/krds-ux-writing/case-studies/']);
  });

  it('코퍼스→사전 이동 시 같은 1차 탭에 머물며 2차 탭만 바뀐다', () => {
    expect(NAV.activeTabFor('/krds-ux-writing/corpus/')).toBe(NAV.activeTabFor('/krds-ux-writing/dictionary/'));
    expect(NAV.activeSubFor('/krds-ux-writing/corpus/')).toBe('corpus');
    expect(NAV.activeSubFor('/krds-ux-writing/dictionary/')).toBe('dictionary-index');
  });
});
