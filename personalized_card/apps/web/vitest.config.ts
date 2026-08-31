import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // These specs test pure functions only (formatting, copy interpolation,
    // CSS scoping) — no component rendering, so no DOM/jsdom is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
