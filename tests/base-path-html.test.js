import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();
const DEPLOYED_LINK_RE = /(href|src)="\/krds-ux-writing(?:\/|")/;

describe('HTML base-path coverage', () => {
  it('loads the base-path helper exactly once on every page with deployed absolute links', () => {
    const htmlFiles = walkHtmlFiles(ROOT);
    const affectedFiles = htmlFiles.filter((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      return DEPLOYED_LINK_RE.test(html);
    });

    expect(affectedFiles.length).toBeGreaterThan(0);

    affectedFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const matches = html.match(/base-path\.js/g) || [];
      expect(matches.length, relPath).toBe(1);
    });
  });

  it('avoids hardcoded same-site absolute domain anchors on pages that rely on base-path rewriting', () => {
    const htmlFiles = walkHtmlFiles(ROOT);
    const affectedFiles = htmlFiles.filter((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      return html.includes('base-path.js');
    });

    affectedFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      expect(
        html,
        relPath,
      ).not.toMatch(/<a\b[^>]*href="https:\/\/thenisaid\.github\.io\/krds-ux-writing(?:\/|")/);
    });
  });

  it('loads the base-path helper before the shared nav script on pages that use shared navigation', () => {
    const htmlFiles = walkHtmlFiles(ROOT);
    const sharedNavPages = htmlFiles.filter((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      return html.includes('shared/nav.js');
    });

    expect(sharedNavPages.length).toBeGreaterThan(0);

    sharedNavPages.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const basePathIndex = html.indexOf('shared/base-path.js');
      const navIndex = html.indexOf('shared/nav.js');

      expect(basePathIndex, `${relPath}: missing shared/base-path.js`).toBeGreaterThanOrEqual(0);
      expect(navIndex, `${relPath}: missing shared/nav.js`).toBeGreaterThanOrEqual(0);
      expect(
        basePathIndex,
        `${relPath}: shared/base-path.js must load before shared/nav.js`,
      ).toBeLessThan(navIndex);
    });
  });
});
