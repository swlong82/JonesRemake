/**
 * Detail cards (M13.3–13.6): click a goal, the job, the home or the studies for a plain-language
 * breakdown, a trend where there is one, and a shortcut to the place that changes it. One modal,
 * four bodies, all reading `info.ts`. Escape or a click outside closes it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { goalLevers } from '../../store/goalLevers';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { GoalLevers } from './Hud';
import { educationInfo, goalInfo, homeInfo, jobInfo, type JobInfo } from './info';
import { degreeName, hours, jobTitle, locationName } from './labels';

function Row({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </>
  );
}

function Trend({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 48;
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (Math.min(100, v) * h) / 100).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-12 w-full rounded border border-line bg-surface-3"
      role="img"
      aria-label={label}
      data-testid="info-trend"
    >
      <polyline points={d} fill="none" stroke="var(--c-accent)" strokeWidth={2} />
    </svg>
  );
}

function GoBtn({ place, onClose }: { place: string; onClose: () => void }) {
  const { t } = useTranslation();
  const openTravel = useGame((s) => s.openTravel);
  const preview = useGame((s) => s.preview);
  const here = useGame((s) => s.state?.players[s.state.activeSeat]?.location);
  if (place === here) return null;
  return (
    <Button
      data-testid="info-go"
      onClick={() => {
        onClose();
        openTravel(place);
      }}
    >
      {t('hint.go', {
        hours: hours(preview({ type: 'Move', to: place, mode: 'walk' })?.hours ?? 0),
      })}{' '}
      · {locationName(place)}
    </Button>
  );
}

/**
 * The job card opens on what a layman wants first: the title and where you work. Wage, dress code
 * and requirements sit behind "More details" (M13.4 wording, collapsed by default).
 */
function JobBody({ j, onClose }: { j: JobInfo; onClose: () => void }) {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);
  return (
    <>
      <div data-testid="info-job-summary">
        <h3 className="text-lg font-semibold" data-testid="info-job-title">
          {jobTitle(j.jobId)}
        </h3>
        <p className="text-sm text-ink-muted" data-testid="info-job-place">
          {t('info.job.at', { place: locationName(j.workplaceId) })}
        </p>
      </div>
      {!j.dressOk && <p className="text-sm text-warn">{t('info.job.dressWarn')}</p>}
      <Button
        aria-expanded={more}
        aria-controls="info-job-details"
        onClick={() => {
          setMore((m) => !m);
        }}
        data-testid="info-job-more"
      >
        {t(more ? 'info.job.less' : 'info.job.more')}
      </Button>
      {more && (
        <dl
          id="info-job-details"
          className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm"
          data-testid="info-job-details"
        >
          <Row
            label={t('info.job.wage')}
            value={t('info.job.perHour', { n: j.wage })}
            testId="info-job-wage"
          />
          <Row label={t('info.job.raises')} value={j.raises} />
          <Row label={t('info.job.tenure')} value={t('info.job.weeks', { count: j.weeksHeld })} />
          <Row
            label={t('info.job.dress')}
            value={`${t(`uniform.${j.uniform}`)} ${j.dressOk ? '✓' : `✗ ${t('info.job.dressBad')}`}`}
          />
          <Row
            label={t('info.job.needs')}
            value={[
              t('info.job.needsExp', { n: j.reqExperience }),
              t('info.job.needsDep', { n: j.reqDependability }),
              ...j.reqDegrees.map(degreeName),
            ].join(' · ')}
          />
          {j.experience !== null && j.dependability !== null && (
            <Row
              label={t('info.job.yours')}
              value={t('info.job.yoursValue', { exp: j.experience, dep: j.dependability })}
            />
          )}
        </dl>
      )}
      <GoBtn place={j.workplaceId} onClose={onClose} />
    </>
  );
}

