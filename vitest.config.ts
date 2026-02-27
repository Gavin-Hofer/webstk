import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'client-only': path.resolve(
        import.meta.dirname,
        './src/test/client-only.ts',
      ),
    },
  },
});
