import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/streaming-sdk-integration.test.ts'],
    setupFiles: [],
    maxWorkers: 1,
  },
});
