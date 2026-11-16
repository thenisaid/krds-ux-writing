/**
 * 사이트 전체 GNB 일관성 (GNB 통일 1단계) — /tmp/nav-audit/REPORT.md (f) 14항목
 *
 * 두 종류로 나눈다.
 *  - 즉시 강제(ENFORCED): 현재 main 에서도 통과하는 항목. 깨지면 바로 실패한다.
 *  - baseline(RATCHET)  : 현재 main 에서 실패하는 항목. 파일별 '지문'을
 *    tests/fixtures/site-nav-baseline.json 에 고정한다.
 *      · 새 불일치가 생기거나 지문이 바뀌면 실패 (악화·변경 감지)
 *      · 불일치가 사라지면 실패 — baseline 을 줄이라는 요구 (개선도 기록하게 강제)
 *    baseline 갱신: UPDATE_NAV_BASELINE=1 npx vitest run tests/site-nav-consistency.test.js
 *    마이그레이션이 끝나면 baseline 은 비어 있어야 하고, 그때 RATCHET 을 ENFORCED 로 옮긴다.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const require = createRequire(import.meta.url);
const NAV = require('../shared/nav-definition.js');
const SYNC = require('../scripts/sync-site-nav.js');

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'tests', 'fixtures', 'site-nav-baseline.json');
const UPDATE = process.env.UPDATE_NAV_BASELINE === '1';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pageFiles = () => Object.keys(NAV.PAGE_MAP).filter((f) => fs.existsSync(path.join(ROOT, f)));

// ─── baseline 입출력 ────────────────────────────────────────────────────────
function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    return { items: {} };
  }
}

const baseline = loadBaseline();
const measured = {}; // 항목 → { 키: 지문 }
const baselineStaged = {};

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

/** 현재 불일치({키: 지문})를 baseline 과 비교한다. UPDATE 모드면 기록만 한다. */
function expectMatchesBaseline(itemId, current) {
  measured[itemId] = sortKeys(current);
  if (UPDATE) {
    baselineStaged[itemId] = measured[itemId];
    return;
  }
  const base = (baseline.items[itemId] && baseline.items[itemId].offenders) || {};
  const added = Object.keys(current).filter((k) => !(k in base));
  const changed = Object.keys(current).filter((k) => k in base && base[k] !== current[k]);
  const fixed = Object.keys(base).filter((k) => !(k in current));
  const msg = [];
  if (added.length) msg.push('새 불일치(악화): ' + added.map((k) => k + ' → ' + current[k]).join(' / '));
  if (changed.length) msg.push('불일치 내용이 바뀜: ' + changed.map((k) => k + '\n  baseline: ' + base[k] + '\n  현재:     ' + current[k]).join('\n'));
  if (fixed.length) msg.push('불일치가 해소됨 — baseline 에서 제거하세요(UPDATE_NAV_BASELINE=1): ' + fixed.join(', '));
  expect(added, msg.join('\n')).toEqual([]);
  expect(changed, msg.join('\n')).toEqual([]);
  expect(fixed, msg.join('\n')).toEqual([]);
}

// ─── 측정 헬퍼 ──────────────────────────────────────────────────────────────
function inspect(file) {
  return SYNC.inspectPage(read(file), file, ROOT);
}

function targetExists(target) {
  const clean = String(target).split('#')[0];
  const rel = clean === '/' || clean === '' ? '' : clean.replace(/^\//, '');
  const candidates = rel === '' ? ['index.html'] : [rel + '.html', rel + '/index.html', rel];
  return candidates.some((c) => {
    const abs = path.join(ROOT, c);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  });
}

function cssRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    rules.push({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] });
  }
  return rules;
}

