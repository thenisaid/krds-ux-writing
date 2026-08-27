import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  computeBundleClassificationViolations,
  parseManifestTable,
  computeManifestDriftViolations,
  verify,
} = require('../scripts/verify-offline-app-bundle.js');

const ROOT = process.cwd();

function readReleaseManifestOfflineAppBundle() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
  return manifest.bundles.offlineApp;
}

describe('computeBundleClassificationViolations', () => {
  const bundle = readReleaseManifestOfflineAppBundle();
  const { releaseFiles, repoOnlyFiles } = bundle;
  const declared = [...releaseFiles, ...repoOnlyFiles];

  it('returns no violations when actual files exactly match releaseFiles + repoOnlyFiles', () => {
    expect(computeBundleClassificationViolations(declared, releaseFiles, repoOnlyFiles)).toEqual([]);
  });

  it('flags an undeclared file (e.g. a stray file someone dropped into offline-app/)', () => {
    const result = computeBundleClassificationViolations([...declared, 'rogue.js'], releaseFiles, repoOnlyFiles);
    expect(result.some((v) => v.includes('rogue.js') && v.includes('선언되지 않은'))).toBe(true);
  });

  it('flags a declared releaseFiles entry that is missing on disk', () => {
    const withoutIndexHtml = declared.filter((f) => f !== 'index.html');
    const result = computeBundleClassificationViolations(withoutIndexHtml, releaseFiles, repoOnlyFiles);
    expect(result.some((v) => v.includes('index.html') && v.includes('실제로 없음'))).toBe(true);
  });

  it('flags a declared repoOnlyFiles entry that is missing on disk', () => {
    const withoutManifest = declared.filter((f) => f !== 'MANIFEST.md');
    const result = computeBundleClassificationViolations(withoutManifest, releaseFiles, repoOnlyFiles);
    expect(result.some((v) => v.includes('MANIFEST.md') && v.includes('실제로 없음'))).toBe(true);
  });

  it('flags an entry declared in both releaseFiles and repoOnlyFiles', () => {
    const result = computeBundleClassificationViolations(['index.html'], ['index.html'], ['index.html']);
    expect(result.some((v) => v.includes('동시에 선언된'))).toBe(true);
  });

  it('never classifies electron/node_modules content as part of the release bundle (source of truth: release-manifest.json)', () => {
    // node_modules is excluded from the walk entirely (see verify()), but as a
    // defense-in-depth check: it must never appear in either declared list.
    expect(releaseFiles.some((f) => f.includes('node_modules'))).toBe(false);
    expect(repoOnlyFiles.some((f) => f.includes('node_modules'))).toBe(false);
  });
});

describe('parseManifestTable', () => {
  it('extracts backtick-quoted paths from rows under "## 파일 목록"', () => {
    const md = [
      '# Title',
      '',
      '## 파일 목록',
      '',
      '| 경로 | 역할 |',
      '|------|------|',
      '| `index.html` | entry point |',
      '| `app.js` | logic |',
      '',
      '## 실행 방법',
      '',
      '| `not-a-file.js` | should not be picked up, wrong section |',
    ].join('\n');

    expect(parseManifestTable(md)).toEqual(['index.html', 'app.js']);
  });

  it('returns an empty array when there is no "## 파일 목록" heading', () => {
    expect(parseManifestTable('# Title\n\nsome text')).toEqual([]);
  });

  it('keeps a trailing slash on directory-style rows', () => {
    const md = ['## 파일 목록', '| 경로 | 역할 |', '|---|---|', '| `electron/node_modules/` | excluded dir |'].join('\n');
    expect(parseManifestTable(md)).toEqual(['electron/node_modules/']);
  });
});

describe('computeManifestDriftViolations', () => {
  it('returns no violations when actual files and documented paths match', () => {
    const result = computeManifestDriftViolations(['index.html', 'app.js'], ['index.html', 'app.js']);
    expect(result).toEqual([]);
  });

  it('flags a real file that the MANIFEST table never mentions (the core drift scenario)', () => {
    const result = computeManifestDriftViolations(['index.html', 'electron/main.js'], ['index.html']);
    expect(result.some((v) => v.includes('electron/main.js') && v.includes('문서화되어 있지 않음'))).toBe(true);
  });

  it('flags a documented file that no longer exists on disk', () => {
    const result = computeManifestDriftViolations(['index.html'], ['index.html', 'removed.js']);
    expect(result.some((v) => v.includes('removed.js') && v.includes('존재하지 않음'))).toBe(true);
  });

  it('treats a documented directory entry as covering everything under it', () => {
    const result = computeManifestDriftViolations(['electron/node_modules/pkg/index.js'], ['electron/node_modules/']);
    expect(result).toEqual([]);
  });
});

describe('verify (orchestration with injected manifest text and dir listing)', () => {
  const bundle = readReleaseManifestOfflineAppBundle();
  const { releaseFiles, repoOnlyFiles, excludeDirs } = bundle;

  it('passes when the manifest documents exactly what listDir returns', () => {
    const manifestMarkdown = ['## 파일 목록', '| 경로 | 역할 |', '|---|---|']
      .concat([...releaseFiles, ...repoOnlyFiles].map((f) => '| `' + f + '` | desc |'))
      .join('\n');

    const { violations, okLines } = verify({
      offlineAppRoot: '/fake/offline-app',
      manifestMarkdown,
      releaseFiles,
      repoOnlyFiles,
      excludeDirs,
      listDir: () => [...releaseFiles, ...repoOnlyFiles],
    });

    expect(violations).toEqual([]);
    expect(okLines).toHaveLength(2);
  });

  it('fails when listDir reports a file the manifest never documented', () => {
    const manifestMarkdown = ['## 파일 목록', '| 경로 | 역할 |', '|---|---|']
      .concat([...releaseFiles, ...repoOnlyFiles].map((f) => '| `' + f + '` | desc |'))
      .join('\n');

    const { violations } = verify({
      offlineAppRoot: '/fake/offline-app',
      manifestMarkdown,
      releaseFiles,
      repoOnlyFiles,
      excludeDirs,
      listDir: () => [...releaseFiles, ...repoOnlyFiles, 'electron/node_modules/leaked.js'],
    });

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('electron/node_modules/leaked.js'))).toBe(true);
  });
});

describe('scripts/verify-offline-app-bundle.js CLI (integration, read-only)', () => {
  it('exits 0 against the real offline-app/ directory, MANIFEST.md, and release-manifest.json', () => {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-offline-app-bundle.js')], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('배포 산출물 분류');
    expect(result.stdout).toContain('MANIFEST.md 드리프트');
    expect(result.stdout).toContain('통과');
  });

  it('every releaseFiles and repoOnlyFiles entry declared in release-manifest.json exists under the real offline-app/', () => {
    const bundle = readReleaseManifestOfflineAppBundle();
    [...bundle.releaseFiles, ...bundle.repoOnlyFiles].forEach((relPath) => {
      const abs = path.join(ROOT, 'offline-app', relPath);
      expect(fs.existsSync(abs)).toBe(true);
    });
  });
});
