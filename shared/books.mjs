export const SCHEMA_VERSION = 2
export const cleanText = (value) =>
	typeof value === 'string'
		? value.normalize('NFC').replace(/\s+/gu, ' ').trim()
		: ''
export const searchText = (value) =>
	cleanText(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()

export function normalizeBook(input, { strict = false } = {}) {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('Missing book metadata')
	const title = cleanText(input.title)
	if (!title || title.length > 300)
		throw new Error('Title must contain 1–300 characters')
	if (
		strict &&
		(!Array.isArray(input.authors) ||
			input.authors.length > 8 ||
			input.authors.some(
				(a) => typeof a !== 'string' || !cleanText(a) || a.length > 160,
			))
	)
		throw new Error('Invalid authors')
	const authors = (Array.isArray(input.authors) ? input.authors : [])
		.filter((a) => typeof a === 'string')
		.map(cleanText)
		.filter(Boolean)
		.slice(0, 8)
		.map((a) => a.slice(0, 160))
	const rawYear = input.year ?? input.publishYear
	if (
		strict &&
		rawYear != null &&
		typeof rawYear !== 'string' &&
		!(typeof rawYear === 'number' && Number.isFinite(rawYear))
	)
		throw new Error('Invalid year')
	const year =
		cleanText(
			typeof rawYear === 'number' && Number.isFinite(rawYear)
				? String(rawYear)
				: rawYear,
		) || null
	if (year && year.length > 40) throw new Error('Year is too long')
	return {
		title,
		authors,
		year,
		...(typeof input.id === 'string' && input.id.length <= 600
			? { id: input.id }
			: {}),
		...(typeof input.coverPath === 'string' &&
		/^\/(?:[a-z0-9-]+\/)?_astro\/[a-zA-Z0-9._-]+\.webp$/.test(input.coverPath)
			? { coverPath: input.coverPath }
			: {}),
	}
}

export function generationMetadata(book) {
	const { title, authors, year } = normalizeBook(book, { strict: true })
	return { title, authors, year }
}

export function canonicalEdition(value) {
	const url = new URL(value)
	if (
		url.protocol !== 'https:' ||
		url.hostname !== 'standardebooks.org' ||
		url.port ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	)
		throw new Error('Unexpected ebook URL')
	const id = url.pathname.replace(/^\/ebooks\//, '').replace(/\/$/, '')
	if (
		!url.pathname.startsWith('/ebooks/') ||
		!/^[a-z0-9]+(?:[-_/][a-z0-9]+)+$/.test(id) ||
		id.length > 600
	)
		throw new Error('Invalid edition path')
	return { id, ebookUrl: `https://standardebooks.org/ebooks/${id}` }
}

export function validateCatalog(snapshot) {
	if (
		snapshot?.schemaVersion !== SCHEMA_VERSION ||
		!Array.isArray(snapshot.books) ||
		!snapshot.books.length
	)
		throw new Error('Invalid catalog snapshot')
	const ids = new Set(),
		slugs = new Set()
	for (const book of snapshot.books) {
		generationMetadata(book)
		const canonical = canonicalEdition(book.ebookUrl)
		if (
			canonical.id !== book.id ||
			typeof book.category !== 'string' ||
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug) ||
			ids.has(book.id) ||
			slugs.has(book.slug)
		)
			throw new Error(`Invalid or duplicate catalog book: ${book.id}`)
		ids.add(book.id)
		slugs.add(book.slug)
	}
	return snapshot
}

export function matchPublished(book, entries) {
	if (book.id)
		return entries.find((e) => e.id === book.id && e.publishedUrl) || null
	if (!book.authors?.length || !book.year) return null
	const matches = entries.filter(
		(e) =>
			e.publishedUrl &&
			searchText(e.title) === searchText(book.title) &&
			e.year === book.year &&
			e.authors.map(searchText).sort().join('|') ===
				book.authors.map(searchText).sort().join('|'),
	)
	return matches.length === 1 ? matches[0] : null
}
