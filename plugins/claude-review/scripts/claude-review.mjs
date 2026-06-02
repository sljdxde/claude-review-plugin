#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseArgs } from './lib/args.mjs';
import {
  getClaudeAuthStatus,
  getClaudeAvailability,
  getUltraReviewAvailability,
  hasDirectApiConfig,
  runClaudePrintReview,
  runClaudeUltraReview,
} from './lib/claude.mjs';
import {
  collectBranchFallbackContext,
  collectWorkingTreeContext,
  detectDefaultBranch,
  ensureGitRepository,
  getRepoRoot,
  resolveReviewTarget,
} from './lib/git.mjs';
import { binaryAvailable, terminateProcessTree } from './lib/process.mjs';
import {
  renderCancelReport,
  renderQueuedReview,
  renderSetupReport,
  renderSingleJobStatus,
  renderStatusReport,
  renderStoredJobResult,
} from './lib/render.mjs';
import { renderReviewHtml } from './lib/render-html.mjs';
import { saveSelections } from './lib/review-actions.mjs';
import { appendJobLog, updateJob } from './lib/tracked-jobs.mjs';
import { ensureDir, readJson } from './lib/fs.mjs';
import {
  generateJobId,
  getWorkspaceStatePaths,
  listJobs,
  pruneJobs,
  readJob,
  upsertJob,
} from './lib/state.mjs';
import { resolveCommandCwd, resolveStateRoot } from './lib/workspace.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');

