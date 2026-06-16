import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function parseInventoryRows(markdown) {
  const sectionMatch = markdown.match(/## 4\. 시민 중심 외부 포털 인벤토리[\s\S]*?(?=\n## 5\.)/);
  const lines = (sectionMatch ? sectionMatch[0] : markdown).split('\n');
  const rows = [];
  let inTable = false;

  lines.forEach((line) => {
    if (line.startsWith('| 서비스 | 현재 공식 명칭 / 도메인 |')) {
      inTable = true;
      return;
    }
    if (!inTable) return;
    if (!line.startsWith('|')) {
      inTable = false;
      return;
    }
    if (line.includes('------')) return;
    rows.push(line);
  });

  return rows.map((row) => row.split('|').slice(1, -1).map((value) => value.trim()));
}

describe('corpus page', () => {
  it('publishes corpus coverage counts and raw source links that match the research docs', () => {
    const html = read('corpus/index.html');
    const survey = read('research/public-service-survey-expanded.md');
    const caseStudiesHtml = read('case-studies/index.html');
    const archiveHtml = read('archive.html');
    const glossary = JSON.parse(read('jargon-dictionary.json'));
    const inventoryRows = parseInventoryRows(survey);

    const coreCount = Number((survey.match(/\| 핵심 코퍼스 \| (\d+) \|/) || [])[1]);
    const supportCount = Number((survey.match(/\| 보조 표본 \| (\d+) \|/) || [])[1]);
    const indirectCount = Number((survey.match(/\| 간접 반영 \| (\d+) \|/) || [])[1]);
    const priorityHighCount = inventoryRows.filter((cols) => cols[5] === '상').length;
    const priorityMidHighCount = inventoryRows.filter((cols) => cols[5] === '중상').length;
    const priorityMidCount = inventoryRows.filter((cols) => cols[5] === '중').length;
    const priorityDictionaryCount = 50;
    const caseCardCount = (caseStudiesHtml.match(/class="case-card"/g) || []).length;
    const archiveCount = Number((archiveHtml.match(/id="stat-total">(\d+)</) || [])[1]);

    expect(html).toContain('<h1>수집한 코퍼스를 “선별본”만이 아니라 원본 범위까지 보이게 엽니다.</h1>');
    expect(html).toContain('공공기관 전체 페이지 전수조사 완료 문서가 아닙니다.');
    expect(html).toContain(`id="corpusStatCore">${coreCount}<`);
    expect(html).toContain(`id="corpusStatSupport">${supportCount}<`);
    expect(html).toContain(`id="corpusStatIndirect">${indirectCount}<`);
    expect(html).toContain(`id="corpusStatInventory">${inventoryRows.length}<`);
    expect(html).toContain(`id="assetPriorityDictionary">${priorityDictionaryCount}<`);
    expect(html).toContain(`id="assetFullDictionary">${glossary.entries.length}<`);
    expect(html).toContain(`id="assetCaseCards">${caseCardCount}<`);
    expect(html).toContain(`id="assetArchive">${archiveCount}<`);
    expect(html).toContain(`id="inventoryHigh">${priorityHighCount}<`);
    expect(html).toContain(`id="inventoryMidHigh">${priorityMidHighCount}<`);
    expect(html).toContain(`id="inventoryMid">${priorityMidCount}<`);
    expect(html).toContain('/krds-ux-writing/dictionary/full.html');
    expect(html).toContain('/krds-ux-writing/research/public-service-corpus.md');
    expect(html).toContain('/krds-ux-writing/research/public-service-survey-expanded.md');
    expect(html).toContain('/krds-ux-writing/jargon-dictionary.json');
    expect(html).toContain('/krds-ux-writing/derived/jeongbu24-guide.md');
    expect(html).toContain('/krds-ux-writing/derived/hometax-guide.md');
    expect(html).toContain('/krds-ux-writing/derived/efamily-court-guide.md');
  });

  it('is discoverable from the home page', () => {
    const homeHtml = read('index.html');

    expect(homeHtml).toContain('코퍼스 공개 현황');
    expect(homeHtml).toContain('href="/krds-ux-writing/corpus/"');
  });
});
