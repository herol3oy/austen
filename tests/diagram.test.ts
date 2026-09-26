import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { parseDiagram, validateDiagram } from '../shared/diagram-policy.mjs'
import { themeDiagramSvg } from '../shared/diagram-theme.mjs'
import { validateSvg } from '../shared/svg-policy.mjs'
import { graph } from './helpers'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

test('the parser retains directed and repeated relationships', () => {
	const source =
		'graph LR\nA["Elizabeth Bennet"]\nB["Fitzwilliam Darcy"]\nA -->|Loves| B\nB -->|Loves| A\nA -->|Marries| B'
	expect(parseDiagram(source)).toMatchObject({
		nodes: [
			{ id: 'A', label: 'Elizabeth Bennet' },
			{ id: 'B', label: 'Fitzwilliam Darcy' },
		],
		edges: [
			{ source: 'A', target: 'B', label: 'Loves' },
			{ source: 'B', target: 'A', label: 'Loves' },
			{ source: 'A', target: 'B', label: 'Marries' },
		],
	})
	for (const invalid of [
		'',
		`${graph}\nclick A "javascript:alert(1)"`,
		`${graph}\nstyle A fill:red`,
		'x'.repeat(12001),
	])
		expect(() => validateDiagram(invalid)).toThrow()
})

test('the diagram theme preserves validated SVG geometry and text', () => {
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><g><text x="10" y="20">Elizabeth Bennet</text><path d="M10 30 L250 30"/></g></svg>'
	const themed = themeDiagramSvg(svg)
	expect(validateSvg(themed)).toEqual(validateSvg(svg))
	expect(themed).toContain('Elizabeth Bennet')
	expect(themeDiagramSvg(themed)).toBe(themed)
})

test('a checked-in published map has matching Mermaid and SVG artifacts', async () => {
	const catalog = JSON.parse(
		await readFile(resolve(ROOT, 'data/catalog/books.json'), 'utf8'),
	)
	const published = JSON.parse(
		await readFile(resolve(ROOT, 'data/published.json'), 'utf8'),
	)
	const pointer = published.books[0]
	const book = catalog.books.find(
		(entry: { id: string }) => entry.id === pointer.bookId,
	)
	if (!book) throw new Error('Published book is missing')
	const prefix = resolve(ROOT, 'data/maps', book.slug, pointer.revision)
	const revision = JSON.parse(await readFile(`${prefix}.json`, 'utf8'))
	const svg = await readFile(`${prefix}.svg`, 'utf8')
	expect(validateDiagram(revision.mermaid).characters).toBeGreaterThan(0)
	expect(validateSvg(svg).width).toBeGreaterThan(0)
})
