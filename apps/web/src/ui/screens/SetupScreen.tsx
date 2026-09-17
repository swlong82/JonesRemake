/** New Game Setup (GDD 4.1, UX 7.1): every option, presets, City picker from world.json. */
import { loadPack, WORLD } from '@hustle-ring/content';
import type { GameConfig, SeatConfig } from '@hustle-ring/engine';
import {
  CHAOS_LEVELS,
  DIFFICULTIES,
  GOAL_IDS,
  PALETTE_IDS,
  TOKEN_SHAPES,
  type Chaos,
  type Difficulty,
  type GoalId,
  type PaletteId,
  type TokenShape,
} from '@hustle-ring/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_FLAGS, useAppFlag } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';
import { Field } from '../common/Field';

export interface SeatDraft extends Omit<SeatConfig, 'ai'> {
  difficulty: Difficulty;
  personality: string;
}

export function randomSeed(): string {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36)).join('-');
}

const PLAYABLE = WORLD.cities.map((c) => c.packId);

export function defaultSeat(
  i: number,
  controller: SeatConfig['controller'],
  name: string,
): SeatDraft {
  return {
    name,
    controller,
    color: PALETTE_IDS[i % 4]!,
    shape: TOKEN_SHAPES[i % 4]!,
    goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
    difficulty: 'normal',
    personality: 'balanced',
  };
}

export function buildConfig(
  packId: string,
  seats: SeatDraft[],
  seed: string,
  chaos: Chaos,
  classicOpacity: boolean,
  soloPractice: boolean,
): GameConfig {
  let list = seats;
  if (list.length === 1 && list[0]!.controller === 'human-local' && !soloPractice) {
    list = [...list, defaultSeat(1, 'ai', 'Rival')];
  }
  return {
    packId,
    seed,
    chaos,
    classicOpacity,
    soloPractice,
    seats: list.map((s) => {
      const base: SeatConfig = {
        name: s.name,
        controller: s.controller,
        color: s.color,
        shape: s.shape,
        goals: { ...s.goals },
      };
      return s.controller === 'ai'
        ? { ...base, ai: { difficulty: s.difficulty, personality: s.personality } }
        : base;
    }),
  };
}

export function validateDraft(seats: SeatDraft[], seed: string): string | null {
  if (seed.trim().length === 0) return 'setup.invalid.seed';
  if (seats.some((s) => s.name.trim().length === 0 || s.name.length > 16))
    return 'setup.invalid.name';
  const colors = new Set(seats.map((s) => s.color));
  const shapes = new Set(seats.map((s) => s.shape));
  if (colors.size !== seats.length || shapes.size !== seats.length) return 'setup.invalid.color';
  return null;
}

