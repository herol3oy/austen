/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    target: ['es2020'],
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js', '@supabase/ssr'],
  },
  resolve: {
    mainFields: ['module', 'browser'],
  },
  plugins: [
    analog({
      vite: {
        inlineStylesExtension: 'scss',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    reporters: ['default'],
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
