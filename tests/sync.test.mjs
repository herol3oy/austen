import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { syncMaps, parseSyncArgs } from '../scripts/sync-maps.mjs';
import { readBookRecords, countAttempts } from '../scripts/map-records.mjs';
import { runBatch } from '../scripts/generate-maps.mjs';
import { loadPublishedMaps, publishMap } from '../scripts/publish-map.mjs';
import { PREFLIGHT_GRAPH, RenderError } from '../scripts/validate-maps.mjs';
import { readJson, writeJson, withLock } from '../scripts/files.mjs';
import { ProviderError } from '../shared/generation.mjs';
import { fixtureRoot, success, svg } from './helpers.mjs';

const options = root => ({ root, dryRun: false, renderer: async () => svg, sleep: async () => {}, log: () => {} });
const invalid = () => ({ ...success(), outcome: 'invalid_graph', mermaid: 'missing graph header' });
const unknown = () => ({ ...success(), outcome: 'unknown_work', mermaid: null });
const noProvider = () => { throw new Error('Unexpected paid request'); };

test('sync defaults to a five-pass dry run; dry run has no rendering or writes', async t => {
  assert.equal(parseSyncArgs([]).passes, 5); assert.equal(parseSyncArgs([]).dryRun, true);
  assert.equal(parseSyncArgs(['--run']).dryRun, false);
  assert.equal(parseSyncArgs(['--run', '--dry-run']).dryRun, true);
  const { root } = await fixtureRoot(t);
  const result = await syncMaps({ root, provider: noProvider, renderer: noProvider, log: () => {} });
  assert.equal(result.plan.length, 3); assert.equal(result.maximumRequests, 15);
  await assert.rejects(readdir(resolve(root, 'data/maps')), { code: 'ENOENT' });
  await assert.rejects(syncMaps({ root, passes: 6 }), /1–5/);
});

test('whole catalog publishes more than 50 books across categories without a selection or manual review', async t => {
  const { root, book, catalog } = await fixtureRoot(t);
  catalog.books = Array.from({ length: 55 }, (_, i) => ({ ...book, id: `fixture-author/book-${i}`, slug: `fixture-author-book-${i}`, title: `Book ${i}`, category: i % 2 ? 'Poetry' : 'Nonfiction', ebookUrl: `https://standardebooks.org/ebooks/fixture-author/book-${i}` }));
  await writeJson(resolve(root, 'data/catalog/books.json'), catalog);
  // Invalid legacy selection proves the full-catalog path never reads it.
  await writeJson(resolve(root, 'data/catalog/selection.json'), { ignored: true });
  let calls = 0;
  const result = await syncMaps({ ...options(root), provider: async () => { calls++; return success(); } });
  assert.equal(calls, 55); assert.equal(result.published, 55); assert.equal(result.actualUsage.total_tokens, 8250);
  const { maps } = await loadPublishedMaps(root, catalog);
  assert.equal(maps.length, 55);
  assert.ok(maps.every(m => m.review.mode === 'automatic' && !m.review.reviewer && m.revision.outcome === 'valid'));
  const before = await readFile(resolve(root, 'data/published.json'), 'utf8');
  const resumed = await syncMaps({ ...options(root), provider: noProvider, renderer: noProvider });
  assert.equal(resumed.reused, 55); assert.equal(resumed.requests, 0);
  assert.equal(await readFile(resolve(root, 'data/published.json'), 'utf8'), before);
});

test('each pass visits pending books once, skips UNKNOWN and success, and publishes a later successful attempt', async t => {
  const { root, catalog } = await fixtureRoot(t);
  const seen = [], counts = new Map();
  const result = await syncMaps({ ...options(root), provider: async metadata => {
    seen.push(metadata.title); const count = (counts.get(metadata.title) || 0) + 1; counts.set(metadata.title, count);
    if (metadata.title === catalog.books[1].title) return unknown();
    if (metadata.title === catalog.books[0].title && count < 3) return invalid();
    return success();
  } });
  assert.deepEqual(seen, [catalog.books[0].title, catalog.books[1].title, catalog.books[2].title, catalog.books[0].title, catalog.books[0].title]);
  assert.equal(result.published, 2); assert.equal(result.unknown, 1);
  await syncMaps({ ...options(root), provider: noProvider });
});

