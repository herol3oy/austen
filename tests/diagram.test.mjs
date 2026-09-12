import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { load } from 'cheerio';
import { parseDiagram, validateDiagram } from '../shared/diagram-policy.mjs';
import { ROOT, readJson } from '../scripts/files.mjs';

test('parser resolves inline declarations and later labels without reordering or duplicating characters', () => {
  const source = 'graph LR\nA -->|Knows| B[Jane Bennet]\nC["Élizabeth & Anne"]\nA["Elizabeth Bennet"]\nB --> C\nA["Lizzy Bennet"]\nA';
  assert.deepEqual(parseDiagram(source), {
    source,
    nodes: [
      { id: 'A', label: 'Lizzy Bennet' },
      { id: 'B', label: 'Jane Bennet' },
      { id: 'C', label: 'Élizabeth & Anne' },
    ],
    edges: [
      { source: 'A', target: 'B', label: 'Knows' },
      { source: 'B', target: 'C', label: null },
    ],
  });
  assert.deepEqual(validateDiagram(source), { source, characters: 3, edges: 2 });
});

test('parser preserves every directed edge, including reciprocal and repeated relationships', () => {
  const { nodes, edges } = parseDiagram('graph LR\nA["Elizabeth Bennet"]\nB["Fitzwilliam Darcy"]\nA -->|Loves| B\nB -->|Loves| A\nA -->|Marries| B\nA -->|Loves| B');
  assert.equal(nodes.length, 2);
  assert.deepEqual(edges, [
    { source: 'A', target: 'B', label: 'Loves' },
    { source: 'B', target: 'A', label: 'Loves' },
    { source: 'A', target: 'B', label: 'Marries' },
    { source: 'A', target: 'B', label: 'Loves' },
  ]);
});

test('parser preserves legacy directions, implicit IDs, fences and whitespace support', () => {
  for (const direction of ['LR', 'RL', 'TD', 'TB', 'BT']) {
    const raw = `\n\x60\x60\x60mermaid\ngraph ${direction}\n  A --> B  \n\x60\x60\x60\n`;
    assert.deepEqual(parseDiagram(raw, { legacy: true }), {
      source: `graph ${direction}\n  A --> B`,
      nodes: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
      edges: [{ source: 'A', target: 'B', label: null }],
    });
    if (direction !== 'LR') assert.throws(() => parseDiagram(raw), /Use graph LR/);
  }
});

test('parser and validator reject unsupported syntax and enforce the existing size limits', () => {
  const valid = 'graph LR\nA["Elizabeth Bennet"] -->|Sister of| B["Jane Bennet"]';
  for (const source of [
    '', 'x'.repeat(12001), 'graph LR\nA', 'graph LR\nA\nB', 'graph LR\r\nA --> B',
    valid + '\nC --> D --> E', valid + '\nsubgraph Group',
    valid.replace('Elizabeth Bennet', '<img src=x>'),
    valid + '\nclick A "javascript:alert(1)"', '%%{init: {}}%%\n' + valid,
    valid + '\nstyle A fill:red', valid + '\nA -->|Knows|',
    'graph LR\n' + Array.from({ length: 21 }, (_, i) => `C${i}["Character ${i}"]`).join('\n') + '\nC0 --> C1',
    'graph LR\n' + Array.from({ length: 41 }, () => 'A --> B').join('\n'),
  ]) {
    assert.throws(() => parseDiagram(source));
    assert.throws(() => validateDiagram(source));
  }
});

test('every published graph has complete character and relationship extraction matching its SVG', async () => {
  const catalog = await readJson(resolve(ROOT, 'data/catalog/books.json'));
  const published = await readJson(resolve(ROOT, 'data/published.json'));
  const books = new Map(catalog.books.map(book => [book.id, book]));
  const examples = new Map([
    ['jane-austen-pride-and-prejudice', ['Elizabeth Bennet', 'Fitzwilliam Darcy']],
    ['f-scott-fitzgerald-the-great-gatsby', ['Nick Carraway', 'Jay Gatsby', 'Daisy Buchanan']],
    ['bram-stoker-dracula', ['Jonathan Harker', 'Mina Murray', 'Count Dracula']],
  ]);
  for (const pointer of published.books) {
    const book = books.get(pointer.bookId);
    const prefix = resolve(ROOT, 'data/maps', book.slug, pointer.revision);
    const revision = await readJson(`${prefix}.json`);
    const { nodes, edges } = parseDiagram(revision.mermaid);
    const $ = load(await readFile(`${prefix}.svg`, 'utf8'), { xml: true });
    assert.equal(nodes.length, $('.nodes .node').length, `${book.slug}: characters`);
    assert.equal(edges.length, $('.edgePaths .flowchart-link').length, `${book.slug}: relationships`);
    const ids = new Set(nodes.map(node => node.id));
    assert.equal(ids.size, nodes.length, `${book.slug}: unique character IDs`);
    assert.ok(edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), `${book.slug}: named endpoints`);
    for (const name of examples.get(book.slug) ?? []) {
      assert.ok(nodes.some(node => node.label === name), `${book.slug}: ${name}`);
    }
  }
});
