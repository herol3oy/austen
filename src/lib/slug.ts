export function slugify(text: string) {
	const slug = text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-|-$/g, '')
	if (!slug) throw new Error(`Cannot create a slug for ${JSON.stringify(text)}`)
	return slug
}
