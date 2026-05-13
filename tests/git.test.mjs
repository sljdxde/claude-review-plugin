import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

import {
  collectWorkingTreeContext,
  detectDefaultBranch,
  resolveReviewTarget,
} from '../plugins/claude-review/scripts/lib/git.mjs';

async function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `git failed: ${args.join(' ')}`));
    });
  });
}

async function createRepo() {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'claude-review-git-'));
  await runGit(['init', '-b', 'main'], repo);
  await runGit(['config', 'user.email', 'test@example.com'], repo);
  await runGit(['config', 'user.name', 'Tester'], repo);
  await writeFile(path.join(repo, 'demo.txt'), 'base\n');
  await runGit(['add', '.'], repo);
  await runGit(['commit', '-m', 'init'], repo);
  return repo;
}

test('resolveReviewTarget picks working-tree for dirty repo in auto mode', async () => {
  const repo = await createRepo();
  try {
    await writeFile(path.join(repo, 'demo.txt'), 'base\nchange\n');
    const target = await resolveReviewTarget(repo, { scope: 'auto' });
    assert.equal(target.mode, 'working-tree');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('resolveReviewTarget picks branch for clean repo in auto mode', async () => {
  const repo = await createRepo();
  try {
    const target = await resolveReviewTarget(repo, { scope: 'auto' });
    assert.equal(target.mode, 'branch');
    assert.equal(target.baseRef, 'main');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('detectDefaultBranch falls back to local main', async () => {
  const repo = await createRepo();
  try {
    const branch = await detectDefaultBranch(repo);
    assert.equal(branch, 'main');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('collectWorkingTreeContext skips binary untracked files', async () => {
  const repo = await createRepo();
  try {
    await writeFile(path.join(repo, 'demo.txt'), 'base\nchange\n');
    await writeFile(path.join(repo, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
    const context = await collectWorkingTreeContext(repo, { label: 'working tree diff' });
    assert.match(context.untrackedFiles, /binary\.bin \[skipped: binary\]/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
