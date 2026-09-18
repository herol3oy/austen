import { compareBooks, compareText } from './authors'
import type { Book, CatalogEntry } from './library'
import { slugify } from './slug'

export interface TaxonomyCollection {
	name: string
	slug: string
	books: CatalogEntry[]
}

export interface EraKey {
	name: string
	slug: string
	startYear: number
}

export const UNCATEGORIZED = 'Uncategorized'
export const UNKNOWN_ERA = 'Publication year unknown'

const YEAR_PATTERN = /\d{4}/

function ordinalCentury(value: number) {
	if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
	switch (value % 10) {
		case 1:
			return `${value}st`
		case 2:
			return `${value}nd`
		case 3:
			return `${value}rd`
		default:
			return `${value}th`
	}
}

export function eraKeyFor(year: string | null): EraKey {
	const match = year?.match(YEAR_PATTERN)
	if (!match)
		return {
			name: UNKNOWN_ERA,
			slug: slugify(UNKNOWN_ERA),
			startYear: Number.POSITIVE_INFINITY,
		}
	const century = Math.floor(Number(match[0]) / 100)
	const name = `${ordinalCentury(century + 1)} century`
	return { name, slug: slugify(name), startYear: century * 100 }
}

function eraStartYear(name: string) {
	if (name === UNKNOWN_ERA) return Number.POSITIVE_INFINITY
	const century = Number(name.match(/\d+/)?.[0])
	return Number.isFinite(century)
		? (century - 1) * 100
		: Number.POSITIVE_INFINITY
}

function taxonomyCollections(
	entries: CatalogEntry[],
	nameFor: (book: Book) => string,
): TaxonomyCollection[] {
	const groups = new Map<string, Map<string, CatalogEntry>>()
	for (const book of entries) {
		if (!book.publishedUrl) continue
		const name = nameFor(book)
		if (!groups.has(name)) groups.set(name, new Map())
		groups.get(name)?.set(book.id, book)
	}
	const slugs = new Map<string, string>()
	const collections: TaxonomyCollection[] = []
	for (const [name, books] of groups) {
		const slug = slugify(name)
		const existing = slugs.get(slug)
		if (existing !== undefined)
			throw new Error(
				`Taxonomy slug collision: ${JSON.stringify(existing)} and ${JSON.stringify(name)} both use ${slug}`,
			)
		slugs.set(slug, name)
		collections.push({
			name,
			slug,
			books: [...books.values()].sort(compareBooks),
		})
	}
	return collections
}

export function genreCollections(
	entries: CatalogEntry[],
): TaxonomyCollection[] {
	return taxonomyCollections(
		entries,
		(book) => book.category.trim() || UNCATEGORIZED,
	).sort((a, b) => compareText(a.name, b.name))
}

export function eraCollections(entries: CatalogEntry[]): TaxonomyCollection[] {
	return taxonomyCollections(entries, (book) => eraKeyFor(book.year).name).sort(
		(a, b) =>
			eraStartYear(a.name) - eraStartYear(b.name) ||
			compareText(a.name, b.name),
	)
}

export function genreForBook(
	book: Pick<Book, 'category'>,
	genres: TaxonomyCollection[],
) {
	const name = book.category.trim() || UNCATEGORIZED
	return genres.find((genre) => genre.name === name) ?? null
}

export function eraForBook(
	book: Pick<Book, 'year'>,
	eras: TaxonomyCollection[],
) {
	const name = eraKeyFor(book.year).name
	return eras.find((era) => era.name === name) ?? null
}

export function relatedByGenre(
	book: Pick<Book, 'id' | 'category'>,
	genres: TaxonomyCollection[],
	exclude: Iterable<string> = [],
) {
	const genre = genreForBook(book, genres)
	if (!genre) return []
	const excluded = new Set([book.id, ...exclude])
	return genre.books
		.filter((other) => !excluded.has(other.id))
		.sort(compareBooks)
		.slice(0, 4)
}
