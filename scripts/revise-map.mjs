import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validateCatalog, cleanText } from '../shared/books.mjs';
import { validateDiagram } from '../shared/diagram-policy.mjs';
import { nextRevision } from './generate-maps.mjs';
import { validateRevision } from './validate-maps.mjs';
import { ROOT, hash, readJson, writeJson, withLock, isMain } from './files.mjs';
export async function reviseMap({ root = ROOT, id, from, source, editor, notes, renderer } = {}) {
  if (!/^v[1-9]\d*$/.test(from) || !cleanText(editor) || !cleanText(notes)) throw new Error('Specify --from vN --editor NAME --notes TEXT');
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json'))), book = catalog.books.find(b => b.id === id);
  if (!book) throw new Error('Unknown catalog ID');
  const parent = await readJson(resolve(root, 'data/maps', book.slug, `${from}.json`));
  if (parent.bookId !== id || parent.schemaVersion !== 1 || parent.revision !== from || !parent.mermaid || parent.mermaidHash !== hash(parent.mermaid)) throw new Error('Invalid parent revision');
  const mermaid = validateDiagram(await readFile(source, 'utf8')).source;
  const revisionName = `v${await nextRevision(root, book.slug)}`, path = resolve(root, 'data/maps', book.slug, `${revisionName}.json`);
  const revision = { ...parent, revision: revisionName, createdAt: new Date().toISOString(), origin: { type: 'local_edit', parentRevision: from, parentMermaidHash: parent.mermaidHash, editor: cleanText(editor), notes: cleanText(notes), editedAt: new Date().toISOString() }, mermaid, mermaidHash: hash(mermaid), outcome: 'candidate', validation: { status: 'pending' } };
  await writeJson(path, revision); return validateRevision(path, { renderer });
}
if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { id: { type: 'string' }, from: { type: 'string' }, source: { type: 'string' }, editor: { type: 'string' }, notes: { type: 'string' } } });
  withLock(ROOT, () => reviseMap(values)).then(r => console.log(`${r.revision}: ${r.outcome}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
