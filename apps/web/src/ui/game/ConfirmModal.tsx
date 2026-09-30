/**
 * Confirm a big action (M13.8): shows what it costs and what changes, cash and hours before →
 * after, then OK or Cancel. Enter confirms, Escape cancels, Tab stays inside. Under classic
 * opacity only hours and money appear.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { commandLabel, hours, previewParts } from './labels';

export function ConfirmModal() {
  const { t } = useTranslation();
  const pending = useGame((s) => s.confirmPending);
  const state = useGame((s) => s.state);
  const preview = useGame((s) => s.preview);
  const confirm = useGame((s) => s.confirmAction);
  const cancel = useGame((s) => s.cancelConfirm);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [pending]);
  if (!pending || !state) return null;
  const player = state.players[state.activeSeat];
  const p = preview(pending.cmd);
  const opaque = state.config.classicOpacity;
  const parts = p ? previewParts(p, t, { opaque }) : [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      data-testid="confirm-modal"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
          return;
        }
        if (e.key !== 'Tab') return;
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
        );
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <section className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-bold" data-testid="confirm-title">
          {t('confirm.title', { action: commandLabel(pending.cmd, t) })}
        </h2>
        {player && p && (
          <dl
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm"
            data-testid="confirm-diff"
          >
            <dt className="text-ink-muted">{t('hud.cash')}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {t('confirm.change', {
                from: t('panel.preview.money', { n: player.cash }),
                to: t('panel.preview.money', { n: player.cash + p.money }),
              })}
            </dd>
            <dt className="text-ink-muted">{t('hud.hoursLabel')}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {t('confirm.change', {
                from: hours(player.hoursLeft),
                to: hours(Math.max(0, player.hoursLeft - Math.abs(p.hours))),
              })}
            </dd>
          </dl>
        )}
        {parts.length > 0 && <p className="text-xs text-ink-muted">{parts.join(' · ')}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={cancel} data-testid="confirm-cancel">
            {t('confirm.cancel')}
          </Button>
          <Button variant="primary" onClick={confirm} data-testid="confirm-ok">
            {t('confirm.ok')}
          </Button>
        </div>
      </section>
    </div>
  );
}