function px(body, prop) {
  const values = [...body.matchAll(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([0-9.]+)px', 'g'))].map((m) => parseFloat(m[1]));
  return values.length ? Math.max(...values) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 즉시 강제 (ENFORCED)
// ═══════════════════════════════════════════════════════════════════════════
describe('site-nav-consistency — 즉시 강제', () => {
  it('[1] defines primary tabs with unique ids and 2+ char noun labels (Before/After 는 TODO 로 일시 허용)', () => {
    const ids = NAV.PRIMARY_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(NAV.PRIMARY_TABS).toHaveLength(4);
    const offenders = NAV.allLabels().filter((l) => NAV.labelProblems(l).length > 0);
    expect(offenders).toEqual([]);
  });

  it('[5] every nav href points to an existing file', () => {
    const missing = [];
    pageFiles().forEach((file) => {
      SYNC.extractPrimaryLinks(read(file), file).forEach((link) => {
        if (link.target && !targetExists(link.target)) missing.push(file + ' → ' + link.href);
      });
    });
    expect(missing).toEqual([]);
  });

  it('[8] every html is classified: 정의(PAGE_MAP) 또는 NAV_EXEMPT(사유 포함)', () => {
    const files = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] }).map((f) => f.split(path.sep).join('/'));
    const unclassified = files.filter((f) => !(f in NAV.PAGE_MAP) && !(f in NAV.NAV_EXEMPT));
    expect(unclassified).toEqual([]);
    Object.entries(NAV.NAV_EXEMPT).forEach(([f, reason]) => expect(reason.trim(), f).not.toBe(''));
  });

  it('[13] skip link is the first focusable and targets an existing main (lint 포함 전체 대상)', () => {
    const offenders = [];
    pageFiles().forEach((file) => {
      const html = read(file);
      const skip = html.match(/<a\b[^>]*class="[^"]*\bskip-(?:link|nav)\b[^"]*"[^>]*>/i);
      if (!skip) { offenders.push(file + ': 스킵 링크 없음'); return; }
      const target = (skip[0].match(/\bhref="#([^"]+)"/i) || [])[1];
      if (!target) { offenders.push(file + ': 스킵 링크 href 없음'); return; }
      const mainRe = new RegExp('<main\\b[^>]*\\bid=([\'"])' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1', 'i');
      if (!mainRe.test(html)) offenders.push(file + ': #' + target + ' 를 id 로 가진 <main> 없음');
      const body = html.slice(html.search(/<body\b[^>]*>/i));
      const first = body.match(/<(?:a|button|input|select|textarea)\b[^>]*>/i);
      if (!first || first[0] !== skip[0]) offenders.push(file + ': 스킵 링크가 첫 포커스 요소가 아님');
    });
    expect(offenders).toEqual([]);
  });

  it('PAGE_MAP 의 모든 페이지가 정의와 활성 탭 계산이 일치한다 (정의 내부 정합성)', () => {
    pageFiles().forEach((file) => {
      const entry = NAV.PAGE_MAP[file];
      expect(NAV.activeTabFor(NAV.pathForFile(file)), file).toBe(entry.tab);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// baseline (RATCHET) — 현재 main 의 불일치를 고정, 악화 금지·개선 기록 강제
// ═══════════════════════════════════════════════════════════════════════════
describe('site-nav-consistency — baseline(현재 불일치 고정)', () => {
  it('[2] every non-exempt html has exactly one primary nav landmark (중첩 없음, aria-label === 정의값)', () => {
    const current = {};
    pageFiles().forEach((file) => {
      const { reasons, details } = inspect(file);
      if (reasons.includes('nav-landmark') || reasons.includes('aria-label')) {
        current[file] = 'count=' + details.primaryNavCount + ' nested=' + Boolean(details.nestedNav) +
          ' aria-label=' + JSON.stringify(details.ariaLabel === undefined ? NAV.NAV_ARIA_LABEL : details.ariaLabel);
      }
    });
    expectMatchesBaseline('2-nav-landmark', current);
  });

  it('[3] tab labels and order match the definition on every page', () => {
    const expected = NAV.PRIMARY_TABS.map((t) => t.label);
    const current = {};
    pageFiles().forEach((file) => {
      const labels = SYNC.extractPrimaryLinks(read(file), file).map((l) => l.label);
      if (labels.join('|') !== expected.join('|')) current[file] = labels.join('|');
    });
    expectMatchesBaseline('3-labels', current);
  });

  it('[4] tab hrefs resolve to the definition targets', () => {
    const expected = NAV.PRIMARY_TABS.map((t) => NAV.normalizePath(t.href));
    const current = {};
    pageFiles().forEach((file) => {
      const targets = SYNC.extractPrimaryLinks(read(file), file).map((l) => l.target);
      if (targets.join('|') !== expected.join('|')) current[file] = targets.join('|');
    });
    expectMatchesBaseline('4-hrefs', current);
  });

  it('[6] exactly one tab is current per page, by longest-prefix match (홈은 0개, .active ⇔ aria-current)', () => {
    const current = {};
    pageFiles().forEach((file) => {
      const links = SYNC.extractPrimaryLinks(read(file), file);
      const expectedTab = NAV.getTab(NAV.activeTabFor(NAV.pathForFile(file)));
      const expectedTarget = expectedTab ? NAV.normalizePath(expectedTab.href) : null;
      const marked = links.filter((l) => l.current);
      const activeMismatch = links.some((l) => l.active !== Boolean(l.current));
      const ok = marked.length === (expectedTab ? 1 : 0) &&
        !activeMismatch &&
        (!expectedTab || marked[0].target === expectedTarget);
      if (!ok) {
        current[file] = 'expected=' + (expectedTab ? expectedTab.id : 'none') + ' actual=' +
          links.map((l) => l.label + (l.current ? '[' + l.current + ']' : '') + (l.active ? '*' : '')).join(',');
      }
    });
    expectMatchesBaseline('6-current', current);
  });

  it('[7] uses no color-only active state: 공유 CSS 의 [aria-current] 규칙이 color 외 font-weight/border/text-decoration 포함', () => {
    const rules = cssRules(read('shared/style.css'));
    const ok = rules.some((r) =>
      r.selectors.some((s) => /\.gnb-nav-link\[aria-current/.test(s)) &&
      /font-weight|border|text-decoration/.test(r.body));
    const current = ok ? {} : { 'shared/style.css': '.gnb-nav-link[aria-current] 규칙 없음 (현재는 .active 클래스 규칙만 있음)' };
    expectMatchesBaseline('7-color-only', current);
  });

  it('[9] exempt pages do not contain gnb markup (조용한 면제 방지)', () => {
    const current = {};
    Object.keys(NAV.NAV_EXEMPT).forEach((file) => {
      const abs = path.join(ROOT, file);
      if (fs.existsSync(abs) && SYNC.hasGnbMarkup(fs.readFileSync(abs, 'utf8'))) {
        current[file] = 'gnb 마크업 보유 (' + NAV.NAV_EXEMPT[file] + ')';
      }
    });
    expectMatchesBaseline('9-exempt-clean', current);
  });

  it('[10] logo link is single, aria-labelled, and points to the site root', () => {
    const current = {};
    pageFiles().forEach((file) => {
      const { reasons, details } = inspect(file);
      if (reasons.includes('logo')) current[file] = 'count=' + details.logoCount + ' ' + JSON.stringify(details.logo);
    });
    expectMatchesBaseline('10-logo', current);
  });

  it('[11] mobile menu labels equal desktop tab labels, and every primary tab is reachable on mobile', () => {
    const current = {};
    pageFiles().forEach((file) => {
      const { reasons, details } = inspect(file);
      if (reasons.includes('mobile-menu')) {
        current[file] = 'aliases=' + JSON.stringify(details.mobileAliases) + ' missing=' + JSON.stringify(details.mobileMissing);
      }
    });
    expectMatchesBaseline('11-mobile-menu', current);
  });

  it('[12] generated nav block is in sync (마커 구간이 생성 결과와 바이트 동일)', () => {
    const current = {};
    SYNC.checkAll(ROOT).pages.forEach((p) => {
      if (p.status !== 'in-sync') current[p.file] = p.status;
    });
    expectMatchesBaseline('12-sync', current);
  });

  it('[14] nav link touch target css >= 44px (공유 CSS: .gnb-nav-link·.gnb-icon-btn·.gnb-hamburger)', () => {
    const rules = cssRules(read('shared/style.css'));
    const needs = {
      '.gnb-nav-link': { h: 44, w: 0 },
      '.gnb-icon-btn': { h: 44, w: 44 },
      '.gnb-hamburger': { h: 44, w: 44 },
    };
    const current = {};
    Object.entries(needs).forEach(([selector, need]) => {
      const bodies = rules.filter((r) => r.selectors.includes(selector)).map((r) => r.body);
      const h = Math.max(0, ...bodies.map((b) => Math.max(px(b, 'min-height'), px(b, 'height'))));
      const w = Math.max(0, ...bodies.map((b) => Math.max(px(b, 'min-width'), px(b, 'width'))));
      const problems = [];
      if (h < need.h) problems.push('min-height ' + h + 'px < ' + need.h);
      if (w < need.w) problems.push('min-width ' + w + 'px < ' + need.w);
      if (problems.length) current['shared/style.css ' + selector] = problems.join(', ');
    });
    expectMatchesBaseline('14-touch-target', current);
  });

  it('baseline 파일은 항목별 건수 요약을 갖는다 (UPDATE_NAV_BASELINE=1 로만 갱신)', () => {
    if (UPDATE) {
      const items = {};
      Object.keys(baselineStaged).sort().forEach((id) => {
        items[id] = { count: Object.keys(baselineStaged[id]).length, offenders: baselineStaged[id] };
      });
      fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
      fs.writeFileSync(BASELINE_PATH, JSON.stringify({
        description: 'GNB 일관성 baseline — 현재 main 의 불일치를 고정한다. 줄이기만 하고 늘리지 않는다. 갱신: UPDATE_NAV_BASELINE=1 npx vitest run tests/site-nav-consistency.test.js',
        definitionVersion: NAV.version,
        items,
      }, null, 2) + '\n');
      return;
    }
    Object.entries(baseline.items).forEach(([id, item]) => {
      expect(item.count, id).toBe(Object.keys(item.offenders).length);
    });
    // 측정되지 않은 baseline 항목(테스트 삭제 등)이 남지 않는다
    expect(Object.keys(baseline.items).sort()).toEqual(Object.keys(measured).sort());
  });
});
