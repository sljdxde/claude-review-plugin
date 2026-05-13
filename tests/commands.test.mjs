import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const cliPath = path.resolve('plugins/claude-review/scripts/claude-review.mjs');
const fixturePath = path.resolve('tests/fixtures/fake-claude.mjs');

async function runCli(args, extraEnv = {}, cwd = process.cwd()) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: {
        ...process.env,
        CLAUDE_REVIEW_FORCE_CLAUDE_CLI: '1',
        CLAUDE_REVIEW_SETTINGS_PATH: path.resolve('tests/fixtures/nonexistent-settings.json'),
        ...extraEnv,
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

async function waitFor(predicate, timeoutMs = 8000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function removeWithRetry(targetPath, attempts = 10, delayMs = 300) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error.code !== 'EBUSY' || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

test('setup reports ready with fake claude binary', async () => {
  const result = await runCli(
    ['setup'],
    {
      CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
      CLAUDE_REVIEW_CLAUDE_BIN_ARGS: fixturePath,
    },
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Claude Review setup: ready/);
});

test('review working tree returns Claude findings in wait mode', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'claude-review-repo-'));
  try {
    await runCli(['help'], {}, repo);
    await runGit(['init', '-b', 'main'], repo);
    await runGit(['config', 'user.email', 'test@example.com'], repo);
    await runGit(['config', 'user.name', 'Tester'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\n');
    await runGit(['add', '.'], repo);
    await runGit(['commit', '-m', 'init'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\nchange\n');

    const result = await runCli(
      ['review', '--scope', 'working-tree', '--wait', '--cwd', repo],
      {
        CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
        CLAUDE_REVIEW_CLAUDE_BIN_ARGS: fixturePath,
      },
      repo,
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Findings/);
  } finally {
    await removeWithRetry(repo);
  }
});

test('review branch uses ultrareview in wait mode', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'claude-review-branch-'));
  try {
    await runGit(['init', '-b', 'main'], repo);
    await runGit(['config', 'user.email', 'test@example.com'], repo);
    await runGit(['config', 'user.name', 'Tester'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\n');
    await runGit(['add', '.'], repo);
    await runGit(['commit', '-m', 'init'], repo);
    await runGit(['checkout', '-b', 'feature/demo'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\nbranch change\n');
    await runGit(['add', '.'], repo);
    await runGit(['commit', '-m', 'feature'], repo);

    const result = await runCli(
      ['review', '--base', 'main', '--wait', '--cwd', repo],
      {
        CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
        CLAUDE_REVIEW_CLAUDE_BIN_ARGS: fixturePath,
      },
      repo,
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Example ultrareview finding/);
  } finally {
    await removeWithRetry(repo);
  }
});

test('background review can be queried through status and result', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'claude-review-bg-'));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  try {
    await runGit(['init', '-b', 'main'], repo);
    await runGit(['config', 'user.email', 'test@example.com'], repo);
    await runGit(['config', 'user.name', 'Tester'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\n');
    await runGit(['add', '.'], repo);
    await runGit(['commit', '-m', 'init'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\nchange\n');

    const env = {
      CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
      CLAUDE_REVIEW_CLAUDE_BIN_ARGS: fixturePath,
      CODEX_HOME: stateRoot,
    };

    const queued = await runCli(
      ['review', '--scope', 'working-tree', '--background', '--cwd', repo],
      env,
      repo,
    );

    assert.equal(queued.code, 0);
    const match = queued.stdout.match(/(review-[a-z0-9]+-[a-z0-9]+)/);
    assert.ok(match);
    const jobId = match[1];

    await waitFor(async () => {
      const status = await runCli(['status', jobId, '--json', '--cwd', repo], env, repo);
      if (status.code !== 0) {
        return null;
      }
      const payload = JSON.parse(status.stdout);
      return payload.status === 'completed' ? payload : null;
    });

    const result = await runCli(['result', jobId, '--cwd', repo], env, repo);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Example issue from fake Claude/);
  } finally {
    await removeWithRetry(repo);
    await removeWithRetry(stateRoot);
  }
});

test('cancel marks a running background review as cancelled', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'claude-review-cancel-'));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  try {
    await runGit(['init', '-b', 'main'], repo);
    await runGit(['config', 'user.email', 'test@example.com'], repo);
    await runGit(['config', 'user.name', 'Tester'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\n');
    await runGit(['add', '.'], repo);
    await runGit(['commit', '-m', 'init'], repo);
    await writeFile(path.join(repo, 'demo.txt'), 'base\nchange\n');

    const env = {
      CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
      CLAUDE_REVIEW_CLAUDE_BIN_ARGS: fixturePath,
      CODEX_HOME: stateRoot,
      FAKE_CLAUDE_DELAY_MS: '4000',
    };

    const queued = await runCli(
      ['review', '--scope', 'working-tree', '--background', '--cwd', repo],
      env,
      repo,
    );

    assert.equal(queued.code, 0);
    const match = queued.stdout.match(/(review-[a-z0-9]+-[a-z0-9]+)/);
    assert.ok(match);
    const jobId = match[1];

    await waitFor(async () => {
      const status = await runCli(['status', jobId, '--json', '--cwd', repo], env, repo);
      if (status.code !== 0) {
        return null;
      }
      const payload = JSON.parse(status.stdout);
      return payload.status === 'running' ? payload : null;
    });

    const cancelled = await runCli(['cancel', jobId, '--json', '--cwd', repo], env, repo);
    assert.equal(cancelled.code, 0);
    const payload = JSON.parse(cancelled.stdout);
    assert.equal(payload.status, 'cancelled');
  } finally {
    await removeWithRetry(repo);
    await removeWithRetry(stateRoot);
  }
});

async function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `git failed: ${args.join(' ')}`));
    });
  });
}
