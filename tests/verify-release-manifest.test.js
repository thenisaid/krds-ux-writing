import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  matchesForbidden,
  matchesNpmAllowlist,
  computeNpmViolations,
  computeBundleViolations,
  verify,
} = require('../scripts/verify-release-manifest.js');

const ROOT = process.cwd();

describe('matchesForbidden', () => {
  it('matches an exact directory-prefix rule', () => {
    expect(matchesForbidden('research/foo.md', ['research/'])).toBe('research/');
  });

  it('matches a bare-prefix rule like .env', () => {
    expect(matchesForbidden('.env.backup', ['.env'])).toBe('.env');
  });

  it('returns null when nothing matches', () => {
    expect(matchesForbidden('bin/krds-lint', ['research/', 'tests/'])).toBeNull();
  });

  it('does not false-positive on a path that merely contains the prefix substring', () => {
    expect(matchesForbidden('my-research-notes/foo.md', ['research/'])).toBeNull();
  });
});

describe('matchesNpmAllowlist', () => {
  const filesField = ['bin/', 'krds-lint.js', 'NOTICE'];

  it('allows files always included by npm regardless of the files field', () => {
    expect(matchesNpmAllowlist('package.json', filesField)).toBe(true);
    expect(matchesNpmAllowlist('LICENSE', filesField)).toBe(true);
  });

  it('allows a directory entry ending in /', () => {
    expect(matchesNpmAllowlist('bin/krds-lint', filesField)).toBe(true);
  });

  it('allows an exact file entry', () => {
    expect(matchesNpmAllowlist('NOTICE', filesField)).toBe(true);
  });

  it('rejects a file not declared anywhere', () => {
    expect(matchesNpmAllowlist('research/secret.json', filesField)).toBe(false);
  });
});

describe('computeNpmViolations', () => {
  const filesField = ['bin/', 'krds-lint.js'];
  const forbidden = ['research/', '.claude/'];

  it('returns no violations when packed files match the allowlist', () => {
    const result = computeNpmViolations(['bin/krds-lint', 'krds-lint.js', 'package.json'], filesField, forbidden);
    expect(result).toEqual([]);
  });

  it('flags a forbidden path (and separately that it is undeclared, since it is both)', () => {
    const result = computeNpmViolations(['.claude/settings.local.json'], filesField, forbidden);
    expect(result).toHaveLength(2);
    expect(result.some((v) => v.includes('forbidden'))).toBe(true);
    expect(result.every((v) => v.includes('.claude/settings.local.json'))).toBe(true);
  });

  it('flags a file that is neither declared nor forbidden', () => {
    const result = computeNpmViolations(['surprise.txt'], filesField, forbidden);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('선언되지 않은 파일');
  });
});

describe('computeBundleViolations', () => {
  const forbidden = ['research/', 'tests/'];

  it('returns no violations when actual and declared file sets match exactly', () => {
    const result = computeBundleViolations(['index.html', 'app.js'], ['index.html', 'app.js'], 'offline-app', forbidden);
    expect(result).toEqual([]);
  });

  it('flags an undeclared file found on disk (drift: something new leaked in)', () => {
    const result = computeBundleViolations(['index.html', 'leaked.js'], ['index.html'], 'offline-app', forbidden);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('offline-app/leaked.js');
  });

  it('flags a declared file that is missing on disk (drift: something was removed)', () => {
    const result = computeBundleViolations(['index.html'], ['index.html', 'app.js'], 'offline-app', forbidden);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('offline-app/app.js');
    expect(result[0]).toContain('실제 파일이 없음');
  });

  it('flags a forbidden path nested inside the bundle root', () => {
    const result = computeBundleViolations(['tests/fixture.js'], ['tests/fixture.js'], 'offline-app', ['offline-app/tests/']);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('forbidden');
  });
});

describe('verify (orchestration with injected npm/dir readers)', () => {
  const manifest = {
    forbidden: { prefixes: ['research/', '.claude/'] },
    bundles: {
      offlineApp: {
        root: 'offline-app',
        include: ['index.html'],
        excludeDirs: [],
      },
    },
  };
  const pkg = { files: ['index.html'] };

  it('passes when npm pack and the offline-app directory both match their manifests', () => {
    const { okLines, violations } = verify({
      rootDir: '/fake/root',
      manifest,
      pkg,
      packNpm: () => ['index.html', 'package.json'],
      listDir: () => ['index.html'],
      dirExists: () => true,
    });
    expect(violations).toEqual([]);
    expect(okLines).toHaveLength(2);
  });

  it('surfaces npm pack failures as a violation instead of throwing', () => {
    const { violations } = verify({
      rootDir: '/fake/root',
      manifest,
      pkg,
      packNpm: () => {
        throw new Error('boom');
      },
      listDir: () => ['index.html'],
      dirExists: () => true,
    });
    expect(violations.some((v) => v.includes('boom'))).toBe(true);
  });

  it('reports a missing "files" field in package.json as a violation', () => {
    const { violations } = verify({
      rootDir: '/fake/root',
      manifest,
      pkg: {},
      packNpm: () => ['index.html'],
      listDir: () => ['index.html'],
      dirExists: () => true,
    });
    expect(violations.some((v) => v.includes('"files" 필드가 없거나'))).toBe(true);
  });

  it('reports a missing offline-app directory as a violation', () => {
    const { violations } = verify({
      rootDir: '/fake/root',
      manifest,
      pkg,
      packNpm: () => ['index.html'],
      listDir: () => ['index.html'],
      dirExists: () => false,
    });
    expect(violations.some((v) => v.includes('디렉터리가 존재하지 않음'))).toBe(true);
  });
});

describe('scripts/verify-release-manifest.js CLI (integration, read-only)', () => {
  it('exits 0 against the real repository state without mutating anything', () => {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-release-manifest.js')], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('npm 번들');
    expect(result.stdout).toContain('offline-app 번들');
    expect(result.stdout).toContain('통과');
  });

  it('release-manifest.json declares an offline-app include list matching the real files on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
    const declared = manifest.bundles.offlineApp.include;
    declared.forEach((relPath) => {
      const abs = path.join(ROOT, manifest.bundles.offlineApp.root, relPath);
      expect(fs.existsSync(abs)).toBe(true);
    });
  });
});
