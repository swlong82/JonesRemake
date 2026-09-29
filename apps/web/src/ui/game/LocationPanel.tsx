/**
 * Location panel and action previews (UX 7.4, M4.4). Actions come from the engine
 * (`candidateCommands`), grouped by service section; each row shows its preview line and, when the
 * command is not legal here, the reason from its `ErrorCode` (ADR-0020).
 */
import {
  defaultDebtOf,
  loansOf,
  totalOwed,
  weeklySubTotal,
  type Command,
} from '@hustle-ring/engine';
import type { ErrorCode } from '@hustle-ring/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { END_TURN_CONFIRM_HOURS, useGame } from '../../store/gameStore';
import { weekNeeds } from '../../store/needs';
import { nextStep } from '../../store/nextStep';
import { useSettings } from '../../store/settings';
import { useTutorial } from '../../tutorial/useTutorial';
import { Button } from '../common/Button';
import {
  SECTION_ORDER,
  assetName,
  commandKey,
  commandLabel,
  degreeName,
  hours,
  locationName,
  locationQuip,
  previewParts,
  sectionOf,
  subscriptionName,
  type SectionId,
} from './labels';

/** Codes that mean "not here / not now", so the action is not shown at this location at all. */
const PLACE_CODES = new Set<ErrorCode>([
  'ERR_NOT_AT_LOCATION',
  'ERR_NOT_INSIDE',
  'ERR_ALREADY_INSIDE',
  'ERR_LOCATION_CLOSED',
  'ERR_UNKNOWN_ID',
  'ERR_FEATURE_OFF',
  'ERR_NOT_YOUR_TURN',
  'ERR_GAME_OVER',
]);

/** Actions worth repeating until the hours run out (UX 7.4). */
export const REPEATABLE = new Set<string>(['Work', 'Study', 'Relax']);

export interface Row {
  cmd: Command;
  code: ErrorCode | null;
}

/** Group the engine's candidates into panel sections, legal rows first. */
export function groupRows(rows: Row[]): { section: SectionId; rows: Row[] }[] {
  const bySection = new Map<SectionId, Row[]>();
  for (const row of rows) {
    if (row.code !== null && PLACE_CODES.has(row.code)) continue;
    const section = sectionOf(row.cmd);
    if (section === null) continue;
    const list = bySection.get(section) ?? [];
    list.push(row);
    bySection.set(section, list);
  }
  const out: { section: SectionId; rows: Row[] }[] = [];
  for (const section of SECTION_ORDER) {
    const list = bySection.get(section);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (a.code === null ? 0 : 1) - (b.code === null ? 0 : 1));
    out.push({ section, rows: list });
  }
  return out;
}

/** Repeat an action until it stops being legal, an event fires or the turn changes. */
export function runRepeat(cmd: Command, limit = 24): void {
  for (let i = 0; i < limit; i++) {
    const before = useGame.getState();
    const seat = before.state?.activeSeat;
    const key = commandKey(cmd);
    if (!before.legal().some((c) => commandKey(c) === key)) break;
    const ok = before.dispatch(cmd);
    const after = useGame.getState();
    if (!ok) break;
    if (after.cards.length > before.cards.length) break;
    if (after.state?.activeSeat !== seat || after.state?.winner !== null) break;
  }
}

function ActionRow({ row, repeat, extra }: { row: Row; repeat: boolean; extra?: string }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const requestSubscriptionCancel = useGame((s) => s.requestSubscriptionCancel);
  const preview = useGame((s) => s.preview);
  const opaque = useGame((s) => s.state?.config.classicOpacity ?? false);
  const p = preview(row.cmd);
  const parts = p ? previewParts(p, t, { opaque }) : [];
  const disabled = row.code !== null;
  return (
    <li className="flex flex-col gap-0.5 border-b border-line py-1 last:border-b-0">
      <Button
        variant={disabled ? 'default' : 'primary'}
        disabled={disabled}
        className="text-left"
        data-testid={`action-${commandKey(row.cmd)}`}
        onClick={() => {
          if (repeat && REPEATABLE.has(row.cmd.type)) runRepeat(row.cmd);
          else if (row.cmd.type === 'Unsubscribe') requestSubscriptionCancel(row.cmd);
          else dispatch(row.cmd);
        }}
      >
        {commandLabel(row.cmd, t)}
      </Button>
      {parts.length > 0 && (
        <p className="text-xs text-ink-muted" data-testid="preview">
          {parts.join(' · ')}
        </p>
      )}
      {extra !== undefined && extra !== '' && (
        <p className="text-xs text-ink-muted" data-testid="apply-needs">
          {extra}
        </p>
      )}
      {disabled && (
        <p className="text-xs text-danger" data-testid="disabled-reason">
          {t('panel.disabled', { reason: t(`error.${row.code ?? ''}`) })}
        </p>
      )}
    </li>
  );
}

