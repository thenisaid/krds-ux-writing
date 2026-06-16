import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'shared/base-path.js'), 'utf8');

function makeNode(attrs = {}) {
  const state = { ...attrs };
  return {
    getAttribute(name) {
      return state[name] ?? null;
    },
    setAttribute(name, value) {
      state[name] = value;
    },
    toJSON() {
      return state;
    },
  };
}

function runBasePath({ pathname = '/index.html', href, scriptPath = '/shared/base-path.js', hrefNodes = [], srcNodes = [] } = {}) {
  const currentScript = { src: `https://example.com${scriptPath}` };
  const document = {
    currentScript,
    querySelectorAll(selector) {
      if (selector === '[href]') return hrefNodes;
      if (selector === '[src]') return srcNodes;
      return [];
    },
    getElementsByTagName() {
      return [currentScript];
    },
  };

  const context = {
    document,
    window: {
      location: {
        pathname,
        href: href || `https://example.com${pathname}`,
      },
    },
    URL,
    Array,
    console,
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(SOURCE, context);

  return context.window.KRDSBasePath;
}

describe('shared/base-path.js', () => {
  it('rewrites deployed absolute links for root-level local preview', () => {
    const homeLink = makeNode({ href: '/krds-ux-writing/' });
    const principlesLink = makeNode({ href: '/krds-ux-writing/principles/' });

    const basePath = runBasePath({
      pathname: '/index.html',
      hrefNodes: [homeLink, principlesLink],
    });

    expect(homeLink.getAttribute('href')).toBe('/');
    expect(principlesLink.getAttribute('href')).toBe('/principles/');
    expect(basePath.buildSitePath('/dictionary/')).toBe('/dictionary/');
    expect(basePath.toSiteRelativePath('/principles/foundation/')).toBe('/principles/foundation/');
  });

  it('preserves the deployment prefix on GitHub Pages-style paths', () => {
    const principlesLink = makeNode({ href: '/krds-ux-writing/principles/' });

    const basePath = runBasePath({
      pathname: '/krds-ux-writing/index.html',
      scriptPath: '/krds-ux-writing/shared/base-path.js',
      hrefNodes: [principlesLink],
    });

    expect(principlesLink.getAttribute('href')).toBe('/krds-ux-writing/principles/');
    expect(basePath.buildSitePath('/')).toBe('/krds-ux-writing/');
    expect(basePath.toSiteRelativePath('/krds-ux-writing/principles/')).toBe('/principles/');
  });

  it('adapts deployed links to arbitrary local subpaths', () => {
    const asset = makeNode({ src: '/krds-ux-writing/assets/logo.svg' });
    const link = makeNode({ href: '/krds-ux-writing/case-studies/' });

    const basePath = runBasePath({
      pathname: '/preview/KRDS/index.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
      hrefNodes: [link],
      srcNodes: [asset],
    });

    expect(link.getAttribute('href')).toBe('/preview/KRDS/case-studies/');
    expect(asset.getAttribute('src')).toBe('/preview/KRDS/assets/logo.svg');
    expect(basePath.buildSitePath('/prompt-library.html')).toBe('/preview/KRDS/prompt-library.html');
    expect(basePath.toSiteRelativePath('/preview/KRDS/principles/foundation/')).toBe('/principles/foundation/');
  });

  it('rewrites deployed absolute hash links for local preview paths', () => {
    const caseStudiesLink = makeNode({ href: '/krds-ux-writing/#case-studies' });

    const basePath = runBasePath({
      pathname: '/preview/KRDS/archive.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
      hrefNodes: [caseStudiesLink],
    });

    expect(caseStudiesLink.getAttribute('href')).toBe('/preview/KRDS/#case-studies');
    expect(basePath.normalizeSitePath('/krds-ux-writing/#case-studies')).toBe('/preview/KRDS/#case-studies');
    expect(basePath.buildSitePath('/#case-studies')).toBe('/preview/KRDS/#case-studies');
  });

  it('preserves query strings when normalizing deployed root links', () => {
    const docsLink = makeNode({ href: '/krds-ux-writing/?tab=overview' });

    const basePath = runBasePath({
      pathname: '/preview/KRDS/index.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
      hrefNodes: [docsLink],
    });

    expect(docsLink.getAttribute('href')).toBe('/preview/KRDS/?tab=overview');
    expect(basePath.stripDeploymentPrefix('/krds-ux-writing/?tab=overview')).toBe('/?tab=overview');
    expect(basePath.normalizeSitePath('/krds-ux-writing/?tab=overview')).toBe('/preview/KRDS/?tab=overview');
  });

  it('rewrites deployed root links without a trailing slash before query and hash suffixes', () => {
    const queryLink = makeNode({ href: '/krds-ux-writing?tab=overview' });
    const hashLink = makeNode({ href: '/krds-ux-writing#case-studies' });

    runBasePath({
      pathname: '/preview/KRDS/index.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
      hrefNodes: [queryLink, hashLink],
    });

    expect(queryLink.getAttribute('href')).toBe('/preview/KRDS/?tab=overview');
    expect(hashLink.getAttribute('href')).toBe('/preview/KRDS/#case-studies');
  });

  it('treats custom subpath root URLs consistently even when query or hash suffixes omit the trailing slash', () => {
    const basePath = runBasePath({
      pathname: '/preview/KRDS/index.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
    });

    expect(basePath.toSiteRelativePath('/preview/KRDS?tab=overview')).toBe('/?tab=overview');
    expect(basePath.toSiteRelativePath('/preview/KRDS#case-studies')).toBe('/#case-studies');
  });

  it('keeps normalizeSitePath idempotent for already normalized custom-subpath URLs', () => {
    const basePath = runBasePath({
      pathname: '/preview/KRDS/index.html',
      scriptPath: '/preview/KRDS/shared/base-path.js',
    });

    expect(basePath.normalizeSitePath('/preview/KRDS/?tab=overview')).toBe('/preview/KRDS/?tab=overview');
    expect(basePath.normalizeSitePath('/preview/KRDS#case-studies')).toBe('/preview/KRDS/#case-studies');
  });
});
