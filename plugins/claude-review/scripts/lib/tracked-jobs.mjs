import { appendFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureDir } from './fs.mjs';
import { getWorkspaceStatePaths, readJob, upsertJob } from './state.mjs';

export async function appendJobLog({ stateRoot = null, workspaceRoot, jobId, message }) {
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  await ensureDir(paths.jobsDir);
  const logFile = path.join(paths.jobsDir, `${jobId}.log`);
  await appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`);
  return logFile;
}

export async function updateJob({ stateRoot = null, workspaceRoot, jobId, patch }) {
  const job = await readJob({ stateRoot, workspaceRoot, jobId });
  if (!job) {
    throw new Error(`Unknown job: ${jobId}`);
  }
  const nextJob = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await upsertJob({ stateRoot, workspaceRoot, job: nextJob });
  return nextJob;
}
