#!/usr/bin/env node
/**
 * scripts/sync-site-nav.js — GNB 마크업 생성·동기화 (GNB 통일 1단계)
 *
 * shared/nav-definition.js 의 정의로부터 정적 GNB 마크업 조각을 만들고,
 * 각 HTML 의 마커 구간(<!-- gnb:start --> … <!-- gnb:end -->)과 대조·갱신한다.
 *
 * 모드 (기본 실행은 아무 파일도 쓰지 않는다 = --dry-run):
 *   --dry-run        무엇이 바뀔지 출력만 한다 (기본값)
 *   --check          정의와 어긋난 페이지 수·목록을 출력한다 (마이그레이션 진행도). 어긋남이 있으면 종료코드 1
 *   --write          마커 구간이 있는 파일만 실제로 갱신한다 (유일한 쓰기 모드)
 *   --print <file>   해당 파일에 대해 생성될 마크업 조각을 출력한다
 *   --root <dir>     대상 루트 (기본: 현재 디렉터리). 사본에서 시험할 때 사용
 *   --json           --check 결과를 JSON 으로 출력한다
 *
 * 1단계 범위: 마커가 없는 파일에는 마커를 삽입하지 않는다(건너뜀으로 보고).
 * 생성 결과는 정적 마크업이다 — 인라인 스크립트·on* 핸들러·style 속성·innerHTML 없음(CSP 준수).
 * aria-current 는 정적으로 포함한다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const NAV = require('../shared/nav-definition.js');

const MARKER_START = '<!-- gnb:start -->';
const MARKER_END = '<!-- gnb:end -->';
const MARKER_RE = /^([ \t]*)<!-- gnb:start -->[\s\S]*?<!-- gnb:end -->/m;

// ─── 1. 마크업 생성 ─────────────────────────────────────────────────────────

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function linkLine(item, baseClass, current) {
  const classes = baseClass + (current ? ' active' : '');
  const aria = current ? ' aria-current="' + current + '"' : '';
  return '<a href="' + escapeAttr(item.href) + '" class="' + classes + '"' + aria + '>' + escapeText(item.label) + '</a>';
}

/**
 * 파일 경로(예: 'lint.html')에 대한 마크업 조각의 줄 배열. 분류되지 않은 파일은 null.
 * 구성: 1차 탭 <nav class="gnb-nav"> + (해당 탭에 2차 탭이 있으면) 2차 <nav class="gnb-subnav">.
 */
function renderFragment(file) {
  const entry = NAV.PAGE_MAP[file];
  if (!entry) return null;

  const current = NAV.ariaCurrentFor(NAV.pathForFile(file));
  const lines = [];

  lines.push('<nav class="gnb-nav" aria-label="' + escapeAttr(NAV.NAV_ARIA_LABEL) + '">');
  NAV.PRIMARY_TABS.forEach((tab) => {
    lines.push('  ' + linkLine(tab, 'gnb-nav-link', tab.id === current.tabId ? current.tab : null));
  });
  lines.push('</nav>');

  const subs = current.tabId ? NAV.SECONDARY_TABS[current.tabId] || [] : [];
  if (subs.length) {
    lines.push('<nav class="gnb-subnav" aria-label="' + escapeAttr(NAV.SUBNAV_ARIA_LABEL) + '">');
    subs.forEach((sub) => {
      lines.push('  ' + linkLine(sub, 'gnb-subnav-link', sub.id === current.subId ? current.sub : null));
    });
    lines.push('</nav>');
  }
  return lines;
}

function indentLines(lines, indent) {
  return lines.map((line) => indent + line).join('\n');
}

// ─── 2. 마커 구간 ───────────────────────────────────────────────────────────

function countOf(html, needle) {
  return html.split(needle).length - 1;
}

