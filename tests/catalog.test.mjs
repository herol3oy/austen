import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCatalog, ingestCatalog } from '../scripts/ingest-catalog.mjs';
import { SOURCE_URL, validateSelection, matchPublished } from '../shared/books.mjs';
import { ROOT } from '../scripts/files.mjs';
import { fixtureRoot } from './helpers.mjs';
const html = await readFile(resolve(ROOT, 'tests/fixtures/catalog.html'), 'utf8');
test('catalog preserves entities, Unicode, ranges, full edition IDs and warnings, and discards descriptions', () => {
  const catalog = parseCatalog(html, null, { minimumEntries: 3 });
  assert.equal(catalog.books[1].title, 'Jane & Eyre'); assert.equal(catalog.books[1].authors[0], 'Charlotte Bronté'); assert.equal(catalog.books[1].year, '1715–1735');
  assert.equal(catalog.books[2].id, 'author-one_author-two/a-book/translator/edition');
  assert.deepEqual(catalog.books[2].metadataWarnings, ['missing_year', 'possible_omitted_coauthors']);
  assert.ok(!JSON.stringify(catalog).includes('Description MUST'));
});
test('reordered anchors and titles preserve existing slugs; duplicate IDs and broken structure fail', () => {
  const first = parseCatalog(html, null, { minimumEntries: 3 }); first.books[0].slug = 'persisted-slug';
  const next = parseCatalog(html.replace('id="001"', 'id="999"'), first, { minimumEntries: 3 });
  assert.equal(next.books[0].id, first.books[0].id); assert.equal(next.books[0].slug, 'persisted-slug');
  assert.throws(() => parseCatalog(html.replace('charlotte-bronte/jane-eyre', 'jane-austen/pride-and-prejudice'), null, { minimumEntries: 3 }));
  assert.throws(() => parseCatalog(html.replace('<strong>Jane Austen</strong>', ''), null, { minimumEntries: 3 }));
  first.books[1].slug = first.books[0].slug; assert.throws(() => parseCatalog(html, first, { minimumEntries: 3 }));
});
test('import only requests index; failed response, size overflow, and changed HTML preserve snapshot', async t => {
  const { root } = await fixtureRoot(t), path = resolve(root, 'data/catalog/books.json'), before = await readFile(path, 'utf8');
  for (const response of [new Response('', { status: 503 }), new Response('<dl></dl>', { headers: { 'content-type': 'text/html' } }), new Response('', { headers: { 'content-type': 'text/html', 'content-length': '3000001' } })]) {
    await assert.rejects(ingestCatalog({ root, minimumEntries: 3, fetchImpl: async url => { assert.equal(url, SOURCE_URL); return response; } }));
    assert.equal(await readFile(path, 'utf8'), before);
  }
  let calls = 0;
  await ingestCatalog({ root, minimumEntries: 3, fetchImpl: async (url, options) => { calls++; assert.equal(url, SOURCE_URL); assert.equal(options.redirect, 'error'); return new Response(html, { headers: { 'content-type': 'text/html' } }); } });
  assert.equal(calls, 1);
});
test('selection rejects collections, duplicates and ambiguous authorship; title-only matches cannot offer maps', async t => {
  const { catalog, book } = await fixtureRoot(t);
  assert.throws(() => validateSelection({ schemaVersion: 1, books: [{ id: book.id, workId: book.id, decision: 'approved', form: 'collection', reason: 'Test' }] }, catalog));
  const entry = { ...book, publishedUrl: '/austen/books/map/' };
  assert.equal(matchPublished({ title: book.title }, [entry]), null);
  assert.equal(matchPublished(book, [entry]), entry);
  const noId = { title: book.title, authors: book.authors, year: book.year };
  assert.equal(matchPublished(noId, [entry, { ...entry, id: 'second-edition' }]), null);
});