const REQ_CODES = new Set<ErrorCode>([
  'ERR_REQ_EXPERIENCE',
  'ERR_REQ_DEPENDABILITY',
  'ERR_REQ_EDUCATION',
]);

/**
 * "Apply for a job" (M11.3): jobs grouped by employer, best pay first, hiding the ones the player
 * cannot apply for unless asked, and spelling out what a locked job needs.
 */
export function ApplyList({ rows, repeat }: { rows: Row[]; repeat: boolean }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const [onlyOk, setOnlyOk] = useState(true);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  const jobOf = (row: Row) =>
    row.cmd.type === 'ApplyJob' ? pack.jobById[row.cmd.jobId] : undefined;
  const shown = onlyOk ? rows.filter((r) => r.code === null) : rows;
  const hidden = rows.length - shown.length;

  const groups = new Map<string, Row[]>();
  for (const row of shown) {
    const employer = jobOf(row)?.workplaceId ?? '';
    groups.set(employer, [...(groups.get(employer) ?? []), row]);
  }
  const wage = (row: Row): number => jobOf(row)?.baseWage ?? 0;
  const ordered = [...groups.entries()]
    .map(([employer, list]) => ({
      employer,
      list: [...list].sort((a, b) => wage(b) - wage(a)),
    }))
    .sort((a, b) => wage(b.list[0]!) - wage(a.list[0]!));

  const needs = (row: Row): string => {
    const job = jobOf(row);
    if (!job || !player || row.code === null || !REQ_CODES.has(row.code)) return '';
    const list: string[] = [];
    if (player.experience < job.reqExperience)
      list.push(t('panel.apply.needExp', { need: job.reqExperience, have: player.experience }));
    if (player.dependability < job.reqDependability)
      list.push(
        t('panel.apply.needDep', { need: job.reqDependability, have: player.dependability }),
      );
    for (const d of job.reqDegrees)
      if (!player.degrees.includes(d))
        list.push(t('panel.apply.needDegree', { degree: degreeName(d) }));
    return list.length > 0 ? t('panel.apply.needs', { list: list.join(', ') }) : '';
  };

  return (
    <div data-testid="apply-list">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={onlyOk}
          onChange={(e) => setOnlyOk(e.target.checked)}
          data-testid="apply-only-ok"
        />
        {t('panel.apply.onlyOk')}
      </label>
      {ordered.length === 0 && (
        <p className="text-xs text-ink-muted" data-testid="apply-none">
          {t('panel.apply.none')}
        </p>
      )}
      {ordered.map(({ employer, list }) => (
        <div key={employer} data-testid={`apply-employer-${employer}`}>
          <h4 className="mt-1 text-xs font-semibold">
            {t('panel.apply.employer', { name: locationName(employer) })}
          </h4>
          <ul>
            {list.map((row) => (
              <ActionRow key={commandKey(row.cmd)} row={row} repeat={repeat} extra={needs(row)} />
            ))}
          </ul>
        </div>
      ))}
      {hidden > 0 && (
        <p className="text-xs text-ink-muted" data-testid="apply-hidden">
          {t('panel.apply.hidden', { n: hidden })}
        </p>
      )}
    </div>
  );
}