/** 마커 상태: {state:'none'|'ok'|'malformed', indent, current} */
function readMarkerRegion(html) {
  const starts = countOf(html, MARKER_START);
  const ends = countOf(html, MARKER_END);
  if (starts === 0 && ends === 0) return { state: 'none' };
  if (starts !== 1 || ends !== 1 || html.indexOf(MARKER_START) > html.indexOf(MARKER_END)) {
    return { state: 'malformed' };
  }
  const match = html.match(MARKER_RE);
  if (!match) return { state: 'malformed' };
  return { state: 'ok', indent: match[1], current: match[0] };
}

/** 마커 구간을 생성 결과로 바꾼 새 HTML. 마커가 없거나 깨졌으면 null. */
function applyFragment(html, file) {
  const region = readMarkerRegion(html);
  if (region.state !== 'ok') return null;
  const lines = renderFragment(file);
  if (!lines) return null;
  const indent = region.indent;
  const replacement = indent + MARKER_START + '\n' + indentLines(lines, indent) + '\n' + indent + MARKER_END;
  return html.replace(MARKER_RE, () => replacement);
}

// ─── 3. 기존 HTML 의 의미 추출 (마커가 없는 현재 상태 대조용) ──────────────

function parseAttrs(tagText) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  const inner = tagText.replace(/^<\s*[a-zA-Z0-9]+/, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(inner))) {
    attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : '';
  }
  return attrs;
}

function classTokens(attrs) {
  return String(attrs.class || '').split(/\s+/).filter(Boolean);
}

function textOf(inner) {
  return inner.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** 페이지 파일 기준으로 href 를 사이트 정규화 경로로 바꾼다. 외부 링크는 null. */
function resolveHref(file, href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;
  const hash = href.indexOf('#');
  const hasFragment = hash !== -1 && hash < href.length - 1;
  const pathPart = hash === -1 ? href : href.slice(0, hash);
  let resolved;
  if (pathPart.startsWith('/')) {
    resolved = pathPart;
  } else if (pathPart === '') {
    resolved = '/' + file;
  } else {
    resolved = '/' + path.posix.normalize(path.posix.join(path.posix.dirname(file), pathPart));
  }
  const normalized = NAV.normalizePath(resolved);
  // 같은 경로에 해시 앵커만 다른 링크(예: 홈 '/#case-studies')는 정의의 대상과 다르다.
  return hasFragment ? normalized + '#' + href.slice(hash + 1) : normalized;
}

function anchorsIn(chunk) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(chunk))) {
    out.push({ attrs: parseAttrs('<a ' + m[1] + '>'), label: textOf(m[2]) });
  }
  return out;
}

/** <nav> 여는 태그를 모두 찾아 {attrs, start, end(여는 태그 끝)} 로 */
function navOpenTags(html) {
  const out = [];
  const re = /<nav\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ attrs: parseAttrs(m[0]), index: m.index, openEnd: m.index + m[0].length });
  }
  return out;
}

function chunkAfter(html, openEnd) {
  const close = html.indexOf('</nav>', openEnd);
  return html.slice(openEnd, close === -1 ? html.length : close);
}

/** 1차 nav(.gnb-nav) 안의 링크: {label, href(원문), target(정규화), current, active}. 1차 nav 가 없으면 [] */
function extractPrimaryLinks(html, file) {
  const primary = navOpenTags(html).find((n) => classTokens(n.attrs).includes('gnb-nav'));
  if (!primary) return [];
  return anchorsIn(chunkAfter(html, primary.openEnd)).map((l) => ({
    label: l.label,
    href: l.attrs.href || '',
    target: resolveHref(file, l.attrs.href || ''),
    current: l.attrs['aria-current'] || null,
    active: classTokens(l.attrs).includes('active'),
  }));
}

/** CSS 의 @media 블록 중 .gnb-nav 를 display:none 하는 것이 있는지 (중괄호 매칭) */
function cssHidesGnbNavOnMobile(css) {
  const re = /@media\s*\(\s*max-width:\s*\d+px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const block = css.slice(re.lastIndex, i - 1);
    if (/(^|[\s,}])\.gnb-nav\s*\{[^}]*display:\s*none/.test(block)) return true;
  }
  return false;
}

