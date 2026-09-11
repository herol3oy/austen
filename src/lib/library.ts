import { resolve } from 'node:path';
import { validateCatalog } from '../../shared/books.mjs';
import { savedCoverSlug, validateCovers } from '../../shared/covers.mjs';
import { readJson } from '../../scripts/files.mjs';
import { loadPublishedMaps } from '../../scripts/publish-map.mjs';
import { readBookRecords, nextAction } from '../../scripts/map-records.mjs';
export interface Book {
  id: string; slug: string; title: string; authors: string[]; year: string | null; category: string;
  sourceUrl: string; sourceAnchor: string | null; ebookUrl: string; metadataWarnings: string[]; coverSlug?: string;
}
export interface CatalogEntry extends Book { eligible: boolean; publishedUrl: string | null; availability: string; mapStatus: 'available' | 'pending' | 'unavailable' }
export async function loadLibrary(root = process.cwd()) {
  const catalog = validateCatalog(await readJson(resolve(root, 'data/catalog/books.json')));
  const covers = validateCovers(await readJson(resolve(root, 'data/catalog/covers.json'), { schemaVersion: 3, books: {} }));
  const { maps } = await loadPublishedMaps(root, catalog);
  for (const map of maps) map.book = { ...map.book, coverSlug: savedCoverSlug(map.book, covers) };
  const available = new Map(maps.map(map => [map.book.id, map]));
  const entries: CatalogEntry[] = [];
  for (const book of catalog.books as Book[]) {
    const map = available.get(book.id);
    const action = map ? 'available' : nextAction(await readBookRecords(root, book)).action;
    const unavailable = ['unknown', 'exhausted', 'failed'].includes(action);
    entries.push({ ...book, coverSlug: savedCoverSlug(book, covers), eligible: !unavailable, publishedUrl: map ? `${import.meta.env.BASE_URL}books/${book.slug}/` : null,
      mapStatus: map ? 'available' : unavailable ? 'unavailable' : 'pending',
      availability: map ? (map.review.mode === 'automatic' ? 'AI-generated map' : 'Reviewed map') : action === 'unknown' ? 'Character map unavailable' : unavailable ? 'Map unavailable' : 'Map pending · generate a map' });
  }
  return { catalog, entries, maps };
}
