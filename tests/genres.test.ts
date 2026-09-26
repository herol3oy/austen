import { expect, test } from 'vitest'
import type { CatalogEntry } from '../src/lib/library'
import { slugify } from '../src/lib/slug'
import {
	eraCollections,
	eraForBook,
	eraKeyFor,
	genreCollections,
	genreForBook,
	relatedByGenre,
	UNKNOWN_ERA,
} from '../src/lib/taxonomy'

const entry = (
	id: string,
	title: string,
	{
		authors = [],
		category = 'Fiction',
		year = '1900',
		published = true,
	}: {
		authors?: string[]
		category?: string
		year?: string | null
		published?: boolean
	} = {},
): CatalogEntry => ({
	id,
	slug: id,
	title,
	authors,
	category,
	year,
	ebookUrl: 'https://standardebooks.org/ebooks/example/example',
	publishedUrl: published ? `/books/${id}/` : null,
	availability: '',
	mapStatus: published ? 'available' : 'unavailable',
})

test('slugs and eras are deterministic', () => {
	expect(slugify('Émile Zola')).toBe('emile-zola')
	expect(eraKeyFor('1813')).toEqual({
		name: '19th century',
		slug: '19th-century',
		startYear: 1800,
	})
	expect(eraKeyFor(null).name).toBe(UNKNOWN_ERA)
})

test('genre and era collections include published maps only and sort consistently', () => {
	const entries = [
		entry('a', 'Alpha', { category: 'Mystery', year: '1910' }),
		entry('b', 'Beta', { category: 'Mystery', year: '1880' }),
		entry('c', 'Gamma', { category: 'Poetry', year: '1910' }),
		entry('d', 'Delta', { category: 'Poetry', year: null }),
		entry('e', 'Excluded', { category: 'Fantasy', published: false }),
	]
	const genres = genreCollections(entries)
	const eras = eraCollections(entries)
	expect(genres.map((genre) => genre.name)).toEqual(['Mystery', 'Poetry'])
	expect(eras.map((era) => era.name)).toEqual([
		'19th century',
		'20th century',
		UNKNOWN_ERA,
	])
	expect(genreForBook({ category: 'Mystery' }, genres)?.name).toBe('Mystery')
	expect(eraForBook({ year: null }, eras)?.name).toBe(UNKNOWN_ERA)
	expect(genreCollections([...entries].reverse())).toEqual(genres)
})

test('related genre maps omit the current map and excluded peers', () => {
	const current = entry('current', 'Mid', { category: 'Mystery' })
	const entries = [
		current,
		...['Zoo', 'Elm', 'Date', 'Cherry', 'Bee', 'Apple'].map((title) =>
			entry(title, title, { category: 'Mystery' }),
		),
	]
	const genres = genreCollections(entries)
	expect(
		relatedByGenre(current, genres, ['Bee']).map((book) => book.title),
	).toEqual(['Apple', 'Cherry', 'Date', 'Elm'])
})