export function SetupScreen() {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const startGame = useGame((s) => s.startGame);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [packId, setPackId] = useState(PLAYABLE[0] ?? 'classic');
  const pack = useMemo(() => loadPack(packId), [packId]);
  const [seats, setSeats] = useState<SeatDraft[]>([
    defaultSeat(0, 'human-local', 'You'),
    defaultSeat(1, 'ai', 'Rival'),
  ]);
  const [seed, setSeed] = useState(randomSeed);
  const [chaos, setChaos] = useState<Chaos>(pack.flags.modernEvents ? 'modern' : 'classic');
  const [classicOpacity, setClassicOpacity] = useState(settings.classicOpacityDefault);
  const [soloPractice, setSoloPractice] = useState(false);
  const boardReady = useAppFlag('gameBoard');
  const error = validateDraft(seats, seed);
  const personalities = pack.personalities;

  const setSeat = (i: number, patch: Partial<SeatDraft>) =>
    setSeats(seats.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setGoal = (i: number, goal: GoalId, value: number) =>
    setSeat(i, { goals: { ...seats[i]!.goals, [goal]: value } });
  const preset = (v: number) =>
    setSeats(
      seats.map((s) => ({ ...s, goals: { wealth: v, happiness: v, education: v, career: v } })),
    );

  return (
    <section className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-3xl font-bold">{t('setup.heading')}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('setup.ruleset')} htmlFor="ruleset">
          <select
            id="ruleset"
            className="input"
            value={packId}
            onChange={(e) => setPackId(e.target.value)}
          >
            {PLAYABLE.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('setup.city')} htmlFor="city">
          <select
            id="city"
            className="input"
            value={packId}
            onChange={(e) => setPackId(e.target.value)}
          >
            {WORLD.cities.map((c) => (
              <option key={c.packId} value={c.packId}>
                {loadPack(c.packId).i18n[loadPack(c.packId).manifest.titleKey ?? ''] ?? c.packId}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <h2 className="mt-6 text-xl font-semibold">{t('setup.seats')}</h2>
      <p className="text-sm text-ink-muted">{t('setup.soloNote')}</p>
      <div className="mt-2 grid gap-3">
        {seats.map((s, i) => (
          <fieldset key={i} className="rounded-lg border border-line p-3" data-testid={`seat-${i}`}>
            <legend className="px-1 font-semibold">{t('setup.seat', { n: i + 1 })}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('setup.type')} htmlFor={`type-${i}`}>
                <select
                  id={`type-${i}`}
                  className="input"
                  value={s.controller}
                  onChange={(e) =>
                    setSeat(i, { controller: e.target.value as SeatConfig['controller'] })
                  }
                >
                  <option value="human-local">{t('setup.type.human')}</option>
                  <option value="ai">{t('setup.type.ai')}</option>
                </select>
              </Field>
              <Field label={t('setup.name')} htmlFor={`name-${i}`}>
                <input
                  id={`name-${i}`}
                  className="input"
                  maxLength={16}
                  value={s.name}
                  onChange={(e) => setSeat(i, { name: e.target.value })}
                />
              </Field>
              <Field label={t('setup.color')} htmlFor={`color-${i}`}>
                <select
                  id={`color-${i}`}
                  className="input"
                  value={s.color}
                  onChange={(e) => setSeat(i, { color: e.target.value as PaletteId })}
                >
                  {PALETTE_IDS.map((c) => (
                    <option key={c} value={c}>
                      {t(`setup.color.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('setup.shape')} htmlFor={`shape-${i}`}>
                <select
                  id={`shape-${i}`}
                  className="input"
                  value={s.shape}
                  onChange={(e) => setSeat(i, { shape: e.target.value as TokenShape })}
                >
                  {TOKEN_SHAPES.map((sh) => (
                    <option key={sh} value={sh}>
                      {t(`setup.shape.${sh}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {s.controller === 'ai' && (
                <>
                  <Field label={t('setup.difficulty')} htmlFor={`diff-${i}`}>
                    <select
                      id={`diff-${i}`}
                      className="input"
                      value={s.difficulty}
                      onChange={(e) => setSeat(i, { difficulty: e.target.value as Difficulty })}
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {t(`setup.difficulty.${d}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('setup.personality')} htmlFor={`pers-${i}`}>
                    <select
                      id={`pers-${i}`}
                      className="input"
                      value={s.personality}
                      onChange={(e) => setSeat(i, { personality: e.target.value })}
                    >
                      {personalities.map((p) => (
                        <option key={p.id} value={p.id}>
                          {pack.i18n[p.nameKey] ?? p.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            {s.controller === 'human-local' ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {GOAL_IDS.map((g) => (
                  <Field
                    key={g}
                    label={`${t(`setup.goal.${g}`)}: ${s.goals[g]}`}
                    htmlFor={`goal-${i}-${g}`}
                  >
                    <input
                      id={`goal-${i}-${g}`}
                      type="range"
                      min={10}
                      max={100}
                      step={10}
                      value={s.goals[g]}
                      onChange={(e) => setGoal(i, g, Number(e.target.value))}
                      className="w-full"
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">{t('setup.aiGoalsNote')}</p>
            )}
            {seats.length > 1 && (
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => setSeats(seats.filter((_, k) => k !== i))}
              >
                {t('setup.removeSeat', { n: i + 1 })}
              </Button>
            )}
          </fieldset>
        ))}
        {seats.length < 4 && (
          <Button
            onClick={() =>
              setSeats([...seats, defaultSeat(seats.length, 'ai', `Rival ${seats.length}`)])
            }
            data-testid="add-seat"
          >
            {t('setup.addSeat')}
          </Button>
        )}
      </div>

      <h2 className="mt-6 text-xl font-semibold">{t('setup.presets')}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => preset(30)} data-testid="preset-quick">
          {t('setup.preset.quick')}
        </Button>
        <Button onClick={() => preset(50)}>{t('setup.preset.standard')}</Button>
        <Button onClick={() => preset(80)}>{t('setup.preset.marathon')}</Button>
      </div>

      <h2 className="mt-6 text-xl font-semibold">{t('setup.options')}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Field label={t('setup.seed')} htmlFor="seed">
          <div className="flex gap-2">
            <input
              id="seed"
              className="input flex-1"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              data-testid="seed"
            />
            <Button onClick={() => setSeed(randomSeed())}>{t('setup.randomSeed')}</Button>
          </div>
        </Field>
        <Field label={t('setup.chaos')} htmlFor="chaos">
          <select
            id="chaos"
            className="input"
            value={chaos}
            onChange={(e) => setChaos(e.target.value as Chaos)}
          >
            {CHAOS_LEVELS.map((c) => (
              <option key={c} value={c}>
                {t(`setup.chaos.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={classicOpacity}
            onChange={(e) => setClassicOpacity(e.target.checked)}
          />
          {t('setup.classicOpacity')}
        </label>
        <Field label={t('setup.aiSpeed')} htmlFor="aispeed">
          <select
            id="aispeed"
            className="input"
            value={settings.aiSpeed}
            onChange={(e) => update({ aiSpeed: e.target.value as typeof settings.aiSpeed })}
          >
            <option value="instant">{t('settings.aiSpeed.instant')}</option>
            <option value="fast">{t('settings.aiSpeed.fast')}</option>
            <option value="normal">{t('settings.aiSpeed.normal')}</option>
          </select>
        </Field>
        {seats.length === 1 && seats[0]!.controller === 'human-local' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={soloPractice}
              onChange={(e) => setSoloPractice(e.target.checked)}
            />
            {t('setup.soloPractice')}
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-danger">
          {t(error)}
        </p>
      )}
      {!boardReady && (
        <p className="mt-4 text-ink-muted" data-testid="board-gated">
          {t('flags.startBlocked', { milestone: APP_FLAGS.gameBoard.milestone })}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => go('title')}>{t('setup.back')}</Button>
        <Button
          variant="primary"
          disabled={error !== null || !boardReady}
          data-testid="start-game"
          onClick={() =>
            startGame(buildConfig(packId, seats, seed, chaos, classicOpacity, soloPractice))
          }
        >
          {t('setup.start')}
        </Button>
      </div>
    </section>
  );
}
