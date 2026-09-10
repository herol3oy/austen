import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishMap, verifyArtifact, validatePublicationManifest } from '../scripts/publish-map.mjs';
import { runBatch } from '../scripts/generate-maps.mjs';
import { validateSvg } from '../scripts/validate-maps.mjs';
import { reviseMap } from '../scripts/revise-map.mjs';
import { readJson } from '../scripts/files.mjs';
import { fixtureRoot, graph, svg, success } from './helpers.mjs';
test('publication is automatic, permits optional review, and detects source/SVG tampering; regeneration preserves the pointer', async t => {
  const { root, book, path } = await fixtureRoot(t);
  await runBatch({ root, dryRun: false, provider: async () => success(), renderer: async () => svg });
  const automatic = await publishMap({ root, id: book.id, revision: 'v1' });
  assert.equal(automatic.mode, 'automatic'); assert.equal(automatic.reviewer, undefined);
  assert.throws(() => validatePublicationManifest({ schemaVersion: 1, books: [{ ...automatic, checks: 'source render svg' }] }), /publication checks/);
  assert.deepEqual(await publishMap({ root, id: book.id, revision: 'v1' }), automatic);
  await assert.rejects(publishMap({ root, id: book.id, revision: 'v1', reviewed: true }), /Manual review requires/);
  await publishMap({ root, id: book.id, revision: 'v1', reviewed: true, reviewer: 'Test fixture reviewer', notes: 'Fixture only; not a public approval.' });
  const before = await readFile(resolve(root, 'data/published.json'), 'utf8');
  await publishMap({ root, id: book.id, revision: 'v1' });
  assert.equal(await readFile(resolve(root, 'data/published.json'), 'utf8'), before);
  await runBatch({ root, dryRun: false, ids: [book.id], regenerate: true, provider: async () => success(), renderer: async () => svg });
  assert.equal(await readFile(resolve(root, 'data/published.json'), 'utf8'), before);
  await writeFile(path.replace('.json', '.svg'), svg.replace('Jane', 'Janet')); await assert.rejects(verifyArtifact(root, book, 'v1'), /hash/);
  await writeFile(path.replace('.json', '.svg'), svg);
  const revision = await readJson(path); revision.mermaid += '\nC["Forged"]'; await writeFile(path, JSON.stringify(revision)); await assert.rejects(verifyArtifact(root, book, 'v1'), /hash/);
});
test('SVG policy rejects active content, event handlers, external references and invalid dimensions', () => {
  for (const bad of [svg.replace('<g>', '<g onload="alert(1)">'), svg.replace('<g>', '<script>alert(1)</script><g>'), svg.replace('<g>', '<foreignObject></foreignObject><g>'), svg.replace('<g>', '<g style="fill:url(https://example.org/a)">'), svg.replace('<g>', '<g style="fill:u&#114;l(https://example.org/a)">'), svg.replace('300 100', '0 0')]) assert.throws(() => validateSvg(bad));
  assert.deepEqual(validateSvg(svg), { width: 300, height: 100 });
});

test('local corrections create a new attributed revision and leave the parent intact', async t => {
  const { root, book, path } = await fixtureRoot(t);
  await runBatch({ root, dryRun: false, provider: async () => success(), renderer: async () => svg });
  const before = await readFile(path, 'utf8'), source = resolve(root, 'correction.mmd'); await writeFile(source, graph.replace('Sister of', 'Sisters'));
  const revised = await reviseMap({ root, id: book.id, from: 'v1', source, editor: 'Fixture editor', notes: 'Test correction', renderer: async () => svg });
  assert.equal(revised.revision, 'v2'); assert.equal(revised.origin.type, 'local_edit'); assert.equal(revised.origin.parentRevision, 'v1'); assert.equal(revised.outcome, 'valid'); assert.equal(await readFile(path, 'utf8'), before);
});
