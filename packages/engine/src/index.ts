/**
 * @hustle-ring/engine — pure game rules.
 *
 * INVARIANTS (CLAUDE.md 1.3, lint-enforced): no DOM, no Date.now(), no Math.random(), no I/O.
 * All mutation goes through applyCommand(state, seat, cmd, pack) → { state, events }.
 *
 * STUB — M1 implements the API in ARCHITECTURE 5.3. Only the version constant exists at M0.
 */

export const ENGINE_VERSION = '0.0.0';

/** Bumped whenever GameState shape changes; save migrations key off this (ARCHITECTURE 5.7). */
export const STATE_SCHEMA_VERSION = 1;
