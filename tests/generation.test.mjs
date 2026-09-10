import test from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import { decompressShare } from '../shared/bounded-lz.mjs';
import { generateDiagram, ProviderError, classifyResponse, DEFAULT_MODEL } from '../shared/generation.mjs';
import { validateDiagram } from '../shared/diagram-policy.mjs';
import { runBatch, parseBatchArgs } from '../scripts/generate-maps.mjs';
import { readJson } from '../scripts/files.mjs';
import { fixtureRoot, graph, svg, success } from './helpers.mjs';
test('CLI defaults to dry run and --run explicitly enables execution', () => {
  assert.equal(parseBatchArgs([]).dryRun, true);
  assert.equal(parseBatchArgs(['--run']).dryRun, false);
  assert.equal(parseBatchArgs(['--run', '--dry-run']).dryRun, true);
});
test('provider request is metadata-only, includes legacy year, disables thinking, caps tokens', async () => {
  const result = await generateDiagram({ title: 'Example', authors: ['Author'], publishYear: 1813, description: 'DO NOT SEND', ebookUrl: 'https://example.org/secret' }, { apiKey: 'fixture-secret', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions'); const body = JSON.parse(options.body);
    assert.equal(body.model, DEFAULT_MODEL); assert.equal(body.max_tokens, 1200); assert.equal(body.temperature, .2); assert.deepEqual(body.thinking, { type: 'disabled' }); assert.equal(body.tools, undefined);
    assert.ok(options.body.includes('1813')); assert.ok(!options.body.includes('DO NOT SEND')); assert.ok(!options.body.includes('example.org'));
    return Response.json({ choices: [{ message: { content: graph }, finish_reason: 'stop' }], model: 'reported-model', usage: { total_tokens: 80 } });
  } });
  assert.equal(result.outcome, 'candidate'); assert.equal(result.reportedModel, 'reported-model');
  assert.equal(classifyResponse({ choices: [{ message: { content: 'UNKNOWN' }, finish_reason: 'stop' }] }).outcome, 'unknown_work');
  assert.equal(classifyResponse({ choices: [{ message: { content: graph }, finish_reason: 'length' }] }).outcome, 'invalid_graph');
});
test('unsafe directives, HTML and overlarge graphs fail', () => {
  for (const source of [graph + '\nclick A "javascript:alert(1)"', '%%{init: {}}%%\n' + graph, graph.replace('Elizabeth Bennet', '<img src=x>'), 'x'.repeat(12001), graph + '\nstyle A fill:red']) assert.throws(() => validateDiagram(source));
});
test('provider classifies auth, 429, and timeouts without exposing raw errors', async () => {
  await assert.rejects(generateDiagram({ title: 'Book', authors: [] }, { apiKey: 'key', fetchImpl: async () => new Response('secret raw upstream error', { status: 401 }) }), e => e.fatal && !e.message.includes('secret'));
  await assert.rejects(generateDiagram({ title: 'Book', authors: [] }, { apiKey: 'key', fetchImpl: async () => new Response('', { status: 429, headers: { 'Retry-After': '2' } }) }), e => e.retryable && e.retryAfterMs === 2000);
  await assert.rejects(generateDiagram({ title: 'Book', authors: [] }, { apiKey: 'key', timeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))) }), e => e.code === 'timeout' && e.retryable);
});
test('received results persist before rendering; restart retries renderer without spending; valid results skip', async t => {
  const { root, path } = await fixtureRoot(t); let calls = 0;
  await runBatch({ root, dryRun: false, provider: async () => { calls++; return success(); }, renderer: async () => { assert.equal((await readJson(path)).outcome, 'candidate'); throw new Error('renderer crashed'); } });
  assert.equal((await readJson(path)).outcome, 'render_failed');
  await runBatch({ root, dryRun: false, provider: () => { throw new Error('must not generate'); }, renderer: async () => svg });
  assert.equal((await readJson(path)).outcome, 'valid');
  await runBatch({ root, dryRun: false, provider: () => { throw new Error('must skip'); } }); assert.equal(calls, 1);
});
test('UNKNOWN is terminal; syntax gets one extra attempt; retries and request budget are bounded', async t => {
  const a = await fixtureRoot(t); let calls = 0;
  await runBatch({ root: a.root, dryRun: false, provider: async () => { calls++; return { ...success(), outcome: 'unknown_work', mermaid: null }; } });
  await runBatch({ root: a.root, dryRun: false, provider: () => { throw new Error('UNKNOWN must skip'); } }); assert.equal(calls, 1);
  const b = await fixtureRoot(t); calls = 0;
  await runBatch({ root: b.root, dryRun: false, provider: async () => { calls++; return { ...success(), outcome: 'invalid_graph', mermaid: 'invalid' }; }, sleep: async () => {} }); assert.equal(calls, 2);
  const c = await fixtureRoot(t); calls = 0;
  await runBatch({ root: c.root, dryRun: false, maxRequests: 2, provider: async () => { calls++; throw new ProviderError('provider_error', { retryable: true, retryAfterMs: 3000 }); }, sleep: async delay => assert.ok(delay >= 3000) }); assert.equal(calls, 2);
});
test('interruption is recorded before request and ordinary restart does not spend again; auth stops batch', async t => {
  const { root, path } = await fixtureRoot(t);
  await assert.rejects(runBatch({ root, dryRun: false, provider: async () => { assert.equal((await readJson(path)).attempts[0].outcome, 'requesting'); throw new Error('process interruption'); } }));
  assert.equal((await readJson(path)).outcome, 'interrupted');
  await runBatch({ root, dryRun: false, provider: () => { throw new Error('must skip uncertain request'); } });
const b = await fixtureRoot(t);
  await assert.rejects(runBatch({ root: b.root, dryRun: false, provider: async () => { throw new ProviderError('provider_error', { fatal: true, status: 402 }); } }), /Batch stopped/);
  assert.equal((await readJson(b.path)).attempts.length, 1);
});

test('bounded decoder preserves LZ-String compatibility and rejects compressed expansion', () => {
  for (const value of ['a', 'é'.repeat(100), JSON.stringify({ title: 'ドラキュラ', graph }), 'a'.repeat(40000)]) assert.equal(decompressShare(LZString.compressToEncodedURIComponent(value)), value);
  assert.throws(() => decompressShare(LZString.compressToEncodedURIComponent('a'.repeat(40001))), /size limit/);
  assert.throws(() => decompressShare('B'));
});
