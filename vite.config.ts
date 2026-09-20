import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import webExtension from 'vite-plugin-web-extension';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  build: {
    outDir: `dist/${process.env.TARGET || 'chrome'}`,
    copyPublicDir: true,
    emptyOutDir: false,
    minify: process.env.NODE_ENV === 'development' ? false : 'oxc',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: undefined
      },
      onwarn(warning, warn) {
        // @tailwindcss/vite transforms CSS without emitting sourcemaps (dev-only notice)
        if (warning.code === 'SOURCEMAP_BROKEN') return;

        // @heyputer/puter.js ships ESM files with guarded CommonJS fallback
        // assignments (`module.exports`). Rollup reports these even though the
        // `typeof module` / `typeof exports` checks keep those branches
        // inactive in the browser bundle.
        const warningId = warning.id?.replaceAll('\\', '/');
        if (
          warning.code === 'COMMONJS_VARIABLE_IN_ESM' &&
          warningId?.includes('/node_modules/@heyputer/puter.js/')
        ) {
          return;
        }

        warn(warning);
      },
    },
  },
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected',
      },
    }),
    svelteTesting(),
    webExtension({
      browser: process.env.TARGET || 'chrome',
      manifest: './manifest.json',
      watchFilePaths: ['src', 'manifest.json'],
      disableAutoLaunch: true,
    }),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
  },
});
