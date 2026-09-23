import type { SaveRecord } from '../types.js';

/** Save-envelope versions are independent of the engine snapshot schema. */
export const SAVE_SCHEMA_VERSION = 2;

/** v2 promotes the engine version to the envelope; legacy snapshots remain byte-identical. */
export function migrateSave(record: SaveRecord): SaveRecord {
  if (
    !Number.isInteger(record.schemaVersion) ||
    record.schemaVersion < 1 ||
    record.schemaVersion > SAVE_SCHEMA_VERSION
  ) {
    throw new Error('Unsupported save version');
  }
  let current = structuredClone(record);
  while (current.schemaVersion < SAVE_SCHEMA_VERSION) {
    const snapshot = current.snapshot;
    const engineVersion =
      snapshot &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot) &&
      typeof snapshot.engineVersion === 'string'
        ? snapshot.engineVersion
        : 'unknown';
    current = { ...current, schemaVersion: 2, engineVersion };
  }
  return current;
}
