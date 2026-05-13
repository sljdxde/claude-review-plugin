import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderQueuedReview,
  renderSetupReport,
  renderSingleJobStatus,
  renderStoredJobResult,
} from '../plugins/claude-review/scripts/lib/render.mjs';

test('renderSetupReport summarizes readiness', () => {
  const output = renderSetupReport({
    ready: true,
    node: { available: true, version: 'v22.16.0' },
    git: { available: true, version: 'git version 2.46.0.windows.1' },
    claude: {
      available: true,
      version: '2.1.140 (Claude Code)',
      authUsable: true,
    },
    nextSteps: ['Run /claude:review --background'],
  });

  assert.match(output, /Claude Review setup: ready/);
  assert.match(output, /Non-interactive Claude run: OK/);
});

test('renderQueuedReview references status command', () => {
  const output = renderQueuedReview({ jobId: 'review-abc-123' });
  assert.match(output, /review-abc-123/);
  assert.match(output, /status/);
});

test('renderSingleJobStatus includes phase and target', () => {
  const output = renderSingleJobStatus({
    id: 'review-abc-123',
    status: 'running',
    phase: 'reviewing',
    target: { label: 'working tree diff' },
    createdAt: '2026-05-13T10:00:00.000Z',
  });

  assert.match(output, /working tree diff/);
  assert.match(output, /reviewing/);
});

test('renderStoredJobResult preserves raw review output', () => {
  const output = renderStoredJobResult({
    id: 'review-abc-123',
    target: { label: 'branch diff against main' },
    status: 'completed',
    result: { rawOutput: 'Findings\n- [P1] Bug' },
  });

  assert.match(output, /Findings/);
  assert.match(output, /branch diff against main/);
});
