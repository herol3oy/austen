import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generationMetadata, validateCatalog, cleanText } from '../shared/books.mjs';
import { validateDiagram } from '../shared/diagram-policy.mjs';
import { validateSvg } from './validate-maps.mjs';
import { ROOT, hash, readJson, writeJson, withLock, isMain } from './files.mjs';
export async function verifyArtifact(root, book, revisionName) {
  if (!/^v[1-9]\d*$/.test(revisionName)) throw new Error('Invalid revision name');
  const path = resolve(root, 'data/maps', book.slug, `${revisionName}.json`), raw = await readFile(path, 'utf8'), revision = JSON.parse(raw);
  if (revision.schemaVersion !== 1 || revision.bookId !== book.id || revision.revision !== revisionName || revision.outcome !== 'valid' || revision.validation?.status !== 'valid' || !Number.isFinite(Date.parse(revision.generatedAt))) throw new Error('Revision is not valid for this book');
  generationMetadata(revision.metadata);
  if (revision.inputHash !== hash(JSON.stringify(revision.metadata)) || revision.mermaidHash !== hash(revision.mermaid) || revision.validation.mermaidHash !== revision.mermaidHash) throw new Error('Revision hash mismatch');
  validateDiagram(revision.mermaid);
  const svg = await readFile(path.replace(/\.json$/, '.svg'), 'utf8'); validateSvg(svg);
  if (hash(svg) !== revision.validation.svgHash) throw new Error('SVG hash mismatch');
  return { revision, svg, revisionHash: hash(raw) };
}

export function validatePublicationManifest(published) {
  if (published?.schemaVersion !== 1 || !Array.isArray(published.books)) throw new Error('Invalid publication manifest');
  const seen = new Set();
  for (const pointer of published.books) {
    if (!pointer || typeof pointer.bookId !== 'string' || seen.has(pointer.bookId) || !/^v[1-9]\d*$/.test(pointer.revision) || !/^[a-f0-9]{64}$/.test(pointer.revisionHash) || !/^[a-f0-9]{64}$/.test(pointer.svgHash)) throw new Error('Invalid publication pointer');
    if (!Array.isArray(pointer.checks) || pointer.checks.some(c => typeof c !== 'string')) throw new Error('Invalid publication checks');
    seen.add(pointer.bookId);
    if (pointer.mode === 'automatic') {
      if (!Number.isFinite(Date.parse(pointer.publishedAt)) || !['source', 'render', 'svg'].every(c => pointer.checks?.includes(c)) || pointer.reviewer || pointer.reviewedAt) throw new Error('Invalid automatic publication');
    } else if (pointer.mode == null || pointer.mode === 'manual') {
      if (!cleanText(pointer.reviewer) || !cleanText(pointer.notes) || !Number.isFinite(Date.parse(pointer.reviewedAt)) || !['work', 'characters', 'relationships', 'directions', 'readability'].every(c => pointer.checks?.includes(c))) throw new Error('Invalid publication approval');
    } else throw new Error('Unknown publication mode');
  }
  return published;
}

export async function loadPublishedMaps(root, catalog) {
  const published = validatePublicationManifest(await readJson(resolve(root, 'data/published.json'), { schemaVersion: 1, books: [] }));
  const books = new Map(catalog.books.map(book => [book.id, book]));
  const maps = [];
  for (const pointer of published.books) {
    const book = books.get(pointer.bookId);
    if (!book) throw new Error('Published book is missing from catalog');
    const artifact = await verifyArtifact(root, book, pointer.revision);
    if (artifact.revisionHash !== pointer.revisionHash || artifact.revision.validation.svgHash !== pointer.svgHash) throw new Error('Published artifact changed after publication');
    maps.push({ book, ...artifact, review: pointer });
  }
  return { published, maps };
}

// Call under the maintenance lock. Keep one manifest in memory for a serial batch.
export async function createPublisher(root, catalog) {
  const { published, maps } = await loadPublishedMaps(root, catalog);
  const pointers = new Map(published.books.map(pointer => [pointer.bookId, pointer]));
  return {
    pointers, maps,
    async publish(book, revision, { reviewed = false, reviewer, notes } = {}) {
      if (reviewed && (!cleanText(reviewer) || !cleanText(notes))) throw new Error('Manual review requires --reviewer NAME --notes TEXT');
      const artifact = await verifyArtifact(root, book, revision);
      const existing = pointers.get(book.id);
      if (existing?.revision === revision) {
        if (existing.revisionHash !== artifact.revisionHash || existing.svgHash !== artifact.revision.validation.svgHash) throw new Error('Published artifact changed after publication');
        if (!reviewed || existing.mode !== 'automatic') return existing;
      }
      const now = new Date().toISOString();
      const pointer = { bookId: book.id, revision, revisionHash: artifact.revisionHash, svgHash: artifact.revision.validation.svgHash, publishedAt: now,
        ...(reviewed ? { mode: 'manual', reviewedAt: now, reviewer: cleanText(reviewer), notes: cleanText(notes), checks: ['work', 'characters', 'relationships', 'directions', 'readability'] } : { mode: 'automatic', checks: ['source', 'render', 'svg'] }) };
      const books = [...published.books.filter(p => p.bookId !== book.id), pointer];
      await writeJson(resolve(root, 'data/published.json'), { ...published, books });
      published.books = books; pointers.set(book.id, pointer);
      return pointer;
    },
  };
}

export async function publishMap({ root = ROOT, id, revision, reviewer, notes, reviewed = false } = {}) {
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json')));
  const book = catalog.books.find(b => b.id === id);
  if (!book) throw new Error('Unknown catalog ID');
  return (await createPublisher(root, catalog)).publish(book, revision, { reviewer, notes, reviewed });
}
if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { id: { type: 'string' }, revision: { type: 'string' }, reviewer: { type: 'string' }, notes: { type: 'string' }, reviewed: { type: 'boolean' } } });
  withLock(ROOT, () => publishMap(values)).then(p => console.log(`Published ${p.bookId} ${p.revision}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
