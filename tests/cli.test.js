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

  it('prints help text and exits 0 when --help is passed', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('krds-lint — KRDS UX Writing 린터');
    expect(result.stdout).toContain('--json');
  });

  it('lints a single file in text mode and exits 1 when errors are found', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'one.txt');
    fs.writeFileSync(filePath, '귀하의 신청이 접수되었습니다.\n', 'utf8');

    const result = runCli([filePath]);

    expect(result.status).toBe(1);
    // Single-file text mode uses formatCLI output directly (no "파일:" header)
    expect(result.stdout).not.toContain('검사 파일:');
    expect(result.stdout).toContain('품질 점수:');
  });

  it('exits 0 for a clean single-file lint with no issues', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'clean.txt');
    fs.writeFileSync(filePath, '신청이 접수되었습니다.\n', 'utf8');

    const result = runCli([filePath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('품질 점수:');
  });

  it('exits 1 and writes to stderr when a target path does not exist', () => {
    const result = runCli(['/nonexistent/path/definitely-missing.txt']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('내부 오류');
  });

  it('reads stdin in JSON mode and returns structured lint output', () => {
    const result = runCli(['--json'], '귀하의 신청이 접수되었습니다.');
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(payload).toHaveProperty('issues');
    expect(payload.issues.length).toBeGreaterThan(0);
    expect(payload).toHaveProperty('score');
  });

  it('reads stdin in text mode and formats output as CLI report', () => {
    const result = runCli([], '신청이 접수되었습니다.');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('품질 점수: 100/100');
  });

  it('uses multi-file format when two explicit file paths are given without a directory', () => {
    const dir = makeTempDir();
    const file1 = path.join(dir, 'first.txt');
    const file2 = path.join(dir, 'second.txt');
    fs.writeFileSync(file1, '귀하의 신청이 접수되었습니다.\n', 'utf8');
    fs.writeFileSync(file2, '신청이 접수되었습니다.\n', 'utf8');

    const result = runCli([file1, file2]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('파일:');
    expect(result.stdout).toContain('검사 파일: 2개');
    expect(result.stdout).toContain('이슈 있는 파일: 1개');
  });

  it('exits 1 and writes to stderr when stdin text is blank', () => {
    const result = runCli([], '   \n  ');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('오류');
  });

  it('skips binary files when scanning a directory', () => {
    const dir = makeTempDir();
    const binaryPath = path.join(dir, 'image.png');
    const nullBytes = Buffer.alloc(16, 0);
    fs.writeFileSync(binaryPath, nullBytes);
    fs.writeFileSync(path.join(dir, 'text.txt'), '신청이 접수되었습니다.\n', 'utf8');

    const result = runCli([dir]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('검사 파일: 1개');
    expect(result.stdout).not.toContain('image.png');
  });
});
