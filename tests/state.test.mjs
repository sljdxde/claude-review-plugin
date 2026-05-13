import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import {
  generateJobId,
  getWorkspaceStatePaths,
  loadState,
  pruneJobs,
  readJob,
  upsertJob,
  writeJob,
} from '../plugins/claude-review/scripts/lib/state.mjs';

test('state creates stable workspace paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  try {
    const paths = getWorkspaceStatePaths({
      stateRoot: root,
      workspaceRoot: 'D:\\project\\demo',
    });

    assert.match(paths.workspaceDir, /demo-/);
    assert.equal(path.dirname(paths.jobsDir), paths.workspaceDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('state load/save round-trips jobs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  try {
    const job = {
      id: 'job-1',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeJob({
      stateRoot: root,
      workspaceRoot: 'D:\\project\\demo',
      job,
    });

    const saved = await readJob({
      stateRoot: root,
      workspaceRoot: 'D:\\project\\demo',
      jobId: 'job-1',
    });

    assert.equal(saved.id, 'job-1');

    const state = await loadState({
      stateRoot: root,
      workspaceRoot: 'D:\\project\\demo',
    });

    assert.deepEqual(state.jobs, ['job-1']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('state prune removes old jobs beyond retention', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  try {
    const workspaceRoot = 'D:\\project\\demo';
    for (let index = 0; index < 4; index += 1) {
      await upsertJob({
        stateRoot: root,
        workspaceRoot,
        job: {
          id: `job-${index}`,
          status: 'completed',
          createdAt: `2026-05-13T10:0${index}:00.000Z`,
          updatedAt: `2026-05-13T10:0${index}:00.000Z`,
        },
      });
    }

    await pruneJobs({
      stateRoot: root,
      workspaceRoot,
      keep: 2,
    });

    const state = await loadState({ stateRoot: root, workspaceRoot });
    assert.deepEqual(state.jobs, ['job-3', 'job-2']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('generateJobId returns review-prefixed identifier', () => {
  assert.match(generateJobId(), /^review-[a-z0-9]+-[a-z0-9]+$/);
});
