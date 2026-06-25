import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SOURCE_SCRIPT = path.join(ROOT, 'scripts', 'switch-ai-mode.sh');
const tempRoots = [];

function createFixture(initialEnv) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'krds-switch-ai-mode-'));
  const scriptsDir = path.join(root, 'scripts');
  const scriptPath = path.join(scriptsDir, 'switch-ai-mode.sh');
  const envPath = path.join(root, '.env');

  tempRoots.push(root);
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(SOURCE_SCRIPT, scriptPath);
  fs.chmodSync(scriptPath, 0o755);
  fs.writeFileSync(envPath, initialEnv, 'utf8');

  return { root, scriptPath, envPath };
}

function runScript(scriptPath, mode) {
  return spawnSync('bash', [scriptPath, mode], {
    encoding: 'utf8',
    env: process.env,
  });
}

afterEach(() => {
  while (tempRoots.length) {
    fs.rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('scripts/switch-ai-mode.sh', () => {
  it('switches to local mode and stores the previous cloud settings as a backup', () => {
    const initialEnv = [
      'ANTHROPIC_BASE_URL=https://api.anthropic.com/v1',
      'ANTHROPIC_API_KEY=test-key',
      'OTHER_SETTING=keep-me',
      '',
    ].join('\n');
    const { scriptPath, envPath } = createFixture(initialEnv);

    const result = runScript(scriptPath, 'local');
    const envContents = fs.readFileSync(envPath, 'utf8');
    const backupContents = fs.readFileSync(`${envPath}.cloud-backup`, 'utf8');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Switched KRDS to LOCAL LLM');
    expect(envContents).toContain('ANTHROPIC_BASE_URL=http://localhost:8200/krds');
    expect(envContents).toContain('ANTHROPIC_API_KEY=local-llm');
    expect(envContents).toContain('OTHER_SETTING=keep-me');
    expect(backupContents).toBe(initialEnv);
  });

  it('restores the previous cloud settings from backup when switching back to cloud mode', () => {
    const initialEnv = [
      'ANTHROPIC_BASE_URL=https://proxy.internal/v1/messages',
      'ANTHROPIC_API_KEY=cloud-key',
      'OTHER_SETTING=keep-me',
      '',
    ].join('\n');
    const { scriptPath, envPath } = createFixture(initialEnv);

    expect(runScript(scriptPath, 'local').status).toBe(0);

    const result = runScript(scriptPath, 'cloud');
    const envContents = fs.readFileSync(envPath, 'utf8');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Restored KRDS cloud settings from');
    expect(envContents).toBe(initialEnv);
  });

  it('restores the default cloud URL and removes the local fallback key when no backup exists', () => {
    const initialEnv = [
      'ANTHROPIC_BASE_URL=http://localhost:8200/krds',
      'ANTHROPIC_API_KEY=local-llm',
      'OTHER_SETTING=keep-me',
      '',
    ].join('\n');
    const { scriptPath, envPath } = createFixture(initialEnv);

    const result = runScript(scriptPath, 'cloud');
    const envContents = fs.readFileSync(envPath, 'utf8');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Restored the default Anthropic base URL only.');
    expect(envContents).toContain('ANTHROPIC_BASE_URL=https://api.anthropic.com/v1');
    expect(envContents).toContain('OTHER_SETTING=keep-me');
    expect(envContents).not.toContain('ANTHROPIC_API_KEY=local-llm');
  });

  it('does not overwrite the backup when switching to local mode while already on local URL', () => {
    const initialEnv = [
      'ANTHROPIC_BASE_URL=http://localhost:8200/krds',
      'ANTHROPIC_API_KEY=local-llm',
      '',
    ].join('\n');
    const { scriptPath, envPath } = createFixture(initialEnv);

    const result = runScript(scriptPath, 'local');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Switched KRDS to LOCAL LLM');
    expect(fs.existsSync(`${envPath}.cloud-backup`)).toBe(false);
  });

  it('keeps a non-local ANTHROPIC_API_KEY when restoring cloud defaults without a backup file', () => {
    const initialEnv = [
      'ANTHROPIC_BASE_URL=http://localhost:8200/krds',
      'ANTHROPIC_API_KEY=real-cloud-key',
      'OTHER_SETTING=keep-me',
      '',
    ].join('\n');
    const { scriptPath, envPath } = createFixture(initialEnv);

    const result = runScript(scriptPath, 'cloud');
    const envContents = fs.readFileSync(envPath, 'utf8');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Restored the default Anthropic base URL only.');
    expect(envContents).toContain('ANTHROPIC_BASE_URL=https://api.anthropic.com/v1');
    expect(envContents).toContain('ANTHROPIC_API_KEY=real-cloud-key');
    expect(envContents).toContain('OTHER_SETTING=keep-me');
  });

  it('returns a usage error for unsupported modes', () => {
    const { scriptPath } = createFixture('');

    const result = runScript(scriptPath, 'staging');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Usage:');
  });
});
