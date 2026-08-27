#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-release-manifest.js
 *
 * release-manifest.json에 선언된 배포 번들(npm 패키지, offline-app 오프라인 앱)이
 * 실제로 만들어내는 파일 목록과 일치하는지, 그리고 forbidden 목록(research/,
 * b2g-service-package/, tests/, .claude/, .env* 등)에 해당하는 파일이 단 하나도
 * 섞여 있지 않은지 검증한다.
 *
 * - npm 번들: `npm pack --dry-run --json` 결과를 package.json의 files 필드와 대조.
 * - offline-app 번들: offline-app/ 디렉터리를 실제로 순회해 release-manifest.json의
 *   include 목록과 정확히 일치하는지 확인(node_modules 등 excludeDirs는 순회에서 제외).
 *
 * 사용법:
 *   node scripts/verify-release-manifest.js
 *
 * 종료 코드: 위반 사항이 하나라도 있으면 1, 모두 통과하면 0.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const NPM_ALWAYS_INCLUDED = new Set(['package.json', 'README.md', 'LICENSE', 'LICENSE.txt', 'LICENCE']);

function matchesForbidden(relPath, forbiddenPrefixes) {
  const normalized = relPath.split(path.sep).join('/');
  return (
    forbiddenPrefixes.find(
      (prefix) => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)
    ) || null
  );
}

function matchesNpmAllowlist(relPath, filesField) {
  if (NPM_ALWAYS_INCLUDED.has(relPath)) return true;
  return filesField.some((entry) => {
    if (entry.endsWith('/')) return relPath === entry.slice(0, -1) || relPath.startsWith(entry);
    return relPath === entry;
  });
}

/**
 * npm pack 결과(packedPaths)를 package.json files 필드 및 forbidden 목록과 대조한다.
 * 순수 함수 — 실제 fs/spawnSync를 호출하지 않아 유닛 테스트에서 합성 입력으로 검증 가능하다.
 */
function computeNpmViolations(packedPaths, filesField, forbiddenPrefixes) {
  const violations = [];
  packedPaths.forEach((relPath) => {
    const hit = matchesForbidden(relPath, forbiddenPrefixes);
    if (hit) {
      violations.push('npm 번들: forbidden 경로가 npm pack 결과에 포함됨 — "' + relPath + '" (규칙: ' + hit + ')');
    }
    if (!matchesNpmAllowlist(relPath, filesField)) {
      violations.push('npm 번들: package.json files에 선언되지 않은 파일이 npm pack 결과에 포함됨 — "' + relPath + '"');
    }
  });
  return violations;
}

/**
 * 실제로 존재하는 파일 목록(actualPaths)과 release-manifest.json의 include 선언
 * (declaredPaths)을 서로 대조한다. 순수 함수 — 디렉터리를 직접 순회하지 않는다.
 */
function computeBundleViolations(actualPaths, declaredPaths, bundleRootLabel, forbiddenPrefixes) {
  const violations = [];
  const declaredSet = new Set(declaredPaths);
  const actualSet = new Set(actualPaths);

  actualPaths.forEach((relPath) => {
    const fullRelPath = bundleRootLabel + '/' + relPath;
    const hit = matchesForbidden(fullRelPath, forbiddenPrefixes);
    if (hit) {
      violations.push('offline-app 번들: forbidden 경로 매치 — "' + fullRelPath + '" (규칙: ' + hit + ')');
    }
    if (!declaredSet.has(relPath)) {
      violations.push(
        'offline-app 번들: release-manifest.json에 선언되지 않은 파일이 존재함 — "' +
          fullRelPath +
          '" (배포 대상에 포함하려면 release-manifest.json의 include 목록을 먼저 갱신할 것)'
      );
    }
  });

  declaredPaths.forEach((relPath) => {
    if (!actualSet.has(relPath)) {
      violations.push(
        'offline-app 번들: release-manifest.json에 선언되어 있으나 실제 파일이 없음 — "' + bundleRootLabel + '/' + relPath + '"'
      );
    }
  });

  return violations;
}

