/** One-time feature tip in the location panel (M12.4). Dismissed tips never return. */
import { useTranslation } from 'react-i18next';
import { pickCoach } from '../../store/coach';
import { useSettings } from '../../store/settings';
import { useTutorial } from '../../tutorial/useTutorial';
import { Button } from '../common/Button';

/** `offered`: the command types the panel lists here (what is on offer, legal or not). */
export function CoachMark({ offered }: { offered: readonly string[] }) {
  const { t } = useTranslation();
  const on = useSettings((s) => s.settings.coach);
  const seen = useSettings((s) => s.settings.coachSeen);
  const update = useSettings((s) => s.update);
  const tutorial = useTutorial((s) => s.active);
  if (!on || tutorial) return null;
  const id = pickCoach(offered, seen);
  if (id === null) return null;
  return (
    <aside
      className="flex flex-col gap-1 rounded-md border border-accent bg-surface-3 p-2 text-xs"
      aria-label={t('coach.label')}
      data-testid="coach-mark"
      data-coach={id}
    >
      <p className="font-semibold">{t(`coach.${id}.title`)}</p>
      <p>{t(`coach.${id}.body`)}</p>
      <div className="flex gap-2">
        <Button data-testid="coach-dismiss" onClick={() => update({ coachSeen: [...seen, id] })}>
          {t('coach.gotIt')}
        </Button>
        <Button data-testid="coach-off" onClick={() => update({ coach: false })}>
          {t('coach.off')}
        </Button>
      </div>
    </aside>
  );
}
