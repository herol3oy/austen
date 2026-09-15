import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
	cp,
	mkdir,
	readdir,
	readFile,
	symlink,
	writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { load } from 'cheerio'
import LZString from 'lz-string'
import puppeteer from 'puppeteer'
import sharp from 'sharp'
import { hash, ROOT, writeJson } from '../scripts/files.mjs'
import { syncMaps } from '../scripts/sync-maps.mjs'
import { renderSvg, validateSvg } from '../scripts/validate-maps.mjs'
import { coverAssetPath } from '../shared/covers.mjs'
import {
	decodeShare,
	loadHistory,
	normalizeSnapshot,
} from '../src/scripts/share-history.js'
import { fixtureRoot, generatedAt, graph, success } from './helpers.mjs'

const execute = promisify(execFile)
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickInView(page, selector) {
	const element = await page.waitForSelector(selector, { visible: true })
	try {
		await element.evaluate(async (node) => {
			await document.fonts.ready
			// Locator checks allow partial visibility, but its final click may
			// scroll again. Cancel smooth scrolling and expose the whole control.
			node.scrollIntoView({
				behavior: 'instant',
				block: 'center',
				inline: 'center',
			})
		})
		await page
			.locator(selector)
			.filter((node) => {
				const rect = node.getBoundingClientRect()
				return (
					rect.top >= 0 &&
					rect.left >= 0 &&
					rect.bottom <= innerHeight &&
					rect.right <= innerWidth &&
					node.contains(
						document.elementFromPoint(
							rect.left + rect.width / 2,
							rect.top + rect.height / 2,
						),
					)
				)
			})
			.click()
	} finally {
		await element.dispose()
	}
}

async function partiallyExposeControl(page, selector) {
	await page.$eval(selector, (node) => {
		node.scrollIntoView({ behavior: 'instant', block: 'end' })
		window.scrollBy({ top: -node.offsetHeight / 2, behavior: 'instant' })
	})
	assert.ok(
		await page.$eval(selector, (node) => {
			const rect = node.getBoundingClientRect()
			return rect.top < innerHeight && rect.bottom > innerHeight
		}),
		`${selector} starts partly outside the viewport`,
	)
}

