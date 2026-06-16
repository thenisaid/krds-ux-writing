import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CLI_PATH = path.join(ROOT, 'bin', 'krds-lint');
const tempPaths = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(ROOT, '.tmp-krds-cli-'));
  tempPaths.push(dir);
  return dir;
}

function runCli(args, input) {
  return spawnSync(process.execPath, [CLI_PATH].concat(args), {
    cwd: ROOT,
    encoding: 'utf8',
    input,
  });
}

afterEach(() => {
  while (tempPaths.length > 0) {
    fs.rmSync(tempPaths.pop(), { recursive: true, force: true });
  }
});

describe('bin/krds-lint CLI', () => {
  it('supports recursive directory linting in text mode', () => {
    const dir = makeTempDir();
    const nestedDir = path.join(dir, 'nested');
    fs.mkdirSync(nestedDir);
    fs.writeFileSync(path.join(dir, 'a.txt'), '귀하의 신청이 접수되었습니다.\n', 'utf8');
    fs.writeFileSync(path.join(nestedDir, 'b.md'), '오류가 발생했습니다.\n', 'utf8');

    const result = runCli([dir]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('파일:');
    expect(result.stdout).toContain('a.txt');
    expect(result.stdout).toContain('nested/b.md');
    expect(result.stdout).toContain('검사 파일: 2개');
  });

  it('aggregates directory results in JSON mode', () => {
    const dir = makeTempDir();
    const nestedDir = path.join(dir, 'nested');
    fs.mkdirSync(nestedDir);
    fs.writeFileSync(path.join(dir, 'clean.txt'), '신청이 접수되었습니다.\n', 'utf8');
    fs.writeFileSync(path.join(nestedDir, 'issue.md'), '귀하의 신청이 접수되었습니다.\n', 'utf8');

    const result = runCli(['--json', dir]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(payload.summary).toEqual({
      totalFiles: 2,
      filesWithIssues: 1,
      totalIssues: 1,
      errors: 1,
      warnings: 0,
      infos: 0,
    });
    expect(payload.files).toHaveLength(2);
    expect(payload.files.some((entry) => entry.path.endsWith('nested/issue.md'))).toBe(true);
  });

  it('preserves single-file JSON output shape', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'sample.txt');
    fs.writeFileSync(filePath, '귀하의 신청이 접수되었습니다.\n', 'utf8');

    const result = runCli(['--json', filePath]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(payload).toHaveProperty('issues');
    expect(payload).toHaveProperty('summary');
    expect(payload).toHaveProperty('score');
    expect(payload).not.toHaveProperty('files');
  });

  it('deduplicates overlapping file and directory inputs so the same file is linted once', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'sample.txt');
    fs.writeFileSync(filePath, '귀하의 신청이 접수되었습니다.\n', 'utf8');

    const result = runCli([dir, filePath]);

    expect(result.status).toBe(1);
    expect(result.stdout.match(/^파일:/gm) || []).toHaveLength(1);
    expect(result.stdout).toContain('검사 파일: 1개');
    expect(result.stdout).toContain('이슈 있는 파일: 1개');
    expect(result.stdout).toContain('총 이슈: 1 (오류 1 / 경고 0 / 안내 0)');
  });
});
