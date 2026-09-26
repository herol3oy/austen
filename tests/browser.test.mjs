import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import puppeteer from 'puppeteer'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = resolve(ROOT, 'dist')
const execute = promisify(execFile)
const mime = {
	'.css': 'text/css',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript',
	'.jpg': 'image/jpeg',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
}

async function staticServer() {
	const server = createServer(async (request, response) => {
		try {
			const pathname = new URL(request.url, 'http://localhost').pathname
			const relative = pathname.replace(/^\/+/, '')
			const file = resolve(
				DIST,
				relative.endsWith('/') || !relative
					? `${relative}index.html`
					: relative,
			)
			if (!file.startsWith(`${DIST}/`)) throw new Error('Invalid path')
			const content = await readFile(file)
			response.writeHead(200, {
				'Content-Type': mime[extname(file)] || 'application/octet-stream',
			})
			response.end(content)
		} catch {
			response.writeHead(404, { 'Content-Type': 'text/html' })
			response.end(await readFile(resolve(DIST, '404.html')))
		}
	})
	await new Promise((done) => server.listen(0, '127.0.0.1', done))
	return server
}

test('the static site works in a real browser without network data tooling', {
	timeout: 120000,
}, async (t) => {
	await execute(resolve(ROOT, 'node_modules/.bin/astro'), ['build'], {
		cwd: ROOT,
		timeout: 90000,
		env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
	})
	const catalog = JSON.parse(
		await readFile(resolve(ROOT, 'data/catalog/books.json'), 'utf8'),
	)
	const published = JSON.parse(
		await readFile(resolve(ROOT, 'data/published.json'), 'utf8'),
	)
	const publishedIds = new Set(published.books.map((pointer) => pointer.bookId))
	const mapBook = catalog.books.find((book) => publishedIds.has(book.id))
	const generatorBook = catalog.books.find((book) => !publishedIds.has(book.id))
	assert.ok(mapBook, 'a published map is required for browser coverage')
	assert.ok(
		generatorBook,
		'an unpublished catalog book is required for generator coverage',
	)

	const server = await staticServer()
	t.after(() => new Promise((done) => server.close(done)))
	const base = `http://127.0.0.1:${server.address().port}/`
	const browser = await puppeteer.launch({
		headless: true,
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
	})
	t.after(() => browser.close())
	const page = await browser.newPage()
	page.setDefaultTimeout(15000)
	const errors = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.setRequestInterception(true)
	page.on('request', (request) => {
		if (
			request.url().startsWith(base) ||
			request.url().startsWith('data:') ||
			request.url().startsWith('blob:')
		)
			void request.continue()
		else void request.abort()
	})

	await page.goto(`${base}books/${mapBook.slug}/`)
	await page.waitForSelector('#mermaid-container.is-interactive svg')
	assert.match(await page.title(), /Character Relationship Map/)
	assert.ok(
		await page.$eval('#diagram-controls', (controls) => !controls.hidden),
		'interactive controls should be enabled by the client script',
	)

	await page.goto(
		`${base}generate/?book=${encodeURIComponent(generatorBook.id)}`,
	)
	await page.waitForFunction(
		() => !document.getElementById('selected-book-section').hidden,
	)
	assert.match(
		await page.$eval('#selected-book-card', (card) => card.textContent),
		new RegExp(generatorBook.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
	)
	assert.deepEqual(errors, [])
})
