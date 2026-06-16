import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { walkHtmlFiles } from './helpers/walk-html-files.js';

const ROOT = process.cwd();

function readHtmlIds(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const ids = new Set();
  const idRe = /\sid=(['"])(.*?)\1/g;
  let match;

  while ((match = idRe.exec(html))) {
    ids.add(match[2]);
  }

  return ids;
}

function resolveHashTargetFile(fromRelPath, href) {
  const rawTargetPath = href.split('#')[0].split('?')[0];
  if (!rawTargetPath) return path.join(ROOT, fromRelPath);

  let normalizedPath = rawTargetPath.replace(/^\/krds-ux-writing(?=\/|$)/, '');
  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.slice(1);
  } else {
    normalizedPath = path.join(path.dirname(fromRelPath), normalizedPath).replace(/\\/g, '/');
  }

  const candidates = [];
  if (!normalizedPath || normalizedPath === '.') {
    candidates.push('index.html');
  } else {
    candidates.push(normalizedPath);
    if (!normalizedPath.endsWith('.html')) {
      candidates.push(path.join(normalizedPath, 'index.html'));
      candidates.push(normalizedPath + '.html');
    }
  }

  for (const candidate of candidates) {
    const absolutePath = path.join(ROOT, candidate);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  return null;
}

function listBrokenHashAnchors() {
  const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });
  const idCache = new Map();
  const issues = [];

  htmlFiles.forEach((relPath) => {
    const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const anchorRe = /<a\b[^>]*\shref=(['"])(.*?)\1/gi;
    let match;

    while ((match = anchorRe.exec(html))) {
      const href = match[2];
      if (!href.includes('#') || href === '#') continue;
      if (/^(?:mailto:|tel:|javascript:|https?:|data:)/i.test(href)) continue;

      const fragment = href.split('#')[1] || '';
      if (!fragment) continue;

      const targetFile = resolveHashTargetFile(relPath, href);
      if (!targetFile) {
        issues.push(`${relPath}: missing file for ${href}`);
        continue;
      }

      if (!idCache.has(targetFile)) {
        idCache.set(targetFile, readHtmlIds(targetFile));
      }

      if (!idCache.get(targetFile).has(fragment)) {
        issues.push(`${relPath}: ${href} -> ${path.relative(ROOT, targetFile)} is missing #${fragment}`);
      }
    }
  });

  return issues;
}

describe('site link safety', () => {
  it('avoids bare root home links in shared site chrome', () => {
    const htmlFiles = walkHtmlFiles(ROOT, { ignoredDirs: ['.ralph'] });

    htmlFiles.forEach((relPath) => {
      const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      const bareChromeHomeLinks = html.match(/<a[^>]+href="\/"[^>]+class="[^"]*(?:gnb-logo|footer-logo)[^"]*"/g) || [];
      expect(bareChromeHomeLinks, relPath).toHaveLength(0);
    });
  });

  it('keeps index-v2 internal links deployment-aware', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index-v2.html'), 'utf8');

    expect(html).toContain('shared/base-path.js');
    expect(html).not.toMatch(/href="\/(?:principles|dictionary|case-studies)(?:\/|#)/);
    expect(html).not.toMatch(/href="\/"\s+class="(?:gnb-logo|footer-logo)"/);
    expect(html).toMatch(/href="\/krds-ux-writing\/principles\//);
    expect(html).toMatch(/href="\/krds-ux-writing\/dictionary\//);
    expect(html).toMatch(/href="\/krds-ux-writing\/case-studies\//);
  });

  it('keeps local hash links pointing at real section ids', () => {
    const brokenAnchors = listBrokenHashAnchors();

    expect(brokenAnchors, brokenAnchors.join('\n')).toHaveLength(0);
  });
});