/** Small, text-backed sparkline: useful at a glance and still readable to assistive technology. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((value, i) => `${(i * 100) / (values.length - 1)},${24 - ((value - min) * 24) / span}`)
    .join(' ');
  return (
    <svg className="h-6 w-24" viewBox="0 0 100 24" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="var(--c-accent)" strokeWidth="2" />
    </svg>
  );
}

function ModernDetails({ section }: { section: SectionId }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;

  if (section === 'invest') {
    const held = Object.entries(player.investments).filter(([, holding]) => holding.units > 0);
    return (
      <div className="text-xs text-ink-muted" data-testid="investment-summary">
        {held.length === 0 ? (
          <p>{t('panel.noInvestments')}</p>
        ) : (
          held.map(([assetId, holding]) => {
            const price = state.market.prices[assetId] ?? 0;
            const value = Math.floor((holding.units * price) / 100_000);
            return (
              <div className="flex items-center gap-2" key={assetId}>
                <Sparkline
                  values={state.market.history[assetId] ?? []}
                  label={`${assetName(assetId)} price history`}
                />
                <span>{t('panel.investment', { asset: assetName(assetId), value })}</span>
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (section === 'loans') {
    const loans = loansOf(player);
    const defaultDebt = defaultDebtOf(player);
    return (
      <div className="text-xs text-ink-muted" data-testid="loan-summary">
        {loans.length === 0 && defaultDebt === 0 ? (
          <p>{t('panel.noLoans')}</p>
        ) : (
          <>
            {loans.map((loan, i) => (
              <p key={`${loan.takenWeek}-${i}`}>
                {t('panel.loan', {
                  balance: loan.balance,
                  payment: loan.weeklyPayment,
                  apr: (loan.aprBp / 100).toFixed(2),
                })}
              </p>
            ))}
            {defaultDebt > 0 && (
              <p className="font-semibold text-danger" data-testid="default-debt">
                {t('panel.defaultDebt', {
                  amount: defaultDebt,
                  percent: (pack.loans?.garnishBp ?? 0) / 100,
                })}
              </p>
            )}
            <p>{t('panel.totalLoanDebt', { amount: totalOwed(player) })}</p>
          </>
        )}
      </div>
    );
  }

  if (section === 'subscriptions')
    return (
      <p className="text-xs text-ink-muted" data-testid="subscription-summary">
        {t('panel.subTotal', { amount: weeklySubTotal(player) })}
      </p>
    );
  return null;
}

function SubscriptionCancelDialog() {
  const { t } = useTranslation();
  const pending = useGame((s) => s.subscriptionCancelPending);
  const confirm = useGame((s) => s.confirmSubscriptionCancel);
  const cancel = useGame((s) => s.cancelSubscriptionCancel);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [pending]);

  if (!pending) return null;

  const name = subscriptionName(pending.cmd.subId);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="subscription-cancel-title"
      aria-describedby="subscription-cancel-description"
      data-testid="subscription-cancel-dialog"
      ref={dialogRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          return;
        }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          event.stopPropagation();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          event.stopPropagation();
          first.focus();
        }
      }}
    >
      <div className="flex max-w-md flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4 shadow-xl">
        <h3 id="subscription-cancel-title" className="text-lg font-bold">
          {t('panel.retention.title')}
        </h3>
        <p id="subscription-cancel-description" className="text-sm">
          {t('panel.retention.body', { name })}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={cancel} data-testid="subscription-cancel-keep">
            {t('panel.retention.keep')}
          </Button>
          <Button variant="danger" onClick={confirm} data-testid="subscription-cancel-confirm">
            {t('panel.retention.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One-line "what next" nudge with a shortcut to travel there (M11.5). */
function NextStepHint() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const preview = useGame((s) => s.preview);
  const openTravel = useGame((s) => s.openTravel);
  const on = useSettings((s) => s.settings.hints);
  const update = useSettings((s) => s.update);
  const tutorial = useTutorial((s) => s.active);
  if (!on || tutorial || !state || !pack) return null;
  const step = nextStep(state, pack);
  if (!step) return null;
  const place = step.place;
  const text =
    place === null
      ? t(`hint.${step.id}${step.id === 'endTurn' ? '' : '.here'}`)
      : t(`hint.${step.id}`, { place: locationName(place) });
  const trip = place === null ? null : preview({ type: 'Move', to: place, mode: 'walk' });
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-line bg-surface-3 p-2 text-xs"
      data-testid="next-step"
    >
      <p>
        <span className="font-semibold">{t('hint.label')}:</span> {text}
      </p>
      <div className="flex gap-2">
        {place !== null && (
          <Button data-testid="next-step-go" onClick={() => openTravel(place)}>
            {t('hint.go', { hours: hours(trip?.hours ?? 0) })}
          </Button>
        )}
        <Button data-testid="next-step-hide" onClick={() => update({ hints: false })}>
          {t('hint.dismiss')}
        </Button>
      </div>
    </div>
  );
}

