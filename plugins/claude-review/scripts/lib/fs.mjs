import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function atomicWriteFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
}

export async function atomicWriteJson(filePath, value) {
  await atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(filePath, fallback = null) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export async function removeFile(filePath) {
  await rm(filePath, { force: true });
}

export function isLikelyBinary(buffer) {
  return buffer.includes(0);
}

export async function readTextSnippet(filePath, maxBytes = 24 * 1024) {
  const buffer = await readFile(filePath);
  if (isLikelyBinary(buffer)) {
    return { ok: false, reason: 'binary' };
  }

  const sliced = buffer.subarray(0, maxBytes);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(sliced);
    return {
      ok: true,
      text,
      truncated: buffer.length > maxBytes,
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
