import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'
import { parseDiagram, validateDiagram } from '../shared/diagram-policy.mjs'
import { themeDiagramSvg } from '../shared/diagram-theme.mjs'
import { validateSvg } from '../shared/svg-policy.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

test('diagram theme changes presentation without changing labels, selectors, references or geometry', () => {
	const svg = `<svg id="40584b" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
<style>#40584b .node {fill:#ECE6D9;stroke:#40584b} #40584b text{fill:#282722} .labelBkg{background-color:rgba(251, 249, 244, 0.5)}</style>
<defs><linearGradient id="fbf9f4"><stop stop-color="#40584b" offset="0"/></linearGradient></defs>
<rect id="ece6d9" x="12" y="24" width="120" height="40" fill="url(#fbf9f4)" stroke='#40584b' style="fill:#ece6d9;transform:translate(2px, 4px);stroke-width:2px"/>
<text fill="#282722" aria-label="fill='#40584b' > rose">#40584b fill="#fbf9f4" &amp; Elizabeth</text>
</svg>`
	const themed = themeDiagramSvg(svg)
	assert.deepEqual(validateSvg(themed), validateSvg(svg))
	assert.equal(themeDiagramSvg(themed), themed)
	assert.match(themed, /#40584b \.node \{fill:#f1e3de;stroke:#915366\}/)
	assert.match(themed, /rgba\(255, 250, 247, 0\.5\)/)
	assert.match(themed, /stop-color="#915366"/)
	assert.match(themed, /fill="url\(#fbf9f4\)" stroke='#915366'/)
	assert.match(themed, /transform:translate\(2px, 4px\);stroke-width:2px/)
	const original = load(svg, { xml: true })
	const result = load(themed, { xml: true })
	assert.equal(result('text').text(), original('text').text())
	assert.equal(
		result('text').attr('aria-label'),
		original('text').attr('aria-label'),
	)
	for (const attribute of ['id', 'x', 'y', 'width', 'height'])
		assert.equal(
			result('rect').attr(attribute),
			original('rect').attr(attribute),
		)
})

test('diagram recoloring does not bypass SVG validation', () => {
	const unsafe =
		'<svg viewBox="0 0 200 100"><rect fill="#40584b" onclick="alert(1)"/></svg>'
	assert.throws(
		() => validateSvg(themeDiagramSvg(unsafe)),
		/Unsafe SVG attribute/,
	)
})

test('parser resolves inline declarations and later labels without reordering or duplicating characters', () => {
	const source =
		'graph LR\nA -->|Knows| B[Jane Bennet]\nC["Élizabeth & Anne"]\nA["Elizabeth Bennet"]\nB --> C\nA["Lizzy Bennet"]\nA'
	assert.deepEqual(parseDiagram(source), {
		source,
		nodes: [
			{ id: 'A', label: 'Lizzy Bennet' },
			{ id: 'B', label: 'Jane Bennet' },
			{ id: 'C', label: 'Élizabeth & Anne' },
		],
		edges: [
			{ source: 'A', target: 'B', label: 'Knows' },
			{ source: 'B', target: 'C', label: null },
		],
	})
	assert.deepEqual(validateDiagram(source), {
		source,
		characters: 3,
		edges: 2,
	})
})

test('parser preserves every directed edge, including reciprocal and repeated relationships', () => {
	const { nodes, edges } = parseDiagram(
		'graph LR\nA["Elizabeth Bennet"]\nB["Fitzwilliam Darcy"]\nA -->|Loves| B\nB -->|Loves| A\nA -->|Marries| B\nA -->|Loves| B',
	)
	assert.equal(nodes.length, 2)
	assert.deepEqual(edges, [
		{ source: 'A', target: 'B', label: 'Loves' },
		{ source: 'B', target: 'A', label: 'Loves' },
		{ source: 'A', target: 'B', label: 'Marries' },
		{ source: 'A', target: 'B', label: 'Loves' },
	])
})

test('parser preserves legacy directions, implicit IDs, fences and whitespace support', () => {
	for (const direction of ['LR', 'RL', 'TD', 'TB', 'BT']) {
		const raw = `\n\x60\x60\x60mermaid\ngraph ${direction}\n  A --> B  \n\x60\x60\x60\n`
		assert.deepEqual(parseDiagram(raw, { legacy: true }), {
			source: `graph ${direction}\n  A --> B`,
			nodes: [
				{ id: 'A', label: 'A' },
				{ id: 'B', label: 'B' },
			],
			edges: [{ source: 'A', target: 'B', label: null }],
		})
		if (direction !== 'LR')
			assert.throws(() => parseDiagram(raw), /Use graph LR/)
	}
})

test('parser and validator reject unsupported syntax and enforce the existing size limits', () => {
	const valid =
		'graph LR\nA["Elizabeth Bennet"] -->|Sister of| B["Jane Bennet"]'
	for (const source of [
		'',
		'x'.repeat(12001),
		'graph LR\nA',
		'graph LR\nA\nB',
		'graph LR\r\nA --> B',
		`${valid}\nC --> D --> E`,
		`${valid}\nsubgraph Group`,
		valid.replace('Elizabeth Bennet', '<img src=x>'),
		`${valid}\nclick A "javascript:alert(1)"`,
		`%%{init: {}}%%\n${valid}`,
		`${valid}\nstyle A fill:red`,
		`${valid}\nA -->|Knows|`,
		'graph LR\n' +
			Array.from({ length: 21 }, (_, i) => `C${i}["Character ${i}"]`).join(
				'\n',
			) +
			'\nC0 --> C1',
		`graph LR\n${Array.from({ length: 41 }, () => 'A --> B').join('\n')}`,
	]) {
		assert.throws(() => parseDiagram(source))
		assert.throws(() => validateDiagram(source))
	}
})

test('published graph samples preserve character and relationship extraction when themed', async () => {
	const catalog = JSON.parse(
		await readFile(resolve(ROOT, 'data/catalog/books.json'), 'utf8'),
	)
	const published = JSON.parse(
		await readFile(resolve(ROOT, 'data/published.json'), 'utf8'),
	)
	const books = new Map(catalog.books.map((book) => [book.id, book]))
	const examples = new Map([
		[
			'jane-austen-pride-and-prejudice',
			['Elizabeth Bennet', 'Fitzwilliam Darcy'],
		],
		[
			'f-scott-fitzgerald-the-great-gatsby',
			['Nick Carraway', 'Jay Gatsby', 'Daisy Buchanan'],
		],
		[
			'bram-stoker-dracula',
			['Jonathan Harker', 'Mina Murray', 'Count Dracula'],
		],
	])
	for (const pointer of published.books.slice(0, 3)) {
		const book = books.get(pointer.bookId)
		const prefix = resolve(ROOT, 'data/maps', book.slug, pointer.revision)
		const revision = JSON.parse(await readFile(`${prefix}.json`, 'utf8'))
		const { nodes, edges } = parseDiagram(revision.mermaid)
		const originalSvg = await readFile(`${prefix}.svg`, 'utf8')
		const themedSvg = themeDiagramSvg(originalSvg)
		assert.deepEqual(validateSvg(themedSvg), validateSvg(originalSvg))
		assert.equal(
			themeDiagramSvg(themedSvg),
			themedSvg,
			`${book.slug}: stable theme`,
		)
		const $ = load(originalSvg, { xml: true })
		const themed = load(themedSvg, { xml: true })
		for (const selector of ['text', 'tspan', 'title', 'desc'])
			assert.deepEqual(
				themed(selector)
					.toArray()
					.map((node) => themed(node).text()),
				$(selector)
					.toArray()
					.map((node) => $(node).text()),
				`${book.slug}: unchanged ${selector}`,
			)
		assert.deepEqual(
			themed('[id], path, rect')
				.toArray()
				.map((node) => [
					node.attribs.id,
					node.attribs.d,
					node.attribs.x,
					node.attribs.y,
					node.attribs.width,
					node.attribs.height,
					node.attribs.transform,
				]),
			$('[id], path, rect')
				.toArray()
				.map((node) => [
					node.attribs.id,
					node.attribs.d,
					node.attribs.x,
					node.attribs.y,
					node.attribs.width,
					node.attribs.height,
					node.attribs.transform,
				]),
			`${book.slug}: unchanged geometry and IDs`,
		)
		assert.equal(
			nodes.length,
			$('.nodes .node').length,
			`${book.slug}: characters`,
		)
		assert.equal(
			edges.length,
			$('.edgePaths .flowchart-link').length,
			`${book.slug}: relationships`,
		)
		const ids = new Set(nodes.map((node) => node.id))
		assert.equal(ids.size, nodes.length, `${book.slug}: unique character IDs`)
		assert.ok(
			edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)),
			`${book.slug}: named endpoints`,
		)
		for (const name of examples.get(book.slug) ?? []) {
			assert.ok(
				nodes.some((node) => node.label === name),
				`${book.slug}: ${name}`,
			)
		}
	}
})
