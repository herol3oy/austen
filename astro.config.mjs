// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://herol3oy.github.io',
  base: '/austen/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()]
});