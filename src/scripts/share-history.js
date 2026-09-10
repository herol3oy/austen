import LZString from 'lz-string';
import { normalizeBook } from '../../shared/books.mjs';
import { validateDiagram } from '../../shared/diagram-policy.mjs';
import { decompressShare } from '../../shared/bounded-lz.mjs';
export const HISTORY_STORAGE_KEY = 'austen-history';
export function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid snapshot');
  const book = normalizeBook(value.book), mermaid = validateDiagram(value.mermaid, { legacy: true }).source;
  const generatedAt = typeof value.generatedAt === 'string' && Number.isFinite(Date.parse(value.generatedAt)) ? new Date(value.generatedAt).toISOString() : null;
  return { book, mermaid, generatedAt };
}
export function encodeShare(value, url) {
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(normalizeSnapshot(value)));
  if (compressed.length > 16000) throw new Error('Map is too large to share');
  const target = new URL(url); target.search = ''; target.hash = ''; target.searchParams.set('graph', compressed); return target.href;
}
export function decodeShare(compressed) {
  if (typeof compressed !== 'string' || !compressed || compressed.length > 16000 || !/^[A-Za-z0-9+ $-]+$/.test(compressed)) throw new Error('Invalid share');
  const json = decompressShare(compressed);
  if (!json || json.length > 40000) throw new Error('Invalid payload size');
  return normalizeSnapshot(JSON.parse(json));
}
export function loadHistory(storage) {
  let raw; try { storage ??= globalThis.localStorage; raw = storage.getItem(HISTORY_STORAGE_KEY); } catch { return { list: [], corrupted: false }; }
  if (!raw) return { list: [], corrupted: false };
  try {
    if (raw.length > 1500000) throw new Error('History too large');
    const parsed = JSON.parse(raw); if (!Array.isArray(parsed)) throw new Error('Not a list');
    const list = []; let corrupted = false;
    for (const entry of parsed.slice(0, 30)) {
      try { const safe = normalizeSnapshot(entry); if (!list.some(e => historyKey(e.book) === historyKey(safe.book))) list.push(safe); }
      catch { corrupted = true; }
    }
    return { list, corrupted };
  } catch { return { list: [], corrupted: true }; }
}
export function saveHistory(list, storage) {
  try { storage ??= globalThis.localStorage; storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 30).map(normalizeSnapshot))); return true; } catch { return false; }
}
export function historyKey(book) {
  const safe = normalizeBook(book); return safe.id || [safe.title, safe.authors.join(','), safe.year].join('|');
}
