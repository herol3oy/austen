import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readJson } from './files.mjs';

export const MAX_BOOK_ATTEMPTS = 5;

export async function readBookRecords(root, book) {
  const dir = resolve(root, 'data/maps', book.slug);
  const names = await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const records = [];
  for (const name of names.filter(n => /^v[1-9]\d*\.json$/.test(n)).sort((a, b) => Number(a.slice(1, -5)) - Number(b.slice(1, -5)))) {
    const path = resolve(dir, name), revision = await readJson(path);
    if (revision.schemaVersion !== 1 || revision.bookId !== book.id || revision.revision !== name.slice(0, -5) || !Array.isArray(revision.attempts)) throw new Error(`Invalid saved revision: ${path}`);
    records.push({ path, revision });
  }
  return records;
}

export function countAttempts(records) {
  // Local corrections inherit provenance; they do not incur new provider requests.
  return records.filter(r => r.revision.origin?.type !== 'local_edit').reduce((sum, r) => sum + r.revision.attempts.length, 0);
}

export function nextAction(records) {
  const valid = records.findLast(r => r.revision.outcome === 'valid');
  if (valid) return { action: 'publish', record: valid };
  const record = records.at(-1), outcome = record?.revision.outcome;
  if (['candidate', 'render_failed'].includes(outcome)) return { action: 'validate', record };
  if (outcome === 'unknown_work') return { action: 'unknown', record };
  if (countAttempts(records) >= MAX_BOOK_ATTEMPTS) return { action: 'exhausted', record };
  const attempt = record?.revision.attempts.at(-1);
  if (outcome === 'provider_error' && attempt?.retryable === false && !attempt.fatal) return { action: 'failed', record };
  return { action: 'generate', record };
}