test('old attempts count toward five, and repeated runs cannot reset exhausted books', async t => {
  const { root, book } = await fixtureRoot(t);
  await runBatch({ root, dryRun: false, provider: async () => invalid(), sleep: async () => {} });
  let calls = 0;
  for (let i = 0; i < 4; i++) await syncMaps({ ...options(root), ids: [book.id], passes: 1, provider: async () => { calls++; return invalid(); } });
  assert.equal(calls, 3); assert.equal(countAttempts(await readBookRecords(root, book)), 5);
  const result = await syncMaps({ ...options(root), ids: [book.id], provider: noProvider });
  assert.equal(result.exhausted, 1);
});

test('request budget and interrupted requests resume without regenerating successes', async t => {
  const { root, catalog } = await fixtureRoot(t);
  const first = await syncMaps({ ...options(root), maxRequests: 1, provider: async () => success() });
  assert.equal(first.published, 1); assert.equal(first.pending, 2);
  await assert.rejects(syncMaps({ ...options(root), provider: async () => { throw new Error('Process interrupted'); } }), /Process interrupted/);
  const interrupted = await readBookRecords(root, catalog.books[1]);
  assert.equal(interrupted[0].revision.attempts[0].outcome, 'requesting');
  const titles = [];
  const result = await syncMaps({ ...options(root), provider: async metadata => { titles.push(metadata.title); return success(); } });
  assert.equal(result.reused, 1); assert.equal(result.published, 2);
  assert.ok(!titles.includes(catalog.books[0].title));
  assert.equal(countAttempts(await readBookRecords(root, catalog.books[1])), 2);
});

test('saved graphs survive renderer failure and resume without a provider call', async t => {
  const { root, book, path } = await fixtureRoot(t); let providerCalls = 0;
  await assert.rejects(syncMaps({ ...options(root), ids: [book.id], provider: async () => { providerCalls++; return success(); }, renderer: async source => {
    if (source === PREFLIGHT_GRAPH) return svg;
    assert.equal((await readJson(path)).outcome, 'candidate');
    throw new Error('Browser crashed');
  } }), /Rendering stopped/);
  assert.equal((await readJson(path)).outcome, 'render_failed');
  const result = await syncMaps({ ...options(root), ids: [book.id], provider: noProvider });
  assert.equal(providerCalls, 1); assert.equal(result.published, 1); assert.equal(result.requests, 0);
});

test('Mermaid parse errors trigger another generation pass rather than a browser setup stop', async t => {
  const { root, book } = await fixtureRoot(t); let renders = 0;
  const result = await syncMaps({ ...options(root), ids: [book.id], provider: async () => success(), renderer: async source => {
    if (source !== PREFLIGHT_GRAPH && ++renders === 1) throw new RenderError('invalid_graph', 'Parse error');
    return svg;
  } });
  assert.equal(result.requests, 2); assert.equal(result.published, 1);
});

test('missing credentials and failed browser preflight stop before any provider request or revision', async t => {
  const { root } = await fixtureRoot(t); let calls = 0;
  await assert.rejects(syncMaps({ ...options(root), apiKey: '', renderer: noProvider }), /DEEPSEEK_API_KEY/);
  await assert.rejects(syncMaps({ ...options(root), renderer: async () => { throw new Error('Could not find Chrome'); }, provider: async () => { calls++; return success(); } }), /Browser preflight failed.*Chrome/);
  assert.equal(calls, 0);
  await assert.rejects(readdir(resolve(root, 'data/maps')), { code: 'ENOENT' });
});

