import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { loadLastmodByPath } from '../shared/sitemap-lastmod.mjs'

const root = await mkdtemp(resolve(tmpdir(), 'austen-sitemap-test-'))
afterAll(() => rm(root, { recursive: true, force: true }))
await mkdir(resolve(root, 'data/catalog'), { recursive: true })
await writeFile(
	resolve(root, 'data/catalog/books.json'),
	JSON.stringify({
		books: [
			{ id: 'author/one', slug: 'author-one' },
			{ id: 'author/two', slug: 'author-two' },
		],
	}),
)
await writeFile(
	resolve(root, 'data/published.json'),
	JSON.stringify({
		books: [
			{ bookId: 'author/one', publishedAt: '2026-09-10T12:51:06.689Z' },
			{ bookId: 'author/two', reviewedAt: '2026-09-09T08:00:00.000Z' },
			{ bookId: 'author/missing', publishedAt: 'not-a-date' },
		],
	}),
)

test('published pages map to publication timestamps', () => {
	const byPath = loadLastmodByPath({ root })
	expect([...byPath.keys()].sort()).toEqual([
		'/books/author-one/',
		'/books/author-two/',
	])
	expect(byPath.get('/books/author-one/')?.toISOString()).toBe(
		'2026-09-10T12:51:06.689Z',
	)
	expect(loadLastmodByPath({ root: resolve(root, 'missing') })).toEqual(
		new Map(),
	)
})
