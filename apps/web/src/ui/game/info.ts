/**
 * Info pop-up data (M13.3–13.6): pure readers over public state and the pack for the goal,
 * job, home and education cards. Hidden stats (experience, dependability, exact goal values)
 * are only included when classic opacity is off, so the DOM never carries them (M7.4).
 */
import type { CityPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import { computeGoals, netWorth } from '@hustle-ring/engine';
import type { GoalId } from '@hustle-ring/shared';
import { rentDueIn } from '../../store/needs';
import { fillPct } from './Hud';

export type InfoTopic =
  { kind: 'goal'; goal: GoalId } | { kind: 'job' } | { kind: 'home' } | { kind: 'education' };

const GOAL_INDEX: Record<GoalId, number> = { wealth: 0, happiness: 1, education: 2, career: 3 };

export interface GoalInfo {
  value: number;
  target: number;
  pct: number;
  met: boolean;
  /** Percent of target per recorded week (quantized under classic opacity). */
  trend: number[];
  cash: number;
  bank: number;
  netWorth: number;
}

export function goalInfo(
  state: GameState,
  pack: CityPack,
  seat: number,
  goal: GoalId,
): GoalInfo | null {
  const p = state.players[seat];
  if (!p) return null;
  const opaque = state.config.classicOpacity;
  const value = computeGoals(p, state, pack, 0)[goal];
  const target = p.goals[goal];
  const idx = GOAL_INDEX[goal];
  return {
    value,
    target,
    pct: fillPct(value, target, opaque),
    met: value >= target,
    trend: p.history.map((h) => fillPct(h.goals[idx] ?? 0, target, opaque)),
    cash: p.cash,
    bank: p.bank,
    netWorth: netWorth(state, seat, pack),
  };
}

export interface JobInfo {
  jobId: string;
  workplaceId: string;
  wage: number;
  baseWage: number;
  raises: number;
  weeksHeld: number;
  uniform: string;
  /** The outfit worn is at least the job's dress code. */
  dressOk: boolean;
  reqExperience: number;
  reqDependability: number;
  reqDegrees: string[];
  experience: number | null;
  dependability: number | null;
}

export function jobInfo(state: GameState, pack: CityPack, seat: number): JobInfo | null {
  const p = state.players[seat];
  const job = p?.job;
  if (!p || !job) return null;
  const spec = pack.jobById[job.jobId];
  if (!spec) return null;
  const worn = p.clothing[0]?.tier ?? 'none';
  const opaque = state.config.classicOpacity;
  return {
    jobId: job.jobId,
    workplaceId: spec.workplaceId,
    wage: job.wage,
    baseWage: spec.baseWage,
    raises: job.raises,
    weeksHeld: Math.max(0, state.week - job.hiredWeek),
    uniform: spec.uniformTier,
    dressOk: pack.uniformRank[worn] >= pack.uniformRank[spec.uniformTier],
    reqExperience: spec.reqExperience,
    reqDependability: spec.reqDependability,
    reqDegrees: spec.reqDegrees,
    experience: opaque ? null : p.experience,
    dependability: opaque ? null : p.dependability,
  };
}

export interface HomeInfo {
  tier: string;
  rent: number;
  paidThroughWeek: number;
  dueIn: number;
  debt: number;
  evictionWeeks: number;
  burglary: boolean;
  homeLocation: string;
  cash: number;
  bank: number;
}

export function homeInfo(state: GameState, pack: CityPack, seat: number): HomeInfo | null {
  const p = state.players[seat];
  if (!p) return null;
  const h = pack.rules.housing;
  return {
    tier: p.home.tier,
    rent: p.home.rentLocked,
    paidThroughWeek: p.home.paidThroughWeek,
    dueIn: rentDueIn(state, pack, seat),
    debt: p.home.debt,
    evictionWeeks: h.evictionWeeks,
    burglary: h.tiers[p.home.tier]?.burglary ?? false,
    homeLocation: pack.homeLocation[p.home.tier],
    cash: p.cash,
    bank: p.bank,
  };
}

export interface EducationInfo {
  held: string[];
  enrolled: { id: string; lessonsLeft: number; lessons: number }[];
  /** Degrees not held or in progress whose prerequisites are met. */
  available: string[];
  /** Jobs each held or enrolled degree is required by. */
  unlocks: Record<string, string[]>;
}

export function educationInfo(
  state: GameState,
  pack: CityPack,
  seat: number,
): EducationInfo | null {
  const p = state.players[seat];
  if (!p) return null;
  const enrolledIds = Object.keys(p.enrolled);
  const unlocks: Record<string, string[]> = {};
  for (const d of pack.degrees) {
    const jobs = pack.jobs.filter((j) => j.reqDegrees.includes(d.id)).map((j) => j.id);
    if (jobs.length > 0) unlocks[d.id] = jobs;
  }
  return {
    held: p.degrees,
    enrolled: enrolledIds.map((id) => ({
      id,
      lessonsLeft: p.enrolled[id]?.lessonsLeft ?? 0,
      lessons: pack.degreeById[id]?.lessons ?? 0,
    })),
    available: pack.degrees
      .filter(
        (d) =>
          !p.degrees.includes(d.id) &&
          !enrolledIds.includes(d.id) &&
          d.prereqs.every((r) => p.degrees.includes(r)),
      )
      .map((d) => d.id),
    unlocks,
  };
}