/**
 * 기존 HTML 이 정의와 어긋나는 이유를 계산한다 (마크업을 바꾸지 않는 순수 읽기).
 * @returns {{reasons:string[], details:object}}
 */
function inspectPage(html, file, root) {
  const reasons = [];
  const details = {};
  const current = NAV.ariaCurrentFor(NAV.pathForFile(file));

  // 3-1. 1차 nav 랜드마크
  const navs = navOpenTags(html);
  const primaryNavs = navs.filter((n) => classTokens(n.attrs).includes('gnb-nav'));
  const nestingNavs = navs.filter((n) => classTokens(n.attrs).includes('gnb'));
  details.primaryNavCount = primaryNavs.length;
  if (primaryNavs.length !== 1) reasons.push('nav-landmark');
  else if (nestingNavs.length > 0) {
    reasons.push('nav-landmark'); // <nav class="gnb"> 안의 <nav class="gnb-nav"> 중첩
    details.nestedNav = true;
  }

  const primary = primaryNavs[0];
  if (primary) {
    if (primary.attrs['aria-label'] !== NAV.NAV_ARIA_LABEL) {
      reasons.push('aria-label');
      details.ariaLabel = primary.attrs['aria-label'] || null;
    }

    const links = anchorsIn(chunkAfter(html, primary.openEnd));
    const labels = links.map((l) => l.label);
    const expectedLabels = NAV.PRIMARY_TABS.map((t) => t.label);
    details.labels = labels;
    if (labels.length !== expectedLabels.length || labels.some((l, i) => l !== expectedLabels[i])) {
      reasons.push('labels');
    }

    const hrefs = links.map((l) => resolveHref(file, l.attrs.href || ''));
    const expectedHrefs = NAV.PRIMARY_TABS.map((t) => NAV.normalizePath(t.href));
    details.hrefs = hrefs;
    if (hrefs.length !== expectedHrefs.length || hrefs.some((h, i) => h !== expectedHrefs[i])) {
      reasons.push('hrefs');
    }

    const actualCurrent = links.map((l) => l.attrs['aria-current'] || null);
    const expectedCurrent = NAV.PRIMARY_TABS.map((t) => (t.id === current.tabId ? current.tab : null));
    details.ariaCurrent = actualCurrent;
    const sameLength = actualCurrent.length === expectedCurrent.length;
    if (!sameLength || actualCurrent.some((v, i) => v !== expectedCurrent[i])) reasons.push('aria-current');

    const activeFlags = links.map((l) => classTokens(l.attrs).includes('active'));
    details.activeFlags = activeFlags;
    if (links.some((l, i) => activeFlags[i] !== (actualCurrent[i] !== null))) reasons.push('active-class');
  } else {
    details.labels = [];
  }

  // 3-2. 로고 링크
  const logos = anchorsIn(html).filter((a) => classTokens(a.attrs).includes('gnb-logo'));
  details.logoCount = logos.length;
  details.logo = logos.map((l) => ({
    ariaLabel: Boolean(l.attrs['aria-label']),
    target: resolveHref(file, l.attrs.href || ''),
  }));
  const logoOk = logos.length === 1 &&
    Boolean(logos[0].attrs['aria-label']) &&
    resolveHref(file, logos[0].attrs.href || '') === '/';
  if (!logoOk) reasons.push('logo');

  // 3-3. 2차 탭
  const subs = current.tabId ? NAV.SECONDARY_TABS[current.tabId] || [] : [];
  const hasSubnav = navs.some((n) => classTokens(n.attrs).includes('gnb-subnav'));
  if (subs.length && !hasSubnav) reasons.push('subnav');

  // 3-4. 모바일 메뉴 라벨 (별칭 금지, CSS 가 데스크톱 탭을 숨기면 모든 1차 탭이 있어야 함)
  const mobileLabels = anchorsIn(html)
    .filter((a) => classTokens(a.attrs).includes('mobile-menu-link') && !a.attrs.target)
    .map((a) => a.label);
  details.mobileLabels = mobileLabels;
  const allLabels = new Set(NAV.allLabels());
  const aliases = mobileLabels.filter((l) => !allLabels.has(l));
  const inlineCss = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  let sharedCss = '';
  if (/shared\/style\.css/.test(html)) {
    try {
      sharedCss = fs.readFileSync(path.join(root, 'shared', 'style.css'), 'utf8');
    } catch (e) { /* 공유 CSS 가 없으면 인라인만 본다 */ }
  }
  const hidesNav = cssHidesGnbNavOnMobile(inlineCss) || cssHidesGnbNavOnMobile(sharedCss);
  // CSS 가 모바일에서 .gnb-nav 를 숨기면, 모든 1차 탭이 모바일 메뉴(.mobile-menu-link)에 있어야 한다.
  // 모바일 메뉴 자체가 없으면(예: 햄버거가 LNB 만 여는 페이지) 4개 모두 도달 불가로 센다.
  const missingOnMobile = hidesNav
    ? NAV.PRIMARY_TABS.map((t) => t.label).filter((l) => !mobileLabels.includes(l))
    : [];
  details.mobileAliases = aliases;
  details.mobileMissing = missingOnMobile;
  if (aliases.length || missingOnMobile.length) reasons.push('mobile-menu');

  return { reasons, details };
}

