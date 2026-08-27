import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  matchesForbidden,
  matchesNpmAllowlist,
  computeNpmViolations,
  computeBundleViolations,
  walkDir,
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
    const result = computeNpmViolations(
      ['bin/krds-lint', 'krds-lint.js', '.claude/settings.local.json'],
      filesField,
      forbidden
    );
    const aboutLeak = result.filter((v) => v.includes('.claude/settings.local.json'));
    expect(aboutLeak).toHaveLength(2);
    expect(aboutLeak.some((v) => v.includes('forbidden'))).toBe(true);
  });

  it('flags a file that is neither declared nor forbidden', () => {
    const result = computeNpmViolations(['bin/krds-lint', 'krds-lint.js', 'surprise.txt'], filesField, forbidden);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('선언되지 않은 파일');
  });

  it('flags a declared file that silently disappeared from the npm pack output', () => {
    const result = computeNpmViolations(['bin/krds-lint'], filesField, forbidden);
    expect(result.some((v) => v.includes('누락됨') && v.includes('krds-lint.js'))).toBe(true);
  });

  it('flags a declared directory that has zero files in the npm pack output', () => {
    const result = computeNpmViolations(['krds-lint.js'], filesField, forbidden);
    expect(result.some((v) => v.includes('하나도 없음') && v.includes('bin/'))).toBe(true);
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

  it('flags a forbidden path nested inside the bundle root, matched bundle-relatively (not root-relatively)', () => {
    // forbidden prefixes are the same root-relative list used for the npm bundle
    // (e.g. "tests/"), so matching must happen against the path *inside* the
    // bundle, not against "offline-app/tests/..." — otherwise a rule like
    // "tests/" would never fire for anything nested under offline-app/.
    const result = computeBundleViolations(['tests/fixture.js'], ['tests/fixture.js'], 'offline-app', ['tests/']);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('forbidden');
    expect(result[0]).toContain('offline-app/tests/fixture.js');
  });
});

describe('walkDir', () => {
  function makeTempTree() {
    // os.tmpdir() (not ROOT) — other tests glob the whole repo for HTML files,
    // and a temp fixture literally named index.html living under the repo root
    // can be caught mid-write/mid-delete by that scan (observed in practice).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krds-verify-release-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>', 'utf8');
    fs.mkdirSync(path.join(dir, 'declared-dep'));
    fs.writeFileSync(path.join(dir, 'declared-dep', 'lib.js'), '', 'utf8');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'evil.js'), '', 'utf8');
    return dir;
  }

  it('skips only explicitly excluded directories, not every directory named node_modules', () => {
    const dir = makeTempTree();
    try {
      const excluded = walkDir(dir, [path.join(dir, 'declared-dep')]);
      expect(excluded.sort()).toEqual(['index.html', 'node_modules/evil.js']);

      const notExcluded = walkDir(dir, []);
      expect(notExcluded.sort()).toEqual(['declared-dep/lib.js', 'index.html', 'node_modules/evil.js']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('verify (orchestration with injected npm/dir readers)', () => {
  const manifest = {
    forbidden: { prefixes: ['research/', '.claude/'] },
    bundles: {
      offlineApp: {
        root: 'offline-app',
        releaseFiles: ['index.html'],
        repoOnlyFiles: [],
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

  it('release-manifest.json declares an offline-app releaseFiles+repoOnlyFiles list matching the real files on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
    const bundle = manifest.bundles.offlineApp;
    const declared = [...bundle.releaseFiles, ...bundle.repoOnlyFiles];
    declared.forEach((relPath) => {
      const abs = path.join(ROOT, bundle.root, relPath);
      expect(fs.existsSync(abs)).toBe(true);
    });
  });
});
