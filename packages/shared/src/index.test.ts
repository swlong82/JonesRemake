import { describe, expect, it } from 'vitest';
import {
  CHAOS_LEVELS,
  DOMAIN_EVENT_TYPES,
  ERROR_CODES,
  GOAL_IDS,
  UNIFORM_TIERS,
  err,
  isErrorCode,
  ok,
  SHARED_VERSION,
  type DomainEvent,
} from './index.js';

describe('shared result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });
  it('err wraps an error', () => {
    expect(err('E')).toEqual({ ok: false, error: 'E' });
  });
  it('exports a version', () => {
    expect(SHARED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('ErrorCode (STATE_MODEL 13.3)', () => {
  it('has the complete list of 46 codes, unique, ERR_-prefixed', () => {
    expect(ERROR_CODES).toHaveLength(46);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    for (const c of ERROR_CODES) expect(c).toMatch(/^ERR_[A-Z_]+$/);
  });
  it('guards strings', () => {
    expect(isErrorCode('ERR_NOT_ENOUGH_HOURS')).toBe(true);
    expect(isErrorCode('ERR_NOPE')).toBe(false);
  });
});

describe('DomainEvent (STATE_MODEL 13.4)', () => {
  it('lists 56 unique event types', () => {
    expect(DOMAIN_EVENT_TYPES).toHaveLength(57);
    expect(new Set(DOMAIN_EVENT_TYPES).size).toBe(DOMAIN_EVENT_TYPES.length);
  });
  it('events carry seq and week', () => {
    const e: DomainEvent = { type: 'Won', seat: 0, week: 12, seq: 3 };
    expect(e.seq).toBe(3);
  });
});

describe('enums', () => {
  it('uniform tiers are ordered none → business', () => {
    expect(UNIFORM_TIERS).toEqual(['none', 'casual', 'dress', 'business']);
  });
  it('four goals, four chaos levels', () => {
    expect(GOAL_IDS).toHaveLength(4);
    expect(CHAOS_LEVELS).toHaveLength(4);
  });
});