function hasGnbMarkup(html) {
  const re = /\bclass\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].split(/\s+/).some((t) => t === 'gnb' || t.indexOf('gnb-') === 0)) return true;
  }
  return false;
}

// ─── 4. 전체 점검 ───────────────────────────────────────────────────────────

/**
 * 모든 PAGE_MAP 페이지를 점검한다.
 * status: 'in-sync'(마커 있고 바이트 동일) | 'drift'(마커 있고 다름) | 'malformed' | 'unmarked'(마커 없음)
 */
function checkAll(root) {
  const pages = Object.keys(NAV.PAGE_MAP).map((file) => {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) {
      return { file, status: 'missing', reasons: ['missing-file'], semanticOk: false, details: {} };
    }
    const html = fs.readFileSync(abs, 'utf8');
    const region = readMarkerRegion(html);
    const inspected = inspectPage(html, file, root);
    const reasons = inspected.reasons.slice();
    let status;
    if (region.state === 'none') {
      status = 'unmarked';
      reasons.push('markers');
    } else if (region.state === 'malformed') {
      status = 'malformed';
      reasons.push('markers');
    } else {
      const expected = applyFragment(html, file);
      status = expected === html ? 'in-sync' : 'drift';
      if (status === 'drift') reasons.push('sync');
    }
    const semanticReasons = reasons.filter((r) => r !== 'markers' && r !== 'sync');
    return { file, status, reasons, semanticOk: semanticReasons.length === 0, details: inspected.details };
  });

  const exemptWithGnb = Object.keys(NAV.NAV_EXEMPT).filter((file) => {
    const abs = path.join(root, file);
    return fs.existsSync(abs) && hasGnbMarkup(fs.readFileSync(abs, 'utf8'));
  });

  return { pages, exemptWithGnb };
}

const REASON_LABELS = {
  'nav-landmark': '1차 nav 랜드마크(개수·중첩)',
  'aria-label': 'GNB aria-label',
  labels: '탭 라벨·순서',
  hrefs: '탭 href',
  'aria-current': 'aria-current',
  'active-class': '.active ⇔ aria-current',
  logo: '로고 링크',
  subnav: '2차 탭 없음',
  'mobile-menu': '모바일 메뉴 라벨',
  markers: '마커 구간 없음',
  sync: '마커 구간이 생성 결과와 다름',
  'missing-file': '파일 없음',
};

function summarize(result) {
  const pages = result.pages;
  const notInSync = pages.filter((p) => p.status !== 'in-sync');
  const semanticBad = pages.filter((p) => !p.semanticOk);
  const reasonCounts = {};
  pages.forEach((p) => p.reasons.forEach((r) => { reasonCounts[r] = (reasonCounts[r] || 0) + 1; }));
  return {
    total: pages.length,
    inSync: pages.length - notInSync.length,
    notInSync,
    semanticBad,
    reasonCounts,
  };
}

