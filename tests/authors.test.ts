import { expect, test } from 'vitest'
import {
	authorCollections,
	authorSlug,
	collectionsForBook,
	relatedMaps,
} from '../src/lib/authors'
import type { CatalogEntry } from '../src/lib/library'
import { breadcrumbData, serializeStructuredData } from '../src/lib/seo'

const entry = (
	id: string,
	title: string,
	authors: string[],
	published = true,
): CatalogEntry => ({
	id,
	slug: id,
	title,
	authors,
	year: null,
	category: 'Fiction',
	ebookUrl: 'https://standardebooks.org/ebooks/example/example',
	publishedUrl: published ? `/books/${id}/` : null,
	availability: '',
	mapStatus: published ? 'available' : 'unavailable',
})

test('author hubs require two distinct published maps and exclude unnamed and Anonymous authors', () => {
	const first = entry('one', 'One', [
		'Jane Austen',
		'Jane Austen',
		'Anonymous',
		' anonymous ',
		'',
		' ',
	])
	const entries = [
		first,
		first,
		entry('two', 'Two', ['Jane Austen', 'Anonymous', '']),
		entry('three', 'Three', ['Single Author']),
		entry('four', 'Four', ['Single Author'], false),
		entry('five', 'Five', []),
		entry('six', 'Six', ['Unavailable Author'], false),
	]
	const authors = authorCollections(entries)
	expect(authors.map((a) => a.name)).toEqual(['Jane Austen'])
	expect(authors[0].books.map((b) => b.id)).toEqual(['one', 'two'])
})

test('author names stay intact and name-based slugs remain stable across catalog order and additions', () => {
	const name = 'Émile Zola'
	const entries = [entry('z', 'Zebra', [name]), entry('a', 'Apple', [name])]
	const authors = authorCollections(entries)
	expect(authors[0].name).toBe(name)
	expect(authors[0].slug).toBe('emile-zola')
	expect(authorSlug('F. Scott Fitzgerald')).toBe('f-scott-fitzgerald')
	expect(authorSlug('李 白')).toBe('李-白')
	expect(authorCollections([...entries].reverse())).toEqual(authors)
	expect(
		authorCollections([...entries, entry('b', 'Bee', [name])])[0].slug,
	).toBe(authors[0].slug)
	expect(() => authorSlug('---')).toThrow(/Cannot create an author slug/)
})

test('colliding author slugs fail instead of merging distinct names', () => {
	for (const names of [
		['Émile Zola', 'Emile Zola'],
		['A. Writer', 'A Writer'],
	]) {
		expect(() =>
			authorCollections([
				entry('one', 'One', names),
				entry('two', 'Two', names),
			]),
		).toThrow(/Author slug collision/)
	}
})

test('directory and complete author collections sort alphabetically with deterministic title ties', () => {
	const entries = [
		entry('z', 'Zoo', ['Z. Writer', 'A. Writer']),
		entry('b', 'Apple', ['Z. Writer', 'A. Writer']),
		entry('a', 'Apple', ['Z. Writer']),
	]
	const authors = authorCollections(entries)
	expect(authors.map((a) => a.name)).toEqual(['A. Writer', 'Z. Writer'])
	expect(authors[1].books.map((b) => b.id)).toEqual(['a', 'b', 'z'])
	expect(authorCollections([...entries].reverse())).toEqual(authors)
})

test('related maps exclude the current book, deduplicate shared authors, sort, and cap at four', () => {
	const current = entry('current', 'Current', ['A. Writer', 'B. Writer'])
	const entries = [
		current,
		...['Zoo', 'Elm', 'Date', 'Cherry', 'Bee', 'Apple'].map((title) =>
			entry(title, title, current.authors),
		),
		entry('other', 'Aardvark', ['Other Author']),
	]
	const authors = authorCollections(entries)
	expect(collectionsForBook(current, authors).map((a) => a.name)).toEqual(
		current.authors,
	)
	expect(relatedMaps(current, authors).map((b) => b.title)).toEqual([
		'Apple',
		'Bee',
		'Cherry',
		'Date',
	])
	const unrelated = entries.at(-1)
	if (!unrelated) throw new Error('Missing unrelated fixture')
	expect(relatedMaps(unrelated, authors)).toEqual([])
})

test('structured data preserves text without allowing script termination and uses breadcrumb URLs', () => {
	const name = 'A & B </script><script>alert("x")</script>\u2028\u2029'
	const data = breadcrumbData(
		[
			{ name: 'Home', href: '/' },
			{ name, href: '/books/example/' },
		],
		new URL('https://austen.page'),
	)
	const serialized = serializeStructuredData(data)
	expect(serialized).not.toMatch(/<|\u2028|\u2029/)
	expect(JSON.parse(serialized)).toEqual(data)
	expect(data.itemListElement[1]).toEqual({
		'@type': 'ListItem',
		position: 2,
		name,
		item: 'https://austen.page/books/example/',
	})
})
