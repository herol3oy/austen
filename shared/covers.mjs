export const COVER_SCHEMA_VERSION = 4

const slug = '[a-z0-9]+(?:-[a-z0-9]+)*'

export const coverAssetPath = (book) =>
	`src/assets/covers/${book.slug}/cover.jpg`

export function validateCovers(manifest) {
	if (
		manifest?.schemaVersion !== COVER_SCHEMA_VERSION ||
		!manifest.books ||
		typeof manifest.books !== 'object' ||
		Array.isArray(manifest.books)
	) {
		throw new Error('Invalid cover manifest')
	}
	for (const [id, record] of Object.entries(manifest.books)) {
		if (
			!id ||
			!record ||
			typeof record.assetPath !== 'string' ||
			!new RegExp(`^src/assets/covers/${slug}/cover\\.jpg$`).test(
				record.assetPath,
			)
		)
			throw new Error(`Invalid cover record: ${id}`)
	}
	return manifest
}

export function savedCoverSlug(book, manifest) {
	const record = manifest.books[book.id]
	return record?.assetPath === coverAssetPath(book) ? book.slug : undefined
}
