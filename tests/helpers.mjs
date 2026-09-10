import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseCatalog } from '../scripts/ingest-catalog.mjs';
import { ROOT, writeJson } from '../scripts/files.mjs';
export const graph = 'graph LR\nA["Elizabeth Bennet"] -->|Sister of| B["Jane Bennet"]';
export const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><g><text x="10" y="20">Elizabeth Bennet</text><path d="M10 30 L250 30"/><text x="180" y="50">Jane Bennet</text></g></svg>';
export const generatedAt = '2026-09-09T12:00:00.000Z';
export const success = () => ({ outcome: 'candidate', mermaid: graph, generatedAt, requestedModel: 'fixture', reportedModel: 'fixture', usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } });
export async function fixtureRoot(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'austen-test-')); t?.after(() => rm(root, { recursive: true, force: true }));
  const html = await readFile(resolve(ROOT, 'tests/fixtures/catalog.html'), 'utf8');
  const catalog = parseCatalog(html, null, { minimumEntries: 3 });
  const book = catalog.books[0];
  await writeJson(resolve(root, 'data/catalog/books.json'), catalog);
  await writeJson(resolve(root, 'data/catalog/selection.json'), { schemaVersion: 1, books: [{ id: book.id, workId: book.id, decision: 'approved', form: 'novel', reason: 'Test fixture only' }] });
  await writeJson(resolve(root, 'data/published.json'), { schemaVersion: 1, books: [] });
  return { root, book, catalog, path: resolve(root, 'data/maps', book.slug, 'v1.json') };
}
