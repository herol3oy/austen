// @ts-check

import { fileURLToPath } from 'node:url'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { loadLastmodByPath } from './shared/sitemap-lastmod.mjs'

const lastmodByPath = loadLastmodByPath({
	root: fileURLToPath(new URL('.', import.meta.url)),
})

export default defineConfig({
	site: 'https://austen.page',
	output: 'static',
	trailingSlash: 'always',
	integrations: [
		sitemap({
			filter: (page) => {
				const path = new URL(page).pathname
				return path !== '/generate/' && path !== '/catalog/'
			},
			serialize: (entry) => {
				const timestamp = lastmodByPath.get(new URL(entry.url).pathname)
				return timestamp ? { ...entry, lastmod: timestamp } : entry
			},
		}),
	],
})
