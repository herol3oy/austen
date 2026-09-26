import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { validateCatalog } from '../shared/books.mjs'
import { validateCovers } from '../shared/covers.mjs'
import { loadPublishedMaps } from '../src/lib/published-maps.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const readJson = async (path: string) =>
	JSON.parse(await readFile(path, 'utf8'))

test('checked-in catalog, covers, and published maps are valid static data', async () => {
	const catalog = validateCatalog(
		await readJson(resolve(ROOT, 'data/catalog/books.json')),
	)
	const covers = validateCovers(
		await readJson(resolve(ROOT, 'data/catalog/covers.json')),
	)
	const { maps } = await loadPublishedMaps(ROOT, catalog)
	expect(catalog.books.length).toBeGreaterThan(0)
	expect(maps.length).toBeGreaterThan(0)
	for (const book of catalog.books) {
		expect(book).not.toHaveProperty('sourceUrl')
		expect(book).not.toHaveProperty('sourceAnchor')
	}
	for (const cover of Object.values(covers.books)) {
		if (!cover || typeof cover !== 'object') throw new Error('Invalid cover')
		expect(Object.keys(cover)).toEqual(['assetPath'])
	}
})

test('a published-map hash mismatch fails before the artifact is served', async () => {
	const root = await mkdtemp(resolve(tmpdir(), 'austen-library-test-'))
	try {
		const catalog = await readJson(resolve(ROOT, 'data/catalog/books.json'))
		const published = await readJson(resolve(ROOT, 'data/published.json'))
		const pointer = published.books[0]
		const book = catalog.books.find(
			(entry: { id: string }) => entry.id === pointer.bookId,
		)
		if (!book) throw new Error('Published book is missing')
		await mkdir(resolve(root, 'data/catalog'), { recursive: true })
		await writeFile(
			resolve(root, 'data/catalog/books.json'),
			JSON.stringify(catalog),
		)
		await writeFile(
			resolve(root, 'data/published.json'),
			JSON.stringify({
				...published,
				books: [{ ...pointer, revisionHash: '0'.repeat(64) }],
			}),
		)
		const target = resolve(root, 'data/maps', book.slug)
		await mkdir(dirname(target), { recursive: true })
		await cp(resolve(ROOT, 'data/maps', book.slug), target, { recursive: true })
		await expect(
			loadPublishedMaps(root, validateCatalog(catalog)),
		).rejects.toThrow(/changed after publication/)
	} finally {
		await rm(root, { recursive: true, force: true })
	}
})
