/** M0.2 AC: importing apps/web from engine fails lint; the allowed direction passes. */
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
// Fixtures are lint-text only (not on disk), so type-aware rules are switched off; the boundary
// and purity rules under test are purely syntactic.
const eslint = new ESLint({
  cwd: root,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: { parserOptions: { projectService: false, project: false } },
    },
  ],
});

async function lint(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? '?'}: ${m.message}`);
}

describe('dependency boundaries (ARCHITECTURE 5.1)', () => {
  it('engine → apps/web is rejected', async () => {
    const msgs = await lint(
      "import { App } from '../../../apps/web/src/App';\nexport const x = App;\n",
      'packages/engine/src/__boundary_fixture__.ts',
    );
    expect(msgs.some((m) => m.startsWith('boundaries/dependencies'))).toBe(true);
  });
  it('engine → ai is rejected (dependency direction)', async () => {
    const msgs = await lint(
      "import { AI_DIFFICULTIES } from '@hustle-ring/ai';\nexport const x = AI_DIFFICULTIES;\n",
      'packages/engine/src/__boundary_fixture__.ts',
    );
    expect(msgs.some((m) => m.startsWith('boundaries/dependencies'))).toBe(true);
  });
  it('ai → engine is allowed', async () => {
    const msgs = await lint(
      "import { ENGINE_VERSION } from '@hustle-ring/engine';\nexport const x = ENGINE_VERSION;\n",
      'packages/ai/src/__boundary_fixture__.ts',
    );
    expect(msgs.filter((m) => m.startsWith('boundaries/'))).toEqual([]);
  });
  it('engine purity: Math.random / Date.now / window are rejected', async () => {
    const msgs = await lint(
      'export const r = Math.random();\nexport const t = Date.now();\nexport const w = window;\n',
      'packages/engine/src/__purity_fixture__.ts',
    );
    expect(msgs.filter((m) => m.startsWith('no-restricted-syntax'))).toHaveLength(2);
    expect(msgs.filter((m) => m.startsWith('no-restricted-globals'))).toHaveLength(1);
  });
});
