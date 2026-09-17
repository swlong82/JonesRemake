/**
 * JSON-logic subset evaluator (CONTENT_SCHEMAS 6.2) over a read-only view. Integer-only: `/` is
 * floor division so content expressions stay deterministic across engines. Shared by the content
 * validator (parse check) and the engine (runtime evaluation).
 */
import type { JsonValue } from '@hustle-ring/shared';

export type LogicValue = JsonValue | undefined;
export type LogicView = Record<string, unknown>;

export const LOGIC_OPS = [
  'var',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'and',
  'or',
  '!',
  'in',
  '+',
  '-',
  '*',
  '/',
  'min',
  'max',
  'if',
] as const;

function lookup(view: LogicView, path: string): unknown {
  let cur: unknown = view;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined) return 0;
  throw new Error(`json-logic: expected number, got ${typeof v}`);
}

export function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

/** Evaluate a JSON-logic expression. Throws on unknown operators (validator turns this into an issue). */
export function evalLogic(expr: unknown, view: LogicView): unknown {
  if (expr === null || typeof expr !== 'object') return expr;
  if (Array.isArray(expr)) return expr.map((e) => evalLogic(e, view));
  const keys = Object.keys(expr);
  if (keys.length !== 1)
    throw new Error(`json-logic: rule must have exactly one operator, got ${keys.join(',')}`);
  const op = keys[0]!;
  const rawArgs = (expr as Record<string, unknown>)[op];
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
  switch (op) {
    case 'var': {
      const path = evalLogic(args[0], view);
      const v = lookup(view, String(path));
      return v === undefined ? (args.length > 1 ? evalLogic(args[1], view) : null) : v;
    }
    case 'if': {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (truthy(evalLogic(args[i], view))) return evalLogic(args[i + 1], view);
      }
      return args.length % 2 === 1 ? evalLogic(args[args.length - 1], view) : null;
    }
    case 'and': {
      let last: unknown = true;
      for (const a of args) {
        last = evalLogic(a, view);
        if (!truthy(last)) return last;
      }
      return last;
    }
    case 'or': {
      let last: unknown = false;
      for (const a of args) {
        last = evalLogic(a, view);
        if (truthy(last)) return last;
      }
      return last;
    }
    case '!':
      return !truthy(evalLogic(args[0], view));
    case 'in': {
      const needle = evalLogic(args[0], view);
      const hay = evalLogic(args[1], view);
      if (Array.isArray(hay)) return hay.includes(needle);
      if (typeof hay === 'string') return hay.includes(String(needle));
      return false;
    }
    default:
      break;
  }
  const vals = args.map((a) => evalLogic(a, view));
  switch (op) {
    case '==':
      return vals[0] === vals[1];
    case '!=':
      return vals[0] !== vals[1];
    case '>':
      return num(vals[0]) > num(vals[1]);
    case '>=':
      return num(vals[0]) >= num(vals[1]);
    case '<':
      return num(vals[0]) < num(vals[1]);
    case '<=':
      return num(vals[0]) <= num(vals[1]);
    case '+':
      return vals.reduce<number>((s, v) => s + num(v), 0);
    case '-':
      return vals.length === 1 ? -num(vals[0]) : num(vals[0]) - num(vals[1]);
    case '*':
      return vals.reduce<number>((s, v) => s * num(v), 1);
    case '/': {
      const d = num(vals[1]);
      if (d === 0) throw new Error('json-logic: division by zero');
      return Math.floor(num(vals[0]) / d);
    }
    case 'min':
      return Math.min(...vals.map(num));
    case 'max':
      return Math.max(...vals.map(num));
    default:
      throw new Error(`json-logic: unknown operator "${op}"`);
  }
}

/** Static check: every operator in the tree is whitelisted. Returns the first bad operator or null. */
export function findUnknownOp(expr: unknown): string | null {
  if (expr === null || typeof expr !== 'object') return null;
  if (Array.isArray(expr)) {
    for (const e of expr) {
      const bad = findUnknownOp(e);
      if (bad) return bad;
    }
    return null;
  }
  const keys = Object.keys(expr);
  if (keys.length !== 1) return keys.join(',');
  const op = keys[0]!;
  if (!(LOGIC_OPS as readonly string[]).includes(op)) return op;
  const args = (expr as Record<string, unknown>)[op];
  return findUnknownOp(Array.isArray(args) ? args : [args]);
}
