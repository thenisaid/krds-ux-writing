#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-offline-app-bundle.js
 *
 * offline-app/은 npm 패키지가 아니라 기관 담당자 PC에 별도로 전달될 배포
 * 산출물(향후 Electron 설치 파일로 패키징 예정)이다. 이 스크립트는 두 가지를
 * 검증한다.
 *
 * 1. release/repo-only 분류: "배포 산출물에 실제로 들어갈 파일"(releaseFiles)과
 *    "저장소에는 재현성/문서화를 위해 커밋하지만 배포 산출물에는 포함되지 않는
 *    파일"(repoOnlyFiles)을 release-manifest.json의 bundles.offlineApp에서 읽어
 *    offline-app/ 실제 내용과 정확히 일치하는지 확인한다. 이 두 목록은
 *    scripts/verify-release-manifest.js도 함께 참조하는 단일 소스 오브 트루스다
 *    (두 스크립트가 서로 다른 배포 정의를 갖는 것을 막기 위함 — 2026-08-27
 *    codex 감사 지적 반영). electron/node_modules/처럼 원래도 배포에 포함될 수
 *    없는 대용량 디렉터리가 실수로 두 목록 중 하나에 들어가거나, 새 파일이
 *    추가됐는데 아무 목록에도 선언되지 않으면 실패한다.
 * 2. MANIFEST.md 드리프트 검사: offline-app/MANIFEST.md의 "파일 목록" 표에
 *    문서화된 경로와 실제 파일을 대조해, 새 파일이 추가됐는데 문서 갱신을
 *    깜빡한 경우(또는 그 반대로 문서에 남아있는데 파일이 삭제된 경우)를 잡는다.
 *
 * 사용법:
 *   node scripts/verify-offline-app-bundle.js
 *
 * 종료 코드: 위반 사항이 하나라도 있으면 1, 모두 통과하면 0.
 */

const fs = require('fs');
const path = require('path');
const { walkDir } = require('./verify-release-manifest.js');

/**
 * releaseFiles/repoOnlyFiles 선언과 offline-app/ 실제 파일 목록(actualPaths)을
 * 대조한다. 순수 함수.
 */
function computeBundleClassificationViolations(actualPaths, releaseFiles, repoOnlyFiles) {
  const violations = [];
  const overlap = releaseFiles.filter((f) => repoOnlyFiles.includes(f));
  if (overlap.length > 0) {
    violations.push('배포 산출물 분류: releaseFiles와 repoOnlyFiles에 동시에 선언된 파일 — ' + overlap.join(', '));
  }

  const declared = new Set([...releaseFiles, ...repoOnlyFiles]);
  const actualSet = new Set(actualPaths);

  actualPaths.forEach((relPath) => {
    if (!declared.has(relPath)) {
      violations.push(
        '배포 산출물 분류: release-manifest.json의 releaseFiles/repoOnlyFiles 어디에도 선언되지 않은 파일이 offline-app/에 존재함 — "' +
          relPath +
          '" (배포 대상이면 releaseFiles에, 저장소 전용이면 repoOnlyFiles에 추가할 것)'
      );
    }
  });

  releaseFiles.forEach((relPath) => {
    if (!actualSet.has(relPath)) {
      violations.push('배포 산출물 분류: releaseFiles에 선언된 파일이 실제로 없음 — "' + relPath + '"');
    }
  });

  repoOnlyFiles.forEach((relPath) => {
    if (!actualSet.has(relPath)) {
      violations.push('배포 산출물 분류: repoOnlyFiles에 선언된 파일이 실제로 없음 — "' + relPath + '"');
    }
  });

  return violations;
}

/**
 * offline-app/MANIFEST.md의 "## 파일 목록" 표에서 백틱으로 감싼 경로 토큰을
 * 추출한다. 순수 함수 — 텍스트만 입력받는다.
 */
function parseManifestTable(markdown) {
  const sectionStart = markdown.indexOf('## 파일 목록');
  if (sectionStart === -1) return [];
  const rest = markdown.slice(sectionStart);
  const nextHeading = rest.indexOf('\n## ', 1);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const paths = [];
  section.split('\n').forEach((line) => {
    if (!line.trim().startsWith('|')) return;
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (match) paths.push(match[1]);
  });
  return paths;
}

