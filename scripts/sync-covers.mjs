import { resolve } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { validateCatalog } from '../shared/books.mjs';
import { COVER_SCHEMA_VERSION, coverAssetPath, savedCoverSlug, standardEbooksRepository, validateCovers } from '../shared/covers.mjs';
import { ROOT, atomicWrite, hash, readJson, writeJson, withLock, isMain } from './files.mjs';

const execute = promisify(execFile);
const apiRoot = 'https://api.github.com';
const maxSourceBytes = 25 * 1024 * 1024;
const emptyManifest = { schemaVersion: COVER_SCHEMA_VERSION, books: {} };
const missing = () => ({ repository: null, branch: null, sourceSha: null, assetPath: null, sourceHash: null });
const imported = (book, repository, sourceSha, sourceHash) => ({ repository, branch: 'master', sourceSha, assetPath: coverAssetPath(book), sourceHash });

async function githubToken(explicitToken) {
  if (explicitToken) return explicitToken;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try { return (await execute('gh', ['auth', 'token'], { timeout: 5000 })).stdout.trim() || null; } catch { return null; }
}

function retryDelay(response, now) {
  const value = response?.headers?.get('retry-after');
  if (!value) return 0;
  return /^\d+$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - now()) || 0;
}
const apiError = response => response.status === 401 || response.status === 403 || response.status === 429 || Number(response.headers.get('x-ratelimit-remaining')) === 0;
const fatalGithubError = message => Object.assign(new Error(message), { fatal: true });
async function responseJson(response, description) { try { return await response.json(); } catch { throw new Error(`Invalid GitHub ${description} response`); } }
const validJpeg = buffer => buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9;
async function normalizeJpeg(buffer) {
  try {
    return await sharp(buffer, { failOn: 'error' }).rotate().jpeg({ quality: 92 }).toBuffer();
  } catch {
    throw new Error('Cover blob is not a processable JPEG image');
  }
}
async function storedCoverIsValid(root, book, record) {
  if (!savedCoverSlug(book, { books: { [book.id]: record } })) return false;
  try {
    const source = await readFile(resolve(root, record.assetPath));
    if (hash(source) !== record.sourceHash || !validJpeg(source)) return false;
    return true;
  } catch { return false; }
}

