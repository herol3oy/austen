// @ts-check

import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://austen.page',
	output: 'static',
	trailingSlash: 'always',
	integrations: [
		sitemap({ filter: (page) => new URL(page).pathname !== '/generate/' }),
	],
})
