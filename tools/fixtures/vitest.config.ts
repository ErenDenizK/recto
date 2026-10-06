import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts'],
    // Building a sample rasterises its scan page (about a second each).
    testTimeout: 60_000,
  },
});
