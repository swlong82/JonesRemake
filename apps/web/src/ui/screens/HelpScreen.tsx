import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

const KEYS = [
  'travel',
  'confirm',
  'back',
  'mode',
  'log',
  'standings',
  'help',
  'save',
  'end',
] as const;

export function HelpContent() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t('help.intro')}</p>
      <h2 className="mt-4 text-xl font-semibold">{t('help.keys')}</h2>
      <table className="mt-2 w-full text-left text-sm">
        <tbody>
          {KEYS.map((k) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-1 pr-3 font-mono">
                {t(`help.key.${k}`)}
              </th>
              <td className="py-1">{t(`help.key.${k}.desc`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-ink-muted">{t('help.tutorialSoon')}</p>
    </>
  );
}

export function HelpScreen() {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const hasGame = useGame((s) => s.state !== null);
  return (
    <section className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="mb-4 text-3xl font-bold">{t('help.heading')}</h1>
      <HelpContent />
      <Button className="mt-6" onClick={() => go(hasGame ? 'game' : 'title')} data-testid="back">
        {t('help.close')}
      </Button>
    </section>
  );
}
