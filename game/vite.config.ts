/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// base './' keeps every asset path relative, so the same build works on a web host,
// inside Capacitor's iOS/Android WebView, and opened from a sub-folder.
const pagesOrigin = 'https://itsgucci9.github.io/The-last-weather/';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'site-url',
      transformIndexHtml(html) {
        const raw = process.env.VITE_SITE_URL || pagesOrigin;
        const site = raw.endsWith('/') ? raw : `${raw}/`;
        return html.replaceAll('__SITE_URL__', site);
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep SVG art as real files so it stays crisp and cacheable
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
