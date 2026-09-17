// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Dependency rule (ARCHITECTURE 5.1 + ROADMAP_SCAFFOLDS 16.8):
//   shared ← platform ; shared ← content ← engine ← ai ← sim ; web → all but sim (+ platform)
const layers = {
  shared: ['shared'],
  platform: ['shared', 'platform'],
  content: ['shared', 'content'],
  engine: ['shared', 'content', 'engine'],
  ai: ['shared', 'content', 'engine', 'ai'],
  sim: ['shared', 'content', 'engine', 'ai', 'sim'],
  web: ['shared', 'platform', 'content', 'engine', 'ai', 'web'],
  tools: ['shared', 'platform', 'content', 'engine', 'ai', 'sim', 'tools'],
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
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
