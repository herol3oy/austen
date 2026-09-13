import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// These pure helpers only import types; transpile with the project's existing compiler.
async function loadHelper(path) {
	const source = await readFile(new URL(path, import.meta.url), 'utf8')
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	})
	return import(
		`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
	)
}
const { authorCollections, authorSlug, collectionsForBook, relatedMaps } =
	await loadHelper('../src/lib/authors.ts')
const { breadcrumbData, serializeStructuredData } =
	await loadHelper('../src/lib/seo.ts')
const entry = (id, title, authors, published = true) => ({
	id,
	title,
	authors,
	publishedUrl: published ? `/books/${id}/` : null,
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
	assert.deepEqual(
		authors.map((a) => a.name),
		['Jane Austen'],
	)
	assert.deepEqual(
		authors[0].books.map((b) => b.id),
		['one', 'two'],
	)
})

test('author names stay intact and name-based slugs remain stable across catalog order and additions', () => {
	const name = 'Émile Zola'
	const entries = [entry('z', 'Zebra', [name]), entry('a', 'Apple', [name])]
	const authors = authorCollections(entries)
	assert.equal(authors[0].name, name)
	assert.equal(authors[0].slug, 'emile-zola')
	assert.equal(authorSlug('F. Scott Fitzgerald'), 'f-scott-fitzgerald')
	assert.equal(authorSlug('李 白'), '李-白')
	assert.deepEqual(authorCollections([...entries].reverse()), authors)
	assert.equal(
		authorCollections([...entries, entry('b', 'Bee', [name])])[0].slug,
		authors[0].slug,
	)
	assert.throws(() => authorSlug('---'), /Cannot create an author slug/)
})

test('colliding author slugs fail instead of merging distinct names', () => {
	for (const names of [
		['Émile Zola', 'Emile Zola'],
		['A. Writer', 'A Writer'],
	]) {
		assert.throws(
			() =>
				authorCollections([
					entry('one', 'One', names),
					entry('two', 'Two', names),
				]),
			/Author slug collision/,
		)
	}
})

test('directory and complete author collections sort alphabetically with deterministic title ties', () => {
	const entries = [
		entry('z', 'Zoo', ['Z. Writer', 'A. Writer']),
		entry('b', 'Apple', ['Z. Writer', 'A. Writer']),
		entry('a', 'Apple', ['Z. Writer']),
	]
	const authors = authorCollections(entries)
	assert.deepEqual(
		authors.map((a) => a.name),
		['A. Writer', 'Z. Writer'],
	)
	assert.deepEqual(
		authors[1].books.map((b) => b.id),
		['a', 'b', 'z'],
	)
	assert.deepEqual(authorCollections([...entries].reverse()), authors)
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
	assert.deepEqual(
		collectionsForBook(current, authors).map((a) => a.name),
		current.authors,
	)
	assert.deepEqual(
		relatedMaps(current, authors).map((b) => b.title),
		['Apple', 'Bee', 'Cherry', 'Date'],
	)
	assert.deepEqual(relatedMaps(entries.at(-1), authors), [])
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
	assert.doesNotMatch(serialized, /<|\u2028|\u2029/)
	assert.deepEqual(JSON.parse(serialized), data)
	assert.deepEqual(data.itemListElement[1], {
		'@type': 'ListItem',
		position: 2,
		name,
		item: 'https://austen.page/books/example/',
	})
})
