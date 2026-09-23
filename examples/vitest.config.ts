import { defineProject } from 'vitest/config';

/** EXTENSIBILITY 12.9: every recipe in docs/EXTENDING.md has an example here, tested in CI. */
export default defineProject({
  test: {
    name: 'examples',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
