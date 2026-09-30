/** Buttons that open the job, home and studies cards (M13.4–13.6). */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

export function InfoButtons() {
  const { t } = useTranslation();
  const openInfo = useGame((s) => s.openInfo);
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          openInfo({ kind: 'job' });
        }}
        data-testid="info-job-btn"
      >
        {t('info.open.job')}
      </Button>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          openInfo({ kind: 'home' });
        }}
        data-testid="info-home-btn"
      >
        {t('info.open.home')}
      </Button>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          openInfo({ kind: 'education' });
        }}
        data-testid="info-edu-btn"
      >
        {t('info.open.edu')}
      </Button>
    </>
  );
}
