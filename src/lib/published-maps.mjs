import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cleanText, generationMetadata } from '../../shared/books.mjs'
import { validateDiagram } from '../../shared/diagram-policy.mjs'
import { validateSvg } from '../../shared/svg-policy.mjs'

const hash = (value) => createHash('sha256').update(value).digest('hex')

export function validatePublicationManifest(published) {
	if (published?.schemaVersion !== 1 || !Array.isArray(published.books))
		throw new Error('Invalid publication manifest')
	const seen = new Set()
	for (const pointer of published.books) {
		if (
			!pointer ||
			typeof pointer.bookId !== 'string' ||
			seen.has(pointer.bookId) ||
			!/^v[1-9]\d*$/.test(pointer.revision) ||
			!/^[a-f0-9]{64}$/.test(pointer.revisionHash) ||
			!/^[a-f0-9]{64}$/.test(pointer.svgHash) ||
			!Array.isArray(pointer.checks) ||
			pointer.checks.some((check) => typeof check !== 'string')
		)
			throw new Error('Invalid publication pointer')
		seen.add(pointer.bookId)
		if (pointer.mode === 'automatic') {
			if (
				!Number.isFinite(Date.parse(pointer.publishedAt)) ||
				!['source', 'render', 'svg'].every((check) =>
					pointer.checks.includes(check),
				) ||
				pointer.reviewer ||
				pointer.reviewedAt
			)
				throw new Error('Invalid automatic publication')
		} else if (pointer.mode == null || pointer.mode === 'manual') {
			if (
				!cleanText(pointer.reviewer) ||
				!cleanText(pointer.notes) ||
				!Number.isFinite(Date.parse(pointer.reviewedAt)) ||
				![
					'work',
					'characters',
					'relationships',
					'directions',
					'readability',
				].every((check) => pointer.checks.includes(check))
			)
				throw new Error('Invalid publication approval')
		} else throw new Error('Unknown publication mode')
	}
	return published
}

async function verifyArtifact(root, book, revisionName) {
	if (!/^v[1-9]\d*$/.test(revisionName))
		throw new Error('Invalid revision name')
	const path = resolve(root, 'data/maps', book.slug, `${revisionName}.json`)
	const raw = await readFile(path, 'utf8')
	const revision = JSON.parse(raw)
	if (
		revision.schemaVersion !== 1 ||
		revision.bookId !== book.id ||
		revision.revision !== revisionName ||
		revision.outcome !== 'valid' ||
		revision.validation?.status !== 'valid' ||
		!Number.isFinite(Date.parse(revision.generatedAt))
	)
		throw new Error('Revision is not valid for this book')
	generationMetadata(revision.metadata)
	if (
		revision.inputHash !== hash(JSON.stringify(revision.metadata)) ||
		revision.mermaidHash !== hash(revision.mermaid) ||
		revision.validation.mermaidHash !== revision.mermaidHash
	)
		throw new Error('Revision hash mismatch')
	validateDiagram(revision.mermaid)
	const svg = await readFile(path.replace(/\.json$/, '.svg'), 'utf8')
	validateSvg(svg)
	if (hash(svg) !== revision.validation.svgHash)
		throw new Error('SVG hash mismatch')
	return { revision, svg, revisionHash: hash(raw) }
}

export async function loadPublishedMaps(root, catalog) {
	const published = validatePublicationManifest(
		JSON.parse(await readFile(resolve(root, 'data/published.json'), 'utf8')),
	)
	const books = new Map(catalog.books.map((book) => [book.id, book]))
	const maps = []
	for (const pointer of published.books) {
		const book = books.get(pointer.bookId)
		if (!book) throw new Error('Published book is missing from catalog')
		const artifact = await verifyArtifact(root, book, pointer.revision)
		if (
			artifact.revisionHash !== pointer.revisionHash ||
			artifact.revision.validation.svgHash !== pointer.svgHash
		)
			throw new Error('Published artifact changed after publication')
		maps.push({ book, ...artifact, review: pointer })
	}
	return { published, maps }
}
