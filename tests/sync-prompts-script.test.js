import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PRINCIPLES,
  extractSnippets,
  replaceSyncBlock,
  syncPromptFiles,
  main,
} = require('../scripts/sync-prompts.js');

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('scripts/sync-prompts.js', () => {
  it('does not rewrite live principle pages when only the sync date changes', () => {
    const writes = [];

    const updated = syncPromptFiles({
      libraryHtml: read('prompt-library.html'),
      rootDir: ROOT,
      date: '2099-12-31',
      writeFile(filePath, html) {
        writes.push({ filePath, html });
      },
      log() {},
      warn() {},
    });

    expect(updated).toBe(0);
    expect(writes).toEqual([]);
  });

  it('updates the block when a synced snippet changes', () => {
    const { id, file } = PRINCIPLES[0];
    const snippets = extractSnippets(read('prompt-library.html'), id);
    const modifiedSnippets = snippets.map((snippet, index) => {
      if (index !== 0) return snippet;
      return snippet.replace('행정어·전문용어 순화', '행정어·전문용어 재작성');
    });

    const result = replaceSyncBlock(read(file), {
      id,
      snippets: modifiedSnippets,
      date: '2099-12-31',
    });

    expect(result.changed).toBe(true);
    expect(result.reason).toBe('updated');
    expect(result.html).toContain('<!-- auto-updated: 2099-12-31 -->');
    expect(result.html).toContain('행정어·전문용어 재작성');
  });

  it('reports missing sync markers without changing the input html', () => {
    const result = replaceSyncBlock('<section></section>', {
      id: 'no-translation',
      snippets: ['<article data-principle="no-translation"></article>'],
      date: '2099-12-31',
    });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('missing-markers');
    expect(result.html).toBe('<section></section>');
  });

  it('clears stale synced snippets when the source library no longer contains them', () => {
    const { id, file } = PRINCIPLES[0];
    const writes = [];
    const expected = replaceSyncBlock(read(file), {
      id,
      snippets: [],
      date: '2099-12-31',
    });

    const updated = syncPromptFiles({
      libraryHtml: '<main></main>',
      principles: [{ id, file }],
      rootDir: ROOT,
      date: '2099-12-31',
      writeFile(filePath, html) {
        writes.push({ filePath, html });
      },
      log() {},
      warn() {},
    });

    expect(expected.changed).toBe(true);
    expect(updated).toBe(1);
    expect(writes).toEqual([
      { filePath: path.join(ROOT, file), html: expected.html },
    ]);
  });

  it('skips a principle when its target file does not exist on disk', () => {
    const warns = [];
    const updated = syncPromptFiles({
      libraryHtml: '<article data-principle="missing-id">내용</article>',
      principles: [{ id: 'missing-id', file: 'nonexistent/does-not-exist.html' }],
      rootDir: ROOT,
      date: '2099-12-31',
      writeFile() { throw new Error('writeFile must not be called'); },
      log() {},
      warn(msg) { warns.push(msg); },
    });

    expect(updated).toBe(0);
    expect(warns.some((w) => w.includes('target missing'))).toBe(true);
  });

  it('skips and warns when the target file exists but is missing sync markers', () => {
    const { id, file } = PRINCIPLES[0];
    const warns = [];

    const updated = syncPromptFiles({
      libraryHtml: `<article data-principle="${id}">내용</article>`,
      principles: [{ id, file }],
      rootDir: ROOT,
      date: '2099-12-31',
      readFile() { return '<section><p>마커 없음</p></section>'; },
      writeFile() { throw new Error('writeFile must not be called'); },
      log() {},
      warn(msg) { warns.push(msg); },
    });

    expect(updated).toBe(0);
    expect(warns.some((w) => w.includes('sync markers missing'))).toBe(true);
  });

  it('treats tags as missing-markers when endTag appears before startTag in the document', () => {
    const id = 'no-translation';
    const html = '<!-- sync:no-translation:end -->before<!-- sync:no-translation:start -->';
    const result = replaceSyncBlock(html, { id, snippets: [], date: '2099-12-31' });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('missing-markers');
    expect(result.html).toBe(html);
  });

  it('uses singular "snippet" in the log when exactly one snippet is written', () => {
    const { id, file } = PRINCIPLES[0];
    const logs = [];
    const fakeTarget = `<div><!-- sync:${id}:start -->\n      <!-- auto-updated: 2000-01-01 -->\n      <article>OLD</article>\n      <!-- sync:${id}:end --></div>`;
    const fakeLibrary = `<article data-principle="${id}">NEW</article>`;

    const updated = syncPromptFiles({
      libraryHtml: fakeLibrary,
      principles: [{ id, file }],
      rootDir: ROOT,
      date: '2099-12-31',
      readFile() { return fakeTarget; },
      writeFile() {},
      log(msg) { logs.push(msg); },
      warn() {},
    });

    expect(updated).toBe(1);
    const updateLog = logs.find((l) => l.includes('snippet'));
    expect(updateLog).toContain('(1 snippet)');
    expect(updateLog).not.toContain('snippets');
  });

  it('returns 0 and logs a not-found message when prompt-library.html does not exist', () => {
    const logs = [];
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    const spy = vi.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));
    try {
      const result = main();
      expect(result).toBe(0);
      expect(logs.some((l) => l.includes('not found'))).toBe(true);
    } finally {
      vi.restoreAllMocks();
      spy.mockRestore();
    }
  });
});
