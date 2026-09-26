import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import { loadLastmodByPath } from '../shared/sitemap-lastmod.mjs'

const root = await mkdtemp(resolve(tmpdir(), 'austen-sitemap-test-'))
test.after(() => rm(root, { recursive: true, force: true }))
await mkdir(resolve(root, 'data/catalog'), { recursive: true })
await writeFile(
	resolve(root, 'data/catalog/books.json'),
	JSON.stringify({
		schemaVersion: 1,
		books: [
			{ id: 'author/one', slug: 'author-one' },
			{ id: 'author/two', slug: 'author-two' },
			{ id: 'author/three', slug: 'author-three' },
			{ id: 'author/four', slug: 'author-four' },
		],
	}),
)
await writeFile(
	resolve(root, 'data/published.json'),
	JSON.stringify({
		schemaVersion: 1,
		books: [
			{ bookId: 'author/one', publishedAt: '2026-09-10T12:51:06.689Z' },
			{ bookId: 'author/two', reviewedAt: '2026-09-09T08:00:00.000Z' },
			{ bookId: 'author/three' },
			{ bookId: 'author/four', publishedAt: 'not-a-date' },
			{ bookId: 'author/absent', publishedAt: '2026-09-01T00:00:00.000Z' },
		],
	}),
)

test('published pages map to their pointer timestamps with reviewedAt fallback', () => {
	const byPath = loadLastmodByPath({ root })
	assert.deepEqual([...byPath.keys()].sort(), [
		'/books/author-one/',
		'/books/author-two/',
	])
	assert.equal(
		byPath.get('/books/author-one/').toISOString(),
		'2026-09-10T12:51:06.689Z',
	)
	assert.equal(
		byPath.get('/books/author-two/').toISOString(),
		'2026-09-09T08:00:00.000Z',
	)
})

test('missing or invalid data produces an empty map instead of throwing', () => {
	assert.equal(loadLastmodByPath({ root: resolve(root, 'nope') }).size, 0)
	assert.equal(loadLastmodByPath({}).size, 0)
})
