import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

describe('prompt copy page wiring', () => {
  it('loads the shared prompt copy script on every page that renders prompt copy buttons', () => {
    const offenders = [];

    walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] }).forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      if (!/\bpl-copy-btn\b/.test(html)) return;
      if (!/<script\b[^>]*\bsrc=(['"])(?:\.\.\/)*shared\/prompt-copy\.js\1/i.test(html)) {
        offenders.push(relPath);
      }
    });

    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });
});
