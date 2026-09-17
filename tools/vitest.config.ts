import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'tools',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
