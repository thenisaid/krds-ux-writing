import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// 웹 게시에서 제외하기로 오너가 확정한 내부 도구 (2026-11-17). 저장소에는 남아 있어야 한다.
const UNPUBLISHED_PAGES = ['ontology-query.html', 'term-graph.html'];

function readLines(file) {
  return fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

describe('내부 도구 웹 게시 제외', () => {
  it.each(UNPUBLISHED_PAGES)('%s 는 GitHub Pages(_config.yml exclude)에서 제외된다', (page) => {
    const lines = readLines('_config.yml');
    const excludeAt = lines.indexOf('exclude:');

    expect(excludeAt).toBeGreaterThanOrEqual(0);
    expect(lines.slice(excludeAt + 1)).toContain(`- ${page}`);
  });

  it.each(UNPUBLISHED_PAGES)('%s 는 Vercel(.vercelignore)에서 제외된다', (page) => {
    expect(readLines('.vercelignore')).toContain(page);
  });

  it.each(UNPUBLISHED_PAGES)('%s 는 저장소에 남아 있다 (게시만 제외)', (page) => {
    expect(fs.existsSync(path.join(ROOT, page))).toBe(true);
  });
});
