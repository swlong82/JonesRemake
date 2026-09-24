// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Dependency rule (ARCHITECTURE 5.1 + ROADMAP_SCAFFOLDS 16.8):
//   shared ← platform ; shared ← art ; shared ← content ← engine ← ai ← sim ;
//   web → all but sim (+ platform, art)
const layers = {
  shared: ['shared'],
  platform: ['shared', 'platform'],
  art: ['shared', 'art'],
  content: ['shared', 'content'],
  engine: ['shared', 'content', 'engine'],
  ai: ['shared', 'content', 'engine', 'ai'],
  sim: ['shared', 'content', 'engine', 'ai', 'sim'],
  web: ['shared', 'platform', 'art', 'content', 'engine', 'ai', 'web'],
  tools: ['shared', 'platform', 'art', 'content', 'engine', 'ai', 'sim', 'tools'],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/__fixtures__/**',
      'reports/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Root-level config files are typed via tsconfig.node.json (referenced from tsconfig.json).
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.es2022 },
    },
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          project: 'tsconfig.json',
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      'boundaries/elements': Object.keys(layers).map((type) => ({
        type,
        partialMatch: false,
        pattern:
          type === 'web' ? 'apps/web/**' : type === 'tools' ? 'tools/**' : `packages/${type}/**`,
      })),
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // noUncheckedIndexedAccess is on; `!` after a guarded index is the idiomatic escape hatch and
      // keeps hot engine loops free of wrapper calls. Type strictness (no any / ts-ignore) is unchanged.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            '{{file.type}} may not import from {{dependency.type}} (ARCHITECTURE 5.1 dependency rule)',
          policies: Object.entries(layers).map(([from, allow]) => ({
            from: { element: { type: from } },
            allow: { to: { element: { types: { anyOf: allow } } } },
          })),
        },
      ],
    },
  },
  {
    // Engine purity (CLAUDE.md 1.3): no DOM, no clock, no ambient randomness, no I/O.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch',
        'performance',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'crypto', 'os'], message: 'Engine is pure: no I/O.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Math.random() is banned in engine; use the injected seeded RNG (CLAUDE.md 1.3).',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() is banned in engine (CLAUDE.md 1.3).',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'new Date() is banned in engine (CLAUDE.md 1.3).',
        },
        {
          selector: "CallExpression[callee.object.name='crypto']",
          message: 'crypto.* is banned in engine (CLAUDE.md 1.3).',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // `onClick={() => dispatch(cmd)}` is the idiomatic React handler; the void return is the
      // point, not a mistake (ADR-0017).
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    // All user-facing strings go through i18n keys (CLAUDE.md 1.3).
    files: ['apps/web/src/**/*.tsx'],
    ...i18next.configs['flat/recommended'],
  },
  {
    files: [
      'tools/**/*.ts',
      'packages/*/cli/**/*.ts',
      'packages/sim/cli.ts',
      '**/*.config.ts',
      '**/e2e/**/*.ts',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    // Test ergonomics: fixtures may assert non-null and use expect() in arrow shorthand.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
