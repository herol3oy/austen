import { loadLibrary } from '../lib/library';
export async function GET() {
  const { entries } = await loadLibrary();
  return Response.json(entries.map(({ id, slug, title, authors, year, eligible, publishedUrl, availability, mapStatus }) => ({ id, slug, title, authors, year, eligible, publishedUrl, availability, mapStatus })));
}
