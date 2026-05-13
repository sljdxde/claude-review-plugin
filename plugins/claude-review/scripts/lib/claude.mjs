import { expandArgv } from './args.mjs';
import { binaryAvailable, runCommand, runCommandChecked } from './process.mjs';
import { readJson } from './fs.mjs';

function getRuntimeEnv(env = process.env) {
  return env ?? process.env;
}

export async function resolveClaudeCommand({ env = process.env } = {}) {
  if (env.CLAUDE_REVIEW_CLAUDE_BIN) {
    return env.CLAUDE_REVIEW_CLAUDE_BIN;
  }

  const whereResult = await runCommand(
    process.platform === 'win32' ? 'where.exe' : 'which',
    ['claude'],
    { env },
  ).catch(() => null);

  if (whereResult?.ok) {
    const matches = whereResult.stdout.trim().split(/\r?\n/).filter(Boolean);
    const preferred = matches.find((item) => item.toLowerCase().endsWith('.cmd'))
      ?? matches.find((item) => item.toLowerCase().endsWith('.exe'))
      ?? matches[0];
    if (preferred) {
      return preferred.trim();
    }
  }

  return 'claude';
}

function getClaudePrefixArgs(env = process.env) {
  return expandArgv([getRuntimeEnv(env).CLAUDE_REVIEW_CLAUDE_BIN_ARGS || '']);
}

function buildClaudeArgs(args, env = process.env) {
  return [...getClaudePrefixArgs(env), ...args];
}

async function getClaudeSettings(env = process.env) {
  const runtimeEnv = getRuntimeEnv(env);
  const explicitPath = runtimeEnv.CLAUDE_REVIEW_SETTINGS_PATH;
  const settingsPath = explicitPath || `${runtimeEnv.USERPROFILE || process.env.USERPROFILE}\\.claude\\settings.json`;
  return readJson(settingsPath, null);
}

async function getDirectApiConfig(env = process.env) {
  const runtimeEnv = getRuntimeEnv(env);
  if (
    runtimeEnv.CLAUDE_REVIEW_API_BASE_URL
    && runtimeEnv.CLAUDE_REVIEW_API_TOKEN
    && runtimeEnv.CLAUDE_REVIEW_API_MODEL
  ) {
    return {
      baseUrl: runtimeEnv.CLAUDE_REVIEW_API_BASE_URL,
      token: runtimeEnv.CLAUDE_REVIEW_API_TOKEN,
      model: runtimeEnv.CLAUDE_REVIEW_API_MODEL,
    };
  }

  const settings = await getClaudeSettings(runtimeEnv);
  const settingsEnv = settings?.env;
  if (
    settingsEnv?.ANTHROPIC_BASE_URL
    && settingsEnv?.ANTHROPIC_AUTH_TOKEN
    && settingsEnv?.ANTHROPIC_MODEL
  ) {
    return {
      baseUrl: settingsEnv.ANTHROPIC_BASE_URL,
      token: settingsEnv.ANTHROPIC_AUTH_TOKEN,
      model: settingsEnv.ANTHROPIC_MODEL,
    };
  }

  return null;
}

export async function hasDirectApiConfig(env = process.env) {
  const config = await getDirectApiConfig(env);
  return Boolean(config);
}

function extractMessageText(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  const text = content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n');

  return text.trim();
}

async function runDirectApiReview(prompt, options = {}) {
  const env = getRuntimeEnv(options.env);
  const config = await getDirectApiConfig(env);
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.token,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: options.maxTokens ?? 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nDo not include thinking. Return plain text only.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Direct Claude API fallback failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const text = extractMessageText(payload);
  if (!text) {
    throw new Error('Direct Claude API fallback returned no text output.');
  }

  return {
    code: 0,
    ok: true,
    stdout: `${text}\n`,
    stderr: '',
    via: 'api-fallback',
    payload,
  };
}

