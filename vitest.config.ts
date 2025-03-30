import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // any test specific configuration
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
