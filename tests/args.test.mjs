import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../plugins/claude-review/scripts/lib/args.mjs';

test('parseArgs supports explicit value and flags', () => {
  const parsed = parseArgs(['review', '--base', 'main', '--background']);

  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.base, 'main');
  assert.equal(parsed.options.background, true);
});

test('parseArgs expands raw argument strings', () => {
  const parsed = parseArgs(['review', '--base main --scope working-tree']);

  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.base, 'main');
  assert.equal(parsed.options.scope, 'working-tree');
});

test('parseArgs preserves positionals', () => {
  const parsed = parseArgs(['status', 'job-123', '--json']);

  assert.equal(parsed.command, 'status');
  assert.deepEqual(parsed.positionals, ['job-123']);
  assert.equal(parsed.options.json, true);
});

test('parseArgs rejects unknown options', () => {
  assert.throws(() => parseArgs(['review', '--nope']), /Unknown option/);
});
