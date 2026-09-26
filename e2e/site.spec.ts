import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

type CatalogBook = { id: string; slug: string; title: string }
type Catalog = { books: CatalogBook[] }
type PublishedMaps = { books: { bookId: string }[] }

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const baseURL = 'http://127.0.0.1:4321/'

async function getBrowserTestBooks() {
	const [catalog, published] = await Promise.all([
		readFile(resolve(root, 'data/catalog/books.json'), 'utf8').then(
			(content) => JSON.parse(content) as Catalog,
		),
		readFile(resolve(root, 'data/published.json'), 'utf8').then(
			(content) => JSON.parse(content) as PublishedMaps,
		),
	])
	const publishedIds = new Set(published.books.map((pointer) => pointer.bookId))
	const mapBook = catalog.books.find((book) => publishedIds.has(book.id))
	const generatorBook = catalog.books.find((book) => !publishedIds.has(book.id))

	if (!mapBook || !generatorBook) {
		throw new Error('Browser coverage requires published and unpublished books')
	}

	return { mapBook, generatorBook }
}

async function blockExternalRequests(page: Page) {
	await page.route('**/*', async (route) => {
		const url = new URL(route.request().url())
		if (
			url.origin === new URL(baseURL).origin ||
			url.protocol === 'data:' ||
			url.protocol === 'blob:'
		) {
			await route.continue()
		} else {
			await route.abort()
		}
	})
}

test('published maps render and become interactive without external requests', async ({
	page,
}) => {
	const { mapBook } = await getBrowserTestBooks()
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await blockExternalRequests(page)

	await page.goto(`/books/${mapBook.slug}/`)

	await expect(page).toHaveTitle(/Character Relationship Map/)
	await expect(
		page.locator('#mermaid-container.is-interactive svg'),
	).toBeVisible()
	await expect(page.locator('#diagram-controls')).toBeVisible()
	expect(errors).toEqual([])
})

test('the generator page selects an unpublished catalog book', async ({
	page,
}) => {
	const { generatorBook } = await getBrowserTestBooks()
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await blockExternalRequests(page)

	await page.goto(`/generate/?book=${encodeURIComponent(generatorBook.id)}`)

	await expect(page.locator('#selected-book-section')).toBeVisible()
	await expect(page.locator('#selected-book-card')).toContainText(
		generatorBook.title,
	)
	expect(errors).toEqual([])
})
