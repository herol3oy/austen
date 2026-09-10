import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { graph } from './helpers.mjs';
const request = (book = { title: 'Book', authors: [], publishYear: 1813 }, extra = {}) => new Request('https://worker.example/', { method: 'POST', headers: { Origin: 'http://localhost:4321', 'Content-Type': 'application/json' }, body: JSON.stringify({ book }), ...extra });
const env = { GENERATION_ENABLED: 'true', DEEPSEEK_API_KEY: 'fixture-key', GENERATION_LIMITER: { limit: async () => ({ success: true }) } };
test('Worker preserves successful response, accepts legacy year, returns UNKNOWN distinctly and redacts upstream errors', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => { assert.ok(options.body.includes('1813')); return Response.json({ choices: [{ message: { content: graph }, finish_reason: 'stop' }] }); });
  let response = await worker.fetch(request(), env); assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4321'); assert.equal((await response.json()).mermaid, graph);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ choices: [{ message: { content: 'UNKNOWN' }, finish_reason: 'stop' }] }));
  response = await worker.fetch(request(), env); assert.equal((await response.json()).code, 'UNKNOWN');
  globalThis.fetch.mock.mockImplementation(async () => new Response('sensitive details', { status: 401 }));
  response = await worker.fetch(request(), env); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('sensitive'));
});
test('Worker validates authors and size, rejects origins, honors rate limit and kill switch', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call provider'); });
  assert.equal((await worker.fetch(request({ title: 'Book', authors: 'bad' }), env)).status, 400);
  assert.equal((await worker.fetch(request({ title: 'x'.repeat(5000), authors: [] }), env)).status, 400);
  assert.equal((await worker.fetch(request(undefined, { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
  assert.equal((await worker.fetch(request(), { ...env, GENERATION_ENABLED: 'false' })).status, 503);
  const response = await worker.fetch(request(), { ...env, GENERATION_LIMITER: { limit: async () => ({ success: false }) } }); assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
