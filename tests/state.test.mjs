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
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'demo-'));
  try {
    const paths = getWorkspaceStatePaths({
      stateRoot: root,
      workspaceRoot: workspace,
    });

    assert.match(paths.workspaceDir, /demo-/);
    assert.equal(path.dirname(paths.jobsDir), paths.workspaceDir);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test('state load/save round-trips jobs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'demo-'));
  try {
    const job = {
      id: 'job-1',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeJob({
      stateRoot: root,
      workspaceRoot: workspace,
      job,
    });

    const saved = await readJob({
      stateRoot: root,
      workspaceRoot: workspace,
      jobId: 'job-1',
    });

    assert.equal(saved.id, 'job-1');

    const state = await loadState({
      stateRoot: root,
      workspaceRoot: workspace,
    });

    assert.deepEqual(state.jobs, ['job-1']);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test('state prune removes old jobs beyond retention', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claude-review-state-'));
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'demo-'));
  try {
    for (let index = 0; index < 4; index += 1) {
      await upsertJob({
        stateRoot: root,
        workspaceRoot: workspace,
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
      workspaceRoot: workspace,
      keep: 2,
    });

    const state = await loadState({ stateRoot: root, workspaceRoot: workspace });
    assert.deepEqual(state.jobs, ['job-3', 'job-2']);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test('generateJobId returns review-prefixed identifier', () => {
  assert.match(generateJobId(), /^review-[a-z0-9]+-[a-z0-9]+$/);
});
