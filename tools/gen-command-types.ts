#!/usr/bin/env tsx
/**
 * `pnpm gen:types [--check]` — regenerates the Command union from the command registry
 * (EXTENSIBILITY 12.2) so UI, AI and content validators share one source of truth.
 *
 * STUB — M1.7 implements the registry and this generator. `--check` passes while no registry
 * exists; the moment `packages/engine/src/commands/registry.ts` appears this stub exits 1 so the
 * generator cannot be forgotten.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = resolve(import.meta.dirname, '..', 'packages/engine/src/commands/registry.ts');
if (existsSync(registry)) {
  console.error(
    'gen:types — command registry exists but the generator is still the M0 stub. Implement M1.7. FAIL',
  );
  process.exit(1);
}
console.log('gen:types — no command registry yet (M1.7). Nothing to generate. OK');
