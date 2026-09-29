/**
 * Floating "what that just did" chips (M11.10): after each action the acting human sees the hours,
 * money and stat changes next to the HUD for a few seconds, so cause and effect do not depend on
 * reading the log. Under classic opacity only hours and money show (hidden values stay hidden).
 * It is a polite status region, and it never animates, so reduced motion needs no special case.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { deltaParts } from './labels';

const SHOW_MS = 3500;

export function DeltaToast({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const delta = useGame((s) => s.delta);
  const opaque = useGame((s) => s.state?.config.classicOpacity ?? false);
  const clear = useGame((s) => s.clearDelta);
  const id = delta?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(clear, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [id, clear]);
  const parts = delta ? deltaParts(delta.events, delta.seat, t, { opaque }) : [];
  return (
    <div role="status" className={`pointer-events-none ${className}`} data-testid="delta-toast">
      {parts.length > 0 && (
        <ul className="flex flex-wrap justify-end gap-1">
          {parts.map((part) => (
            <li
              key={part}
              className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold shadow-md"
            >
              {part}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
