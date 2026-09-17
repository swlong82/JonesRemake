/**
 * Command registry (EXTENSIBILITY 12.2): the runtime discriminated union is built from the
 * handlers registered by active modules; `pnpm gen:types` derives the TypeScript union in
 * `commands.generated.ts` from the `*Command` interfaces in this folder.
 */
import { z } from 'zod';
import type { Engine } from '../core/module.js';

export function commandSchema(engine: Engine): z.ZodTypeAny {
  const schemas = [...engine.handlers.values()].map(
    (h) => h.schema as z.ZodDiscriminatedUnionOption<'type'>,
  );
  if (schemas.length < 2) return schemas[0] ?? z.never();
  return z.discriminatedUnion(
    'type',
    schemas as [
      z.ZodDiscriminatedUnionOption<'type'>,
      z.ZodDiscriminatedUnionOption<'type'>,
      ...z.ZodDiscriminatedUnionOption<'type'>[],
    ],
  );
}

export function commandTypes(engine: Engine): string[] {
  return [...engine.handlers.keys()].sort();
}
