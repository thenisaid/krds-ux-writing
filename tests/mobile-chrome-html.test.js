import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

describe('mobile site chrome', () => {
  it('does not hide the primary gnb nav on small screens without an alternate menu path', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });
    const offenders = [];

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const hasGnbNav = /class="[^"]*\bgnb-nav\b[^"]*"/.test(html);
      const hasMobileAlternative = /gnbHamburger|id="mobileMenu"|class="sidebar-backdrop"/.test(html);
      const hidesGnbNavOnMobile = /@media\s*\(max-width:\s*\d+px\)\s*\{[\s\S]*?\.gnb-nav\s*\{\s*display:\s*none\s*;?/m.test(html);

      if (hasGnbNav && !hasMobileAlternative && hidesGnbNavOnMobile) {
        offenders.push(relPath);
      }
    });

    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });
});
