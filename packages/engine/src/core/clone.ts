/**
 * Fast deep clone for plain JSON-shaped state. Used by applyCommand so callers keep immutable
 * semantics (ARCHITECTURE 5.3) without an Immer dependency (ADR-0009). Arrays of primitives and
 * nested plain objects only; no Dates, Maps or class instances ever live in GameState.
 */
export function cloneJson<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) out[i] = cloneJson(value[i]);
    return out as unknown as T;
  }
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k in src) out[k] = cloneJson(src[k]);
  return out as T;
}