export async function getClaudeAvailability(cwd, options = {}) {
  const env = getRuntimeEnv(options.env);
  const command = await resolveClaudeCommand({ env });
  const result = await binaryAvailable(
    command,
    buildClaudeArgs(['--version'], env),
    { cwd, env },
  );
  return {
    available: result.available,
    version: result.stdout,
  };
}

export async function getClaudeAuthStatus(cwd, options = {}) {
  const env = getRuntimeEnv(options.env);
  const hasDirectApi = await hasDirectApiConfig(env);
  if (hasDirectApi && !env.CLAUDE_REVIEW_FORCE_CLAUDE_CLI) {
    const fallback = await runDirectApiReview('Reply with OK only.', {
      env,
      maxTokens: 128,
    }).catch(() => null);
    if (fallback?.stdout.trim() === 'OK') {
      return {
        authUsable: true,
        stdout: 'OK',
        via: 'api-fallback',
      };
    }
  }

  try {
    const command = await resolveClaudeCommand({ env });
    const result = await runCommandChecked(
      command,
      buildClaudeArgs([
        '-p',
        '--output-format',
        'text',
        '--permission-mode',
        'default',
        'Reply with OK only.',
      ], env),
      { cwd, timeoutMs: 30_000, env },
    );
    if (!result.stdout.trim()) {
      const fallback = await runDirectApiReview('Reply with OK only.', {
        env,
        maxTokens: 128,
      }).catch(() => null);
      if (fallback?.stdout.trim() === 'OK') {
        return {
          authUsable: true,
          stdout: 'OK',
          via: 'api-fallback',
        };
      }
    }
    return {
      authUsable: result.stdout.trim() === 'OK',
      stdout: result.stdout.trim(),
      via: 'claude-cli',
    };
  } catch {
    const fallback = await runDirectApiReview('Reply with OK only.', {
      env,
      maxTokens: 128,
    }).catch(() => null);
    if (fallback?.stdout.trim() === 'OK') {
      return {
        authUsable: true,
        stdout: 'OK',
        via: 'api-fallback',
      };
    }
    return {
      authUsable: false,
      stdout: '',
      via: 'claude-cli',
    };
  }
}

export async function getUltraReviewAvailability(cwd, options = {}) {
  const env = getRuntimeEnv(options.env);
  const command = await resolveClaudeCommand({ env });
  const result = await runCommand(
    command,
    buildClaudeArgs(['ultrareview', '--help'], env),
    { cwd, timeoutMs: 30_000, env },
  );

  return result.ok;
}

export async function runClaudePrintReview(cwd, prompt, options = {}) {
  const timeoutMinutes = Number(options.timeoutMinutes || 30);
  const env = getRuntimeEnv(options.env);
  if (!env.CLAUDE_REVIEW_FORCE_CLAUDE_CLI) {
    const directApi = await runDirectApiReview(prompt, {
      env,
      maxTokens: 4096,
    }).catch(() => null);
    if (directApi) {
      return directApi;
    }
  }

  const command = await resolveClaudeCommand({ env });
  const result = await runCommandChecked(
    command,
    buildClaudeArgs([
      '-p',
      '--output-format',
      'text',
      '--permission-mode',
      'default',
      prompt,
    ], env),
    {
      cwd,
      timeoutMs: timeoutMinutes * 60 * 1000,
      env,
    },
  );

  if (result.stdout.trim()) {
    return result;
  }

  const fallback = await runDirectApiReview(prompt, {
    env,
    maxTokens: 4096,
  });
  if (fallback) {
    return fallback;
  }

  return result;
}

export async function runClaudeUltraReview(cwd, baseRef, options = {}) {
  const timeoutMinutes = Number(options.timeoutMinutes || 30);
  const env = getRuntimeEnv(options.env);
  const command = await resolveClaudeCommand({ env });
  const args = ['ultrareview', baseRef];
  if (options.json) {
    args.push('--json');
  }
  args.push('--timeout', String(timeoutMinutes));

  return runCommandChecked(
    command,
    buildClaudeArgs(args, env),
    {
      cwd,
      timeoutMs: timeoutMinutes * 60 * 1000,
      env,
    },
  );
}
