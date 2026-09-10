import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, cp, symlink, readdir, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';
import LZString from 'lz-string';
import { ROOT, writeJson } from '../scripts/files.mjs';
import { syncMaps } from '../scripts/sync-maps.mjs';
import { renderSvg, validateSvg } from '../scripts/validate-maps.mjs';
import { decodeShare, loadHistory, normalizeSnapshot } from '../src/scripts/share-history.js';
import { fixtureRoot, graph, success, generatedAt } from './helpers.mjs';
const execute = promisify(execFile);
const delay = ms => new Promise(r => setTimeout(r, ms));

test('built static library and migrated workspace', { timeout: 180000 }, async t => {
  const { root, book, catalog } = await fixtureRoot(t);
  const svg = await renderSvg(graph); assert.ok(validateSvg(svg).width > 0);
  await assert.rejects(renderSvg('graph LR\nend["Reserved identifier"]\nC2["Other"]\nend -->|Knows| C2'), error => error.code === 'invalid_graph');
  const extra = Array.from({ length: 51 }, (_, i) => ({ ...book, id: `fixture-author/book-${i}`, slug: `fixture-author-book-${i}`, title: `Fixture ${i}`, year: '1900', category: 'Poetry', ebookUrl: `https://standardebooks.org/ebooks/fixture-author/book-${i}` }));
  catalog.books.push(...extra);
  await writeJson(resolve(root, 'data/catalog/books.json'), catalog);
  await syncMaps({ root, dryRun: false, ids: [book.id, ...extra.map(b => b.id)], provider: async () => success(), renderer: async () => svg, log: () => {} });
  await syncMaps({ root, dryRun: false, ids: [catalog.books[1].id], provider: async () => ({ ...success(), outcome: 'unknown_work', mermaid: null }), renderer: async () => svg, log: () => {} });
  for (const name of ['src', 'shared', 'scripts', 'public']) await cp(resolve(ROOT, name), resolve(root, name), { recursive: true });
  for (const name of ['astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(resolve(ROOT, name), resolve(root, name));
  await symlink(resolve(ROOT, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  await execute(resolve(ROOT, 'node_modules/.bin/astro'), ['build'], { cwd: root, timeout: 60000, maxBuffer: 2000000, env: { ...process.env, NODE_OPTIONS: `--import=${resolve(ROOT, 'tests/fixtures/offline.mjs')}`, DEEPSEEK_API_KEY: 'STATIC_BUILD_SECRET_SENTINEL' } });
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith('/austen/')) { res.writeHead(404); res.end(); return; }
      const relative = path.slice('/austen/'.length), file = resolve(root, 'dist', relative.endsWith('/') || !relative ? `${relative}index.html` : relative);
      if (!file.startsWith(resolve(root, 'dist') + '/')) throw new Error('Invalid path');
      const content = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(content);
    } catch { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(await readFile(resolve(root, 'dist/404.html'))); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/austen/`;
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined }); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let providerCalls = 0, apiReply = null, discoveryReply = null;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith(base) || request.url().startsWith('data:') || request.url().startsWith('blob:')) { void request.continue(); return; }
    if (request.url().startsWith('https://austen-api.potato0.workers.dev') && apiReply) {
      if (request.method() === 'OPTIONS') { void request.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }); return; }
      providerCalls++; void apiReply(request); return;
    }
    if (request.url().startsWith('https://openlibrary.org/search.json') && discoveryReply) { void discoveryReply(request); return; }
    void request.abort();
  });
  const publishedUrl = `${base}books/${book.slug}/`;
  await t.test('published maps have static SVG, attribution and spoilers without JavaScript; unpublished books have no routes', async () => {
    await page.setJavaScriptEnabled(false); await page.goto(publishedUrl);
    assert.ok(await page.$('#mermaid-container svg')); assert.equal(await page.$eval('#diagram-workspace', n => n.hidden), false);
    assert.match(await page.$eval('main', n => n.textContent), /Spoilers:.*whole book/s);
    assert.match(await page.$eval('main', n => n.textContent), /AI-generated/);
    assert.doesNotMatch(await page.$eval('main', n => n.textContent), /\bReviewed\b/);
    assert.ok(await page.$('a[href^="https://sudalyph.org"]'));
    assert.equal((await page.goto(`${base}books/charlotte-bronte-jane-eyre/`)).status(), 404);
    await page.goto(base); assert.equal(await page.$$eval('[data-library-book]', n => n.length), 52); assert.equal(providerCalls, 0);
    const index = JSON.parse(await readFile(resolve(root, 'dist/catalog-index.json'), 'utf8'));
    assert.equal(index.length, 54); assert.ok(!JSON.stringify(index).includes('mermaid'));
    assert.equal(index[0].mapStatus, 'available'); assert.equal(index[1].mapStatus, 'unavailable'); assert.equal(index[1].publishedUrl, null);
    assert.equal(index[2].mapStatus, 'pending'); assert.equal(index[2].publishedUrl, null);
    assert.equal((await page.goto(`${base}books/${extra.at(-1).slug}/`)).status(), 200);
  });
  await t.test('saved workspace uses canonical share; edits validate, revert, cancel and save locally with original timestamp', async () => {
    await page.setJavaScriptEnabled(true); await page.goto(publishedUrl);
    await page.waitForFunction(() => !document.getElementById('edit-btn').disabled);
    assert.equal(await page.$eval('#share-url-input', n => n.value), `https://herol3oy.github.io/austen/books/${book.slug}/`);
    await page.click('#edit-btn'); const original = await page.$eval('#mermaid-container', n => n.textContent);
    const setDraft = value => page.$eval('#editor-input', (n, value) => { n.value = value; n.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await setDraft('graph LR\nA[broken'); await page.waitForFunction(() => document.getElementById('editor-status').dataset.tone === 'error');
    assert.equal(await page.$eval('#mermaid-container', n => n.textContent), original); assert.equal(await page.$eval('#editor-save-btn', n => n.disabled), true);
    await page.click('#editor-revert-btn'); assert.equal(await page.$eval('#editor-input', n => n.value), graph);
    await setDraft(graph.replace('Sister of', 'Sisters')); await page.waitForFunction(() => !document.getElementById('editor-save-btn').disabled);
    page.once('dialog', dialog => dialog.accept()); await page.click('#editor-cancel-btn');
    assert.equal(await page.$eval('#mermaid-source', n => n.value), graph);
    await page.click('#edit-btn'); await setDraft(graph.replace('Sister of', 'Sisters')); await page.waitForFunction(() => !document.getElementById('editor-save-btn').disabled); await page.click('#editor-save-btn');
    const share = new URL(await page.$eval('#share-url-input', n => n.value)); assert.equal(share.pathname, '/austen/generate/');
    assert.equal(decodeShare(share.searchParams.get('graph')).generatedAt, generatedAt);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('austen-history'))[0].generatedAt), generatedAt);
    await page.reload(); await page.waitForFunction(() => !document.getElementById('edit-btn').disabled); assert.equal(await page.$eval('#mermaid-source', n => n.value), graph);
  });
  await t.test('pan/zoom and complete SVG/PNG exports work', async () => {
    const downloads = resolve(root, 'downloads'); await mkdir(downloads);
    const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await page.click('#zoom-in-btn'); await page.waitForFunction(() => document.getElementById('diagram-zoom-level').textContent !== '100%');
    await page.click('#download-svg-btn'); await page.waitForFunction(() => document.getElementById('download-status').textContent.includes('downloaded'));
    await page.click('#download-png-btn'); await page.waitForFunction(() => document.getElementById('download-status').textContent.includes('PNG downloaded'));
    let files = []; for (let i = 0; i < 50; i++) { files = await readdir(downloads); if (files.some(f => f.endsWith('.png')) && files.some(f => f.endsWith('.svg'))) break; await delay(100); }
    const savedSvg = await readFile(resolve(downloads, files.find(f => f.endsWith('.svg'))), 'utf8');
    const dimensions = validateSvg(savedSvg); assert.ok(dimensions.width > 300); assert.ok(!savedSvg.includes('transform-origin'));
    const png = await readFile(resolve(downloads, files.find(f => f.endsWith('.png')))); assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a'); assert.ok(png.readUInt32BE(16) >= dimensions.width); assert.ok(png.readUInt32BE(20) >= dimensions.height);
  });
  await t.test('catalog filtering and preselection offer a published map without generating', async () => {
    await page.goto(`${base}catalog/`); await page.type('#library-search', '1813'); assert.equal(await page.$$eval('[data-library-book]:not([hidden])', n => n.length), 1);
    await page.goto(`${base}generate/?book=${encodeURIComponent(book.id)}`); await page.waitForSelector('.published-offer'); assert.equal(providerCalls, 0);
  });
  await t.test('legacy homepage shares forward, preserve metadata and render; malformed history and Undo work', async () => {
    const oldShare = (await readFile(resolve(ROOT, 'tests/fixtures/legacy-share.txt'), 'utf8')).trim();
    await page.goto(`${base}?graph=${new URL(oldShare).searchParams.get('graph')}`); await page.waitForFunction(() => location.pathname === '/austen/generate/' && !document.getElementById('edit-btn').disabled);
    assert.match(await page.$eval('#selected-book-card', n => n.textContent), /Pride and Prejudice/);
    await page.evaluate(({ graph, generatedAt }) => localStorage.setItem('austen-history', JSON.stringify([{ book: { title: 'Legacy', authors: 'malformed', publishYear: 1813 }, mermaid: graph, generatedAt }, { book: null, mermaid: 4 } ])), { graph, generatedAt });
    await page.goto(`${base}generate/`); await page.waitForSelector('.shelf-delete'); await page.click('.shelf-delete'); await page.click('#history-undo-btn'); assert.equal(await page.$$eval('.shelf-row', n => n.length), 1);
    await page.goto(`${base}generate/?graph=broken`); await page.waitForFunction(() => document.getElementById('global-status').textContent.includes('corrupted'));
  });
  await t.test('generation is click-only; stale generation cannot replace a new selection; valid results enter history after render', async () => {
    await page.goto(`${base}generate/?book=${encodeURIComponent(book.id)}`); await page.waitForSelector('.published-offer');
    const reply = (request, content) => request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(content) }).catch(() => {});
    apiReply = async request => { await delay(700); await reply(request, { mermaid: graph, generatedAt }); };
    await page.click('#selected-book-card button'); await page.$eval('.manual-entry', n => n.open = true);
    await page.type('[name="title"]', 'Another Book'); await page.type('[name="author"]', 'Another Author'); await page.click('#manual-book-form button'); await delay(1000);
    assert.match(await page.$eval('#selected-book-card', n => n.textContent), /Another Book/); assert.equal(await page.$eval('#diagram-workspace', n => n.hidden), true);
    apiReply = request => reply(request, { mermaid: graph, generatedAt }); await page.click('#selected-book-card button'); await page.waitForFunction(() => !document.getElementById('edit-btn').disabled);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('austen-history'))[0].book.title), 'Another Book');
    const saved = await page.evaluate(() => localStorage.getItem('austen-history'));
    apiReply = request => reply(request, { mermaid: 'graph LR\nA[broken', generatedAt }); await page.click('#selected-book-card button'); await page.waitForFunction(() => document.getElementById('generate-status').dataset.tone === 'error'); assert.equal(await page.evaluate(() => localStorage.getItem('austen-history')), saved);
    apiReply = request => request.respond({ status: 422, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code: 'UNKNOWN' }) }); await page.click('#selected-book-card button'); await page.waitForFunction(() => document.getElementById('generate-status').textContent.includes('confidently'));
  });
  await t.test('stale OpenLibrary discovery results cannot overwrite a newer query', async () => {
    discoveryReply = async request => { const query = new URL(request.url()).searchParams.get('q'); await delay(query === 'old' ? 800 : 20); await request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ docs: [{ title: query, author_name: ['Author'] }] }) }).catch(() => {}); };
    await page.goto(`${base}generate/`); await page.type('#search-input', 'old'); await delay(350);
    await page.$eval('#search-input', n => { n.value = 'new'; n.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.getElementById('search-results').textContent.includes('new')); await delay(600); assert.ok(!(await page.$eval('#search-results', n => n.textContent)).includes('old'));
  });
  assert.deepEqual(errors, []);
  for (const name of await readdir(resolve(root, 'dist/_astro'))) if (name.endsWith('.js')) assert.ok(!(await readFile(resolve(root, 'dist/_astro', name), 'utf8')).includes('STATIC_BUILD_SECRET_SENTINEL'));
});

test('malformed share/history fields are bounded and normalized', () => {
  assert.throws(() => decodeShare('a'.repeat(16001))); assert.throws(() => normalizeSnapshot({ book: { title: 'Title' }, mermaid: '<script>' }));
  const storage = { getItem: () => JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ book: { title: `Book ${i}`, authors: null, publishYear: 1813 }, mermaid: graph }))) };
  assert.equal(loadHistory(storage).list.length, 30); assert.deepEqual(loadHistory(storage).list[0].book.authors, []);
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({ book: { title: 'Book', authors: 1 }, mermaid: graph })); assert.deepEqual(decodeShare(compressed).book.authors, []);
});