export function LocationPanel() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const candidates = useGame((s) => s.candidates);
  const dispatch = useGame((s) => s.dispatch);
  const confirmEnd = useGame((s) => s.endTurnPending);
  const requestEndTurn = useGame((s) => s.requestEndTurn);
  const cancelEndTurn = useGame((s) => s.cancelEndTurn);
  const [repeat, setRepeat] = useState(false);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;

  const rows = candidates();
  const enterRow = rows.find((r) => r.cmd.type === 'Enter');
  const closed = enterRow?.code === 'ERR_LOCATION_CLOSED';
  const sections = groupRows(rows);
  const halfHoursLeft = player.hoursLeft;
  const needs = weekNeeds(state, pack);
  const needText = (need: (typeof needs)[number]): string =>
    need.id === 'food'
      ? t('panel.needs.food', {
          hours: hours(need.halfHours),
          happiness: Math.abs(pack.rules.happiness.starvation),
        })
      : t('panel.needs.rent', { amount: need.amount });

  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
      aria-label={locationName(player.location)}
      data-testid="location-panel"
    >
      <header>
        <h2 className="text-lg font-bold" data-testid="panel-location">
          {locationName(player.location)}
        </h2>
        <p className="text-xs italic text-ink-muted">{locationQuip(player.location, state.week)}</p>
        <p className="text-xs" data-testid="panel-state">
          {closed ? t('panel.closed') : player.inside ? t('panel.open') : t('panel.outside')}
        </p>
      </header>

      {!confirmEnd && <NextStepHint />}

      {needs.length > 0 && !confirmEnd && (
        <p className="text-xs text-warn" data-testid="needs-banner">
          {t('panel.needs.banner', {
            list: needs.map((n) => t(`panel.needs.short.${n.id}`)).join(', '),
          })}
        </p>
      )}

      {player.inside ? (
        <Button onClick={() => dispatch({ type: 'Exit' })} data-testid="exit">
          {t('panel.exit')}
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={enterRow?.code !== null && enterRow !== undefined}
          onClick={() => dispatch({ type: 'Enter' })}
          data-testid="enter"
        >
          {t('panel.enter', { hours: hours(pack.rules.time.enterHours) })}
        </Button>
      )}

      {sections.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            data-testid="repeat"
          />
          {t('panel.repeat')}
        </label>
      )}

      <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto">
        {sections.length === 0 && <p className="text-sm text-ink-muted">{t('panel.noActions')}</p>}
        {sections.map(({ section, rows: list }) => (
          <div key={section} data-testid={`section-${section}`}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {t(`panel.section.${section}`)}
            </h3>
            {section === 'bank' && (
              <p className="text-xs text-ink-muted">
                {t('panel.balance', { cash: player.cash, bank: player.bank })}
              </p>
            )}
            <ModernDetails section={section} />
            {section === 'apply' ? (
              <ApplyList rows={list} repeat={repeat} />
            ) : (
              <ul>
                {list.map((row) => (
                  <ActionRow key={commandKey(row.cmd)} row={row} repeat={repeat} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <SubscriptionCancelDialog />

      {confirmEnd ? (
        <div
          role="alertdialog"
          aria-label={t('panel.endTurn')}
          className="flex flex-col gap-2"
          data-testid="end-turn-dialog"
        >
          {halfHoursLeft > END_TURN_CONFIRM_HOURS && (
            <p className="text-sm">{t('panel.endTurnConfirm', { hours: hours(halfHoursLeft) })}</p>
          )}
          {needs.length > 0 && (
            <ul className="list-disc pl-4 text-sm text-warn" data-testid="needs-list">
              {needs.map((n) => (
                <li key={n.id}>{needText(n)}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">{t('panel.needs.weekend')}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="grow"
              onClick={() => {
                cancelEndTurn();
                dispatch({ type: 'EndTurn' });
              }}
              data-testid="end-turn-confirm"
            >
              {t('panel.endTurn')}
            </Button>
            <Button className="grow" onClick={cancelEndTurn} data-testid="end-turn-cancel">
              {t('travel.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={requestEndTurn} data-testid="end-turn">
          {t('panel.endTurn')}
        </Button>
      )}
    </section>
  );
}
