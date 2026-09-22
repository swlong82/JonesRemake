/**
 * Wire and value types shared by the platform contracts (ROADMAP_SCAFFOLDS 16.4, 16.7).
 * Kept in one file so a provider adapter imports exactly one module of types.
 */
import type { JsonValue } from '@hustle-ring/shared';

export type Unsubscribe = () => void;
export type RoomId = string;
export type PlayerId = string;
export type FeatureId = string;

export interface Identity {
  readonly playerId: PlayerId;
  readonly displayName: string;
}

/** Versioned command envelope; `clientHash` = state hash before apply (16.4). */
export interface CommandEnvelope {
  readonly v: 1;
  readonly roomId: RoomId;
  readonly seat: number;
  readonly seq: number;
  readonly cmd: JsonValue;
  readonly clientHash: string;
}

export interface Ack {
  readonly seq: number;
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface RoomConfig {
  readonly packId: string;
  readonly seats: number;
  readonly isPrivate: boolean;
}

export interface Room {
  readonly id: RoomId;
  readonly code: string;
  readonly config: RoomConfig;
  readonly members: readonly PlayerId[];
}

export interface SaveMeta {
  readonly id: string;
  readonly createdAt: string;
  readonly week: number;
  readonly packId: string;
  readonly seatsSummary: string;
}

/** Full record shape is fixed in ARCHITECTURE 5.7; snapshot/commandLog stay opaque here. */
export interface SaveRecord extends SaveMeta {
  readonly schemaVersion: number;
  readonly engineVersion?: string;
  readonly packVersion: string;
  readonly config: JsonValue;
  readonly commandLog: readonly JsonValue[];
  readonly finalHash?: string;
  readonly snapshot: JsonValue;
}

export type SyncResult =
  { readonly status: 'not-supported' } | { readonly status: 'ok'; readonly pulled: number };

/** `global` | `season:<id>` | `pack:<id>` | `pack:<id>:season:<id>` | `league:<id>` (16.7). */
export type Scope = string;

export interface ScoreEntry {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly engineVersion: string;
  readonly scoringVersion: number;
  readonly seed: string;
  readonly weeks: number;
  readonly score: number;
  readonly finishedAt: string;
  readonly commandLogRef?: string;
  readonly verified: boolean;
}

export interface SubmitResult {
  readonly accepted: boolean;
  readonly rank?: number;
}
export interface Page {
  readonly offset: number;
  readonly limit: number;
}
export interface ScorePage {
  readonly entries: readonly ScoreEntry[];
  readonly total: number;
}
export interface Rank {
  readonly rank: number;
  readonly total: number;
}

export interface ShareData {
  readonly title: string;
  readonly text: string;
  readonly url?: string;
}
export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';
