import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateCatalog } from '../../shared/books.mjs'
import { savedCoverSlug, validateCovers } from '../../shared/covers.mjs'
import { loadPublishedMaps } from './published-maps.mjs'
export interface Book {
	id: string
	slug: string
	title: string
	authors: string[]
	year: string | null
	category: string
	ebookUrl: string
	coverSlug?: string
}
export interface CatalogEntry extends Book {
	publishedUrl: string | null
	availability: string
	mapStatus: 'available' | 'unavailable'
}

const featuredSlugs = [
	'jane-austen-pride-and-prejudice',
	'f-scott-fitzgerald-the-great-gatsby',
	'charlotte-bronte-jane-eyre',
	'emily-bronte-wuthering-heights',
	'homer-the-odyssey-william-cullen-bryant',
	'fyodor-dostoevsky-crime-and-punishment-constance-garnett',
	'herman-melville-moby-dick',
	'lewis-carroll-alices-adventures-in-wonderland-john-tenniel',
]

export function featuredMaps(entries: CatalogEntry[]) {
	const published = entries.filter((book) => book.publishedUrl)
	const bySlug = new Map(published.map((book) => [book.slug, book]))
	const featured = featuredSlugs.flatMap((slug) => {
		const book = bySlug.get(slug)
		return book ? [book] : []
	})
	const selected = new Set(featured.map((book) => book.id))
	return [
		...featured,
		...published.filter((book) => !selected.has(book.id)),
	].slice(0, 8)
}

export async function loadLibrary(root = process.cwd()) {
	const catalog = validateCatalog(
		JSON.parse(
			await readFile(resolve(root, 'data/catalog/books.json'), 'utf8'),
		),
	)
	const covers = validateCovers(
		JSON.parse(
			await readFile(resolve(root, 'data/catalog/covers.json'), 'utf8').catch(
				() => '{"schemaVersion":4,"books":{}}',
			),
		),
	)
	const { maps } = await loadPublishedMaps(root, catalog)
	for (const map of maps)
		map.book = { ...map.book, coverSlug: savedCoverSlug(map.book, covers) }
	const available = new Map(maps.map((map) => [map.book.id, map]))
	const entries: CatalogEntry[] = []
	for (const book of catalog.books as Book[]) {
		const map = available.get(book.id)
		entries.push({
			...book,
			coverSlug: savedCoverSlug(book, covers),
			publishedUrl: map
				? `${import.meta.env.BASE_URL}books/${book.slug}/`
				: null,
			mapStatus: map ? 'available' : 'unavailable',
			availability: map
				? map.review.mode === 'automatic'
					? 'AI-generated map'
					: 'Reviewed map'
				: 'No published map · generate one',
		})
	}
	return { catalog, entries, maps }
}
