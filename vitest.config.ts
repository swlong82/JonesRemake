import { defineConfig } from 'vitest/config';

// Coverage thresholds per CLAUDE.md 1.7. Glob keys apply per package; the
// unkeyed values are the floor for everything else (tools, platform, shared).
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
      'tools/vitest.config.ts',
      'examples/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**', 'apps/web/src/**', 'tools/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/cli.ts',
        '**/cli/**',
        'apps/web/src/main.tsx',
        'apps/web/src/vite-env.d.ts',
        'tools/*.ts',
        '**/__fixtures__/**',
      ],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,
        'packages/engine/src/**': { lines: 90, branches: 85, functions: 90, statements: 90 },
        'packages/ai/src/**': { lines: 80, branches: 70, functions: 80, statements: 80 },
        'packages/content/src/**': { lines: 90, branches: 80, functions: 90, statements: 90 },
        // Art sets validate untrusted user files (ART_SPEC 17.6): held to the content bar.
        'packages/art/src/**': { lines: 90, branches: 80, functions: 90, statements: 90 },
        'apps/web/src/**': { lines: 60, branches: 50, functions: 60, statements: 60 },
      },
    },
  },
});
