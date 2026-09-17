/**
 * @hustle-ring/shared — types shared by every layer. No runtime dependencies.
 * Dependency rule: nothing in this package imports from any other workspace package.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Nominal typing helper: `type LocationId = Brand<string, 'LocationId'>`. */
export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** i18n keys are plain strings at the type level until M1 generates the key union. */
export type I18nKey = string;

/** Semver string as used by pack.json and save records. */
export type SemVer = `${number}.${number}.${number}`;

export const SHARED_VERSION = '0.0.0';
