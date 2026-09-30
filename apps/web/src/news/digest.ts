/**
 * The Daily Hustle's weekly digest: headlines written from the current game state, so the paper
 * always has something to say (stocks, the economy, jobs, rent, what just happened, what to watch).
 *
 * Pure: it reads public state and the pack only (never RNG streams or other seats' hidden stats),
 * and returns finished strings from the translation function it is given. Under classic opacity
 * the economy is hidden by the rules, so the paper shrugs instead of reporting the phase.
 */
import type { CityPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import { computeGoals } from '@hustle-ring/engine';
import type { DomainEvent } from '@hustle-ring/shared';
import type { TFunction } from 'i18next';
import { tp } from '../i18n';
import { rentDueIn } from '../store/needs';
import { GOAL_IDS, fillPct } from '../ui/game/Hud';
import { assetName, eventCardText, jobTitle, locationName } from '../ui/game/labels';

export type StorySection = 'lead' | 'markets' | 'work' | 'home' | 'city' | 'rivals' | 'watch';
export type StoryTone = 'good' | 'bad' | 'neutral';

export interface NewsStory {
  id: string;
  section: StorySection;
  tone: StoryTone;
  headline: string;
  body: string;
}

export interface NewsDigest {
  week: number;
  /** Most newsworthy first; the flash banner shows `stories[0]`. */
  stories: NewsStory[];
}

export interface EventEntry {
  week: number;
  event: DomainEvent;
}

/** One of `count` variants of a key, stable for a given week so it never flickers on re-render. */
function pick(week: number, salt: number, count: number): number {
  return ((week * 7 + salt * 3) % count) + 1;
}

/** Per-mille change between the last two recorded prices (0 with less than two). */
function weeklyMovePm(history: readonly number[] | undefined): number {
  if (!history || history.length < 2) return 0;
  const prev = history[history.length - 2] ?? 0;
  const now = history[history.length - 1] ?? 0;
  return prev > 0 ? Math.round(((now - prev) * 1000) / prev) : 0;
}

/** Lead first, then what touches the reader's own life, then the wider city. */
const SECTION_RANK: Record<StorySection, number> = {
  lead: 0,
  watch: 1,
  home: 2,
  work: 3,
  markets: 4,
  city: 5,
  rivals: 6,
};

export function buildDigest(
  state: GameState,
  pack: CityPack,
  seat: number,
  t: TFunction,
  recent: readonly EventEntry[] = [],
): NewsDigest {
  const week = state.week;
  const p = state.players[seat];
  const opaque = state.config.classicOpacity;
  const stories: NewsStory[] = [];
  if (!p) return { week, stories };

  // 1. The economy: the lead story, unless the rules keep it secret.
  if (opaque) {
    stories.push({
      id: 'lead-opaque',
      section: 'lead',
      tone: 'neutral',
      headline: t(`news.digest.opaque.${pick(week, 1, 3)}`),
      body: t('news.digest.opaque.body'),
    });
  } else {
    const phase = state.econ.phase;
    const idxPct = Math.round(state.econ.index / 10);
    stories.push({
      id: 'lead-economy',
      section: 'lead',
      tone: phase === 'boom' ? 'good' : phase === 'recession' ? 'bad' : 'neutral',
      headline: tp(`news.${phase}.${pick(week, 2, 5)}`, t(`news.headline.${phase}`)),
      body:
        idxPct === 100
          ? t('news.digest.economy.level')
          : t(`news.digest.economy.${idxPct > 100 ? 'above' : 'below'}`, {
              pct: Math.abs(idxPct - 100),
            }),
    });
  }

  // 2. Markets: the biggest mover of the week, and what it means for the reader's holdings.
  let best: { id: string; pm: number } | null = null;
  for (const a of pack.assets) {
    const pm = weeklyMovePm(state.market.history[a.id]);
    if (best === null || Math.abs(pm) > Math.abs(best.pm)) best = { id: a.id, pm };
  }
  if (best !== null && best.pm !== 0) {
    const held = p.investments[best.id];
    const price = state.market.prices[best.id] ?? 0;
    const value = held ? Math.floor((held.units * price) / 100_000) : 0;
    const dir = best.pm > 0 ? 'up' : 'down';
    const params = { asset: assetName(best.id), pct: (Math.abs(best.pm) / 10).toFixed(1), value };
    stories.push({
      id: 'markets-mover',
      section: 'markets',
      tone: best.pm > 0 ? 'good' : 'bad',
      headline: t(`news.digest.market.${dir}.${pick(week, 3, 3)}`, params),
      body: t(
        held !== undefined && held.units > 0
          ? `news.digest.market.held.${dir}`
          : `news.digest.market.notHeld.${dir}`,
        params,
      ),
    });
  } else if (pack.assets.length > 0) {
    stories.push({
      id: 'markets-flat',
      section: 'markets',
      tone: 'neutral',
      headline: t(`news.digest.market.flat.${pick(week, 3, 3)}`),
      body: t('news.digest.market.flatBody'),
    });
  }

  // 3. Work: your own job (with a warning if it is exposed), or the best opening you qualify for.
  const job = p.job ? pack.jobById[p.job.jobId] : undefined;
  if (job) {
    const place = locationName(job.workplaceId);
    stories.push({
      id: 'work-yours',
      section: 'work',
      tone: 'neutral',
      headline: t(`news.digest.work.yours.${pick(week, 4, 3)}`, { job: jobTitle(job.id), place }),
      body: t('news.digest.work.yoursBody', { wage: p.job?.wage ?? job.baseWage, place }),
    });
    if (pack.flags.modernEvents && job.automationRiskBp >= 3000) {
      stories.push({
        id: 'watch-automation',
        section: 'watch',
        tone: 'bad',
        headline: t('news.digest.watch.automation', { job: jobTitle(job.id) }),
        body: t('news.digest.watch.automationBody', {
          pct: Math.round(job.automationRiskBp / 100),
        }),
      });
    }
    if (!opaque && state.econ.phase === 'recession') {
      stories.push({
        id: 'watch-layoffs',
        section: 'watch',
        tone: 'bad',
        headline: t('news.digest.watch.layoffs'),
        body: t('news.digest.watch.layoffsBody', { place }),
      });
    }
  } else {
    // The best-paying regular job the reader already qualifies for (their own requirements).
    const top = pack.jobs
      .filter(
        (j) =>
          !j.isGig &&
          j.reqDegrees.every((d) => p.degrees.includes(d)) &&
          j.reqExperience <= p.experience &&
          j.reqDependability <= p.dependability,
      )
      .sort((a, b) => b.baseWage - a.baseWage)[0];
    if (top) {
      const place = locationName(top.workplaceId);
      stories.push({
        id: 'work-opening',
        section: 'work',
        tone: 'good',
        headline: t(`news.digest.work.opening.${pick(week, 5, 3)}`, {
          job: jobTitle(top.id),
          place,
        }),
        body: t('news.digest.work.openingBody', {
          wage: Math.round((top.baseWage * state.econ.index) / 1000),
          place,
        }),
      });
    } else {
      stories.push({
        id: 'work-none',
        section: 'work',
        tone: 'neutral',
        headline: t('news.digest.work.none'),
        body: t('news.digest.work.noneBody'),
      });
    }
  }

  // 4. Home: overdue or due-soon rent, and a landlord's notice from the last week.
  const dueIn = rentDueIn(state, pack, seat);
  const rentLoc = pack.locations.find((l) => l.services.includes('rent'))?.id;
  const rentOffice = locationName(rentLoc ?? pack.homeLocation.low);
  if (p.home.debt > 0) {
    stories.push({
      id: 'home-debt',
      section: 'home',
      tone: 'bad',
      headline: t('news.digest.home.debt', { amount: p.home.debt }),
      body: t('news.digest.home.debtBody', { weeks: pack.rules.housing.evictionWeeks }),
    });
  } else if (dueIn <= 1) {
    stories.push({
      id: 'home-rent',
      section: 'home',
      tone: 'bad',
      headline: t(dueIn === 0 ? 'news.digest.home.dueNow' : 'news.digest.home.dueNext', {
        rent: p.home.rentLocked,
      }),
      body: t('news.digest.home.dueBody', { place: rentOffice }),
    });
  }
  const notice = recent.find(
    (e) =>
      e.week >= week - 1 &&
      e.event.type === 'EventFired' &&
      e.event.seat === seat &&
      e.event.eventId === 'core:rent-hike-notice',
  );
  if (notice) {
    stories.push({
      id: 'home-hike',
      section: 'home',
      tone: 'bad',
      headline: t('news.digest.home.hike'),
      body: eventCardText(notice.event, t).text,
    });
  }

  // 5. City: this and last week's events, told as local news (two at most).
  const seen = new Set<string>();
  for (const e of recent) {
    const ev = e.event;
    if (e.week < week - 1 || ev.type !== 'EventFired' || ev.seat !== seat) continue;
    if (ev.eventId === 'core:rent-hike-notice' || seen.has(ev.eventId)) continue;
    seen.add(ev.eventId);
    const card = eventCardText(ev, t, pack.rules);
    const tone = pack.eventById[ev.eventId]?.tone;
    stories.push({
      id: `city-${ev.eventId}`,
      section: 'city',
      tone: tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'neutral',
      headline: card.title,
      body: card.text,
    });
    if (seen.size >= 2) break;
  }

  // 6. Rivals: who is closest to the finish.
  if (state.players.length > 1) {
    const lead = state.players
      .map((q) => {
        const g = computeGoals(q, state, pack, 0);
        const pcts = GOAL_IDS.map((id) => fillPct(g[id], q.goals[id], opaque));
        return { q, total: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) };
      })
      .sort((a, b) => b.total - a.total)[0];
    // Nothing to report about a race nobody has started.
    if (lead && lead.total >= 10) {
      const you = lead.q.seat === seat;
      stories.push({
        id: 'rivals-lead',
        section: 'rivals',
        tone: you ? 'good' : 'bad',
        headline: t(you ? 'news.digest.rivals.you' : 'news.digest.rivals.other', {
          name: lead.q.name,
          pct: lead.total,
        }),
        body: t('news.digest.rivals.body'),
      });
    }
  }

  return {
    week,
    stories: stories.sort((a, b) => SECTION_RANK[a.section] - SECTION_RANK[b.section]),
  };
}
