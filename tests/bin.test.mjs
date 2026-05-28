import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const binPath = path.resolve('bin/claude-review.mjs');

function runBin(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('enable registers local marketplace and enables plugin', async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'claude-review-home-'));
  try {
    const result = await runBin(['enable'], {
      HOME: homeDir,
      USERPROFILE: homeDir,
    });

    assert.equal(result.code, 0);
    const config = await readFile(path.join(homeDir, '.codex', 'config.toml'), 'utf8');
    assert.match(config, /\[marketplaces\.local-codex-plugins\]/);
    assert.match(config, /source_type = "local"/);
    assert.match(config, /source = /);
    assert.match(config, /\[plugins\."claude-review@local-codex-plugins"\]/);
    assert.match(config, /enabled = true/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
