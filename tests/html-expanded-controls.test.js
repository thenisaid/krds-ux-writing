import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

function getIds(html) {
  return new Set(
    [...html.matchAll(/\bid=(['"])([^'"]+)\1/g)].map((match) => match[2]),
  );
}

function getIdCounts(html) {
  return [...html.matchAll(/\bid=(['"])([^'"]+)\1/g)].reduce((counts, match) => {
    const id = match[2];
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());
}

function getAttributeTokens(html, attribute) {
  const attrRe = new RegExp(`\\b${attribute}=(['"])([^'"]+)\\1`, 'gi');
  const matches = [];

  for (const match of html.matchAll(attrRe)) {
    const value = match[2].trim();
    if (!value) continue;
    matches.push({
      raw: match[0],
      tokens: attribute === 'for' ? [value] : value.split(/\s+/).filter(Boolean),
    });
  }

  return matches;
}

describe('expanded button relationships', () => {
  it('keeps button aria-expanded states wired to concrete same-page controls', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const ids = getIds(html);
      const buttons = [...html.matchAll(/<button\b(?=[^>]*\baria-expanded=(['"])[^'"]+\1)[^>]*>/gi)];

      buttons.forEach((match) => {
        const tag = match[0];
        const controlsMatch = tag.match(/\baria-controls=(['"])([^'"]+)\1/i);

        expect(controlsMatch, `${relPath}: ${tag}`).not.toBeNull();
        expect(ids.has(controlsMatch[2]), `${relPath}: ${tag}`).toBe(true);
      });
    });
  });
});

describe('html id and reference integrity', () => {
  it('keeps ids unique within each html document', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const duplicateIds = [...getIdCounts(html).entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `${id} (${count})`);

      expect(duplicateIds, relPath).toHaveLength(0);
    });
  });

  it('keeps aria and label references wired to concrete same-page ids', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });
    const refAttributes = ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'];

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const ids = getIds(html);

      refAttributes.forEach((attribute) => {
        getAttributeTokens(html, attribute).forEach((match) => {
          match.tokens.forEach((token) => {
            expect(ids.has(token), `${relPath}: ${match.raw}`).toBe(true);
          });
        });
      });
    });
  });
});
