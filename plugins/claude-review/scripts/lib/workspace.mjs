import os from 'node:os';
import path from 'node:path';

export function resolveStateRoot(explicitRoot = null) {
  return explicitRoot
    ?? process.env.CODEX_PLUGIN_DATA
    ?? process.env.CODEX_HOME
    ?? path.join(os.tmpdir(), 'claude-review-plugin');
}

export function resolveCommandCwd(explicitCwd = null) {
  return path.resolve(explicitCwd ?? process.cwd());
}
