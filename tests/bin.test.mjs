import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

async function createFakeCodex(binDir, logPath) {
  const fakeScript = path.join(binDir, 'codex-fake.mjs');
  await writeFile(fakeScript, [
    "import { appendFileSync } from 'node:fs';",
    "appendFileSync(process.env.FAKE_CODEX_LOG, `${JSON.stringify(process.argv.slice(2))}\\n`);",
    '',
  ].join('\n'), 'utf8');

  if (process.platform === 'win32') {
    await writeFile(path.join(binDir, 'codex.cmd'), `@echo off\r\nnode "%~dp0\\codex-fake.mjs" %*\r\n`, 'utf8');
    return;
  }

  const codexPath = path.join(binDir, 'codex');
  await writeFile(codexPath, `#!/usr/bin/env node\nimport './codex-fake.mjs';\n`, 'utf8');
  await chmod(codexPath, 0o755);
}

async function createFakeCommand(binDir, name, body) {
  const scriptPath = path.join(binDir, `${name}-fake.mjs`);
  await writeFile(scriptPath, [body, ''].join('\n'), 'utf8');

  if (process.platform === 'win32') {
    await writeFile(path.join(binDir, `${name}.cmd`), `@echo off\r\nnode "%~dp0\\${name}-fake.mjs" %*\r\n`, 'utf8');
    return;
  }

  const filePath = path.join(binDir, name);
  await writeFile(filePath, `#!/usr/bin/env node\nimport './${name}-fake.mjs';\n`, 'utf8');
  await chmod(filePath, 0o755);
}

test('enable registers package root marketplace through Codex CLI', async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'claude-review-home-'));
  const binDir = path.join(homeDir, 'bin');
  const logPath = path.join(homeDir, 'codex-calls.log');
  try {
    await mkdir(binDir, { recursive: true });
    await createFakeCodex(binDir, logPath);

    const result = await runBin(['enable'], {
      HOME: homeDir,
      USERPROFILE: homeDir,
      FAKE_CODEX_LOG: logPath,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    });

    assert.equal(result.code, 0);
    const calls = (await readFile(logPath, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    assert.deepEqual(calls, [
      ['plugin', 'marketplace', 'add', path.resolve('.')],
      ['plugin', 'add', 'claude-review@local-codex-plugins'],
    ]);
    assert.match(result.stdout, /Local marketplace registered/);
    assert.match(result.stdout, /Plugin enabled in Codex/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('doctor recognizes the package root marketplace source', async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'claude-review-home-'));
  const binDir = path.join(homeDir, 'bin');
  const configDir = path.join(homeDir, '.codex');
  const configPath = path.join(configDir, 'config.toml');
  try {
    await mkdir(binDir, { recursive: true });
    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, [
      '[marketplaces.local-codex-plugins]',
      'source_type = "local"',
      `source = '${path.resolve('.')}'`,
      '',
      '[plugins."claude-review@local-codex-plugins"]',
      'enabled = true',
      '',
    ].join('\n'), 'utf8');

    await createFakeCommand(binDir, 'git', "console.log('git version 2.46.0')");
    await createFakeCommand(binDir, 'claude', [
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') {",
      "  console.log('2.1.112 (Claude Code)');",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'auth' && args[1] === 'status') {",
      "  console.log(JSON.stringify({ loggedIn: true, authMethod: 'oauth_token' }));",
      "  process.exit(0);",
      "}",
      "process.exit(0);",
    ].join('\n'));

    const result = await runBin(['doctor'], {
      HOME: homeDir,
      USERPROFILE: homeDir,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Codex Marketplace/);
    assert.match(result.stdout, /registered \(local-codex-plugins\)/);
    assert.match(result.stdout, /All checks passed!/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
