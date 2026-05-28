import { spawn } from 'node:child_process';
import process from 'node:process';

export async function runCommand(binary, args = [], options = {}) {
  const {
    cwd,
    env,
    input,
    timeoutMs,
  } = options;

  const useShellWrapper = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binary);

  return new Promise((resolve, reject) => {
    const child = useShellWrapper
      ? spawn('cmd.exe', ['/c', binary, ...args], {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      : spawn(binary, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;

    if (timeoutMs) {
      timer = setTimeout(async () => {
        if (settled) {
          return;
        }
        await terminateProcessTree(child.pid);
        settled = true;
        reject(new Error(`Command timed out after ${timeoutMs} ms`));
      }, timeoutMs);
    }

    child.on('error', (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code, signal) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        code,
        signal,
        stdout,
        stderr,
        ok: code === 0,
      });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export async function runCommandChecked(binary, args = [], options = {}) {
  const result = await runCommand(binary, args, options);
  if (!result.ok) {
    const error = new Error(result.stderr.trim() || `${binary} exited with code ${result.code}`);
    error.result = result;
    throw error;
  }
  return result;
}

export async function binaryAvailable(binary, args = ['--version'], options = {}) {
  try {
    const result = await runCommand(binary, args, options);
    return {
      available: result.ok,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch {
    return {
      available: false,
      stdout: '',
      stderr: '',
    };
  }
}

export async function terminateProcessTree(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    const taskkillResult = await runCommand('taskkill', ['/pid', String(pid), '/t', '/f']).catch(() => null);
    if (!taskkillResult?.ok) {
      try {
        process.kill(pid);
      } catch {
        // Best effort only.
      }
    }
    const processIds = getTaskkillProcessIds(pid, taskkillResult);
    await Promise.all(processIds.map((processId) => waitForWindowsProcessExit(processId)));
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Best effort only.
    }
  }
}

function getTaskkillProcessIds(pid, result) {
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  const processIds = new Set([Number(pid)]);
  for (const match of output.matchAll(/\b(\d{2,})\b/g)) {
    processIds.add(Number(match[1]));
  }
  return [...processIds].filter(Number.isFinite);
}

async function waitForWindowsProcessExit(pid, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await runCommand('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh']).catch(() => null);
    const output = result?.stdout?.trim() ?? '';
    if (!output || !output.includes(`"${pid}"`)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
