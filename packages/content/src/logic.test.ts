import { describe, expect, it } from 'vitest';
import { evalLogic, findUnknownOp, truthy } from './logic.js';

const view = {
  player: { cash: 250, degreeCount: 2, itemIds: ['computer', 'atlas'], job: null },
  econ: { phase: 'boom' },
  week: 7,
};

describe('json-logic subset', () => {
  it('literals pass through', () => {
    expect(evalLogic(5, view)).toBe(5);
    expect(evalLogic('x', view)).toBe('x');
    expect(evalLogic(null, view)).toBeNull();
    expect(evalLogic([1, { var: 'week' }], view)).toEqual([1, 7]);
  });
  it('var with dotted paths and defaults', () => {
    expect(evalLogic({ var: 'player.cash' }, view)).toBe(250);
    expect(evalLogic({ var: 'player.job.title' }, view)).toBeNull();
    expect(evalLogic({ var: ['player.missing', 9] }, view)).toBe(9);
    expect(evalLogic({ var: 'player.cash.deep' }, view)).toBeNull();
  });
  it('comparisons and boolean ops', () => {
    expect(evalLogic({ '>': [{ var: 'player.cash' }, 200] }, view)).toBe(true);
    expect(evalLogic({ '<=': [{ var: 'week' }, 6] }, view)).toBe(false);
    expect(evalLogic({ '==': [{ var: 'econ.phase' }, 'boom'] }, view)).toBe(true);
    expect(evalLogic({ '!=': [1, 1] }, view)).toBe(false);
    expect(evalLogic({ '>=': [7, 7] }, view)).toBe(true);
    expect(evalLogic({ '<': [1, 2] }, view)).toBe(true);
    expect(evalLogic({ and: [true, { var: 'week' }] }, view)).toBe(7);
    expect(evalLogic({ and: [false, true] }, view)).toBe(false);
    expect(evalLogic({ or: [false, 0, 'x'] }, view)).toBe('x');
    expect(evalLogic({ or: [false, 0] }, view)).toBe(0);
    expect(evalLogic({ '!': [true] }, view)).toBe(false);
    expect(evalLogic({ '!': false }, view)).toBe(true);
  });
  it('in over arrays and strings', () => {
    expect(evalLogic({ in: ['computer', { var: 'player.itemIds' }] }, view)).toBe(true);
    expect(evalLogic({ in: ['tv', { var: 'player.itemIds' }] }, view)).toBe(false);
    expect(evalLogic({ in: ['oo', 'boom'] }, view)).toBe(true);
    expect(evalLogic({ in: ['x', 5] }, view)).toBe(false);
  });
  it('integer arithmetic with floor division', () => {
    expect(evalLogic({ '+': [1, 2, 3] }, view)).toBe(6);
    expect(evalLogic({ '-': [10, 4] }, view)).toBe(6);
    expect(evalLogic({ '-': [4] }, view)).toBe(-4);
    expect(
      evalLogic(
        { '*': [300, { '-': [1000, { '*': [80, { var: 'player.degreeCount' }] }] }] },
        view,
      ),
    ).toBe(252_000);
    expect(evalLogic({ '/': [7, 2] }, view)).toBe(3);
    expect(evalLogic({ min: [3, 1, 2] }, view)).toBe(1);
    expect(evalLogic({ max: [3, 1, 2] }, view)).toBe(3);
    expect(() => evalLogic({ '/': [1, 0] }, view)).toThrow(/division/);
  });
  it('if chains', () => {
    expect(evalLogic({ if: [false, 1, true, 2, 3] }, view)).toBe(2);
    expect(evalLogic({ if: [false, 1, 3] }, view)).toBe(3);
    expect(evalLogic({ if: [false, 1] }, view)).toBeNull();
  });
  it('rejects unknown operators and malformed rules', () => {
    expect(() => evalLogic({ pow: [2, 3] }, view)).toThrow(/unknown operator/);
    expect(() => evalLogic({ a: 1, b: 2 }, view)).toThrow(/exactly one/);
    expect(() => evalLogic({ '+': ['x', 1] }, view)).toThrow(/expected number/);
    expect(findUnknownOp({ and: [{ '>': [1, 2] }, { sqrt: 4 }] })).toBe('sqrt');
    expect(findUnknownOp({ and: [{ '>': [1, 2] }] })).toBeNull();
    expect(findUnknownOp(3)).toBeNull();
    expect(findUnknownOp({ a: 1, b: 2 })).toBe('a,b');
  });
  it('truthy follows json-logic (empty array is false)', () => {
    expect(truthy([])).toBe(false);
    expect(truthy([0])).toBe(true);
    expect(truthy('')).toBe(false);
    expect(evalLogic({ '+': [true, null] }, view)).toBe(1);
  });
});