async function removeIfUnchanged(path, expectedHash) {
  try {
    const content = await readFile(path);
    if (hash(content) === expectedHash) await unlink(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function upgradeManifest(root, rawManifest, catalog, dryRun) {
  if (rawManifest?.schemaVersion !== 2 || !rawManifest.books || typeof rawManifest.books !== 'object') return null;
  const booksById = new Map(catalog.books.map(book => [book.id, book]));
  const upgraded = structuredClone(emptyManifest);
  for (const [id, record] of Object.entries(rawManifest.books)) {
    const book = booksById.get(id);
    const checkedAt = Number.isFinite(Date.parse(record?.checkedAt)) ? record.checkedAt : new Date().toISOString();
    if (!book || record?.status !== 'imported' || typeof record.sourceHash !== 'string') {
      upgraded.books[id] = { status: ['missing_repository', 'missing_cover', 'failed'].includes(record?.status) ? record.status : 'failed', ...missing(), checkedAt };
      continue;
    }
    const oldSource = resolve(root, `data/covers/${book.slug}/cover.jpg`);
    const oldDisplay = resolve(root, `public/covers/${book.slug}/cover.jpg`);
    try {
      const source = await readFile(oldSource);
      if (!validJpeg(source) || hash(source) !== record.sourceHash) throw new Error('legacy source is invalid');
      if (!dryRun) {
        await atomicWrite(resolve(root, coverAssetPath(book)), source);
        await removeIfUnchanged(oldSource, record.sourceHash);
        await removeIfUnchanged(oldDisplay, typeof record.displayHash === 'string' ? record.displayHash : record.sourceHash);
      }
      upgraded.books[id] = { status: 'imported', ...imported(book, record.repository, record.sourceSha, record.sourceHash), checkedAt };
    } catch {
      upgraded.books[id] = { status: 'failed', ...missing(), checkedAt };
    }
  }
  return upgraded;
}

export async function syncCovers({ root = ROOT, id, refresh = false, dryRun = false, token, fetchImpl = fetch, wait = sleep, now = Date.now, log = console.log } = {}) {
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json')));
  const published = await readJson(resolve(root, 'data/published.json'));
  if (!Array.isArray(published?.books)) throw new Error('Invalid published map index');
  const publishedIds = new Set(published.books.map(entry => entry.bookId));
  const books = (id ? catalog.books.filter(book => book.id === id) : catalog.books).filter(book => publishedIds.has(book.id));
  if (id && !catalog.books.some(book => book.id === id)) throw new Error('Unknown catalog ID');
  if (id && !books.length) throw new Error('That catalog book has no published map');
  const manifestPath = resolve(root, 'data/catalog/covers.json');
  const rawManifest = await readJson(manifestPath, emptyManifest);
  let manifest = await upgradeManifest(root, rawManifest, catalog, dryRun);
  if (manifest) {
    if (!dryRun) await writeJson(manifestPath, validateCovers(manifest));
  } else {
    try { manifest = validateCovers(rawManifest); } catch { manifest = structuredClone(emptyManifest); }
  }
  const authenticatedToken = await githubToken(token);
  if (!authenticatedToken) throw new Error('GitHub authentication is required. Set GITHUB_TOKEN (or GH_TOKEN), or run gh auth login.');
  let requests = 0;
  const request = async (path, { allow404 = false } = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try { requests++; response = await fetchImpl(`${apiRoot}${path}`, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${authenticatedToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'austen-cover-importer' } }); }
      catch (error) { if (attempt === 2) throw new Error(`GitHub request failed: ${error.message}`); await wait(1000 * 2 ** attempt); continue; }
      if (response.ok || allow404 && response.status === 404) return response;
      const body = await response.text().catch(() => '');
      if (apiError(response)) throw fatalGithubError(`GitHub authentication or rate limit error (HTTP ${response.status}): ${body.slice(0, 200)}`);
      if (response.status < 500 || attempt === 2) throw new Error(`GitHub returned HTTP ${response.status}: ${body.slice(0, 200)}`);
      await wait(Math.min(60000, Math.max(retryDelay(response, now), 1000 * 2 ** attempt)));
    }
  };
  const repositories = new Set();
  for (let page = 1; ; page++) {
    const response = await request(`/orgs/standardebooks/repos?type=public&per_page=100&page=${page}`);
    const entries = await responseJson(response, 'repository list');
    if (!Array.isArray(entries)) throw new Error('Invalid GitHub repository list');
    for (const entry of entries) if (typeof entry?.name === 'string') repositories.add(entry.name);
    if (entries.length < 100) break;
  }
  const save = async () => { if (!dryRun) await writeJson(manifestPath, validateCovers(manifest)); };
  let cached = 0, downloaded = 0, missingRepository = 0, missingCover = 0, failed = 0;
  for (const book of books) {
    const previous = manifest.books[book.id];
    if (!refresh && previous?.status === 'imported' && await storedCoverIsValid(root, book, previous)) { cached++; continue; }
    const repository = standardEbooksRepository(book);
    const record = (status, details = missing()) => { manifest.books[book.id] = { status, ...details, checkedAt: new Date(now()).toISOString() }; };
    if (!repositories.has(repository)) { record('missing_repository'); missingRepository++; await save(); continue; }
    try {
      const content = await request(`/repos/standardebooks/${encodeURIComponent(repository)}/contents/images/cover.jpg?ref=master`, { allow404: true });
      if (content.status === 404) { record('missing_cover'); missingCover++; await save(); continue; }
      const entry = await responseJson(content, 'cover metadata');
      if (typeof entry?.sha !== 'string' || !/^[a-f0-9]{40}$/.test(entry.sha) || !Number.isSafeInteger(entry.size) || entry.size <= 0 || entry.size > maxSourceBytes) throw new Error('Unexpected cover metadata');
      if (previous?.status === 'imported' && previous.sourceSha === entry.sha && await storedCoverIsValid(root, book, previous)) { cached++; continue; }
      if (dryRun) { downloaded++; continue; }
      const blob = await request(`/repos/standardebooks/${encodeURIComponent(repository)}/git/blobs/${entry.sha}`);
      const data = await responseJson(blob, 'cover blob');
      if (data?.encoding !== 'base64' || typeof data.content !== 'string') throw new Error('Unexpected cover blob');
      const source = Buffer.from(data.content.replace(/\s/g, ''), 'base64');
      if (source.length !== entry.size) throw new Error('Cover blob size does not match metadata');
      if (!validJpeg(source)) throw new Error('Cover blob is not a JPEG image');
      const asset = await normalizeJpeg(source);
      const sourceHash = hash(asset);
      await atomicWrite(resolve(root, coverAssetPath(book)), asset);
      record('imported', imported(book, repository, entry.sha, sourceHash)); downloaded++; await save();
    } catch (error) {
      if (error.fatal) throw error;
      failed++;
      if (!(previous?.status === 'imported' && await storedCoverIsValid(root, book, previous))) record('failed');
      log(`Cover import failed for ${book.id}: ${error.message}`); await save();
    }
  }
  const summary = { published: books.length, cached, downloaded, missingRepository, missingCover, failed, requests, dryRun };
  log(JSON.stringify(summary, null, 2));
  return summary;
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { id: { type: 'string' }, refresh: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } } });
  withLock(ROOT, () => syncCovers({ id: values.id, refresh: values.refresh, dryRun: values['dry-run'] })).then(summary => { if (summary.failed) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
