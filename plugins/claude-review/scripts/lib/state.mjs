import crypto from 'node:crypto';
import path from 'node:path';

import { atomicWriteJson, ensureDir, readJson, removeFile } from './fs.mjs';
import { resolveStateRoot } from './workspace.mjs';

const DEFAULT_STATE = {
  version: 1,
  jobs: [],
};

export function generateJobId() {
  const left = Date.now().toString(36);
  const right = crypto.randomBytes(3).toString('hex');
  return `review-${left}-${right}`;
}

export function getWorkspaceStatePaths({ stateRoot = null, workspaceRoot }) {
  const resolvedStateRoot = resolveStateRoot(stateRoot);
  const normalized = path.resolve(workspaceRoot);
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const workspaceName = path.basename(normalized) || 'workspace';
  const workspaceDir = path.join(resolvedStateRoot, 'state', `${workspaceName}-${digest}`);
  const jobsDir = path.join(workspaceDir, 'jobs');

  return {
    stateRoot: resolvedStateRoot,
    workspaceDir,
    jobsDir,
    stateFile: path.join(workspaceDir, 'state.json'),
  };
}

async function saveState(paths, state) {
  await ensureDir(paths.workspaceDir);
  await atomicWriteJson(paths.stateFile, state);
}

export async function loadState({ stateRoot = null, workspaceRoot }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  const existing = await readJson(paths.stateFile, DEFAULT_STATE);
  if (!existing) {
    return { ...DEFAULT_STATE };
  }
  return {
    version: existing.version ?? 1,
    jobs: Array.isArray(existing.jobs) ? existing.jobs : [],
  };
}

export async function writeJob({ stateRoot = null, workspaceRoot, job }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  await ensureDir(paths.jobsDir);
  await atomicWriteJson(path.join(paths.jobsDir, `${job.id}.json`), job);
  const state = await loadState({ stateRoot, workspaceRoot });
  if (!state.jobs.includes(job.id)) {
    state.jobs.unshift(job.id);
    await saveState(paths, state);
  }
}

export async function readJob({ stateRoot = null, workspaceRoot, jobId }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  return readJson(path.join(paths.jobsDir, `${jobId}.json`), null);
}

export async function upsertJob({ stateRoot = null, workspaceRoot, job }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  const state = await loadState({ stateRoot, workspaceRoot });
  state.jobs = [job.id, ...state.jobs.filter((id) => id !== job.id)];
  await saveState(paths, state);
  await writeJob({ stateRoot, workspaceRoot, job });
}

export async function listJobs({ stateRoot = null, workspaceRoot, includeMissing = false }) {
  const state = await loadState({ stateRoot, workspaceRoot });
  const jobs = [];

  for (const jobId of state.jobs) {
    const job = await readJob({ stateRoot, workspaceRoot, jobId });
    if (job) {
      jobs.push(job);
    } else if (includeMissing) {
      jobs.push({ id: jobId, status: 'missing' });
    }
  }

  return jobs;
}

export async function pruneJobs({ stateRoot = null, workspaceRoot, keep = 50 }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  const state = await loadState({ stateRoot, workspaceRoot });
  const extra = state.jobs.slice(keep);
  state.jobs = state.jobs.slice(0, keep);
  await saveState(paths, state);

  for (const jobId of extra) {
    await removeFile(path.join(paths.jobsDir, `${jobId}.json`));
    await removeFile(path.join(paths.jobsDir, `${jobId}.log`));
  }
}
