import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';

import {
  getClaudeAuthStatus,
  resolveClaudeCommand,
  runClaudePrintReview,
} from '../plugins/claude-review/scripts/lib/claude.mjs';

test('resolveClaudeCommand honors explicit override', async () => {
  const resolved = await resolveClaudeCommand({
    env: {
      CLAUDE_REVIEW_CLAUDE_BIN: 'custom-claude',
    },
  });

  assert.equal(resolved, 'custom-claude');
});

test('resolveClaudeCommand can resolve claude.cmd from PATH on Windows-like setups', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claude-bin-'));
  try {
    const fakeCmd = path.join(tempDir, 'claude.cmd');
    await writeFile(fakeCmd, '@echo off\r\necho fake claude\r\n');

    const resolved = await resolveClaudeCommand({
      env: {
        PATH: `${tempDir};${process.env.PATH}`,
      },
    });

    assert.match(resolved.toLowerCase(), /claude(\.cmd)?$/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('runClaudePrintReview falls back to direct API when CLI output is empty', async () => {
  const server = await createAnthropicLikeServer();
  try {
    const result = await runClaudePrintReview(process.cwd(), 'Review this.', {
      timeoutMinutes: 1,
      env: {
        CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
        CLAUDE_REVIEW_CLAUDE_BIN_ARGS: path.resolve('tests/fixtures/fake-claude-empty.mjs'),
        CLAUDE_REVIEW_API_BASE_URL: server.baseUrl,
        CLAUDE_REVIEW_API_TOKEN: 'test-token',
        CLAUDE_REVIEW_API_MODEL: 'fake-model',
      },
    });

    assert.match(result.stdout, /API fallback review/);
  } finally {
    await server.close();
  }
});

test('getClaudeAuthStatus uses direct API fallback when CLI output is empty', async () => {
  const server = await createAnthropicLikeServer({
    text: 'OK',
  });
  try {
    const result = await getClaudeAuthStatus(process.cwd(), {
      env: {
        CLAUDE_REVIEW_CLAUDE_BIN: process.execPath,
        CLAUDE_REVIEW_CLAUDE_BIN_ARGS: path.resolve('tests/fixtures/fake-claude-empty.mjs'),
        CLAUDE_REVIEW_API_BASE_URL: server.baseUrl,
        CLAUDE_REVIEW_API_TOKEN: 'test-token',
        CLAUDE_REVIEW_API_MODEL: 'fake-model',
      },
    });

    assert.equal(result.authUsable, true);
    assert.equal(result.via, 'api-fallback');
  } finally {
    await server.close();
  }
});

async function createAnthropicLikeServer(options = {}) {
  const text = options.text ?? 'API fallback review';

  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/messages') {
      response.statusCode = 404;
      response.end('not found');
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(payload.model, 'fake-model');

    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'fake-model',
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text },
        ],
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
