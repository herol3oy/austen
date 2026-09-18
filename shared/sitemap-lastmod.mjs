import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readBookArray(path) {
	const data = JSON.parse(readFileSync(path, 'utf8'))
	return Array.isArray(data?.books) ? data.books : []
}

export function loadLastmodByPath({ root } = {}) {
	try {
		const books = readBookArray(resolve(root, 'data/catalog/books.json'))
		const published = readBookArray(resolve(root, 'data/published.json'))
		const byId = new Map(books.map((book) => [book.id, book]))
		const byPath = new Map()
		for (const pointer of published) {
			const book = byId.get(pointer.bookId)
			const timestamp = pointer.publishedAt ?? pointer.reviewedAt
			if (!book || typeof timestamp !== 'string') continue
			const date = new Date(timestamp)
			if (!Number.isFinite(date.getTime())) continue
			byPath.set(`/books/${book.slug}/`, date)
		}
		return byPath
	} catch {
		return new Map()
	}
}
