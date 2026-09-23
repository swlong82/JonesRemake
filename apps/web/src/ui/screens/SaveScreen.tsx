import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadSave, MAX_IMPORT_BYTES } from '../../save/codec';
import { MANUAL_SLOTS, useSaves, type SaveSlot } from '../../save/controller';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

export function SaveScreen() {
  const { t } = useTranslation();
  const { records, busy, controller } = useSaves();
  const state = useGame((s) => s.state);
  const go = useGame((s) => s.go);
  const [confirm, setConfirm] = useState<{ id: string; action: 'save' | 'delete' } | null>(null);
  const [reading, setReading] = useState(false);
  const disabled = busy || reading || !controller;
  async function importFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file || !controller) return;
    if (file.size > MAX_IMPORT_BYTES) {
      useSaves.setState({ error: 'invalid' });
      return;
    }
    setReading(true);
    try {
      await controller.import(await file.text());
    } catch {
      useSaves.setState({ error: 'invalid' });
    } finally {
      setReading(false);
    }
  }
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 p-4" aria-busy={busy || reading}>
      <h1 className="text-3xl font-bold">{t('save.heading')}</h1>
      <p>{t('save.local')}</p>
      {['autosave', ...MANUAL_SLOTS].map((id, i) => {
        const record = records.find((r) => r.id === id);
        const label = id === 'autosave' ? t('save.autosave') : t('save.slot', { n: i });
        return (
          <section
            key={id}
            aria-label={label}
            className="flex flex-col gap-2 rounded-lg border border-line p-3"
          >
            <h2 className="font-bold">{label}</h2>
            <p className="break-words text-sm">
              {record
                ? t('save.summary', {
                    week: record.week,
                    names: record.seatsSummary,
                    date: new Date(record.createdAt).toLocaleString(),
                  })
                : t('save.empty')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled || !record}
                onClick={() => {
                  void controller?.load(id);
                }}
                aria-label={t('save.loadLabel', { slot: label })}
              >
                {t('menu.load')}
              </Button>
              {id !== 'autosave' && (
                <Button
                  disabled={disabled || !state}
                  aria-label={t('save.saveLabel', { slot: label })}
                  onClick={() => {
                    if (record) setConfirm({ id, action: 'save' });
                    else void controller?.save(id as SaveSlot);
                  }}
                >
                  {t('menu.save')}
                </Button>
              )}
              <Button
                disabled={disabled || !record}
                aria-label={t('save.deleteLabel', { slot: label })}
                onClick={() => setConfirm({ id, action: 'delete' })}
              >
                {t('save.delete')}
              </Button>
            </div>
            {confirm?.id === id && (
              <div className="flex flex-col gap-2">
                <p>
                  {t(confirm.action === 'save' ? 'save.overwrite' : 'save.deleteConfirm', {
                    slot: label,
                  })}
                </p>
                <Button
                  disabled={disabled}
                  variant="danger"
                  onClick={() => {
                    if (confirm.action === 'save') void controller?.save(id as SaveSlot);
                    else void controller?.remove(id);
                    setConfirm(null);
                  }}
                >
                  {t('save.confirm')}
                </Button>
                <Button onClick={() => setConfirm(null)}>{t('travel.cancel')}</Button>
              </div>
            )}
          </section>
        );
      })}
      <Button
        disabled={!state}
        onClick={() => {
          if (state) downloadSave(state, t('app.title'));
        }}
      >
        {t('save.export')}
      </Button>
      <label htmlFor="save-import" className="font-medium">
        {t('save.import')}
      </label>
      <input
        id="save-import"
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        onChange={(e) => {
          void importFile(e);
        }}
      />
      <p className="text-sm text-ink-muted">{t('save.importHint')}</p>
      <Button
        disabled={reading}
        onClick={() => go(state ? (state.winner === null ? 'game' : 'end') : 'title')}
      >
        {t('save.back')}
      </Button>
    </section>
  );
}
