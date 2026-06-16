import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PRINCIPLES,
  extractSnippets,
  replaceSyncBlock,
  syncPromptFiles,
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
});