test('built static library and migrated workspace', {
	timeout: 180000,
}, async (t) => {
	// Astro's linked components need a common parent with the fixture root.
	const directory = resolve(ROOT, 'test-results')
	await mkdir(directory, { recursive: true })
	const { root, book, catalog } = await fixtureRoot(t, { directory })
	const svg = await renderSvg(graph)
	assert.ok(validateSvg(svg).width > 0)
	await assert.rejects(
		renderSvg(
			'graph LR\nend["Reserved identifier"]\nC2["Other"]\nend -->|Knows| C2',
		),
		(error) => error.code === 'invalid_graph',
	)
	const extra = Array.from({ length: 51 }, (_, i) => ({
		...book,
		id: `fixture-author/book-${i}`,
		slug: `fixture-author-book-${i}`,
		title: `Fixture ${i}`,
		year: '1900',
		category: 'Poetry',
		ebookUrl: `https://standardebooks.org/ebooks/fixture-author/book-${i}`,
	}))
	extra[0] = {
		...extra[0],
		title:
			'The Collected Adventures of Friends & Their Extraordinary Companions',
		authors: ['Author One', 'Author Two'],
		year: null,
	}
	extra[1].authors = ['Author One', 'Author Two']
	const escapedAuthor = 'Élodie & </script><script>alert("SEO")</script>'
	extra[2].authors = [escapedAuthor]
	extra[2].title = 'A Book & </script><script>alert("SEO")</script>'
	extra[3].authors = [escapedAuthor]
	extra[4].authors = ['Anonymous']
	extra[5].authors = []
	const contentNames = [
		'Élizabeth & Anne',
		'Jane Bennet',
		'Charles Bingley',
		'Fitzwilliam Darcy',
		'ACharacterWithAnExceptionallyLongNameThatMustWrapOnSmallScreens',
		'George Wickham',
	]
	const contentGraph =
		'graph LR\n' +
		contentNames.map((name, i) => `C${i}["${name}"]`).join('\n') +
		'\nC0 -->|Knows & trusts| C1\nC1 -->|Friend of| C0\nC0 -->|Mentors| C1\nC0 --> C5'
	const contentSvg = await renderSvg(contentGraph)
	catalog.books.push(...extra)
	await writeJson(resolve(root, 'data/catalog/books.json'), catalog)
	const cover = await readFile(
		resolve(
			ROOT,
			'src/assets/covers/jane-austen-pride-and-prejudice/cover.jpg',
		),
	)
	await writeJson(resolve(root, 'data/catalog/covers.json'), {
		schemaVersion: 3,
		books: Object.fromEntries(
			[book, extra[0], extra.at(-1)].map((entry) => [
				entry.id,
				{
					status: 'imported',
					repository: 'fixture',
					branch: 'master',
					sourceSha: 'a'.repeat(40),
					assetPath: coverAssetPath(entry),
					sourceHash: hash(cover),
					checkedAt: generatedAt,
				},
			]),
		),
	})
	await syncMaps({
		root,
		dryRun: false,
		ids: [book.id, ...extra.map((b) => b.id)],
		provider: async (metadata) => ({
			...success(),
			mermaid: metadata.title === extra[0].title ? contentGraph : graph,
		}),
		renderer: async (source) => (source === contentGraph ? contentSvg : svg),
		log: () => {},
	})
	await syncMaps({
		root,
		dryRun: false,
		ids: [catalog.books[1].id],
		provider: async () => ({
			...success(),
			outcome: 'unknown_work',
			mermaid: null,
		}),
		renderer: async () => svg,
		log: () => {},
	})
	for (const name of ['src', 'shared', 'scripts', 'public'])
		await cp(resolve(ROOT, name), resolve(root, name), { recursive: true })
	for (const entry of [book, extra[0], extra.at(-1)]) {
		const path = resolve(root, coverAssetPath(entry))
		await mkdir(resolve(path, '..'), { recursive: true })
		await writeFile(path, cover)
	}
	for (const name of ['astro.config.mjs', 'package.json', 'tsconfig.json'])
		await cp(resolve(ROOT, name), resolve(root, name))
	await symlink(
		resolve(ROOT, 'node_modules'),
		resolve(root, 'node_modules'),
		'dir',
	)
	await execute(resolve(ROOT, 'node_modules/.bin/astro'), ['build'], {
		cwd: root,
		timeout: 60000,
		maxBuffer: 2000000,
		env: {
			...process.env,
			// Reproduce a fresh CI machine. The offline preload must disable telemetry itself.
			CI: 'true',
			XDG_CONFIG_HOME: resolve(root, 'config'),
			ASTRO_TELEMETRY_DISABLED: '',
			TELEMETRY_DISABLED: '',
			NODE_OPTIONS: `--import=${resolve(ROOT, 'tests/fixtures/offline.mjs')}`,
			DEEPSEEK_API_KEY: 'STATIC_BUILD_SECRET_SENTINEL',
		},
	})
	const mime = {
		'.html': 'text/html',
		'.js': 'text/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.webp': 'image/webp',
		'.ico': 'image/x-icon',
	}
	const server = createServer(async (req, res) => {
		try {
			const path = new URL(req.url, 'http://localhost').pathname
			const relative = path.slice(1),
				file = resolve(
					root,
					'dist',
					relative.endsWith('/') || !relative
						? `${relative}index.html`
						: relative,
				)
			if (!file.startsWith(`${resolve(root, 'dist')}/`))
				throw new Error('Invalid path')
			const content = await readFile(file)
			res.writeHead(200, {
				'Content-Type': mime[extname(file)] || 'application/octet-stream',
			})
			res.end(content)
		} catch {
			res.writeHead(404, { 'Content-Type': 'text/html' })
			res.end(await readFile(resolve(root, 'dist/404.html')))
		}
	})
	await new Promise((r) => server.listen(0, '127.0.0.1', r))
	t.after(() => new Promise((r) => server.close(r)))
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
	let searchRequests = 0
	let providerCalls = 0,
		apiReply = null,
		discoveryReply = null,
		contactReply = null
	await page.setRequestInterception(true)
	page.on('request', (request) => {
		if (
			request.url().startsWith(base) ||
			request.url().startsWith('data:') ||
			request.url().startsWith('blob:')
		) {
			void request.continue()
			return
		}
		if (request.url().startsWith('https://openlibrary.org/search.json'))
			searchRequests++
		if (
			request.url().startsWith('https://austen-api.potato0.workers.dev') &&
			apiReply
		) {
			if (request.method() === 'OPTIONS') {
				void request.respond({
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'POST, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
					},
				})
				return
			}
			providerCalls++
			void apiReply(request)
			return
		}
		if (
			request.url().startsWith('https://openlibrary.org/search.json') &&
			discoveryReply
		) {
			void discoveryReply(request)
			return
		}
		if (
			request.url().startsWith('https://api.web3forms.com/submit') &&
			contactReply
		) {
			void contactReply(request)
			return
		}
		void request.abort()
	})
	const publishedUrl = `${base}books/${book.slug}/`
	await t.test(
		'published maps match the site palette with and without JavaScript',
		async () => {
			for (const javascript of [false, true]) {
				await page.setJavaScriptEnabled(javascript)
				await page.goto(publishedUrl)
				if (javascript)
					await page.waitForSelector('#mermaid-container.is-interactive')
				const colors = await page.evaluate(() => {
					const root = getComputedStyle(document.documentElement)
					const rgb = (name) => {
						const hex = root.getPropertyValue(name).trim().slice(1)
						return `rgb(${hex
							.match(/../g)
							.map((channel) => Number.parseInt(channel, 16))
							.join(', ')})`
					}
					const node = getComputedStyle(
						document.querySelector('#mermaid-container .node rect'),
					)
					const text = getComputedStyle(
						document.querySelector('#mermaid-container .node text'),
					)
					const edge = getComputedStyle(
						document.querySelector('#mermaid-container .flowchart-link'),
					)
					return {
						actual: [node.fill, node.stroke, text.fill, edge.stroke],
						expected: [
							'--color-paper-dim',
							'--color-accent',
							'--color-ink',
							'--color-ink-muted',
						].map(rgb),
					}
				})
				assert.deepEqual(colors.actual, colors.expected)
			}
		},
	)
	await t.test(
		'CSS protections survive competing layout and inline styles',
		async (t) => {
			const isolatedPage = await browser.newPage()
			t.after(() => isolatedPage.close())
			isolatedPage.setDefaultTimeout(15000)
			await isolatedPage.setViewport({ width: 1280, height: 900 })
			await t.test('hidden flex diagram controls are invisible', async () => {
				await isolatedPage.setJavaScriptEnabled(false)
				await isolatedPage.goto(publishedUrl)
				assert.deepEqual(
					await isolatedPage.$eval('#diagram-controls', (controls) => ({
						hidden: controls.hidden,
						display: getComputedStyle(controls).display,
						rects: controls.getClientRects().length,
					})),
					{ hidden: true, display: 'none', rects: 0 },
				)
				assert.equal(
					await isolatedPage.$eval('#diagram-controls', (controls) => {
						controls.hidden = false
						return getComputedStyle(controls).display
					}),
					'flex',
				)
			})
			await isolatedPage.setJavaScriptEnabled(true)
			const openInteractiveDiagram = async () => {
				await isolatedPage.goto(publishedUrl)
				await isolatedPage.waitForSelector(
					'#mermaid-container.is-interactive svg',
				)
			}
			await t.test('reduced motion disables button transitions', async () => {
				await isolatedPage.emulateMediaFeatures([
					{ name: 'prefers-reduced-motion', value: 'reduce' },
				])
				await openInteractiveDiagram()
				const durations = await isolatedPage.$eval('#zoom-in-btn', (button) =>
					getComputedStyle(button)
						.transitionDuration.split(',')
						.map(
							(duration) =>
								Number.parseFloat(duration) *
								(duration.trim().endsWith('ms') ? 1 : 1000),
						),
				)
				assert.ok(
					durations.every((duration) => duration <= 0.01),
					`Reduced-motion transitions must be at most 0.01ms: ${durations}`,
				)
			})
			await t.test(
				'interactive SVG fills its container despite inline limits',
				async () => {
					await openInteractiveDiagram()
					const dimensions = await isolatedPage.$eval(
						'#mermaid-container > svg',
						(svg) => {
							svg.style.width = '40px'
							svg.style.height = '30px'
							svg.style.maxWidth = '20px'
							const style = getComputedStyle(svg)
							return {
								width: Number.parseFloat(style.width),
								height: Number.parseFloat(style.height),
								maxWidth: style.maxWidth,
								containerWidth: svg.parentElement.clientWidth,
								containerHeight: svg.parentElement.clientHeight,
							}
						},
					)
					assert.ok(
						dimensions.containerWidth > 40 && dimensions.containerHeight > 30,
					)
					assert.ok(
						Math.abs(dimensions.width - dimensions.containerWidth) <= 1,
						`SVG width must fill its container: ${JSON.stringify(dimensions)}`,
					)
					assert.ok(
						Math.abs(dimensions.height - dimensions.containerHeight) <= 1,
						`SVG height must fill its container: ${JSON.stringify(dimensions)}`,
					)
					assert.equal(dimensions.maxWidth, 'none')
				},
			)
			await t.test(
				'panning uses grabbing despite Panzoom inline cursor',
				async () => {
					await openInteractiveDiagram()
					const svg = await isolatedPage.$('#mermaid-container > svg')
					await svg.scrollIntoView()
					assert.equal(await svg.evaluate((svg) => svg.style.cursor), 'grab')
					const box = await svg.boundingBox()
					await isolatedPage.mouse.move(
						box.x + box.width / 2,
						box.y + box.height / 2,
					)
					await isolatedPage.mouse.down()
					try {
						await isolatedPage.waitForSelector('#mermaid-container.is-panning')
						assert.equal(
							await svg.evaluate((svg) => getComputedStyle(svg).cursor),
							'grabbing',
						)
					} finally {
						await isolatedPage.mouse.up()
					}
					await isolatedPage.waitForSelector(
						'#mermaid-container:not(.is-panning)',
					)
				},
			)
		},
	)
	const builtPage = async (path) =>
		load(await readFile(resolve(root, 'dist', path, 'index.html'), 'utf8'))
	const jsonLd = ($) =>
		$('script[type="application/ld+json"]')
			.map((_, script) => JSON.parse($(script).text()))
			.get()
	await t.test(
		'landing metadata, canonicals and generator indexing survive plain and query URLs',
		async () => {
			await page.setJavaScriptEnabled(false)
			const expected = [
				[
					'',
					'Austen — Character Relationship Maps for Books',
					'Character relationship maps for books',
				],
				[
					'maps/',
					'Browse Character Relationship Maps — Austen',
					'Browse character relationship maps',
				],
				[
					'catalog/',
					'Book Catalog and Map Availability — Austen',
					'Book catalog and map availability',
				],
				[
					'generate/',
					'Generate a Character Relationship Map — Austen',
					'Generate a character relationship map',
				],
				['contact/', 'Contact — Austen', 'Contact Austen'],
			]
			for (const [path, title, heading] of expected) {
				const $ = await builtPage(path)
				assert.equal($('title').text(), title)
				assert.equal($('h1').length, 1)
				assert.equal($('h1').text(), heading)
				assert.equal(
					$('meta[name="robots"]').attr('content'),
					path === 'generate/' ? 'noindex, follow' : undefined,
				)
				for (const query of [
					'',
					'?utm_source=test&fbclid=tracking',
					`?book=${encodeURIComponent(book.id)}`,
				]) {
					await page.goto(`${base}${path}${query}`)
					assert.equal(
						await page.$eval('link[rel="canonical"]', (el) => el.href),
						`https://austen.page/${path}`,
					)
					assert.equal(
						await page.$eval('meta[property="og:url"]', (el) => el.content),
						`https://austen.page/${path}`,
					)
					assert.equal(await page.title(), title)
					if (path === 'generate/')
						assert.equal(
							await page.$eval('meta[name="robots"]', (el) => el.content),
							'noindex, follow',
						)
				}
				for (const width of [320, 375]) {
					await page.setViewport({ width, height: 900 })
					assert.ok(
						await page.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
						`${path} wraps at ${width}px`,
					)
				}
			}
			assert.equal(
				(await builtPage(''))('meta[name="description"]').attr('content'),
				'Explore character relationship maps for books. Discover the connections between literary characters and create interactive maps of your own.',
			)
			assert.match(
				(await builtPage('maps/'))('meta[name="description"]').attr('content'),
				/52 published/,
			)
			assert.match(
				(await builtPage('catalog/'))('meta[name="description"]').attr(
					'content',
				),
				/54 books.*52 published/,
			)
			const contact = await builtPage('contact/')
			assert.equal(
				contact('meta[name="description"]').attr('content'),
				'Contact Austen with questions, feedback, or corrections about character relationship maps.',
			)
			assert.equal(
				contact('#contact-form').attr('action'),
				'https://api.web3forms.com/submit',
			)
			assert.equal(contact('#contact-form').attr('method'), 'POST')
			assert.equal(
				contact('input[name="access_key"]').attr('value'),
				'90fe3833-26f2-4e42-b640-71165bc11c55',
			)
			assert.deepEqual(
				contact('#contact-form [required]')
					.map((_, field) => contact(field).attr('name'))
					.get(),
				['name', 'email', 'message'],
			)
			assert.deepEqual(
				contact('#contact-form label')
					.map((_, label) => contact(label).attr('for'))
					.get(),
				['contact-name', 'contact-email', 'contact-message'],
			)
			assert.equal(contact('#contact-result').attr('role'), 'status')
			assert.equal(
				(await builtPage('maps/'))('a[href="/catalog/"]').first().text(),
				'Explore the full catalog',
			)
			assert.deepEqual(jsonLd(await builtPage('')), [
				{
					'@context': 'https://schema.org',
					'@type': 'WebSite',
					name: 'Austen',
					url: 'https://austen.page/',
				},
			])
			const sitemap = load(
				await readFile(resolve(root, 'dist/sitemap-0.xml'), 'utf8'),
				{ xmlMode: true },
			)
			const urls = sitemap('loc')
				.map((_, el) => sitemap(el).text())
				.get()
			assert.ok(!urls.includes('https://austen.page/generate/'))
			for (const path of [
				'',
				'maps/',
				'catalog/',
				'contact/',
				'authors/',
				'authors/jane-austen/',
				'authors/author-one/',
				'authors/author-two/',
				...[book, ...extra].map((b) => `books/${b.slug}/`),
			]) {
				assert.ok(
					urls.includes(`https://austen.page/${path}`),
					`Sitemap includes ${path}`,
				)
			}
			assert.ok(!urls.some((url) => url.includes('/authors/anonymous/')))
			assert.match(
				await readFile(resolve(root, 'dist/robots.txt'), 'utf8'),
				/Allow: \//,
			)
			assert.doesNotMatch(
				await readFile(resolve(root, 'dist/robots.txt'), 'utf8'),
				/Disallow:/,
			)
		},
	)
	await t.test(
		'contact form submits safely and handles API and network failures after client navigation',
		async (t) => {
			await page.setViewport({ width: 375, height: 900 })
			await page.setJavaScriptEnabled(true)
			await page.goto(base)
			await Promise.all([
				page.waitForFunction(
					() =>
						location.pathname === '/contact/' &&
						document.getElementById('contact-form')?.dataset.initialized ===
							'true',
				),
				page.click('nav a[href="/contact/"]'),
			])

			await page.type('#contact-name', 'Jane Reader')
			await page.type('#contact-email', 'jane@example.com')
			await page.type('#contact-message', 'A thoughtful note')

			let releaseSuccess
			t.after(() => {
				releaseSuccess?.()
				contactReply = null
			})
			contactReply = async (request) => {
				await new Promise((resolve) => {
					releaseSuccess = resolve
				})
				await request.respond({
					status: 200,
					contentType: 'application/json',
					headers: { 'Access-Control-Allow-Origin': '*' },
					body: JSON.stringify({ success: true }),
				})
			}
			// Exercise the partial-visibility case that can trigger a second scroll.
			await partiallyExposeControl(page, '#contact-form button')
			await Promise.all([
				page.waitForRequest('https://api.web3forms.com/submit'),
				clickInView(page, '#contact-form button'),
			])
			assert.equal(
				await page.$eval('#contact-result', (result) => result.textContent),
				'Sending...',
			)
			assert.equal(
				await page.$eval('#contact-form button', (button) => button.disabled),
				true,
			)
			releaseSuccess()
			await page.waitForFunction(
				() =>
					document.getElementById('contact-result')?.dataset.tone === 'success',
			)
			assert.equal(
				await page.$eval('#contact-result', (result) => result.textContent),
				'Form Submitted Successfully',
			)
			assert.deepEqual(
				await page.$$eval(
					'#contact-form input:not([type="hidden"]), #contact-form textarea',
					(fields) => fields.map((field) => field.value),
				),
				['', '', ''],
			)

			await page.type('#contact-name', 'Jane Reader')
			await page.type('#contact-email', 'jane@example.com')
			await page.type('#contact-message', 'Please keep this message')
			contactReply = (request) =>
				request.respond({
					status: 422,
					contentType: 'application/json',
					headers: { 'Access-Control-Allow-Origin': '*' },
					body: JSON.stringify({
						success: false,
						message: '<strong>Please try again</strong>',
					}),
				})
			await clickInView(page, '#contact-form button')
			await page.waitForFunction(
				() =>
					document.getElementById('contact-result')?.dataset.tone === 'error',
			)
			assert.equal(
				await page.$eval('#contact-result', (result) => result.textContent),
				'<strong>Please try again</strong>',
			)
			assert.equal(await page.$('#contact-result strong'), null)
			assert.equal(
				await page.$eval('#contact-message', (field) => field.value),
				'Please keep this message',
			)

			contactReply = (request) => request.abort()
			await clickInView(page, '#contact-form button')
			await page.waitForFunction(
				() =>
					document.getElementById('contact-result')?.textContent ===
					'Something went wrong. Please try again.',
			)
			assert.equal(
				await page.$eval('#contact-form button', (button) => button.disabled),
				false,
			)
			contactReply = null
		},
	)
	await t.test(
		'author directory, collections, contextual links and matching breadcrumbs are static',
		async () => {
			const directory = await builtPage('authors/')
			assert.deepEqual(
				directory('.author-directory a')
					.map((_, a) => directory(a).text())
					.get(),
				['Author One', 'Author Two', escapedAuthor, 'Jane Austen'],
			)
			for (const [path, expectedBooks] of [
				['authors/author-one/', extra.slice(0, 2)],
				['authors/author-two/', extra.slice(0, 2)],
				['authors/jane-austen/', [book, ...extra.slice(6)]],
			]) {
				const $ = await builtPage(path)
				const name = path.includes('jane-austen')
					? 'Jane Austen'
					: path.includes('author-one')
						? 'Author One'
						: 'Author Two'
				assert.equal(
					$('title').text(),
					`${name} Character Relationship Maps — Austen`,
				)
				assert.equal($('h1').text(), `${name} character relationship maps`)
				assert.equal($('meta[name="robots"]').length, 0)
				assert.deepEqual(
					$('.library-list .book-cover-caption h3')
						.map((_, el) => $(el).text())
						.get(),
					expectedBooks
						.map((b) => b.title)
						.sort((a, b) => a.localeCompare(b, 'en')),
				)
				assert.match(
					$('.library-intro p').last().text(),
					new RegExp(`${expectedBooks.length} published`),
				)
			}
			for (const b of [book, extra[0], extra[2]]) {
				const $ = await builtPage(`books/${b.slug}/`)
				const data = jsonLd($)
				const webpage = data.find((item) => item['@type'] === 'WebPage')
				assert.deepEqual(webpage.about, {
					'@type': 'Book',
					name: b.title,
					author: b.authors.map((name) => ({ '@type': 'Person', name })),
				})
				assert.equal(webpage.name, `${b.title} Character Relationship Map`)
				assert.equal(
					webpage.description,
					$('meta[name="description"]').attr('content'),
				)
				assert.equal(webpage.url, `https://austen.page/books/${b.slug}/`)
				assert.equal(webpage.creator, undefined)
				assert.deepEqual(
					$('.book-byline a')
						.map((_, el) => $(el).text())
						.get(),
					b.authors,
				)
				const links = $('.related-maps .book-cover-link')
					.map((_, el) => $(el).attr('href'))
					.get()
				assert.ok(links.length > 0 && links.length <= 4)
				assert.equal(new Set(links).size, links.length)
				assert.ok(!links.includes(`/books/${b.slug}/`))
				if (b === extra[0])
					assert.deepEqual(links, [`/books/${extra[1].slug}/`])
				assert.equal($('.related-maps > p a').length, b.authors.length)
			}
			for (const b of [extra[4], extra[5]]) {
				const $ = await builtPage(`books/${b.slug}/`)
				assert.equal($('.book-byline a, .related-maps').length, 0)
			}
			const escapedHub = directory('.author-directory a')
				.toArray()
				.find((el) => directory(el).text() === escapedAuthor)
			const escapedPath = directory(escapedHub).attr('href').slice(1)
			for (const path of [
				`books/${book.slug}/`,
				`books/${extra[2].slug}/`,
				'authors/jane-austen/',
				escapedPath,
			]) {
				const $ = await builtPage(path)
				const breadcrumb = jsonLd($).find(
					(item) => item['@type'] === 'BreadcrumbList',
				)
				const items = $('.breadcrumbs li')
					.toArray()
					.map((el) => ({
						name: $(el).children().last().text(),
						href: $(el).find('a').attr('href') || `/${path}`,
					}))
				assert.deepEqual(
					breadcrumb.itemListElement,
					items.map((item, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						name: item.name,
						item: new URL(item.href, 'https://austen.page').href,
					})),
				)
				assert.equal($('.breadcrumbs [aria-current="page"]').length, 1)
				await page.goto(`${base}${path}?utm_source=test`)
				assert.equal(
					await page.$eval('link[rel="canonical"]', (el) => el.href),
					`https://austen.page/${path}`,
				)
				for (const width of [320, 375, 800]) {
					await page.setViewport({ width, height: 900 })
					assert.ok(
						await page.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
						`${path} wraps at ${width}px`,
					)
					assert.ok(
						await page.$eval('.breadcrumbs', (el) => el.checkVisibility()),
					)
				}
				assert.equal(
					$('script:not([src]):not([type="application/ld+json"])')
						.toArray()
						.some((el) => $(el).text().includes('alert("SEO")')),
					false,
				)
			}
			assert.equal((await page.goto(`${base}authors/anonymous/`)).status(), 404)
			assert.equal(
				(await page.goto(`${base}authors/charlotte-bronte/`)).status(),
				404,
			)
		},
	)
	await t.test(
		'social previews use actual local portrait JPEG metadata and retain the logo fallback',
		async () => {
			for (const [path, hasCover, title] of [
				[`books/${book.slug}/`, true, book.title],
				[`books/${extra[0].slug}/`, true, extra[0].title],
				[`books/${extra[2].slug}/`, false],
				['', false],
				['authors/jane-austen/', false],
			]) {
				const $ = await builtPage(path)
				const imageUrl = $('meta[property="og:image"]').attr('content')
				assert.ok(imageUrl.startsWith('https://austen.page/'))
				assert.equal($('meta[name="twitter:image"]').attr('content'), imageUrl)
				assert.equal($('meta[name="twitter:card"]').attr('content'), 'summary')
				const metadata = await sharp(
					await readFile(
						resolve(root, 'dist', new URL(imageUrl).pathname.slice(1)),
					),
				).metadata()
				assert.equal(
					Number($('meta[property="og:image:width"]').attr('content')),
					metadata.width,
				)
				assert.equal(
					Number($('meta[property="og:image:height"]').attr('content')),
					metadata.height,
				)
				assert.equal(
					$('meta[property="og:image:type"]').attr('content'),
					`image/${metadata.format}`,
				)
				const alt = hasCover ? `Cover of ${title}` : 'Austen logo'
				assert.equal($('meta[property="og:image:alt"]').attr('content'), alt)
				assert.equal($('meta[name="twitter:image:alt"]').attr('content'), alt)
				if (hasCover) {
					assert.equal(metadata.width, 720)
					assert.equal(metadata.format, 'jpeg')
					const original = await sharp(cover).metadata()
					assert.ok(
						Math.abs(
							metadata.height / metadata.width -
								original.height / original.width,
						) < 0.002,
					)
					assert.ok(metadata.height > metadata.width)
				} else assert.equal(imageUrl, 'https://austen.page/logo.png')
			}
		},
	)
	await t.test(
		'published maps have static SVG, attribution and spoilers without JavaScript; unpublished books have no routes',
		async () => {
			await page.setJavaScriptEnabled(false)
			await page.goto(publishedUrl)
			const expectedTitle = `${book.title} Character Relationship Map`
			const expectedDescription = `Explore the relationships between Elizabeth Bennet and Jane Bennet in ${book.title} by ${book.authors.join(', ')}.`
			const $ = load(
				await readFile(
					resolve(root, 'dist/books', book.slug, 'index.html'),
					'utf8',
				),
			)
			$('svg, script, style, textarea').remove()
			assert.equal($('h1').text(), expectedTitle)
			assert.equal($('title').text(), `${expectedTitle} — Austen`)
			assert.equal(
				$('meta[name="description"]').attr('content'),
				expectedDescription,
			)
			assert.equal($('.book-description').text(), expectedDescription)
			assert.equal(
				$('.book-byline').text(),
				`${book.authors.join(', ')} · ${book.year}`,
			)
			assert.deepEqual(
				$('.book-details h2')
					.map((_, heading) => $(heading).text())
					.get(),
				['Key characters', 'Key relationships'],
			)
			assert.deepEqual(
				$('.character-list li')
					.map((_, item) => $(item).text())
					.get(),
				['Elizabeth Bennet', 'Jane Bennet'],
			)
			assert.equal(
				$('.relationship-list dt').text(),
				'Elizabeth Bennet → Jane Bennet',
			)
			assert.equal($('.relationship-list dd').text(), 'Sister of')
			assert.equal($('.book-details [hidden], .book-details details').length, 0)
			assert.equal($('#mermaid-section .section-heading').length, 0)
			assert.deepEqual(
				$('#diagram-workspace > section')
					.map(
						(_, section) =>
							$(section).attr('id') || $(section).attr('aria-labelledby'),
					)
					.get(),
				[
					'mermaid-section',
					'key-characters-heading',
					'key-relationships-heading',
					'actions-section',
					'editor-section',
				],
			)
			for (const width of [320, 375, 800, 1280]) {
				await page.setViewport({ width, height: 900 })
				assert.ok(
					await page.$eval('.character-list', (node) => node.checkVisibility()),
				)
				assert.ok(
					await page.$eval('.relationship-list', (node) =>
						node.checkVisibility(),
					),
				)
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				)
			}
			assert.ok(await page.$('#mermaid-container svg'))
			assert.equal(
				await page.$eval('#diagram-workspace', (n) => n.hidden),
				false,
			)
			assert.match(
				await page.$eval('main', (n) => n.textContent),
				/Spoilers:.*whole book/s,
			)
			assert.match(
				await page.$eval('main', (n) => n.textContent),
				/AI-generated/,
			)
			assert.doesNotMatch(
				await page.$eval('main', (n) => n.textContent),
				/\bReviewed\b/,
			)
			assert.doesNotMatch(
				await page.$eval('.book-intro-copy', (node) => node.textContent),
				/Metadata:|Sudalyph|Standard Ebooks edition/,
			)
			assert.equal(
				(await page.goto(`${base}books/charlotte-bronte-jane-eyre/`)).status(),
				404,
			)
			await page.goto(base)
			assert.equal(await page.$$eval('[data-library-book]', (n) => n.length), 8)
			assert.equal(providerCalls, 0)
			assert.equal(
				await page.$eval('.browse-maps-link', (link) =>
					link.textContent.trim(),
				),
				'Browse all 52 maps →',
			)
			await Promise.all([
				page.waitForNavigation(),
				page.click('.browse-maps-link'),
			])
			assert.equal(page.url(), `${base}maps/`)
			assert.equal(
				await page.$$eval('[data-library-book]', (n) => n.length),
				52,
			)
			const index = JSON.parse(
				await readFile(resolve(root, 'dist/catalog-index.json'), 'utf8'),
			)
			assert.equal(index.length, 54)
			assert.ok(!JSON.stringify(index).includes('mermaid'))
			assert.equal(index[0].mapStatus, 'available')
			assert.equal(index[1].mapStatus, 'unavailable')
			assert.equal(index[1].publishedUrl, null)
			assert.equal(index[0].coverPath, undefined)
			assert.equal(index[1].coverPath, undefined)
			assert.equal(index[2].mapStatus, 'pending')
			assert.equal(index[2].publishedUrl, null)
			assert.equal(
				(await page.goto(`${base}books/${extra.at(-1).slug}/`)).status(),
				200,
			)
		},
	)
	await t.test(
		'book content preserves all relationships, escapes text, and handles larger casts and missing years',
		async () => {
			await page.setJavaScriptEnabled(false)
			await page.goto(`${base}books/${extra[0].slug}/`)
			assert.deepEqual(
				await page.$$eval('.character-list li', (items) =>
					items.map((item) => item.textContent),
				),
				contentNames,
			)
			assert.deepEqual(
				await page.$$eval('.relationship-list dt', (items) =>
					items.map((item) => item.textContent),
				),
				[
					'Élizabeth & Anne → Jane Bennet',
					'Jane Bennet → Élizabeth & Anne',
					'Élizabeth & Anne → Jane Bennet',
					'Élizabeth & Anne → George Wickham',
				],
			)
			assert.deepEqual(
				await page.$$eval('.relationship-list dd', (items) =>
					items.map((item) => item.textContent),
				),
				['Knows & trusts', 'Friend of', 'Mentors', 'Relationship unspecified'],
			)
			assert.equal(
				await page.$eval('.book-description', (node) => node.textContent),
				`Explore the relationships between ${contentNames.slice(0, 5).join(', ')}, and the other major characters in ${extra[0].title} by Author One and Author Two.`,
			)
			assert.equal(
				await page.$eval('.book-byline', (node) => node.textContent),
				'Author One, Author Two · Year unknown',
			)
			assert.equal(
				await page.$eval('h1', (node) => node.textContent),
				`${extra[0].title} Character Relationship Map`,
			)
			assert.equal(
				await page.$eval('meta[name="description"]', (node) => node.content),
				await page.$eval('.book-description', (node) => node.textContent),
			)
			const html = await readFile(
				resolve(root, 'dist/books', extra[0].slug, 'index.html'),
				'utf8',
			)
			assert.ok(html.includes('Élizabeth &amp; Anne'))
			for (const width of [320, 375, 800, 1280]) {
				await page.setViewport({ width, height: 900 })
				assert.ok(
					await page.$eval(
						'.character-list',
						(node) =>
							node.checkVisibility() && node.scrollWidth <= node.clientWidth,
					),
				)
				assert.ok(
					await page.$eval(
						'.relationship-list',
						(node) =>
							node.checkVisibility() && node.scrollWidth <= node.clientWidth,
					),
				)
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				)
			}
		},
	)
	await t.test(
		'local covers render without JavaScript; grids and filtering work at all sizes',
		async () => {
			await page.setJavaScriptEnabled(false)
			await page.goto(publishedUrl)
			assert.ok(
				await page.$eval(
					'.book-intro [data-book-cover] img',
					(img) => img.complete && img.naturalWidth > 0,
				),
			)
			assert.equal(
				await page.$eval(
					'.book-intro [data-book-cover] img',
					(img) => img.loading,
				),
				'eager',
			)
			assert.ok(
				(
					await page.$eval(
						'.book-intro [data-book-cover] source',
						(source) => source.srcset,
					)
				).includes('/_astro/'),
			)
			assert.ok(
				(
					await page.$eval(
						'.book-intro [data-book-cover] img',
						(img) => img.src,
					)
				).includes('/_astro/'),
			)
			await page.goto(`${base}maps/`)
			await page.waitForFunction(
				() => document.querySelector('[data-book-cover] img').naturalWidth > 0,
			)
			assert.equal(
				await page.$eval('.book-cover-link', (link) => link.href),
				publishedUrl,
			)
			assert.equal(
				await page.$$eval('[data-book-cover] img', (images) =>
					images.every((img) => img.loading === 'lazy'),
				),
				true,
			)
			await page.setJavaScriptEnabled(true)
			await page.setViewport({ width: 1280, height: 900 })
			await page.goto(`${base}maps/`)
			assert.equal(
				await page.$$eval('[data-book-cover]', (covers) => covers.length),
				52,
			)
			assert.equal(
				await page.$$eval(
					'[data-book-cover]:not(:has(img))',
					(covers) => covers.length,
				),
				49,
			)
			const columns = () =>
				page.$eval(
					'.library-list',
					(list) =>
						getComputedStyle(list).gridTemplateColumns.split(' ').length,
				)
			for (const [width, expected] of [
				[1280, 6],
				[800, 4],
				[375, 2],
			]) {
				await page.setViewport({ width, height: 900 })
				assert.equal(await columns(), expected)
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				)
			}
			await page.type('#library-search', 'Fixture 50')
			assert.equal(
				await page.$$eval(
					'[data-library-book]:not([hidden])',
					(cards) => cards.length,
				),
				1,
			)
			assert.match(
				await page.$eval('#library-count', (count) => count.textContent),
				/Showing 1–1 of 1 matching map/,
			)
			await page.$eval('#library-search', (input) => {
				input.value = 'no matching book'
				input.dispatchEvent(new Event('input'))
			})
			assert.equal(
				await page.$$eval(
					'[data-library-book]:not([hidden])',
					(cards) => cards.length,
				),
				0,
			)
			await page.goto(`${base}catalog/`)
			assert.equal(await columns(), 2)
			assert.equal(
				await page.$$eval('[data-library-book]', (cards) => cards.length),
				54,
			)
			await page.goto(publishedUrl)
			assert.equal(
				await page.$eval(
					'.book-intro',
					(intro) =>
						getComputedStyle(intro).gridTemplateColumns.split(' ').length,
				),
				1,
			)
			assert.equal(searchRequests, 0)
			assert.equal(providerCalls, 0)
			await page.setViewport({ width: 1280, height: 900 })
		},
	)
	await t.test(
		'maps paginate the complete search results and restore URL state',
		async () => {
			const visibleLinks = () =>
				page.$$eval(
					'[data-library-book]:not([hidden]) .book-cover-link',
					(links) => links.map((link) => link.getAttribute('href')),
				)
			const current = (number) =>
				page.waitForFunction(
					(number) =>
						document.querySelector('.library-pagination [aria-current="page"]')
							?.dataset.page === String(number),
					{},
					number,
				)
			const setSearch = (value) =>
				page.$eval(
					'#library-search',
					(input, value) => {
						input.value = value
						input.dispatchEvent(new Event('input'))
					},
					value,
				)
			await page.setJavaScriptEnabled(false)
			await page.goto(`${base}maps/?page=2`)
			assert.equal((await visibleLinks()).length, 52)
			assert.equal(
				await page.$eval(
					'.library-pagination',
					(nav) => getComputedStyle(nav).display,
				),
				'none',
			)
			const allLinks = await visibleLinks()
			await page.setJavaScriptEnabled(true)
			await page.goto(`${base}maps/`)
			await current(1)
			assert.deepEqual(await visibleLinks(), allLinks.slice(0, 24))
			assert.equal(
				await page.$eval(
					'[aria-label="Previous page"]',
					(button) => button.disabled,
				),
				true,
			)
			const historyLength = await page.evaluate(() => history.length)
			await page.focus('[aria-label="Page 2"]')
			await page.keyboard.press('Enter')
			await current(2)
			assert.deepEqual(await visibleLinks(), allLinks.slice(24, 48))
			assert.equal(
				await page.evaluate(() => document.activeElement.id),
				'library-heading',
			)
			assert.equal(page.url(), `${base}maps/?page=2`)
			assert.equal(await page.evaluate(() => history.length), historyLength)
			assert.equal(
				await page.$eval('#library-count', (node) => node.textContent),
				'Showing 25–48 of 52 maps',
			)
			await page.locator('[aria-label="Next page"]').click()
			await current(3)
			assert.deepEqual(await visibleLinks(), allLinks.slice(48))
			assert.equal(
				await page.$eval(
					'[aria-label="Next page"]',
					(button) => button.disabled,
				),
				true,
			)
			await page.locator('[aria-label="Previous page"]').click()
			await current(2)
			await page.reload()
			await current(2)
			assert.deepEqual(await visibleLinks(), allLinks.slice(24, 48))

			await page.focus('#library-search')
			await setSearch('Fixture')
			await current(1)
			assert.equal(
				await page.evaluate(() => document.activeElement.id),
				'library-search',
			)
			assert.equal(new URL(page.url()).searchParams.get('page'), null)
			await page.locator('[aria-label="Next page"]').click()
			await current(2)
			assert.equal((await visibleLinks()).length, 24)
			assert.equal(new URL(page.url()).searchParams.get('q'), 'Fixture')
			await setSearch('Fixture 50')
			assert.deepEqual(await visibleLinks(), [`/books/${extra.at(-1).slug}/`])
			assert.equal(
				await page.$eval('.library-pagination', (nav) => nav.hidden),
				true,
			)
			await setSearch('no matching book')
			assert.equal((await visibleLinks()).length, 0)
			assert.equal(
				await page.$eval('#library-count', (node) => node.textContent),
				'No maps found',
			)
			assert.equal(
				await page.$eval('.library-pagination', (nav) => nav.hidden),
				true,
			)
			await setSearch('')
			await current(1)
			assert.equal(page.url(), `${base}maps/`)
			assert.deepEqual(await visibleLinks(), allLinks.slice(0, 24))

			for (const [value, expected] of [
				['0', 1],
				['-1', 1],
				['nope', 1],
				['1.5', 1],
				['999', 3],
			]) {
				await page.goto(
					`${base}maps/?page=${value}&utm_source=test#library-heading`,
				)
				await current(expected)
				const url = new URL(page.url())
				assert.equal(
					url.searchParams.get('page'),
					expected === 1 ? null : String(expected),
				)
				assert.equal(url.searchParams.get('utm_source'), 'test')
				assert.equal(url.hash, '#library-heading')
				assert.equal(
					await page.$eval('link[rel="canonical"]', (link) => link.href),
					'https://austen.page/maps/',
				)
			}
			await page.goto(`${base}maps/?q=Fixture&page=2`)
			await current(2)
			const filteredLinks = await visibleLinks()
			assert.equal(
				await page.$eval('#library-search', (input) => input.value),
				'Fixture',
			)
			await Promise.all([
				page.waitForFunction(
					() =>
						location.pathname === '/catalog/' &&
						!document.querySelector('.library-pagination'),
				),
				page.locator('a[href="/catalog/"]').click(),
			])
			await page.goBack()
			await current(2)
			assert.deepEqual(await visibleLinks(), filteredLinks)
			await page.goForward()
			await page.waitForFunction(
				() =>
					location.pathname === '/catalog/' &&
					!document.querySelector('.library-pagination'),
			)
			await page.goBack()
			await current(2)
			await setSearch('1813')
			assert.deepEqual(await visibleLinks(), [`/books/${book.slug}/`])

			await setSearch('')
			for (const width of [320, 375, 800, 1280]) {
				await page.setViewport({ width, height: 900 })
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				)
			}
		},
	)
	await t.test(
		'homepage features eight published covers below the generator with keyboard navigation and responsive columns',
		async () => {
			await page.goto(base)
			assert.ok(await page.$('#search-input'))
			assert.equal(
				await page.$eval('#selected-book-section', (section) => section.hidden),
				true,
			)
			assert.equal(
				await page.$eval('#diagram-workspace', (workspace) => workspace.hidden),
				true,
			)
			assert.deepEqual(
				await page.$$eval('.featured-list .book-cover-caption h3', (titles) =>
					titles.map((title) => title.textContent),
				),
				[book.title, ...extra.slice(0, 7).map((entry) => entry.title)],
			)
			assert.deepEqual(
				await page.$$eval('.featured-list .book-cover-link', (links) =>
					links.map((link) => link.href),
				),
				[book, ...extra.slice(0, 7)].map(
					(entry) => `${base}books/${entry.slug}/`,
				),
			)
			assert.equal(await page.$('#library-search'), null)
			assert.equal(
				await page.$eval('nav a', (link) => link.href),
				`${base}maps/`,
			)
			assert.equal(
				await page.$eval('nav a:last-child', (link) => link.href),
				'https://github.com/herol3oy/austen/',
			)
			assert.deepEqual(
				await page.$$eval('nav a', (links) =>
					links.map((link) => link.textContent),
				),
				['Maps', 'Authors', 'Contact', 'GitHub'],
			)
			for (const [width, expected] of [
				[1280, 4],
				[800, 4],
				[375, 2],
				[320, 2],
			]) {
				await page.setViewport({ width, height: 900 })
				assert.equal(
					await page.$eval(
						'.featured-list',
						(list) =>
							getComputedStyle(list).gridTemplateColumns.split(' ').length,
					),
					expected,
				)
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				)
				assert.ok(
					await page.evaluate(
						() =>
							document.querySelector('.featured-maps').getBoundingClientRect()
								.top >=
							document.querySelector('#search-section').getBoundingClientRect()
								.bottom,
					),
				)
			}
			await page.focus('.featured-list .book-cover-link')
			await Promise.all([
				page.waitForFunction((url) => location.href === url, {}, publishedUrl),
				page.keyboard.press('Enter'),
			])
			assert.equal(page.url(), publishedUrl)
			await page.goto(base)
			await page.focus('.browse-maps-link')
			await Promise.all([
				page.waitForFunction(
					(url) => location.href === url,
					{},
					`${base}maps/`,
				),
				page.keyboard.press('Enter'),
			])
			assert.equal(page.url(), `${base}maps/`)
			assert.equal(searchRequests, 0)
			assert.equal(providerCalls, 0)
			await page.setViewport({ width: 1280, height: 900 })
		},
	)
	await t.test(
		'saved workspace uses canonical share; edits validate, revert, cancel and save locally with original timestamp',
		async () => {
			await page.setJavaScriptEnabled(true)
			await page.goto(publishedUrl)
			await page.waitForFunction(
				() => !document.getElementById('edit-btn').disabled,
			)
			assert.equal(
				await page.$eval('#share-url-input', (n) => n.value),
				`https://austen.page/books/${book.slug}/`,
			)
			await page.click('#edit-btn')
			const original = await page.$eval(
				'#mermaid-container',
				(n) => n.textContent,
			)
			const setDraft = (value) =>
				page.$eval(
					'#editor-input',
					(n, value) => {
						n.value = value
						n.dispatchEvent(new Event('input', { bubbles: true }))
					},
					value,
				)
			await setDraft('graph LR\nA[broken')
			await page.waitForFunction(
				() => document.getElementById('editor-status').dataset.tone === 'error',
			)
			assert.equal(
				await page.$eval('#mermaid-container', (n) => n.textContent),
				original,
			)
			assert.equal(
				await page.$eval('#editor-save-btn', (n) => n.disabled),
				true,
			)
			await page.click('#editor-revert-btn')
			assert.equal(await page.$eval('#editor-input', (n) => n.value), graph)
			await setDraft(graph.replace('Sister of', 'Sisters'))
			await page.waitForFunction(
				() => !document.getElementById('editor-save-btn').disabled,
			)
			page.once('dialog', (dialog) => dialog.accept())
			await page.click('#editor-cancel-btn')
			assert.equal(await page.$eval('#mermaid-source', (n) => n.value), graph)
			await page.click('#edit-btn')
			await setDraft(graph.replace('Sister of', 'Sisters'))
			await page.waitForFunction(
				() => !document.getElementById('editor-save-btn').disabled,
			)
			await page.click('#editor-save-btn')
			const share = new URL(
				await page.$eval('#share-url-input', (n) => n.value),
			)
			assert.equal(share.pathname, '/generate/')
			assert.equal(
				decodeShare(share.searchParams.get('graph')).generatedAt,
				generatedAt,
			)
			assert.equal(
				await page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('austen-history'))[0].generatedAt,
				),
				generatedAt,
			)
			await page.reload()
			await page.waitForFunction(
				() => !document.getElementById('edit-btn').disabled,
			)
			assert.equal(await page.$eval('#mermaid-source', (n) => n.value), graph)
		},
	)
	await t.test('pan/zoom and complete SVG/PNG exports work', async (t) => {
		t.after(() => page.setViewport({ width: 1280, height: 900 }))
		await page.setViewport({ width: 1280, height: 600 })
		await page.setJavaScriptEnabled(true)
		await page.goto(publishedUrl)
		await page.waitForSelector('#mermaid-container.is-interactive svg')
		await page.waitForFunction(
			() =>
				!document.getElementById('zoom-in-btn').disabled &&
				!document.getElementById('download-svg-btn').disabled,
		)
		const downloads = resolve(root, 'downloads')
		await mkdir(downloads)
		const cdp = await page.createCDPSession()
		await cdp.send('Browser.setDownloadBehavior', {
			behavior: 'allow',
			downloadPath: downloads,
		})
		await partiallyExposeControl(page, '#zoom-in-btn')
		await clickInView(page, '#zoom-in-btn')
		await page.waitForFunction(
			() =>
				document.getElementById('diagram-zoom-level').textContent !== '100%',
		)
		await clickInView(page, '#download-svg-btn')
		await page.waitForFunction(() =>
			document
				.getElementById('download-status')
				.textContent.includes('downloaded'),
		)
		await clickInView(page, '#download-png-btn')
		await page.waitForFunction(() =>
			document
				.getElementById('download-status')
				.textContent.includes('PNG downloaded'),
		)
		let files = []
		for (let i = 0; i < 50; i++) {
			files = await readdir(downloads)
			if (
				files.some((f) => f.endsWith('.png')) &&
				files.some((f) => f.endsWith('.svg'))
			)
				break
			await delay(100)
		}
		const savedSvg = await readFile(
			resolve(
				downloads,
				files.find((f) => f.endsWith('.svg')),
			),
			'utf8',
		)
		const dimensions = validateSvg(savedSvg)
		assert.ok(dimensions.width > 300)
		assert.ok(!savedSvg.includes('transform-origin'))
		assert.match(savedSvg, /fill:#f1e3de/)
		assert.match(savedSvg, /stroke:#915366/)
		assert.doesNotMatch(savedSvg, /#ece6d9|#40584b/)
		const png = await readFile(
			resolve(
				downloads,
				files.find((f) => f.endsWith('.png')),
			),
		)
		assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a')
		assert.ok(png.readUInt32BE(16) >= dimensions.width)
		assert.ok(png.readUInt32BE(20) >= dimensions.height)
		const pixel = await sharp(png)
			.extract({ left: 0, top: 0, width: 1, height: 1 })
			.removeAlpha()
			.raw()
			.toBuffer()
		assert.deepEqual([...pixel], [255, 250, 247])
	})
	await t.test(
		'catalog filtering and preselection offer a published map without generating',
		async () => {
			await page.goto(`${base}catalog/`)
			await page.type('#library-search', '1813')
			assert.equal(
				await page.$$eval('[data-library-book]:not([hidden])', (n) => n.length),
				1,
			)
			await page.goto(`${base}generate/?book=${encodeURIComponent(book.id)}`)
			await page.waitForSelector('.published-offer')
			assert.equal(providerCalls, 0)
			assert.equal(await page.$('#selected-book-card img'), null)
		},
	)
	await t.test(
		'legacy homepage shares forward, preserve metadata and render; malformed history and Undo work',
		async () => {
			const oldShare = (
				await readFile(resolve(ROOT, 'tests/fixtures/legacy-share.txt'), 'utf8')
			).trim()
			await page.goto(
				`${base}?graph=${new URL(oldShare).searchParams.get('graph')}`,
			)
			await page.waitForFunction(
				() =>
					location.pathname === '/generate/' &&
					document
						.getElementById('selected-book-card')
						?.textContent.includes('Pride and Prejudice') &&
					!document.getElementById('edit-btn').disabled,
			)
			assert.match(
				await page.$eval('#selected-book-card', (n) => n.textContent),
				/Pride and Prejudice/,
			)
			await page.evaluate(
				({ graph, generatedAt }) =>
					localStorage.setItem(
						'austen-history',
						JSON.stringify([
							{
								book: {
									title: 'Legacy',
									authors: 'malformed',
									publishYear: 1813,
								},
								mermaid: graph,
								generatedAt,
							},
							{ book: null, mermaid: 4 },
						]),
					),
				{ graph, generatedAt },
			)
			await page.goto(`${base}generate/`)
			await page.waitForSelector('.shelf-delete')
			await page.click('.shelf-delete')
			await page.click('#history-undo-btn')
			assert.equal(await page.$$eval('.shelf-row', (n) => n.length), 1)
			await page.goto(`${base}generate/?graph=broken`)
			await page.waitForFunction(() =>
				document
					.getElementById('global-status')
					.textContent.includes('corrupted'),
			)
		},
	)
	await t.test(
		'homepage generation is click-only; stale generation cannot replace a new selection; valid results enter history after render',
		async () => {
			await page.goto(`${base}?book=${encodeURIComponent(book.id)}`)
			await page.waitForSelector('.published-offer')
			assert.equal(providerCalls, 0)
			const reply = (request, content) =>
				request
					.respond({
						status: 200,
						contentType: 'application/json',
						headers: { 'Access-Control-Allow-Origin': '*' },
						body: JSON.stringify(content),
					})
					.catch(() => {})
			apiReply = async (request) => {
				await delay(700)
				await reply(request, { mermaid: graph, generatedAt })
			}
			await page.click('#selected-book-card button')
			await page.$eval('.manual-entry', (n) => (n.open = true))
			await page.type('[name="title"]', 'Another Book')
			await page.type('[name="author"]', 'Another Author')
			await page.click('#manual-book-form button')
			await delay(1000)
			assert.match(
				await page.$eval('#selected-book-card', (n) => n.textContent),
				/Another Book/,
			)
			assert.equal(
				await page.$eval('#diagram-workspace', (n) => n.hidden),
				true,
			)
			apiReply = (request) => reply(request, { mermaid: graph, generatedAt })
			await page.click('#selected-book-card button')
			await page.waitForFunction(
				() => !document.getElementById('edit-btn').disabled,
			)
			assert.equal(
				await page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('austen-history'))[0].book.title,
				),
				'Another Book',
			)
			assert.equal(
				new URL(await page.$eval('#share-url-input', (input) => input.value))
					.pathname,
				'/generate/',
			)
			await page.click('#edit-btn')
			await page.waitForSelector('#editor-section', { visible: true })
			await page.click('#editor-cancel-btn')
			assert.equal(
				await page.$$eval(
					'.featured-list [data-library-book]',
					(cards) => cards.length,
				),
				8,
			)
			const saved = await page.evaluate(() =>
				localStorage.getItem('austen-history'),
			)
			apiReply = (request) =>
				reply(request, { mermaid: 'graph LR\nA[broken', generatedAt })
			await page.click('#selected-book-card button')
			await page.waitForFunction(
				() =>
					document.getElementById('generate-status').dataset.tone === 'error',
			)
			assert.equal(
				await page.evaluate(() => localStorage.getItem('austen-history')),
				saved,
			)
			apiReply = (request) =>
				request.respond({
					status: 422,
					contentType: 'application/json',
					headers: { 'Access-Control-Allow-Origin': '*' },
					body: JSON.stringify({ code: 'UNKNOWN' }),
				})
			await page.click('#selected-book-card button')
			await page.waitForFunction(() =>
				document
					.getElementById('generate-status')
					.textContent.includes('confidently'),
			)
		},
	)
	await t.test(
		'homepage search handles failure and stale OpenLibrary results cannot overwrite a newer query',
		async () => {
			await page.goto(base)
			await page.type('#search-input', 'unavailable')
			await page.waitForFunction(() =>
				document
					.getElementById('search-status')
					.textContent.includes('Enter the book details below'),
			)
			discoveryReply = async (request) => {
				const query = new URL(request.url()).searchParams.get('q')
				await delay(query === 'old' ? 800 : 20)
				await request
					.respond({
						status: 200,
						contentType: 'application/json',
						headers: { 'Access-Control-Allow-Origin': '*' },
						body: JSON.stringify({
							docs: [{ title: query, author_name: ['Author'] }],
						}),
					})
					.catch(() => {})
			}
			await page.goto(base)
			await page.type('#search-input', 'old')
			await delay(350)
			await page.$eval('#search-input', (n) => {
				n.value = 'new'
				n.dispatchEvent(new Event('input', { bubbles: true }))
			})
			await page.waitForFunction(() =>
				document.getElementById('search-results').textContent.includes('new'),
			)
			await delay(600)
			assert.ok(
				!(await page.$eval('#search-results', (n) => n.textContent)).includes(
					'old',
				),
			)
			const beforeSelection = providerCalls
			await page.click('#search-results button')
			assert.match(
				await page.$eval('#selected-book-card', (card) => card.textContent),
				/new/,
			)
			assert.equal(providerCalls, beforeSelection)
		},
	)
	await t.test(
		'client navigation reinitializes search, covers and workspaces through back and forward',
		async () => {
			await page.goto(base)
			await page.evaluate(() => {
				window.navigationMarker = 'same-document'
				window.pageLoads = 0
				window.transitionFinished = true
				document.addEventListener('astro:page-load', () => window.pageLoads++)
				document.addEventListener('astro:before-swap', (event) => {
					window.transitionFinished = false
					event.viewTransition.finished.finally(() => {
						window.transitionFinished = true
					})
				})
			})
			const navigate = async (path, action) => {
				const previous = await page.evaluate(() => window.pageLoads)
				await action()
				await page.waitForFunction(
					({ path, previous }) =>
						location.pathname === path &&
						window.pageLoads > previous &&
						window.transitionFinished,
					{},
					{ path, previous },
				)
				assert.equal(
					await page.evaluate(() => window.navigationMarker),
					'same-document',
				)
			}
			const follow = (path, selector) =>
				navigate(path, () => page.click(selector))
			await follow('/maps/', 'nav a[href="/maps/"]')
			await page.type('#library-search', '1813')
			assert.equal(
				await page.$$eval(
					'[data-library-book]:not([hidden])',
					(rows) => rows.length,
				),
				1,
			)
			await follow('/catalog/', 'a[href="/catalog/"]')
			await page.type('#library-search', '1813')
			assert.equal(
				await page.$$eval(
					'[data-library-book]:not([hidden])',
					(rows) => rows.length,
				),
				1,
			)
			await follow('/authors/', 'nav a[href="/authors/"]')
			await follow('/authors/jane-austen/', 'a[href="/authors/jane-austen/"]')
			const bookPath = `/books/${book.slug}/`
			await follow(bookPath, `.book-cover-link[href="${bookPath}"]`)
			await page.waitForSelector('#diagram-controls:not([hidden])')
			await page.click('#zoom-in-btn')
			await page.waitForFunction(
				() =>
					parseInt(
						document.getElementById('diagram-zoom-level').textContent,
						10,
					) > 100,
			)
			await page.click('#edit-btn')
			assert.equal(
				await page.$eval('#editor-section', (el) => el.hidden),
				false,
			)
			await page.click('#editor-cancel-btn')
			await navigate('/authors/jane-austen/', () =>
				page.evaluate(() => history.back()),
			)
			await navigate(bookPath, () => page.evaluate(() => history.forward()))
			await page.waitForSelector('#diagram-controls:not([hidden])')
			assert.equal(
				await page.$eval('#share-url-input', (el) => el.value),
				`https://austen.page${bookPath}`,
			)
			await page.click('#zoom-in-btn')
			await page.waitForFunction(
				() =>
					parseInt(
						document.getElementById('diagram-zoom-level').textContent,
						10,
					) > 100,
			)
			await page.$eval('[data-book-cover] img', (img) => {
				img
					.closest('picture')
					.querySelectorAll('source')
					.forEach((source) => {
						source.remove()
					})
				img.removeAttribute('srcset')
				img.src = '/missing-cover.png'
			})
			await page.waitForFunction(
				() => document.querySelector('[data-book-cover] img').hidden,
			)
			await follow('/', '.brand')
			assert.equal(
				await page.$eval('body', (body) =>
					body.classList.contains('has-graph'),
				),
				false,
			)
			await page.$eval('#manual-book-form', (form) => {
				form.elements.namedItem('title').value = 'Navigation test'
				form.requestSubmit()
			})
			await page.waitForFunction(() =>
				document
					.getElementById('selected-book-card')
					.textContent.includes('Navigation test'),
			)
			const callsBefore = providerCalls
			let finishGeneration
			const pendingGeneration = new Promise((resolve) => {
				finishGeneration = resolve
			})
			apiReply = async (request) => {
				await pendingGeneration
				await request
					.respond({
						status: 200,
						contentType: 'application/json',
						headers: { 'Access-Control-Allow-Origin': '*' },
						body: JSON.stringify({ mermaid: graph, generatedAt }),
					})
					.catch(() => {})
			}
			try {
				await page.click('#selected-book-card button')
				await page.waitForFunction(() =>
					document
						.getElementById('generate-status')
						.textContent.includes('Asking the backend'),
				)
				await follow('/maps/', 'nav a[href="/maps/"]')
			} finally {
				finishGeneration()
			}
			await delay(500)
			assert.equal(providerCalls, callsBefore + 1)
			assert.equal(
				await page.$eval('body', (body) =>
					body.classList.contains('has-graph'),
				),
				false,
			)
			await follow('/', '.brand')
			await page.$eval('#manual-book-form', (form) => {
				form.elements.namedItem('title').value = 'Returned home'
				form.requestSubmit()
			})
			await page.waitForFunction(() =>
				document
					.getElementById('selected-book-card')
					.textContent.includes('Returned home'),
			)
			assert.equal(
				await page.evaluate(() => window.navigationMarker),
				'same-document',
			)
			assert.equal(page.url(), base)
			apiReply = null
		},
	)
	assert.deepEqual(errors, [])
	for (const name of await readdir(resolve(root, 'dist/_astro')))
		if (name.endsWith('.js'))
			assert.ok(
				!(await readFile(resolve(root, 'dist/_astro', name), 'utf8')).includes(
					'STATIC_BUILD_SECRET_SENTINEL',
				),
			)
})

test('malformed share/history fields are bounded and normalized', () => {
	assert.throws(() => decodeShare('a'.repeat(16001)))
	assert.throws(() =>
		normalizeSnapshot({ book: { title: 'Title' }, mermaid: '<script>' }),
	)
	const storage = {
		getItem: () =>
			JSON.stringify(
				Array.from({ length: 60 }, (_, i) => ({
					book: { title: `Book ${i}`, authors: null, publishYear: 1813 },
					mermaid: graph,
				})),
			),
	}
	assert.equal(loadHistory(storage).list.length, 30)
	assert.deepEqual(loadHistory(storage).list[0].book.authors, [])
	const compressed = LZString.compressToEncodedURIComponent(
		JSON.stringify({ book: { title: 'Book', authors: 1 }, mermaid: graph }),
	)
	assert.deepEqual(decodeShare(compressed).book.authors, [])
})
