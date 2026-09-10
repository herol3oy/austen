import { load } from 'cheerio';
import { resolve } from 'node:path';
import { canonicalEdition, cleanText, SOURCE_URL, validateCatalog } from '../shared/books.mjs';
import { readLimitedText } from '../shared/generation.mjs';
import { ROOT, hash, readJson, writeJson, withLock, isMain } from './files.mjs';

export function parseCatalog(html, previous = null, { minimumEntries = 1000, fetchedAt = new Date().toISOString() } = {}) {
  const $ = load(html); const terms = $('dl dt');
  if (terms.length < minimumEntries || terms.length !== $('dt').length || terms.length !== $('dl dd').length) throw new Error('Unexpected Sudalyph definition-list structure');
  const previousSlugs = new Map(previous?.books.map(b => [b.id, b.slug]) || []);
  const reservedSlugs = new Map(previous?.books.map(b => [b.slug, b.id]) || []);
  const books = terms.toArray().map(element => {
    const term = $(element), link = term.find('a').filter((_, a) => $(a).find('i').length > 0);
    if (link.length !== 1 || term.find('strong').length !== 1) throw new Error('Unexpected title/author markup');
    const { id, ebookUrl } = canonicalEdition(link.attr('href'));
    const title = cleanText(link.text()), author = cleanText(term.find('strong').text());
    const tail = cleanText(term.text());
    const categoryMatch = tail.match(/\[([^\]]+)\]\s*$/u);
    if (!categoryMatch || !title) throw new Error('Missing title/category');
    // Only metadata following the title link; descriptions are never read.
    const afterTitle = cleanText(term.clone().find('a, strong').remove().end().text());
    const yearMatch = afterTitle.match(/\(([^()]+)\)\s*\[/u);
    const year = yearMatch ? cleanText(yearMatch[1]) : null;
    const metadataWarnings = [];
    if (!author) metadataWarnings.push('missing_author');
    if (!year) metadataWarnings.push('missing_year');
    else if (!/^\d{3,4}(?:[–-]\d{3,4})?$/.test(year)) metadataWarnings.push('unusual_year');
    if (id.split('/')[0].includes('_')) metadataWarnings.push('possible_omitted_coauthors');
    const sourceAnchor = term.find('[id]').first().attr('id') || null;
    if (!sourceAnchor) metadataWarnings.push('missing_anchor');
    const slug = previousSlugs.get(id) || id.replace(/[/_]/g, '-');
    if (reservedSlugs.has(slug) && reservedSlugs.get(slug) !== id) throw new Error(`Slug collision: ${slug}`);
    return { id, slug, title, authors: author ? [author] : [], year, category: cleanText(categoryMatch[1]), sourceUrl: SOURCE_URL, sourceAnchor, ebookUrl, metadataWarnings };
  });
  if (previous && books.length < previous.books.length * 0.8) throw new Error('Catalog unexpectedly lost more than 20% of entries');
  const updated = cleanText($('.info').filter((_, e) => $(e).text().includes('Last updated:')).first().text()).match(/Last updated:\s*([^¶]+)/)?.[1]?.trim() || null;
  return validateCatalog({ schemaVersion: 1, sourceUrl: SOURCE_URL, fetchedAt, sourceUpdated: updated, sourceHash: hash(html), books });
}
export function catalogDiff(previous, next) {
  const before = new Map(previous?.books.map(b => [b.id, b]) || []), after = new Set(next.books.map(b => b.id));
  return { additions: next.books.filter(b => !before.has(b.id)).map(b => b.id), changes: next.books.filter(b => before.has(b.id) && JSON.stringify(before.get(b.id)) !== JSON.stringify(b)).map(b => b.id), removals: [...before.keys()].filter(id => !after.has(id)), warnings: next.books.filter(b => b.metadataWarnings.length).map(b => ({ id: b.id, warnings: b.metadataWarnings })) };
}
export async function ingestCatalog({ root = ROOT, fetchImpl = fetch, minimumEntries = 1000 } = {}) {
  const path = resolve(root, 'data/catalog/books.json'); const previous = await readJson(path, null);
  const response = await fetchImpl(SOURCE_URL, { signal: AbortSignal.timeout(30000), redirect: 'error', headers: { Accept: 'text/html' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Sudalyph index unavailable');
  const next = parseCatalog(await readLimitedText(response, 3000000), previous, { minimumEntries });
  console.log(JSON.stringify(catalogDiff(previous, next), null, 2));
  await writeJson(path, next); return next;
}
if (isMain(import.meta.url)) withLock(ROOT, () => ingestCatalog()).catch(error => { console.error(error.message); process.exitCode = 1; });