function walkDir(root, excludeDirsAbs) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const abs = path.join(current, entry.name);
      if (excludeDirsAbs.includes(abs)) return;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') return;
        walk(abs);
      } else if (entry.isFile()) {
        results.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    });
  }
  walk(root);
  return results;
}

function runNpmPackDryRun(cwd) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('`npm pack --dry-run --json` 실행 실패 — ' + (result.stderr || '알 수 없는 오류'));
  }
  const parsed = JSON.parse(result.stdout);
  const packedFiles = (parsed[0] && parsed[0].files) || [];
  return packedFiles.map((f) => f.path);
}

function verify({ rootDir, manifest, pkg, packNpm = runNpmPackDryRun, listDir = walkDir, dirExists = fs.existsSync }) {
  const forbiddenPrefixes = (manifest.forbidden && manifest.forbidden.prefixes) || [];
  const okLines = [];
  const violations = [];

  // npm 번들
  const filesField = Array.isArray(pkg.files) ? pkg.files : [];
  if (filesField.length === 0) {
    violations.push('npm 번들: package.json에 "files" 필드가 없거나 비어 있다 — allowlist가 존재하지 않으면 저장소 전체가 npm pack 대상이 된다.');
  } else {
    let packedPaths;
    try {
      packedPaths = packNpm(rootDir);
    } catch (err) {
      violations.push('npm 번들: ' + err.message);
      packedPaths = null;
    }
    if (packedPaths) {
      const npmViolations = computeNpmViolations(packedPaths, filesField, forbiddenPrefixes);
      if (npmViolations.length === 0) {
        okLines.push('npm 번들: ' + packedPaths.length + '개 파일 모두 allowlist와 일치, forbidden 경로 없음.');
      } else {
        violations.push(...npmViolations);
      }
    }
  }

  // offline-app 번들
  const bundle = manifest.bundles && manifest.bundles.offlineApp;
  if (!bundle) {
    violations.push('offline-app 번들: release-manifest.json에 bundles.offlineApp 정의가 없다.');
  } else {
    const bundleRoot = path.join(rootDir, bundle.root);
    if (!dirExists(bundleRoot)) {
      violations.push('offline-app 번들: 디렉터리가 존재하지 않음 — ' + bundleRoot);
    } else {
      const excludeDirsAbs = (bundle.excludeDirs || []).map((d) => path.join(bundleRoot, d));
      const actualPaths = listDir(bundleRoot, excludeDirsAbs).sort();
      const declaredPaths = (bundle.include || []).slice().sort();
      const bundleViolations = computeBundleViolations(actualPaths, declaredPaths, bundle.root, forbiddenPrefixes);
      if (bundleViolations.length === 0) {
        okLines.push('offline-app 번들: ' + actualPaths.length + '개 파일 모두 release-manifest.json과 정확히 일치, forbidden 경로 없음.');
      } else {
        violations.push(...bundleViolations);
      }
    }
  }

  return { okLines, violations };
}

function main() {
  const ROOT = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  const { okLines, violations } = verify({ rootDir: ROOT, manifest, pkg });

  console.log('release-manifest 검증 결과');
  console.log('─'.repeat(50));
  okLines.forEach((line) => console.log('✅ ' + line));
  violations.forEach((line) => console.log('❌ ' + line));
  console.log('─'.repeat(50));

  if (violations.length > 0) {
    console.log('실패: ' + violations.length + '건의 위반 사항 발견');
    process.exit(1);
  }

  console.log('통과: 모든 배포 번들이 release-manifest.json과 일치하며 forbidden 경로가 없음');
  process.exit(0);
}

module.exports = {
  matchesForbidden,
  matchesNpmAllowlist,
  computeNpmViolations,
  computeBundleViolations,
  walkDir,
  verify,
};

if (require.main === module) {
  main();
}