function formatCheckReport(result) {
  const s = summarize(result);
  const lines = [];
  lines.push('GNB 정의 대조 (--check) — 정의: shared/nav-definition.js v' + NAV.version);
  lines.push('대상 ' + s.total + '개 페이지 (PAGE_MAP). 면제 ' + Object.keys(NAV.NAV_EXEMPT).length + '개는 대상 아님.');
  lines.push('');
  result.pages.forEach((p) => {
    const mark = p.status === 'in-sync' ? 'OK  ' : p.semanticOk ? '마커' : '어긋남';
    const why = p.reasons.map((r) => REASON_LABELS[r] || r).join(', ');
    lines.push('  [' + mark + '] ' + p.file + (why ? '  ← ' + why : ''));
  });
  lines.push('');
  lines.push('요약');
  lines.push('  정의와 의미가 어긋난 페이지: ' + s.semanticBad.length + '/' + s.total + ' (라벨·href·aria·로고·2차 탭·모바일 메뉴 기준)');
  lines.push('  동기화 미완료(마커+바이트 동일이 아닌) 페이지: ' + s.notInSync.length + '/' + s.total);
  lines.push('  동기화 완료: ' + s.inSync + '/' + s.total);
  // 감사 보고서의 'GNB 있는 21개'는 PAGE_MAP 20개 + 면제 목록의 GNB 보유 파일(index-v2 등)이다.
  const extra = result.exemptWithGnb.length;
  lines.push('  GNB 보유 전체(면제지만 GNB 마크업이 남은 ' + extra + '개 포함): ' +
    (s.total + extra) + '개 중 ' + (s.semanticBad.length + extra) + '개가 정의와 어긋남');
  lines.push('');
  lines.push('불일치 사유별 페이지 수');
  Object.keys(s.reasonCounts)
    .sort((a, b) => s.reasonCounts[b] - s.reasonCounts[a])
    .forEach((r) => lines.push('  ' + String(s.reasonCounts[r]).padStart(3) + '  ' + (REASON_LABELS[r] || r)));
  lines.push('');
  lines.push('어긋난 페이지 목록 (' + s.semanticBad.length + ')');
  s.semanticBad.forEach((p) => lines.push('  - ' + p.file));
  if (result.exemptWithGnb.length) {
    lines.push('');
    lines.push('참고: 면제 목록에 있으나 GNB 마크업을 가진 파일 (' + result.exemptWithGnb.length + ')');
    result.exemptWithGnb.forEach((f) => lines.push('  - ' + f + '  (' + NAV.NAV_EXEMPT[f] + ')'));
  }
  return lines.join('\n');
}

// ─── 5. dry-run / write ─────────────────────────────────────────────────────

/** 파일별 계획: 'update' | 'up-to-date' | 'skip-no-markers' | 'skip-malformed' | 'missing' */
function planSync(root) {
  return Object.keys(NAV.PAGE_MAP).map((file) => {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) return { file, action: 'missing' };
    const html = fs.readFileSync(abs, 'utf8');
    const region = readMarkerRegion(html);
    if (region.state === 'none') return { file, action: 'skip-no-markers' };
    if (region.state === 'malformed') return { file, action: 'skip-malformed' };
    const next = applyFragment(html, file);
    return { file, action: next === html ? 'up-to-date' : 'update', next };
  });
}

function writePlan(root, plan) {
  const written = [];
  plan.forEach((item) => {
    if (item.action !== 'update') return;
    fs.writeFileSync(path.join(root, item.file), item.next);
    written.push(item.file);
  });
  return written;
}

const ACTION_LABELS = {
  update: '갱신 예정',
  'up-to-date': '최신',
  'skip-no-markers': '건너뜀(마커 없음)',
  'skip-malformed': '건너뜀(마커 깨짐)',
  missing: '파일 없음',
};

