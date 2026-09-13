export interface BreadcrumbItem {
	name: string
	href: string
}

export function breadcrumbData(items: BreadcrumbItem[], site: URL) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: new URL(item.href, site).href,
		})),
	}
}

export function serializeStructuredData(data: Record<string, unknown>) {
	// JSON-LD is raw script text: prevent content from closing the script element.
	return JSON.stringify(data)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029')
}
