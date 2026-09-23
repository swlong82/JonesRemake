import { useTranslation } from 'react-i18next';
import { Button } from '../ui/common/Button';
import { useSaves } from './controller';

export function SaveNotice() {
  const { t } = useTranslation();
  const { error, warning, message } = useSaves();
  if (!error && !warning && !message) return null;
  return (
    <aside className="mx-auto flex max-w-xl flex-wrap items-center gap-2 p-3">
      <div role={error || warning ? 'alert' : 'status'} className="min-w-0 flex-1">
        {error && <p>{t(`save.error.${error}`)}</p>}
        {warning && <p>{t('save.warning')}</p>}
        {!error && message && <p>{t(`save.message.${message}`)}</p>}
      </div>
      <Button onClick={() => useSaves.setState({ error: null, warning: false, message: null })}>
        {t('save.dismiss')}
      </Button>
    </aside>
  );
}
