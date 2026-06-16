import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readHtml(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function getIds(html) {
  return new Set(
    [...html.matchAll(/\bid=(['"])([^'"]+)\1/g)].map((match) => match[2]),
  );
}

function countClassOccurrences(html, className) {
  let count = 0;

  for (const match of html.matchAll(/\bclass=(['"])([^'"]+)\1/g)) {
    const tokens = match[2].split(/\s+/).filter(Boolean);
    if (tokens.includes(className)) count += 1;
  }

  return count;
}

const PAGE_SCRIPT_CONTRACTS = [
  {
    htmlFile: 'archive.html',
    scriptSrcRe: /<script\b[^>]*\bsrc=(['"])archive\.js(?:\?[^'"]*)?\1/i,
    ids: [
      'themeToggle',
      'arc-tab-jeongbu24',
      'arc-tab-hometax',
      'arc-tab-efamily',
      'arc-count-badge-jeongbu24',
      'arc-count-badge-hometax',
      'arc-count-badge-efamily',
      'arc-panel-jeongbu24',
      'arc-panel-hometax',
      'arc-panel-efamily',
      'arc-search-jeongbu24',
      'arc-search-hometax',
      'arc-search-efamily',
      'arc-result-jeongbu24',
      'arc-result-hometax',
      'arc-result-efamily',
      'arc-grid-jeongbu24',
      'arc-grid-hometax',
      'arc-grid-efamily',
    ],
    classMinimums: [
      ['arc-tab', 3],
      ['arc-panel', 3],
      ['arc-filter', 3],
    ],
    regexes: [
      /\bdata-agency="jeongbu24"/,
      /\bdata-agency="hometax"/,
      /\bdata-agency="efamily"/,
    ],
  },
  {
    htmlFile: 'dictionary/index.html',
    scriptSrcRe: /<script\b[^>]*\bsrc=(['"])dict\.js\1/i,
    ids: [
      'searchInput',
      'searchClear',
      'resultCount',
      'emptyState',
      'dictTable',
      'dictBody',
    ],
    classMinimums: [
      ['filter-btn', 1],
      ['table-wrap', 1],
    ],
    regexes: [
      /<tbody\b[^>]*\bid=(['"])dictBody\1[^>]*>[\s\S]*?<tr\b/i,
    ],
  },
  {
    htmlFile: 'generator/index.html',
    scriptSrcRe: /<script\b[^>]*\bsrc=(['"])app\.js\1/i,
    ids: [
      'generator-form',
      'submit-btn',
      'agency-name',
      'agency-type',
      'sample-1',
      'sample-2',
      'sample-3',
      'form-alert',
      'stream-output',
      'generating-status',
      'generating-error',
      'fallback-area',
      'cancel-btn',
      'fallback-btn',
      'output-title',
      'output-content',
      'copy-md-btn',
      'download-btn',
      'restart-btn',
      'download-error',
      'dl-chevron',
      'dl-menu',
    ],
    classMinimums: [
      ['screen', 3],
      ['dl-menu-item', 3],
    ],
    regexes: [
      /<script\b[^>]*\bsrc=(['"])\.\.\/shared\/base-path\.js(?:\?[^'"]*)?\1[\s\S]*<script\b[^>]*\bsrc=(['"])app\.js(?:\?[^'"]*)?\2/i,
    ],
  },
  {
    htmlFile: 'lint.html',
    scriptSrcRe: /<script\b[^>]*\bsrc=(['"])(?:\.\/)?lint-ui\.js\1/i,
    ids: [
      'themeToggle',
      'inputText',
      'sampleBtn',
      'clearBtn',
      'scoreSection',
      'highlightCard',
      'issuesCard',
      'improvedCard',
      'highlightedText',
      'issuesList',
      'issuesTitle',
      'lintBtn',
      'copyBtn',
      'downloadBtn',
      'shareLinkBtn',
      'improvedText',
      'copyImprovedBtn',
      'historyCard',
      'historyList',
      'clearHistoryBtn',
      'cliBanner',
      'cliBannerClose',
      'copyCliBtn',
      'charCount',
      'toast',
    ],
    classMinimums: [
      ['opt-chip', 2],
      ['filter-tab', 4],
    ],
  },
  {
    htmlFile: 'krds-extension/popup.html',
    scriptSrcRe: /<script\b[^>]*\bsrc=(['"])popup\.js\1/i,
    ids: [
      'searchInput',
      'clearBtn',
      'resultsList',
      'resultsView',
      'tipsView',
      'fullGuideBtn',
      'openFullBtn',
      'categoryChips',
    ],
    classMinimums: [
      ['chip', 1],
    ],
  },
];

describe('page-specific HTML/script contracts', () => {
  PAGE_SCRIPT_CONTRACTS.forEach((spec) => {
    it(`${spec.htmlFile} keeps the DOM contract expected by its page script`, () => {
      const html = readHtml(spec.htmlFile);
      const ids = getIds(html);

      expect(spec.scriptSrcRe.test(html), `${spec.htmlFile}: missing page script tag`).toBe(true);

      spec.ids.forEach((id) => {
        expect(ids.has(id), `${spec.htmlFile}: missing #${id}`).toBe(true);
      });

      spec.classMinimums.forEach(([className, minimumCount]) => {
        expect(
          countClassOccurrences(html, className),
          `${spec.htmlFile}: expected at least ${minimumCount} .${className}`,
        ).toBeGreaterThanOrEqual(minimumCount);
      });

      (spec.regexes || []).forEach((pattern) => {
        expect(pattern.test(html), `${spec.htmlFile}: missing ${pattern}`).toBe(true);
      });
    });
  });
});
