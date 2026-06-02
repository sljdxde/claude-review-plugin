import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function parseSelectionsJson(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data.selections || !Array.isArray(data.selections)) {
      throw new Error('Invalid selections format: missing selections array');
    }
    return data;
  } catch (error) {
    throw new Error(`Failed to parse selections: ${error.message}`);
  }
}

export function validateSelections(selections) {
  const validActions = new Set(['fix', 'skip', 'custom']);

  for (const sel of selections) {
    if (!sel.findingId) {
      throw new Error('Each selection must have a findingId');
    }
    if (!validActions.has(sel.action)) {
      throw new Error(`Invalid action "${sel.action}" for finding ${sel.findingId}. Must be fix, skip, or custom.`);
    }
    if (sel.action === 'custom' && !sel.customLogic) {
      throw new Error(`Custom action for finding ${sel.findingId} must include customLogic`);
    }
  }

  return true;
}

export async function saveSelections(selections, options = {}) {
  const outputDir = options.outputDir ?? process.cwd();
  const reviewId = selections.reviewId ?? randomUUID();
  const timestamp = selections.timestamp ?? new Date().toISOString();

  const result = {
    reviewId,
    timestamp,
    selections: selections.selections,
  };

  await mkdir(outputDir, { recursive: true });
  const filename = `review-selections-${reviewId.slice(0, 8)}.json`;
  const filepath = path.join(outputDir, filename);

  await writeFile(filepath, JSON.stringify(result, null, 2), 'utf8');

  return { filepath, reviewId, filename };
}

export async function loadSelections(filepath) {
  const raw = await readFile(filepath, 'utf8');
  return parseSelectionsJson(raw);
}

export function getFixableFindings(selections) {
  return selections.selections.filter(s => s.action === 'fix');
}

export function getSkippedFindings(selections) {
  return selections.selections.filter(s => s.action === 'skip');
}

export function getCustomFindings(selections) {
  return selections.selections.filter(s => s.action === 'custom');
}

export function generateSummary(selections) {
  const fix = getFixableFindings(selections).length;
  const skip = getSkippedFindings(selections).length;
  const custom = getCustomFindings(selections).length;

  return {
    total: selections.selections.length,
    fix,
    skip,
    custom,
    message: `${fix} to fix, ${skip} to skip, ${custom} custom`,
  };
}
