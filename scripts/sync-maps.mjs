import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validateCatalog } from '../shared/books.mjs';
import { DEFAULT_MODEL, generateDiagram, MAX_OUTPUT_TOKENS } from '../shared/generation.mjs';
import { createGenerationRevision, requestRevision } from './generate-maps.mjs';
import { MAX_BOOK_ATTEMPTS, readBookRecords, countAttempts, nextAction } from './map-records.mjs';
import { createPublisher } from './publish-map.mjs';
import { preflightRenderer, renderSvg, validateRevision } from './validate-maps.mjs';
import { ROOT, readJson, writeJson, withLock, isMain } from './files.mjs';

const addUsage = (totals, usage) => {
  for (const [key, count] of Object.entries(usage || {})) if (Number.isSafeInteger(count) && count >= 0) totals[key] = (totals[key] || 0) + count;
};

export async function syncMaps({ root = ROOT, ids = [], passes = 5, dryRun = true, maxRequests = Infinity,
  model = DEFAULT_MODEL, apiKey = process.env.DEEPSEEK_API_KEY, provider = generateDiagram,
  renderer = renderSvg, preflight = preflightRenderer, sleep = ms => new Promise(r => setTimeout(r, ms)), random = Math.random, log = console.log } = {}) {
  if (!Number.isInteger(passes) || passes < 1 || passes > 5) throw new Error('Use 1–5 passes');
  if (maxRequests !== Infinity && (!Number.isSafeInteger(maxRequests) || maxRequests < 1)) throw new Error('max-requests must be a positive integer');
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json')));
  if (ids.some(id => !catalog.books.some(book => book.id === id))) throw new Error('Unknown catalog ID');
  const publisher = await createPublisher(root, catalog);
  const all = [];
  for (const book of catalog.books) all.push({ book, records: await readBookRecords(root, book) });
  const items = all.filter(item => !ids.length || ids.includes(item.book.id));
  const existingPublished = new Set(publisher.pointers.keys());
  const actionFor = item => publisher.pointers.has(item.book.id) ? { action: 'reuse' } : nextAction(item.records);
  const plan = items.map(item => ({ id: item.book.id, action: actionFor(item).action, attempts: countAttempts(item.records) }));
  const maximumRequests = Math.min(maxRequests, plan.reduce((sum, item) => sum + (['generate', 'validate'].includes(item.action) ? Math.min(passes, Math.max(0, MAX_BOOK_ATTEMPTS - item.attempts)) : 0), 0));
  log(JSON.stringify({ dryRun, books: items.length, passes, maximumRequests, maximumOutputTokens: maximumRequests * MAX_OUTPUT_TOKENS, inputExposure: 'Each request sends the fixed prompt and title/authors/year. Actual input tokens depend on the provider tokenizer.', ...(dryRun ? { plan } : {}) }, null, 2));
  if (dryRun) return { plan, requests: 0, maximumRequests };

  let requests = 0;
  const actualUsage = {};
  let summary;
  // A provider cooldown applies across books and survives restarting or targeting another ID.
  let retryAt = Math.max(0, ...all.flatMap(item => item.records.flatMap(r => r.revision.attempts.map(a => Date.parse(a.retryAt || '') || 0))));
  async function waitForProvider() {
    let remaining = Math.max(0, retryAt - Date.now());
    while (remaining > 0) {
      const chunk = Math.min(30000, remaining);
      log(`Provider cooldown: waiting ${Math.ceil(remaining / 1000)}s before another request.`);
      await sleep(chunk); remaining -= chunk;
    }
    retryAt = 0;
  }
  async function finishCandidate(item, record) {
    record.revision = await validateRevision(record.path, { renderer });
    if (record.revision.outcome === 'valid') await publisher.publish(item.book, record.revision.revision);
    if (record.revision.outcome === 'render_failed') throw new Error(`Rendering stopped for ${item.book.id}: ${record.revision.validation.error}. Fix the browser setup and rerun maps:sync; the saved graph will be reused.`);
  }
  try {
    if (maximumRequests && provider === generateDiagram && (!apiKey || apiKey === 'your-deepseek-api-key')) throw new Error('Configure DEEPSEEK_API_KEY in .env before running a paid batch.');
    if (plan.some(item => ['generate', 'validate'].includes(item.action))) await preflight({ renderer });

    // Recover interrupted validation/publication before spending on any new graphs.
    for (const item of items) {
      const { action, record } = actionFor(item);
      if (action === 'publish') await publisher.publish(item.book, record.revision.revision);
      if (action === 'validate') await finishCandidate(item, record);
      if (['publish', 'validate'].includes(action)) log(`${item.book.id}: ${actionFor(item).action === 'reuse' ? 'published saved map' : 'saved graph needs another generation attempt'}`);
    }

    for (let pass = 1; pass <= passes && requests < maxRequests; pass++) {
      let attempted = false;
      for (let index = 0; index < items.length && requests < maxRequests; index++) {
        const item = items[index];
        if (actionFor(item).action !== 'generate') continue;
        await waitForProvider();
        const version = Number(item.records.at(-1)?.revision.revision.slice(1) || 0) + 1;
        const revision = createGenerationRevision(item.book, version, model);
        const record = { revision, path: resolve(root, 'data/maps', item.book.slug, `${revision.revision}.json`) };
        item.records.push(record); requests++; attempted = true;
        log(`[Pass ${pass}/${passes}, book ${index + 1}/${items.length}] ${item.book.id}: requesting (attempt ${countAttempts(item.records) + 1}/${MAX_BOOK_ATTEMPTS})`);
        const journal = await requestRevision(record.path, revision, { provider, apiKey, model });
        addUsage(actualUsage, journal.usage);
        if (journal.fatal) throw new Error('Batch stopped: provider credentials, credits, or model configuration need attention. Fix the configuration and rerun maps:sync.');
        if (journal.retryable) {
          retryAt = Math.max(Date.parse(journal.retryAt || '') || 0, Date.now() + Math.min(8000, 1000 * 2 ** (countAttempts(item.records) - 1)) + Math.floor(random() * 500));
          journal.retryAt = new Date(retryAt).toISOString();
          await writeJson(record.path, revision);
        }
        if (revision.outcome === 'candidate') await finishCandidate(item, record);
        log(`${item.book.id}: ${record.revision.outcome}${publisher.pointers.has(item.book.id) ? ' · published' : ''}`);
      }
      if (!attempted) break;
    }
  } finally {
    const counts = { published: 0, reused: 0, unknown: 0, failed: 0, exhausted: 0, pending: 0 };
    const recordedUsage = {};
    for (const item of items) {
      const action = actionFor(item).action;
      if (action === 'reuse') counts[existingPublished.has(item.book.id) ? 'reused' : 'published']++;
      else if (['unknown', 'failed', 'exhausted'].includes(action)) counts[action]++;
      else if (item.records.at(-1)?.revision.outcome === 'render_failed') counts.failed++;
      else counts.pending++;
      for (const record of item.records.filter(r => r.revision.origin?.type !== 'local_edit')) for (const attempt of record.revision.attempts) addUsage(recordedUsage, attempt.usage);
    }
    summary = { ...counts, requests, actualUsage, recordedUsage, note: 'Published means automated syntax, rendering and SVG checks passed. Usage includes received responses; interrupted or timed-out requests may also have been processed.' };
    log(JSON.stringify(summary, null, 2));
  }
  return { plan, ...summary };
}

export function parseSyncArgs(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { run: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, passes: { type: 'string' }, id: { type: 'string', multiple: true }, 'max-requests': { type: 'string' } } });
  return { ids: values.id, passes: Number(values.passes ?? 5), dryRun: !values.run || Boolean(values['dry-run']), maxRequests: values['max-requests'] === undefined ? Infinity : Number(values['max-requests']), model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL };
}
if (isMain(import.meta.url)) {
  const main = async () => {
    const options = parseSyncArgs();
    return options.dryRun ? syncMaps(options) : withLock(ROOT, () => syncMaps(options));
  };
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
