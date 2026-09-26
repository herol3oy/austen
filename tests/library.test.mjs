import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateCatalog } from '../shared/books.mjs'
import { validateCovers } from '../shared/covers.mjs'
import { loadPublishedMaps } from '../src/lib/published-maps.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'))
}

test('the checked-in catalog, covers, and published maps are self-contained and valid', async () => {
	const catalog = validateCatalog(
		await readJson(resolve(ROOT, 'data/catalog/books.json')),
	)
	const covers = validateCovers(
		await readJson(resolve(ROOT, 'data/catalog/covers.json')),
	)
	const { maps } = await loadPublishedMaps(ROOT, catalog)
	assert.ok(catalog.books.length > 0)
	assert.ok(maps.length > 0)
	for (const book of catalog.books) {
		assert.equal('sourceUrl' in book, false)
		assert.equal('sourceAnchor' in book, false)
	}
	for (const cover of Object.values(covers.books))
		assert.deepEqual(Object.keys(cover), ['assetPath'])
})

test('a published-map hash mismatch fails before it can be served', async (t) => {
	const root = await mkdtemp(resolve(tmpdir(), 'austen-library-test-'))
	t.after(() => rm(root, { recursive: true, force: true }))
	const catalog = await readJson(resolve(ROOT, 'data/catalog/books.json'))
	const published = await readJson(resolve(ROOT, 'data/published.json'))
	const pointer = published.books[0]
	const book = catalog.books.find((entry) => entry.id === pointer.bookId)
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
	const source = resolve(ROOT, 'data/maps', book.slug)
	const target = resolve(root, 'data/maps', book.slug)
	await mkdir(dirname(target), { recursive: true })
	await cp(source, target, { recursive: true })
	await assert.rejects(
		loadPublishedMaps(root, validateCatalog(catalog)),
		/changed after publication/,
	)
})
