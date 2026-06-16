import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function parseArchiveIssueCount(markdown) {
  return markdown
    .split(/^(?=(?:###|####)\s+[EHF]\d+\s*[—:])/m)
    .filter((block) => {
      return /^(?:###|####)\s+[EHF]\d+\s*[—:]\s*.*? (★+) \[[^\]]+\]/.test(block) ||
        /^>\s*원칙\s*:/m.test(block) ||
        (/\|\s*\*\*원칙\*\*\s*\|\s*([^|]+)\|/m.test(block) &&
          /\|\s*\*\*심각도\*\*\s*\|\s*(★+)\s*\|/m.test(block));
    })
    .length;
}

describe('static content counts', () => {
  it('keeps dictionary filter badge counts aligned with the rendered rows', () => {
    const html = read('dictionary/index.html');
    const noTranslation = read('principles/no-translation/index.html');
    const rows = [...html.matchAll(/<tr data-cat="([^"]+)"/g)].map((match) => match[1]);
    const actualCounts = rows.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, /** @type {Record<string, number>} */ ({}));

    const badgeCounts = Object.fromEntries(
      [...html.matchAll(/<button class="filter-btn(?: active)?" data-cat="([^"]+)"[^>]*>[\s\S]*?<span class="count">(\d+)<\/span>/g)]
        .map((match) => [match[1], Number(match[2])]),
    );
    const heroStats = [...html.matchAll(/<div class="stat-num">(\d+)<\/div>/g)].map((match) => Number(match[1]));
    const glossaryTotal = Number((noTranslation.match(/(\d+)개 행정어를 5개 카테고리로 분류합니다/) || [])[1]);
    const footerCounts = (html.match(/전체 (\d+)개 사전 중 고우선순위 (\d+)개 수록/) || []).slice(1).map(Number);

    expect(badgeCounts.all).toBe(rows.length);
    expect(badgeCounts.admin).toBe(actualCounts.admin || 0);
    expect(badgeCounts.double).toBe(actualCounts.double || 0);
    expect(badgeCounts.foreign).toBe(actualCounts.foreign || 0);
    expect(badgeCounts.formal).toBe(actualCounts.formal || 0);
    expect(heroStats[0]).toBe(rows.length);
    expect(heroStats[1]).toBe(glossaryTotal);
    expect(footerCounts).toEqual([glossaryTotal, rows.length]);
  });

  it('keeps archive stats and tab badges aligned with the derived guide data', () => {
    const html = read('archive.html');
    const derivedFiles = {
      jeongbu24: 'derived/jeongbu24-guide.md',
      hometax: 'derived/hometax-guide.md',
      efamily: 'derived/efamily-court-guide.md',
    };

    const actualCounts = Object.fromEntries(
      Object.entries(derivedFiles).map(([agency, relPath]) => {
        return [agency, parseArchiveIssueCount(read(relPath))];
      }),
    );

    const htmlBadgeCounts = Object.fromEntries(
      [...html.matchAll(/id="arc-count-badge-([^"]+)">(\d+)</g)].map((match) => [match[1], Number(match[2])]),
    );
    const htmlTotal = Number((html.match(/id="stat-total">(\d+)</) || [])[1]);

    expect(htmlBadgeCounts).toEqual(actualCounts);
    expect(htmlTotal).toBe(
      actualCounts.jeongbu24 + actualCounts.hometax + actualCounts.efamily,
    );
  });

  it('keeps index archive entry counts aligned with the derived guide data', () => {
    const html = read('index.html');
    const derivedFiles = {
      jeongbu24: 'derived/jeongbu24-guide.md',
      hometax: 'derived/hometax-guide.md',
      efamily: 'derived/efamily-court-guide.md',
    };

    const actualCounts = Object.fromEntries(
      Object.entries(derivedFiles).map(([agency, relPath]) => {
        return [agency, parseArchiveIssueCount(read(relPath))];
      }),
    );

    const entryCounts = {
      jeongbu24: Number((html.match(/정부24 (\d+)개/) || [])[1]),
      hometax: Number((html.match(/홈택스 (\d+)개/) || [])[1]),
      efamily: Number((html.match(/전자가족관계등록 (\d+)개/) || [])[1]),
    };
    const entryTotal = Object.values(entryCounts).reduce((sum, count) => sum + count, 0);

    expect(entryTotal).toBe(
      actualCounts.jeongbu24 + actualCounts.hometax + actualCounts.efamily,
    );
    expect(entryCounts).toEqual(actualCounts);
  });
});
