import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import webExtension from 'vite-plugin-web-extension';
import { svelteTesting } from '@testing-library/svelte/vite';

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: `dist/${process.env.TARGET || 'chrome'}`,
    copyPublicDir: true,
    emptyOutDir: false,
    minify: process.env.NODE_ENV === 'development' ? false : 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: undefined
      },
      onwarn(warning, warn) {
        // @tailwindcss/vite transforms CSS without emitting sourcemaps (dev-only notice)
        if (warning.code === 'SOURCEMAP_BROKEN') return;
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
