import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COVER_SCHEMA_VERSION, coverAssetPath, savedCoverSlug, standardEbooksRepository, validateCovers } from '../shared/covers.mjs';
import { hash, readJson, writeJson } from '../scripts/files.mjs';
import { syncCovers } from '../scripts/sync-covers.mjs';
import { fixtureRoot, generatedAt } from './helpers.mjs';

const sha = 'a'.repeat(40);
const image = () => Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAB4AFADAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAYH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AnxoCHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/2Q==', 'base64');
const record = (book, source) => ({
  status: 'imported', repository: standardEbooksRepository(book), branch: 'master', sourceSha: sha,
  assetPath: coverAssetPath(book), sourceHash: hash(source), checkedAt: generatedAt,
});

test('cover manifests accept only local Standard Ebooks assets', async () => {
  const book = { id: 'jane-austen/pride-and-prejudice', slug: 'jane-austen-pride-and-prejudice' };
  const source = image();
  const manifest = { schemaVersion: COVER_SCHEMA_VERSION, books: { [book.id]: record(book, source) } };
  validateCovers(manifest);
  assert.equal(savedCoverSlug(book, manifest), 'jane-austen-pride-and-prejudice');
  assert.equal(standardEbooksRepository(book), 'jane-austen_pride-and-prejudice');
  assert.equal(standardEbooksRepository({ id: `${'a'.repeat(70)}/${'b'.repeat(70)}` }).length, 100);
  assert.throws(() => validateCovers({ ...manifest, schemaVersion: 1 }));
  assert.throws(() => validateCovers({ ...manifest, books: { [book.id]: { ...manifest.books[book.id], assetPath: 'https://github.com/cover.webp' } } }));
});

test('imports only published catalog books, stores local assets, and skips stored covers on rerun', async t => {
  const { root, catalog, book } = await fixtureRoot(t);
  const second = catalog.books[1];
  await writeJson(resolve(root, 'data/published.json'), { schemaVersion: 1, books: [{ bookId: book.id }, { bookId: second.id }] });
  const source = image();
  let requests = 0;
  const fetchImpl = async (url, options) => {
    requests++;
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const path = new URL(url).pathname;
    if (path === '/orgs/standardebooks/repos') return Response.json([{ name: standardEbooksRepository(book) }]);
    if (path.endsWith('/contents/images/cover.jpg')) return Response.json({ sha, size: source.length });
    if (path.endsWith(`/git/blobs/${sha}`)) return Response.json({ encoding: 'base64', content: source.toString('base64') });
    throw new Error(`Unexpected request: ${url}`);
  };
  const result = await syncCovers({ root, token: 'test-token', fetchImpl, log: () => {} });
  assert.deepEqual({ downloaded: result.downloaded, missingRepository: result.missingRepository, failed: result.failed }, { downloaded: 1, missingRepository: 1, failed: 0 });
  const manifest = await readJson(resolve(root, 'data/catalog/covers.json'));
  const saved = manifest.books[book.id];
  assert.equal(saved.status, 'imported');
  assert.equal(saved.assetPath, coverAssetPath(book));
  const stored = await readFile(resolve(root, saved.assetPath));
  assert.equal(stored.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])), true);
  assert.equal(saved.sourceHash, hash(stored));
  assert.equal(manifest.books[second.id].status, 'missing_repository');
  assert.equal(manifest.books[catalog.books[2].id], undefined);
  const rerun = await syncCovers({ root, token: 'test-token', fetchImpl: async url => {
    assert.equal(new URL(url).pathname, '/orgs/standardebooks/repos');
    return Response.json([{ name: standardEbooksRepository(book) }]);
  }, log: () => {} });
  assert.equal(rerun.cached, 1);
  assert.equal(rerun.downloaded, 0);
});

test('migrates valid version 2 covers to Astro assets without redownloading them', async t => {
  const { root, book } = await fixtureRoot(t);
  await writeJson(resolve(root, 'data/published.json'), { schemaVersion: 1, books: [{ bookId: book.id }] });
  const source = image();
  const legacySource = resolve(root, `data/covers/${book.slug}/cover.jpg`);
  const legacyDisplay = resolve(root, `public/covers/${book.slug}/cover.jpg`);
  await writeJson(resolve(root, 'data/catalog/covers.json'), { schemaVersion: 2, books: { [book.id]: {
    status: 'imported', repository: standardEbooksRepository(book), branch: 'master', sourceSha: sha,
    sourcePath: `data/covers/${book.slug}/cover.jpg`, displayPath: `covers/${book.slug}/cover.jpg`, sourceHash: hash(source), displayHash: hash(source), checkedAt: generatedAt,
  } } });
  await mkdir(resolve(legacySource, '..'), { recursive: true });
  await mkdir(resolve(legacyDisplay, '..'), { recursive: true });
  await writeFile(legacySource, source); await writeFile(legacyDisplay, source);
  const result = await syncCovers({ root, token: 'test-token', fetchImpl: async url => {
    assert.equal(new URL(url).pathname, '/orgs/standardebooks/repos');
    return Response.json([{ name: standardEbooksRepository(book) }]);
  }, log: () => {} });
  assert.equal(result.cached, 1);
  const manifest = await readJson(resolve(root, 'data/catalog/covers.json'));
  assert.equal(manifest.schemaVersion, COVER_SCHEMA_VERSION);
  assert.equal((await readFile(resolve(root, coverAssetPath(book)))).equals(source), true);
  await assert.rejects(access(legacySource)); await assert.rejects(access(legacyDisplay));
});

test('records missing source files and keeps filesystem unchanged in dry-run mode', async t => {
  const { root, book } = await fixtureRoot(t);
  await writeJson(resolve(root, 'data/published.json'), { schemaVersion: 1, books: [{ bookId: book.id }] });
  const result = await syncCovers({ root, token: 'test-token', dryRun: true, fetchImpl: async url => {
    const path = new URL(url).pathname;
    if (path === '/orgs/standardebooks/repos') return Response.json([{ name: standardEbooksRepository(book) }]);
    if (path.endsWith('/contents/images/cover.jpg')) return new Response('', { status: 404 });
    throw new Error(`Unexpected request: ${url}`);
  }, log: () => {} });
  assert.equal(result.missingCover, 1);
  await assert.rejects(readFile(resolve(root, 'data/catalog/covers.json')));
});