function print(value) {
  process.stdout.write(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

async function loadWorkingTreePrompt() {
  const promptPath = path.join(pluginRoot, 'prompts', 'working-tree-review.md');
  return readFile(promptPath, 'utf8');
}

async function loadWorkingTreePromptJson() {
  const promptPath = path.join(pluginRoot, 'prompts', 'working-tree-review-json.md');
  return readFile(promptPath, 'utf8');
}

function renderPrompt(template, values) {
  return template
    .replaceAll('{{TARGET_LABEL}}', values.targetLabel)
    .replaceAll('{{REPO_ROOT}}', values.repoRoot)
    .replaceAll('{{GIT_STATUS}}', values.gitStatus || '(none)')
    .replaceAll('{{STAGED_DIFF}}', values.stagedDiff || '(none)')
    .replaceAll('{{UNSTAGED_DIFF}}', values.unstagedDiff || '(none)')
    .replaceAll('{{UNTRACKED_FILES}}', values.untrackedFiles || '(none)');
}

async function runSetup(cwd, options = {}) {
  const node = {
    available: true,
    version: process.version,
  };
  const gitAvailability = await binaryAvailable('git', ['--version'], { cwd });
  const claudeAvailability = await getClaudeAvailability(cwd, { env: process.env });
  const claudeAuth = await getClaudeAuthStatus(cwd, { env: process.env });
  const report = {
    ready: Boolean(node.available && gitAvailability.available && claudeAvailability.available && claudeAuth.authUsable),
    node,
    git: {
      available: gitAvailability.available,
      version: gitAvailability.stdout,
    },
    claude: {
      available: claudeAvailability.available,
      version: claudeAvailability.version,
      authUsable: claudeAuth.authUsable,
    },
    nextSteps: claudeAuth.authUsable
      ? ['Run /claude:review --background']
      : ['Run `claude auth login` or open Claude Code once, then rerun /claude:setup.'],
  };

  if (options.json) {
    print(report);
    return;
  }

  print(renderSetupReport(report));
}

async function runReviewForeground(cwd, options = {}) {
  await ensureGitRepository(cwd);
  const target = await resolveReviewTarget(cwd, options);
  const useJsonFormat = options.format === 'table';

  if (target.mode === 'working-tree') {
    const context = await collectWorkingTreeContext(cwd, target);
    const template = useJsonFormat ? await loadWorkingTreePromptJson() : await loadWorkingTreePrompt();
    const prompt = renderPrompt(template, {
      targetLabel: target.label,
      repoRoot: context.repoRoot,
      gitStatus: context.gitStatus,
      stagedDiff: context.stagedDiff,
      unstagedDiff: context.unstagedDiff,
      untrackedFiles: context.untrackedFiles,
    });
    const result = await runClaudePrintReview(cwd, prompt, {
      timeoutMinutes: options.timeout,
      env: process.env,
      commandCwd: options.commandCwd,
    });

    if (useJsonFormat) {
      const parsed = tryParseJson(result.stdout);
      if (parsed) {
        parsed.targetLabel = target.label;
      }
      return {
        target,
        output: result.stdout,
        stderr: result.stderr,
        exitCode: result.code,
        parsed,
      };
    }

    return {
      target,
      output: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  }

  const directApiEnabled = await hasDirectApiConfig(process.env);
  const ultraAvailable = !directApiEnabled && await getUltraReviewAvailability(cwd, { env: process.env });
  if (ultraAvailable) {
    try {
      const result = await runClaudeUltraReview(cwd, target.baseRef, {
        timeoutMinutes: options.timeout,
        json: options.json,
        env: process.env,
      });
      if (result.stdout.trim()) {
        return {
          target,
          output: result.stdout,
          stderr: result.stderr,
          exitCode: result.code,
        };
      }
    } catch {
      // Fall through to local diff review.
    }
  }

  const fallback = await collectBranchFallbackContext(cwd, target.baseRef ?? await detectDefaultBranch(cwd));
  const prompt = [
    'You are reviewing local Git branch changes. This is a read-only code review.',
    'Prioritize real bugs, regressions, missing tests, and maintainability risks.',
    directApiEnabled
      ? 'Claude ultrareview was skipped because the local Claude CLI is configured with a direct Anthropic-compatible API fallback.'
      : 'Claude ultrareview is unavailable; falling back to local diff review.',
    `Base branch: ${target.baseRef}`,
    `Repository: ${fallback.repoRoot}`,
    '',
    fallback.diff,
  ].join('\n');
  const result = await runClaudePrintReview(cwd, prompt, {
    timeoutMinutes: options.timeout,
    env: process.env,
    commandCwd: options.commandCwd,
  });
  return {
    target,
    output: `${directApiEnabled ? 'Claude ultrareview was skipped; used local diff review via direct Claude API.' : 'Claude ultrareview is unavailable; used local diff review via claude -p.'}\n\n${result.stdout}`,
    stderr: result.stderr,
    exitCode: result.code,
  };
}

async function createBackgroundJob(cwd, options = {}) {
  await ensureGitRepository(cwd);
  const workspaceRoot = await getRepoRoot(cwd);
  const stateRoot = resolveStateRoot();
  const paths = getWorkspaceStatePaths({ stateRoot, workspaceRoot });
  await ensureDir(paths.jobsDir);

  const target = await resolveReviewTarget(cwd, options);
  const job = {
    id: generateJobId(),
    kind: 'review',
    title: 'Claude Review',
    status: 'queued',
    phase: 'queued',
    workspaceRoot,
    cwd,
    pid: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    target,
    request: {
      argv: process.argv.slice(2),
      timeoutMinutes: Number(options.timeout || 30),
      json: Boolean(options.json),
      scope: options.scope ?? 'auto',
      base: options.base ?? null,
    },
    logFile: null,
    result: null,
    errorMessage: null,
  };

  job.logFile = path.join(paths.jobsDir, `${job.id}.log`);
  await upsertJob({ stateRoot, workspaceRoot, job });
  await appendJobLog({ stateRoot, workspaceRoot, jobId: job.id, message: `Job created for ${target.label}.` });
  await pruneJobs({ stateRoot, workspaceRoot });

  const child = spawn(process.execPath, [__filename, 'review-worker', '--cwd', cwd, '--job-id', job.id], {
    cwd: pluginRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  await updateJob({
    stateRoot,
    workspaceRoot,
    jobId: job.id,
    patch: {
      status: 'running',
      phase: 'starting-claude',
      pid: child.pid,
    },
  });

  return job;
}

async function runReviewWorker(cwd, jobId) {
  await ensureGitRepository(cwd);
  const workspaceRoot = await getRepoRoot(cwd);
  const stateRoot = resolveStateRoot();

  await updateJob({
    stateRoot,
    workspaceRoot,
    jobId,
    patch: {
      pid: process.pid,
      status: 'running',
      phase: 'collecting-context',
    },
  });

  await appendJobLog({ stateRoot, workspaceRoot, jobId, message: 'Worker started.' });
  const job = await readJob({ stateRoot, workspaceRoot, jobId });
  if (!job) {
    throw new Error(`Unknown job: ${jobId}`);
  }

  try {
    await updateJob({
      stateRoot,
      workspaceRoot,
      jobId,
      patch: {
        phase: 'reviewing',
      },
    });
    const result = await runReviewForeground(cwd, {
      ...job.request,
      cwd,
      commandCwd: pluginRoot,
    });
    await appendJobLog({ stateRoot, workspaceRoot, jobId, message: 'Review completed.' });
    await updateJob({
      stateRoot,
      workspaceRoot,
      jobId,
      patch: {
        status: 'completed',
        phase: 'completed',
        pid: null,
        completedAt: new Date().toISOString(),
        target: result.target,
        result: {
          exitCode: result.exitCode ?? 0,
          rawOutput: result.output,
          stderr: result.stderr ?? '',
          parsedJson: job.request.json ? tryParseJson(result.output) : null,
        },
      },
    });
  } catch (error) {
    await appendJobLog({ stateRoot, workspaceRoot, jobId, message: `Review failed: ${error.message}` });
    await updateJob({
      stateRoot,
      workspaceRoot,
      jobId,
      patch: {
        status: 'failed',
        phase: 'failed',
        pid: null,
        completedAt: new Date().toISOString(),
        errorMessage: error.message,
      },
    });
    process.exitCode = 1;
  }
}

function tryParseJson(raw) {
  let text = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function runStatus(cwd, options, positionals) {
  await ensureGitRepository(cwd);
  const workspaceRoot = await getRepoRoot(cwd);
  const stateRoot = resolveStateRoot();
  const jobs = await listJobs({ stateRoot, workspaceRoot });
  const targetJobId = positionals[0];

  if (targetJobId) {
    const job = await readJob({ stateRoot, workspaceRoot, jobId: targetJobId });
    if (!job) {
      throw new Error(`Unknown job: ${targetJobId}`);
    }
    if (options.json) {
      print(job);
      return;
    }
    print(`${renderSingleJobStatus(job)}\n`);
    return;
  }

  if (options.json) {
    print(jobs);
    return;
  }

  print(renderStatusReport({ workspaceRoot, jobs }));
}

async function runResult(cwd, options, positionals) {
  await ensureGitRepository(cwd);
  const workspaceRoot = await getRepoRoot(cwd);
  const stateRoot = resolveStateRoot();
  const jobs = await listJobs({ stateRoot, workspaceRoot });
  const requestedId = positionals[0];
  const job = requestedId
    ? await readJob({ stateRoot, workspaceRoot, jobId: requestedId })
    : jobs.find((item) => ['completed', 'failed', 'cancelled'].includes(item.status));

  if (!job) {
    throw new Error('No completed, failed, or cancelled review jobs were found.');
  }

  if (options.json) {
    print(job);
    return;
  }

  print(renderStoredJobResult(job));
}

async function runCancel(cwd, options, positionals) {
  await ensureGitRepository(cwd);
  const workspaceRoot = await getRepoRoot(cwd);
  const stateRoot = resolveStateRoot();
  const jobs = await listJobs({ stateRoot, workspaceRoot });
  const requestedId = positionals[0];
  const job = requestedId
    ? await readJob({ stateRoot, workspaceRoot, jobId: requestedId })
    : jobs.find((item) => ['queued', 'running'].includes(item.status));

  if (!job) {
    throw new Error('No running or queued review jobs were found.');
  }

  await terminateProcessTree(job.pid);
  await appendJobLog({ stateRoot, workspaceRoot, jobId: job.id, message: 'Cancelled by user.' });
  const cancelled = await updateJob({
    stateRoot,
    workspaceRoot,
    jobId: job.id,
    patch: {
      status: 'cancelled',
      phase: 'cancelled',
      pid: null,
      completedAt: new Date().toISOString(),
    },
  });

  if (options.json) {
    print(cancelled);
    return;
  }

  print(renderCancelReport(cancelled));
}

function renderHelp() {
  return [
    'claude-review commands:',
    '- setup [--json]',
    '- review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--timeout <minutes>] [--json] [--cwd <path>] [--format text|table] [--output <path>] [--open]',
    '- status [job-id] [--json]',
    '- result [job-id] [--json]',
    '- cancel [job-id] [--json]',
    '',
  ].join('\n');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cwd = resolveCommandCwd(parsed.options.cwd);

  switch (parsed.command) {
    case 'setup':
      await runSetup(cwd, parsed.options);
      break;
    case 'review': {
      const format = parsed.options.format ?? 'text';
      if (format !== 'text' && format !== 'table') {
        throw new Error(`Invalid --format value: ${format}. Must be "text" or "table".`);
      }

      if (parsed.options.wait) {
        const result = await runReviewForeground(cwd, parsed.options);

        if (format === 'table') {
          const parsedJson = result.parsed ?? tryParseJson(result.output);
          if (!parsedJson) {
            print('Warning: Claude output is not valid JSON. Falling back to text output.\n');
            print(result.output);
            break;
          }

          const html = renderReviewHtml(parsedJson);
          const outputDir = parsed.options.output ?? path.join(cwd, '.claude-review');
          await mkdir(outputDir, { recursive: true });
          const htmlFilename = `review-report-${randomUUID().slice(0, 8)}.html`;
          const htmlPath = path.join(outputDir, htmlFilename);
          await writeFile(htmlPath, html, 'utf8');

          print(`Review HTML report generated: ${htmlPath}\n`);

          if (parsed.options.open) {
            const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            spawn(openCmd, [htmlPath], { detached: true, stdio: 'ignore' }).unref();
          }
          break;
        }

        print(parsed.options.json ? tryParseJson(result.output) ?? { rawOutput: result.output } : result.output);
        break;
      }

      if (format === 'table') {
        print('Warning: --format=table is not supported with --background mode. Use --wait instead.\n');
      }

      const job = await createBackgroundJob(cwd, {
        ...parsed.options,
        background: true,
      });
      print(parsed.options.json ? job : renderQueuedReview({ jobId: job.id }));
      break;
    }
    case 'review-worker':
      await runReviewWorker(cwd, parsed.options['job-id']);
      break;
    case 'status':
      await runStatus(cwd, parsed.options, parsed.positionals);
      break;
    case 'result':
      await runResult(cwd, parsed.options, parsed.positionals);
      break;
    case 'cancel':
      await runCancel(cwd, parsed.options, parsed.positionals);
      break;
    case 'help':
    default:
      print(renderHelp());
      break;
  }
}

main().catch((error) => {
  process.exitCode = 1;
  process.stderr.write(`${error.message}\n`);
});