export function InfoModal() {
  const { t } = useTranslation();
  const topic = useGame((s) => s.info);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const candidates = useGame((s) => s.candidates);
  const preview = useGame((s) => s.preview);
  const close = useGame((s) => s.closeInfo);
  useEffect(() => {
    if (!topic) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [topic, close]);
  if (!topic || !state || !pack) return null;
  const seat = state.activeSeat;
  const opaque = state.config.classicOpacity;
  let title: string;
  let body: ReactNode = null;

  if (topic.kind === 'goal') {
    const g = goalInfo(state, pack, seat, topic.goal);
    const name = t(`hud.goal.${topic.goal}`);
    title = t('info.goal.title', { goal: name });
    if (g) {
      const rows: ReactNode = (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
          <Row
            label={t('info.goal.progress')}
            value={opaque ? `${g.pct}%` : `${g.value}/${g.target}`}
            testId="info-goal-progress"
          />
          {topic.goal === 'wealth' && (
            <>
              <Row label={t('hud.cash')} value={t('panel.preview.money', { n: g.cash })} />
              <Row label={t('hud.bank')} value={t('panel.preview.money', { n: g.bank })} />
              <Row
                label={t('info.goal.netWorth')}
                value={t('panel.preview.money', { n: g.netWorth })}
              />
            </>
          )}
        </dl>
      );
      body = (
        <>
          <p className="text-sm">{t(`info.goal.about.${topic.goal}`)}</p>
          {rows}
          {g.met && <p className="text-sm font-semibold text-ok">{t('info.goal.met')}</p>}
          <Trend points={g.trend} label={t('info.goal.trend', { goal: name })} />
          {!g.met && <GoalLevers goal={topic.goal} />}
        </>
      );
    }
  } else if (topic.kind === 'job') {
    const j = jobInfo(state, pack, seat);
    title = t('info.job.title');
    body = !j ? (
      <p className="text-sm" data-testid="info-job-none">
        {t('info.job.none')}
      </p>
    ) : (
      <JobBody j={j} onClose={close} />
    );
  } else if (topic.kind === 'home') {
    const h = homeInfo(state, pack, seat);
    title = t('info.home.title');
    if (h) {
      body = (
        <>
          <h3 className="font-semibold">{t(`home.${h.tier}`)}</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <Row
              label={t('info.home.rent')}
              value={t('info.home.perPeriod', { n: h.rent })}
              testId="info-home-rent"
            />
            <Row
              label={t('info.home.paidThrough')}
              value={t('hud.week', { n: h.paidThroughWeek })}
            />
            <Row
              label={t('info.home.due')}
              value={
                h.debt > 0
                  ? t('info.home.overdue')
                  : h.dueIn === 0
                    ? t('info.home.dueNow')
                    : t('info.home.dueIn', { count: h.dueIn })
              }
              testId="info-home-due"
            />
            {h.debt > 0 && (
              <Row label={t('info.home.debt')} value={t('panel.preview.money', { n: h.debt })} />
            )}
            <Row
              label={t('info.home.safety')}
              value={h.burglary ? t('info.home.burglary') : t('info.home.secure')}
            />
            <Row label={t('hud.cash')} value={t('panel.preview.money', { n: h.cash })} />
          </dl>
          {h.debt > 0 && (
            <p className="text-sm text-danger">
              {t('info.home.evict', { count: h.evictionWeeks })}
            </p>
          )}
          <GoBtn place={h.homeLocation} onClose={close} />
        </>
      );
    }
  } else {
    const e = educationInfo(state, pack, seat);
    title = t('info.edu.title');
    if (e) {
      const jobsFor = (id: string): string =>
        (e.unlocks[id] ?? []).map((j) => jobTitle(j)).join(', ');
      const place = goalLevers('education', state, pack, candidates(), preview).place;
      body = (
        <>
          <section>
            <h3 className="font-semibold">{t('info.edu.held')}</h3>
            {e.held.length === 0 ? (
              <p className="text-sm">{t('info.edu.noneHeld')}</p>
            ) : (
              <ul className="text-sm" data-testid="info-edu-held">
                {e.held.map((id) => (
                  <li key={id}>
                    {t('info.edu.tick', { name: degreeName(id) })}
                    {e.unlocks[id] && (
                      <span className="text-ink-muted">
                        {' '}
                        — {t('info.edu.unlocks', { jobs: jobsFor(id) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="font-semibold">{t('info.edu.enrolled')}</h3>
            {e.enrolled.length === 0 ? (
              <p className="text-sm">{t('info.edu.noneEnrolled')}</p>
            ) : (
              <ul className="text-sm" data-testid="info-edu-enrolled">
                {e.enrolled.map((c) => (
                  <li key={c.id}>
                    {degreeName(c.id)} —{' '}
                    {t('info.edu.lessons', { left: c.lessonsLeft, total: c.lessons })}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {e.available.length > 0 && (
            <section>
              <h3 className="font-semibold">{t('info.edu.available')}</h3>
              <ul className="text-sm">
                {e.available.map((id) => (
                  <li key={id}>
                    {degreeName(id)}
                    {e.unlocks[id] && (
                      <span className="text-ink-muted">
                        {' '}
                        — {t('info.edu.unlocks', { jobs: jobsFor(id) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {place !== null && <GoBtn place={place} onClose={close} />}
        </>
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="info-modal"
      onClick={close}
    >
      <section
        className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-surface-2 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" data-testid="info-title">
          {title}
        </h2>
        {body}
        <Button variant="primary" onClick={close} autoFocus data-testid="info-close">
          {t('info.close')}
        </Button>
      </section>
    </div>
  );
}
