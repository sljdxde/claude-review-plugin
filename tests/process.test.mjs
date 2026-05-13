import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

import { runCommand } from '../plugins/claude-review/scripts/lib/process.mjs';

test('runCommand can execute cmd wrappers on Windows', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claude-review-process-'));
  try {
    const scriptPath = path.join(tempDir, 'echo-test.cmd');
    await writeFile(scriptPath, '@echo off\r\necho wrapper-ok\r\n');
    const result = await runCommand(scriptPath, []);
    assert.equal(result.ok, true);
    assert.match(result.stdout, /wrapper-ok/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
