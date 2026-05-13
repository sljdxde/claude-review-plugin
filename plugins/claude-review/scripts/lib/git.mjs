import path from 'node:path';

import { readTextSnippet } from './fs.mjs';
import { runCommandChecked, runCommand } from './process.mjs';

const MAX_INLINE_BYTES = 256 * 1024;
const MAX_UNTRACKED_FILES = 20;

async function git(cwd, args, options = {}) {
  return runCommandChecked('git', args, { cwd, ...options });
}

export async function ensureGitRepository(cwd) {
  try {
    await git(cwd, ['rev-parse', '--show-toplevel']);
    return true;
  } catch {
    throw new Error('This command must run inside a Git repository.');
  }
}

export async function getRepoRoot(cwd) {
  const result = await git(cwd, ['rev-parse', '--show-toplevel']);
  return result.stdout.trim();
}

export async function detectDefaultBranch(cwd) {
  const candidates = [
    ['symbolic-ref', 'refs/remotes/origin/HEAD'],
  ];

  try {
    const originHead = await git(cwd, candidates[0]);
    const ref = originHead.stdout.trim();
    if (ref.includes('/')) {
      return ref.split('/').at(-1);
    }
  } catch {
    // fall through
  }

  for (const ref of ['main', 'origin/main', 'master', 'origin/master', 'trunk', 'origin/trunk']) {
    const result = await runCommand('git', ['rev-parse', '--verify', ref], { cwd });
    if (result.ok) {
      return ref.replace(/^origin\//, '');
    }
  }

  throw new Error('Unable to detect the default branch. Pass --base <ref> or use --scope working-tree.');
}

export async function getWorkingTreeState(cwd) {
  const status = await git(cwd, ['status', '--short', '--untracked-files=all']);
  const lines = status.stdout.trim() ? status.stdout.trim().split(/\r?\n/) : [];
  const dirty = lines.length > 0;
  return {
    dirty,
    lines,
    statusText: status.stdout.trim(),
  };
}

export async function resolveReviewTarget(cwd, options = {}) {
  if (options.base) {
    return {
      mode: 'branch',
      label: `branch diff against ${options.base}`,
      baseRef: options.base,
      explicit: true,
    };
  }

  if (options.scope === 'working-tree') {
    return {
      mode: 'working-tree',
      label: 'working tree diff',
      baseRef: null,
      explicit: true,
    };
  }

  if (options.scope === 'branch') {
    const baseRef = await detectDefaultBranch(cwd);
    return {
      mode: 'branch',
      label: `branch diff against ${baseRef}`,
      baseRef,
      explicit: true,
    };
  }

  const workingTree = await getWorkingTreeState(cwd);
  if (workingTree.dirty) {
    return {
      mode: 'working-tree',
      label: 'working tree diff',
      baseRef: null,
      explicit: false,
    };
  }

  const baseRef = await detectDefaultBranch(cwd);
  return {
    mode: 'branch',
    label: `branch diff against ${baseRef}`,
    baseRef,
    explicit: false,
  };
}

export async function collectWorkingTreeContext(cwd, target) {
  const status = await git(cwd, ['status', '--short', '--untracked-files=all']);
  const stagedDiff = await git(cwd, ['diff', '--cached', '--binary', '--no-ext-diff', '--submodule=diff']);
  const unstagedDiff = await git(cwd, ['diff', '--binary', '--no-ext-diff', '--submodule=diff']);
  const untracked = await git(cwd, ['ls-files', '--others', '--exclude-standard']);

  if (!status.stdout.trim()) {
    throw new Error('No working-tree changes were found. Retry with --base <ref> to review a branch diff.');
  }

  const repoRoot = await getRepoRoot(cwd);
  const untrackedLines = untracked.stdout.trim() ? untracked.stdout.trim().split(/\r?\n/) : [];
  const snippets = [];
  let totalBytes = Buffer.byteLength(status.stdout) + Buffer.byteLength(stagedDiff.stdout) + Buffer.byteLength(unstagedDiff.stdout);

  for (const relativePath of untrackedLines.slice(0, MAX_UNTRACKED_FILES)) {
    const absolutePath = path.join(repoRoot, relativePath);
    const snippet = await readTextSnippet(absolutePath);
    if (!snippet.ok) {
      snippets.push(`- ${relativePath} [skipped: ${snippet.reason}]`);
      continue;
    }

    const text = snippet.truncated ? `${snippet.text}\n[truncated]` : snippet.text;
    const block = `--- ${relativePath} ---\n${text}`;
    snippets.push(block);
    totalBytes += Buffer.byteLength(block);
  }

  if (totalBytes > MAX_INLINE_BYTES) {
    throw new Error('The working-tree diff is too large to inline safely. Retry with --base <ref> or reduce the diff size.');
  }

  return {
    repoRoot,
    target,
    gitStatus: status.stdout.trim(),
    stagedDiff: stagedDiff.stdout.trim(),
    unstagedDiff: unstagedDiff.stdout.trim(),
    untrackedFiles: snippets.join('\n\n') || '(none)',
  };
}

export async function collectBranchFallbackContext(cwd, baseRef) {
  const mergeBase = await git(cwd, ['merge-base', baseRef, 'HEAD']);
  const diff = await git(cwd, ['diff', `${mergeBase.stdout.trim()}..HEAD`, '--binary', '--no-ext-diff', '--submodule=diff']);
  const repoRoot = await getRepoRoot(cwd);

  if (Buffer.byteLength(diff.stdout) > MAX_INLINE_BYTES) {
    throw new Error('The branch diff is too large to inline safely. Retry with Claude ultrareview or reduce the diff size.');
  }

  return {
    repoRoot,
    baseRef,
    diff: diff.stdout.trim(),
  };
}