test('provider credentials/credit failures stop the whole batch; non-retryable errors remain failed', async t => {
  const { root, book } = await fixtureRoot(t); let calls = 0;
  await assert.rejects(syncMaps({ ...options(root), provider: async () => { calls++; throw new ProviderError('provider_error', { fatal: true, status: 402 }); } }), /Batch stopped/);
  assert.equal(calls, 1);
  const result = await syncMaps({ ...options(root), ids: [book.id], provider: async () => { throw new ProviderError('provider_error', { retryable: false, status: 413 }); } });
  assert.equal(result.failed, 1);
  await syncMaps({ ...options(root), ids: [book.id], provider: noProvider });
});

test('Retry-After persists across restarts and applies to other books, with short waits', async t => {
  const { root, catalog } = await fixtureRoot(t);
  await syncMaps({ ...options(root), ids: [catalog.books[0].id], maxRequests: 1, provider: async () => { throw new ProviderError('provider_error', { retryable: true, status: 429, retryAfterMs: 65000 }); } });
  const delays = [];
  const result = await syncMaps({ ...options(root), ids: [catalog.books[1].id], sleep: async ms => delays.push(ms), provider: async () => { assert.ok(delays.reduce((a, b) => a + b, 0) > 64000); return success(); } });
  assert.ok(delays.every(ms => ms <= 30000)); assert.equal(result.published, 1);
});

test('timeouts and 5xx share the five-attempt ceiling', async t => {
  const { root, book } = await fixtureRoot(t); let calls = 0;
  const result = await syncMaps({ ...options(root), ids: [book.id], provider: async () => { calls++; throw new ProviderError(calls % 2 ? 'timeout' : 'provider_error', { retryable: true, status: calls % 2 ? 0 : 503 }); } });
  assert.equal(calls, 5); assert.equal(result.exhausted, 1);
});

test('legacy manual publications remain byte-for-byte unchanged and saved valid revisions publish for free', async t => {
  const { root, book } = await fixtureRoot(t);
  await runBatch({ root, dryRun: false, provider: async () => success(), renderer: async () => svg });
  const published = await syncMaps({ ...options(root), ids: [book.id], renderer: noProvider, provider: noProvider });
  assert.equal(published.published, 1);
  await publishMap({ root, id: book.id, revision: 'v1', reviewed: true, reviewer: 'Hamed', notes: 'Fixture' });
  const manifestPath = resolve(root, 'data/published.json'), manifest = await readJson(manifestPath);
  delete manifest.books[0].mode; delete manifest.books[0].publishedAt;
  await writeJson(manifestPath, manifest);
  const before = await readFile(manifestPath, 'utf8');
  await syncMaps({ ...options(root), ids: [book.id], renderer: noProvider, provider: noProvider });
  assert.equal(await readFile(manifestPath, 'utf8'), before);
});

test('an outcome of valid alone cannot bypass artifact verification', async t => {
  const { root, book, path } = await fixtureRoot(t);
  await runBatch({ root, dryRun: false, provider: async () => invalid(), sleep: async () => {} });
  const revision = await readJson(path); revision.outcome = 'valid'; await writeJson(path, revision);
  await assert.rejects(syncMaps({ ...options(root), ids: [book.id], provider: noProvider }), /Revision is not valid/);
  assert.equal((await readJson(resolve(root, 'data/published.json'))).books.length, 0);
});

test('maintenance recovers dead-process locks and refuses a live process', async t => {
  const { root } = await fixtureRoot(t);
  const child = spawn(process.execPath, ['-e', '']); await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const path = resolve(root, 'data/.maintenance.lock');
  await writeJson(path, { pid: child.pid });
  assert.equal(await withLock(root, async () => 42), 42);
  await writeJson(path, { pid: process.pid });
  await assert.rejects(withLock(root, async () => {}), /already running/);
  assert.equal((await readJson(path)).pid, process.pid);
});
