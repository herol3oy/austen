import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generationMetadata, validateCatalog, validateSelection } from '../shared/books.mjs';
import { buildGenerationPrompt, generateDiagram, PROMPT_VERSION, DEFAULT_MODEL, MAX_OUTPUT_TOKENS, ProviderError } from '../shared/generation.mjs';
import { VALIDATOR_VERSION } from '../shared/diagram-policy.mjs';
import { validateRevision, RENDERER_VERSION } from './validate-maps.mjs';
import { ROOT, hash, readJson, writeJson, withLock, isMain } from './files.mjs';
export async function nextRevision(root, slug) {
  const dir = resolve(root, 'data/maps', slug);
  const files = await readdir(dir).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
  return Math.max(0, ...files.map(f => Number(f.match(/^v(\d+)\.json$/)?.[1] || 0))) + 1;
}
export function createGenerationRevision(book, version, model = DEFAULT_MODEL) {
  const metadata = generationMetadata(book);
  return { schemaVersion: 1, revision: `v${version}`, bookId: book.id, metadata, inputHash: hash(JSON.stringify(metadata)), promptHash: hash(buildGenerationPrompt(metadata)), promptVersion: PROMPT_VERSION, validatorVersion: VALIDATOR_VERSION, rendererVersion: RENDERER_VERSION, requestedModel: model, createdAt: new Date().toISOString(), outcome: 'interrupted', attempts: [], mermaid: null, mermaidHash: null, validation: { status: 'pending' } };
}

// One provider request, journaled before sending and before any local rendering.
export async function requestRevision(path, revision, { provider = generateDiagram, apiKey, model = revision.requestedModel } = {}) {
  const journal = { attempt: revision.attempts.length + 1, startedAt: new Date().toISOString(), outcome: 'requesting' };
  revision.attempts.push(journal); revision.outcome = 'interrupted';
  await writeJson(path, revision);
  try {
    const result = await provider(revision.metadata, { apiKey, model });
    Object.assign(journal, result, { finishedAt: new Date().toISOString() });
    Object.assign(revision, { outcome: result.outcome, mermaid: result.mermaid, mermaidHash: result.mermaid ? hash(result.mermaid) : null, generatedAt: result.generatedAt, reportedModel: result.reportedModel, usage: result.usage });
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    Object.assign(journal, { outcome: error.code, status: error.status, retryable: error.retryable, fatal: error.fatal, retryAfterMs: error.retryAfterMs, finishedAt: new Date().toISOString(), ...(error.retryAfterMs > 0 ? { retryAt: new Date(Date.now() + error.retryAfterMs).toISOString() } : {}) });
    revision.outcome = 'provider_error';
  }
  await writeJson(path, revision);
  return journal;
}
export async function runBatch({ root = ROOT, ids = [], limit = 5, maxRequests = 60, dryRun = true, regenerate = false, retry = false, model = DEFAULT_MODEL, apiKey = process.env.DEEPSEEK_API_KEY, provider = generateDiagram, renderer, sleep = ms => new Promise(r => setTimeout(r, ms)), random = Math.random } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 60) throw new Error('Limits: 1–50 books, 1–60 requests');
  if ((retry || regenerate) && ids.length !== 1) throw new Error('Retry/regenerate requires exactly one --id');
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json')));
  if (ids.some(id => !catalog.books.some(b => b.id === id))) throw new Error('Unknown catalog ID');
  const selected = ids.length ? catalog.books.filter(book => ids.includes(book.id)).slice(0, limit)
    : validateSelection(await readJson(resolve(root, 'data/catalog/selection.json')), catalog).books.filter(e => e.decision === 'approved').slice(0, limit).map(e => catalog.books.find(b => b.id === e.id));
  const plan = [];
  for (const book of selected) {
    const version = await nextRevision(root, book.slug), latestPath = resolve(root, 'data/maps', book.slug, `v${version - 1}.json`);
    const latest = version > 1 ? await readJson(latestPath) : null;
    const action = regenerate ? 'generate' : latest && ['candidate', 'render_failed'].includes(latest.outcome) ? 'validate' : !latest || (retry && !['valid', 'candidate', 'render_failed'].includes(latest.outcome)) ? 'generate' : 'skip';
    plan.push({ book, version, latestPath, action, existing: latest?.outcome || null });
  }
  const maximumRequests = Math.min(maxRequests, plan.filter(p => p.action === 'generate').length * 3);
  console.log(JSON.stringify({ dryRun, books: plan.map(p => ({ id: p.book.id, action: p.action, existing: p.existing })), maximumRequests, maximumOutputTokens: maximumRequests * MAX_OUTPUT_TOKENS, inputExposure: 'Each request sends only the fixed prompt and title/authors/year; input tokens depend on the provider tokenizer.' }, null, 2));
  if (dryRun) return { plan, requests: 0 };
  if (provider === generateDiagram && !apiKey && plan.some(p => p.action === 'generate')) throw new Error('Configure DEEPSEEK_API_KEY before running a paid batch.');
  let requests = 0; const actualUsage = {};
  for (const item of plan) {
    if (item.action === 'skip') continue;
    if (item.action === 'validate') { await validateRevision(item.latestPath, { renderer }); continue; }
    if (requests >= maxRequests) break;
    const path = resolve(root, 'data/maps', item.book.slug, `v${item.version}.json`);
    const revision = createGenerationRevision(item.book, item.version, model);
    let syntaxRetries = 0;
    for (let attempt = 1; attempt <= 3 && requests < maxRequests; attempt++) {
      requests++;
      const journal = await requestRevision(path, revision, { provider, apiKey, model });
      for (const [key, count] of Object.entries(journal.usage || {})) actualUsage[key] = (actualUsage[key] || 0) + count;
      const fatal = journal.fatal, delay = journal.retryAfterMs || 0;
      const again = revision.outcome === 'invalid_graph' ? syntaxRetries++ === 0 : journal.retryable;
      if (fatal) throw new Error('Batch stopped: provider credentials, credits, or model configuration need attention. See persisted attempt status.');
      if (!again || attempt === 3 || requests >= maxRequests) break;
      // Long Retry-After is respected by stopping, without blocking a maintenance process indefinitely.
      if (delay > 60000) { console.log(`Batch deferred for at least ${delay}ms; use an explicit targeted retry later.`); return { plan, requests, actualUsage, deferredUntil: new Date(Date.now() + delay).toISOString() }; }
      await sleep(Math.max(delay, Math.min(8000, 1000 * 2 ** (attempt - 1)) + Math.floor(random() * 500)));
    }
    if (revision.outcome === 'candidate') await validateRevision(path, { renderer });
  }
  console.log(JSON.stringify({ requests, actualUsage, note: 'Usage reflects received responses; timed-out requests may still have been processed.' }));
  return { plan, requests, actualUsage };
}
export function parseBatchArgs(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { 'dry-run': { type: 'boolean' }, run: { type: 'boolean' }, id: { type: 'string', multiple: true }, limit: { type: 'string' }, 'max-requests': { type: 'string' }, regenerate: { type: 'boolean' }, retry: { type: 'boolean' } } });
  return { ids: values.id, limit: Number(values.limit || 5), maxRequests: Number(values['max-requests'] || 60), dryRun: !values.run || Boolean(values['dry-run']), regenerate: values.regenerate, retry: values.retry, model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL };
}
if (isMain(import.meta.url)) withLock(ROOT, () => runBatch(parseBatchArgs())).catch(error => { console.error(error.message); process.exitCode = 1; });