// ─── 6. CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { mode: null, root: process.cwd(), json: false, print: null, help: false, errors: [] };
  const setMode = (mode) => {
    if (opts.mode && opts.mode !== mode) opts.errors.push('모드는 하나만 지정할 수 있습니다: --' + opts.mode + ' 와 --' + mode);
    opts.mode = mode;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') setMode('dry-run');
    else if (arg === '--check') setMode('check');
    else if (arg === '--write') setMode('write');
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--root') {
      i += 1;
      if (!argv[i]) opts.errors.push('--root 에 경로가 필요합니다');
      else opts.root = path.resolve(argv[i]);
    } else if (arg === '--print') {
      i += 1;
      if (!argv[i]) opts.errors.push('--print 에 파일 경로가 필요합니다');
      else { setMode('print'); opts.print = argv[i]; }
    } else opts.errors.push('알 수 없는 옵션: ' + arg);
  }
  return opts;
}

const USAGE = [
  '사용법: node scripts/sync-site-nav.js [--dry-run | --check | --write | --print <file>] [--root <dir>] [--json]',
  '  (모드 없음) = --dry-run: 아무 파일도 쓰지 않는다',
  '  --write 는 마커 구간이 이미 있는 파일만 갱신한다 (1단계에서는 마커를 삽입하지 않음)',
].join('\n');

function main(argv, out) {
  const log = out || ((text) => process.stdout.write(text + '\n'));
  const opts = parseArgs(argv);
  if (opts.help) { log(USAGE); return 0; }
  if (opts.errors.length) { opts.errors.forEach((e) => log('오류: ' + e)); log(USAGE); return 2; }
  const mode = opts.mode || 'dry-run';

  if (mode === 'print') {
    const lines = renderFragment(opts.print.replace(/^\.?\//, ''));
    if (!lines) { log('오류: 분류되지 않았거나 면제된 파일입니다: ' + opts.print); return 2; }
    log(MARKER_START + '\n' + lines.join('\n') + '\n' + MARKER_END);
    return 0;
  }

  if (mode === 'check') {
    const result = checkAll(opts.root);
    const s = summarize(result);
    if (opts.json) {
      log(JSON.stringify({
        total: s.total,
        inSync: s.inSync,
        semanticMismatch: s.semanticBad.map((p) => p.file),
        notInSync: s.notInSync.map((p) => p.file),
        reasonCounts: s.reasonCounts,
        exemptWithGnb: result.exemptWithGnb,
        pages: result.pages.map((p) => ({ file: p.file, status: p.status, reasons: p.reasons })),
      }, null, 2));
    } else {
      log(formatCheckReport(result));
    }
    return s.notInSync.length === 0 ? 0 : 1;
  }

  const plan = planSync(opts.root);
  if (mode === 'write') {
    const written = writePlan(opts.root, plan);
    plan.forEach((p) => log('  [' + ACTION_LABELS[p.action] + '] ' + p.file));
    log('');
    log('쓴 파일 ' + written.length + '개' + (written.length ? ': ' + written.join(', ') : ''));
    return 0;
  }

  plan.forEach((p) => log('  [' + ACTION_LABELS[p.action] + '] ' + p.file));
  const counts = {};
  plan.forEach((p) => { counts[p.action] = (counts[p.action] || 0) + 1; });
  log('');
  log('dry-run 요약: ' + Object.keys(counts).map((a) => ACTION_LABELS[a] + ' ' + counts[a]).join(', '));
  log('아무 파일도 쓰지 않았습니다. 실제 쓰기는 --write 로만 가능합니다.');
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  MARKER_START,
  MARKER_END,
  renderFragment,
  readMarkerRegion,
  applyFragment,
  inspectPage,
  resolveHref,
  extractPrimaryLinks,
  hasGnbMarkup,
  checkAll,
  summarize,
  formatCheckReport,
  planSync,
  writePlan,
  parseArgs,
  main,
};
