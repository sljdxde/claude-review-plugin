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
    const child = spawn(useShellWrapper ? `"${binary}"` : binary, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: useShellWrapper,
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
    await runCommand('taskkill', ['/pid', String(pid), '/t', '/f']).catch(() => {});
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
