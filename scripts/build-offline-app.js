#!/usr/bin/env node
/**
 * offline-app/dist/ 를 생성한다.
 * 루트의 krds-lint.js / jargon-dictionary.js 를 그대로 복사해
 * 오프라인 앱이 별도 사본을 직접 관리하지 않고 단일 소스 오브 트루스를 유지하게 한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'offline-app', 'dist');
const FILES = ['krds-lint.js', 'jargon-dictionary.js', 'rulepack-schema.js', 'rulepack-validator.js'];

fs.mkdirSync(DIST_DIR, { recursive: true });

FILES.forEach((file) => {
  const src = path.join(ROOT, file);
  const dest = path.join(DIST_DIR, file);
  fs.copyFileSync(src, dest);
  console.log('copied ' + file + ' -> offline-app/dist/' + file);
});