/**
 * MANIFEST.md에 문서화된 경로(documentedPaths, 디렉터리는 끝에 "/"가 붙는다)와
 * 실제 파일 목록(actualPaths)을 대조한다. 순수 함수.
 */
function computeManifestDriftViolations(actualPaths, documentedPaths) {
  const violations = [];
  const documentedFiles = new Set(documentedPaths.filter((p) => !p.endsWith('/')));
  const documentedDirs = documentedPaths.filter((p) => p.endsWith('/')).map((p) => p.slice(0, -1));
  const actualSet = new Set(actualPaths);

  actualPaths.forEach((relPath) => {
    const underDocumentedDir = documentedDirs.some((dir) => relPath === dir || relPath.startsWith(dir + '/'));
    if (!documentedFiles.has(relPath) && !underDocumentedDir) {
      violations.push('MANIFEST.md 드리프트: 실제 파일이 MANIFEST.md "파일 목록" 표에 문서화되어 있지 않음 — "' + relPath + '"');
    }
  });

  documentedFiles.forEach((relPath) => {
    if (!actualSet.has(relPath)) {
      violations.push('MANIFEST.md 드리프트: 문서화된 파일이 실제로 존재하지 않음 — "' + relPath + '" (파일이 삭제됐으면 MANIFEST.md도 갱신할 것)');
    }
  });

  return violations;
}

function verify({ offlineAppRoot, manifestMarkdown, releaseFiles, repoOnlyFiles, excludeDirs = [], listDir = walkDir }) {
  const excludeDirsAbs = excludeDirs.map((d) => path.join(offlineAppRoot, d));
  const actualPaths = listDir(offlineAppRoot, excludeDirsAbs).sort();
  const documentedPaths = parseManifestTable(manifestMarkdown);

  const violations = [
    ...computeBundleClassificationViolations(actualPaths, releaseFiles, repoOnlyFiles),
    ...computeManifestDriftViolations(actualPaths, documentedPaths),
  ];

  const okLines = [];
  if (violations.length === 0) {
    okLines.push(
      '배포 산출물 분류: ' + releaseFiles.length + '개 배포 대상 + ' + repoOnlyFiles.length + '개 저장소 전용 파일, 실제 내용과 정확히 일치.'
    );
    okLines.push('MANIFEST.md 드리프트: 실제 ' + actualPaths.length + '개 파일 모두 문서화되어 있고, 문서화된 항목 모두 실제로 존재함.');
  }

  return { okLines, violations, actualPaths };
}

function main() {
  const ROOT = path.join(__dirname, '..');
  const offlineAppRoot = path.join(ROOT, 'offline-app');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
  const bundle = manifest.bundles && manifest.bundles.offlineApp;

  if (!bundle) {
    console.log('❌ release-manifest.json에 bundles.offlineApp 정의가 없다.');
    process.exit(1);
  }

  const manifestMarkdown = fs.readFileSync(path.join(offlineAppRoot, 'MANIFEST.md'), 'utf8');

  const { okLines, violations } = verify({
    offlineAppRoot,
    manifestMarkdown,
    releaseFiles: bundle.releaseFiles || [],
    repoOnlyFiles: bundle.repoOnlyFiles || [],
    excludeDirs: bundle.excludeDirs || [],
  });

  console.log('offline-app 배포 산출물 검증 결과');
  console.log('─'.repeat(50));
  okLines.forEach((line) => console.log('✅ ' + line));
  violations.forEach((line) => console.log('❌ ' + line));
  console.log('─'.repeat(50));

  if (violations.length > 0) {
    console.log('실패: ' + violations.length + '건의 위반 사항 발견');
    process.exit(1);
  }

  console.log('통과: offline-app 배포 산출물 분류와 MANIFEST.md 문서가 실제 파일과 일치함');
  process.exit(0);
}

module.exports = {
  computeBundleClassificationViolations,
  parseManifestTable,
  computeManifestDriftViolations,
  verify,
};

if (require.main === module) {
  main();
}
