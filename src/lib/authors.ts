import type { Book, CatalogEntry } from './library';

export interface AuthorCollection { name: string; slug: string; books: CatalogEntry[] }

const compareText = (a: string, b: string) => a.localeCompare(b, 'en') || (a < b ? -1 : a > b ? 1 : 0);
const compareBooks = (a: CatalogEntry, b: CatalogEntry) => compareText(a.title, b.title) || compareText(a.id, b.id);

export function authorSlug(name: string) {
  const slug = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error(`Cannot create an author slug for ${JSON.stringify(name)}`);
  return slug;
}

export function authorCollections(entries: CatalogEntry[]): AuthorCollection[] {
  const authors = new Map<string, Map<string, CatalogEntry>>();
  for (const book of entries) {
    if (!book.publishedUrl) continue;
    for (const name of new Set(book.authors)) {
      if (!name.trim() || name.trim().toLowerCase() === 'anonymous') continue;
      if (!authors.has(name)) authors.set(name, new Map());
      authors.get(name)!.set(book.id, book);
    }
  }
  const slugs = new Map<string, string>();
  const collections: AuthorCollection[] = [];
  for (const [name, books] of authors) {
    if (books.size < 2) continue;
    const slug = authorSlug(name);
    const existing = slugs.get(slug);
    if (existing !== undefined) throw new Error(`Author slug collision: ${JSON.stringify(existing)} and ${JSON.stringify(name)} both use ${slug}`);
    slugs.set(slug, name);
    collections.push({ name, slug, books: [...books.values()].sort(compareBooks) });
  }
  return collections.sort((a, b) => compareText(a.name, b.name));
}

export function collectionsForBook(book: Pick<Book, 'authors'>, collections: AuthorCollection[]) {
  return collections.filter(author => book.authors.includes(author.name));
}

export function relatedMaps(book: Pick<Book, 'id' | 'authors'>, collections: AuthorCollection[]) {
  const matches = new Map<string, CatalogEntry>();
  for (const author of collectionsForBook(book, collections)) {
    for (const other of author.books) if (other.id !== book.id) matches.set(other.id, other);
  }
  return [...matches.values()].sort(compareBooks).slice(0, 4);
}
