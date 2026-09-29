/**
 * Command palette (M12.3): `/` or Ctrl/⌘+K opens a search box over places, local actions and turn
 * shortcuts. Arrow keys move, Enter runs, Escape closes. It only offers what the player can do now
 * (or where they can travel), and runs everything through the same store actions as the mouse.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { buildPaletteEntries, filterPaletteEntries } from './palette';

export function CommandPalette() {
  const open = useGame((s) => s.paletteOpen);
  return open ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const { t } = useTranslation();
  const close = useGame((s) => s.togglePalette);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  // Snapshot once per open: the list is short-lived and the store is read again when one runs.
  const entries = useMemo(() => buildPaletteEntries(useGame.getState(), t), [t]);
  const results = useMemo(() => filterPaletteEntries(entries, query), [entries, query]);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const active = results[Math.min(index, results.length - 1)];

  const run = (i: number): void => {
    const entry = results[i];
    if (!entry) return;
    close(false);
    entry.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.heading')}
        className="w-full max-w-md rounded-xl border border-line bg-surface-2 p-3 shadow-2xl"
        data-testid="palette"
      >
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={active ? `palette-${active.id}` : undefined}
          aria-label={t('palette.heading')}
          placeholder={t('palette.placeholder')}
          className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-ink"
          value={query}
          data-testid="palette-input"
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close(false);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(Math.min(index, results.length - 1));
            }
          }}
        />
        <ul id="palette-list" role="listbox" className="mt-2 flex flex-col gap-1">
          {results.map((entry, i) => (
            <li
              key={entry.id}
              id={`palette-${entry.id}`}
              role="option"
              aria-selected={entry === active}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm ${
                entry === active ? 'bg-accent text-on-accent' : 'hover:bg-surface-3'
              }`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
            >
              <span className="font-semibold">{entry.label}</span>
              <span className="truncate text-xs opacity-80">{entry.hint}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted" data-testid="palette-empty">
              {t('palette.none')}
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">{t('palette.keys')}</p>
      </div>
    </div>
  );
}
