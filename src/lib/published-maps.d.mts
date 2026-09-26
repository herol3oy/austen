export interface CatalogBook {
	id: string
	slug: string
	title: string
	authors: string[]
	year: string | null
	category: string
	ebookUrl: string
	coverSlug?: string
}

export interface Revision {
	mermaid: string
	generatedAt: string
	validation: { svgHash: string }
}

export interface PublicationPointer {
	mode?: 'automatic' | 'manual'
	publishedAt: string
	reviewedAt: string
	reviewer: string
}

export interface PublishedMap {
	book: CatalogBook
	revision: Revision
	svg: string
	review: PublicationPointer
}

export interface PublicationManifest {
	schemaVersion: 1
	books: PublicationPointer[]
}

export function validatePublicationManifest(
	published: unknown,
): PublicationManifest
export function loadPublishedMaps(
	root: string,
	catalog: { books: CatalogBook[] },
): Promise<{ published: PublicationManifest; maps: PublishedMap[] }>
