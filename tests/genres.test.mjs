import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// The helpers are small pure modules with relative imports; transpile and
// concatenate them so the data-URL import has no unresolved specifiers.
async function loadHelper(...paths) {
	const modules = []
	for (const path of paths) {
		const source = await readFile(new URL(path, import.meta.url), 'utf8')
		const { outputText } = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		})
		modules.push(
			outputText
				.split('\n')
				.filter((line) => !/^\s*import\b.*from\s+'\.\//.test(line))
				.join('\n'),
		)
	}
	return import(
		`data:text/javascript;base64,${Buffer.from(modules.join('\n')).toString('base64')}`
	)
}
const helpers = await loadHelper(
	'../src/lib/slug.ts',
	'../src/lib/authors.ts',
	'../src/lib/taxonomy.ts',
)
const { slugify } = await loadHelper('../src/lib/slug.ts')
const {
	eraCollections,
	eraForBook,
	eraKeyFor,
	genreCollections,
	genreForBook,
	relatedByGenre,
	UNKNOWN_ERA,
} = helpers
const entry = (
	id,
	title,
	{ authors = [], category = 'Fiction', year = '1900', published = true } = {},
) => ({
	id,
	title,
	authors,
	category,
	year,
	publishedUrl: published ? `/books/${id}/` : null,
})

test('slugify handles names, punctuation, and empties consistently', () => {
	assert.equal(slugify('F. Scott Fitzgerald'), 'f-scott-fitzgerald')
	assert.equal(slugify('Science Fiction'), 'science-fiction')
	assert.equal(slugify('Émile Zola'), 'emile-zola')
	assert.equal(slugify('19th century'), '19th-century')
	assert.throws(() => slugify('---'), /Cannot create a slug/)
})

test('century eras derive from the first four-digit year with ordinal labels', () => {
	for (const [year, name, slug, startYear] of [
		['1813', '19th century', '19th-century', 1800],
		['1715–1735', '18th century', '18th-century', 1700],
		['1851 & 1857', '19th century', '19th-century', 1800],
		['1348–1353', '14th century', '14th-century', 1300],
		['1000', '11th century', '11th-century', 1000],
		['2000', '21st century', '21st-century', 2000],
	]) {
		assert.deepEqual(eraKeyFor(year), { name, slug, startYear })
	}
	for (const year of [null, undefined, '', 'n.d.', 'circa']) {
		assert.deepEqual(eraKeyFor(year), {
			name: UNKNOWN_ERA,
			slug: 'publication-year-unknown',
			startYear: Number.POSITIVE_INFINITY,
		})
	}
})

test('genre and era collections include only published maps, group, and sort deterministically', () => {
	const entries = [
		entry('a', 'Alpha', { category: 'Mystery', year: '1910' }),
		entry('b', 'Beta', { category: 'Mystery', year: '1880' }),
		entry('c', 'Gamma', { category: 'Poetry', year: '1910' }),
		entry('d', 'Delta', { category: 'Poetry', year: '1813' }),
		entry('e', 'Epsilon', { category: 'Poetry', year: null }),
		entry('f', 'Zeta', { category: 'Fantasy', year: '1910', published: false }),
		entry('g', 'Eta', { category: 'Mystery', year: '1910', published: false }),
	]
	assert.deepEqual(
		genreCollections(entries).map((g) => g.name),
		['Mystery', 'Poetry'],
	)
	assert.deepEqual(
		genreCollections(entries).map((g) => g.books.map((b) => b.id)),
		[
			['a', 'b'],
			['d', 'e', 'c'],
		],
	)
	assert.deepEqual(
		eraCollections(entries).map((e) => e.name),
		['19th century', '20th century', UNKNOWN_ERA],
	)
	assert.deepEqual(
		eraCollections(entries).map((e) => e.books.map((b) => b.id)),
		[['b', 'd'], ['a', 'c'], ['e']],
	)
	assert.deepEqual(
		genreCollections([...entries].reverse()),
		genreCollections(entries),
	)
	assert.deepEqual(
		eraCollections([...entries].reverse()),
		eraCollections(entries),
	)
})

test('slugs stay stable as collections grow and collisions fail loudly', () => {
	const entries = [
		entry('a', 'Alpha', { category: 'Mystery' }),
		entry('b', 'Beta', { category: 'Mystery' }),
	]
	assert.equal(genreCollections(entries)[0].slug, 'mystery')
	const grown = [
		...entries,
		entry('c', 'Gamma', { category: 'Mystery' }),
		entry('d', 'Delta', { category: 'Poetry' }),
	]
	assert.equal(
		genreCollections(grown).find((g) => g.name === 'Mystery').books.length,
		3,
	)
	assert.throws(
		() =>
			genreCollections([
				entry('x', 'X', { category: 'A. Writer' }),
				entry('y', 'Y', { category: 'A Writer' }),
			]),
		/Taxonomy slug collision/,
	)
})

test('genre and era lookup matches a book to its single collection', () => {
	const genres = genreCollections([
		entry('a', 'Alpha', { category: 'Mystery' }),
		entry('b', 'Beta', { category: 'Poetry' }),
	])
	const eras = eraCollections([
		entry('a', 'Alpha', { year: '1888' }),
		entry('b', 'Beta', { year: null }),
	])
	assert.equal(genreForBook({ category: 'Mystery' }, genres)?.name, 'Mystery')
	assert.equal(genreForBook({ category: 'Unknown' }, genres), null)
	assert.equal(eraForBook({ year: '1888' }, eras)?.name, '19th century')
	assert.equal(eraForBook({ year: 'n.d.' }, eras)?.name, UNKNOWN_ERA)
	assert.equal(eraForBook({ year: '2200' }, eras), null)
})

test('related genre maps exclude the current book and author peers, dedupe, sort, and cap at four', () => {
	const current = entry('current', 'Mid', { category: 'Mystery' })
	const entries = [
		current,
		...['Zoo', 'Elm', 'Date', 'Cherry', 'Bee', 'Apple'].map((title) =>
			entry(title, title, { category: 'Mystery' }),
		),
		entry('other', 'Aardvark', { category: 'Poetry' }),
	]
	const genres = genreCollections(entries)
	const [elided, taxi] = ['Bee', 'Date'].map((title) =>
		entry(title, title, { category: 'Mystery' }),
	)
	assert.deepEqual(
		relatedByGenre(current, genres, [elided.id]).map((b) => b.title),
		['Apple', 'Cherry', 'Date', 'Elm'],
	)
	assert.deepEqual(
		relatedByGenre(current, genres, [elided.id, taxi.id]).map((b) => b.title),
		['Apple', 'Cherry', 'Elm', 'Zoo'],
	)
	assert.equal(
		relatedByGenre({ id: 'other', category: 'Poetry' }, genres).length,
		0,
	)
})
