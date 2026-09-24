/** Layout breakpoints (UX 7.2: phone < 768px). Without matchMedia the wide layout is assumed. */
import { useEffect, useState } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';

export function matchesPhone(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false;
  return globalThis.matchMedia(PHONE_QUERY).matches;
}

/** Wide enough for the scene's sheets to open inside the park (ART_SPEC 17.9). */
export const WIDE_QUERY = '(min-width: 1024px)';

function matches(query: string, fallback: boolean): boolean {
  if (typeof globalThis.matchMedia !== 'function') return fallback;
  return globalThis.matchMedia(query).matches;
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY, false);
}

export function useIsWide(): boolean {
  return useMediaQuery(WIDE_QUERY, true);
}

export function useMediaQuery(query: string, fallback: boolean): boolean {
  const [value, setValue] = useState(() => matches(query, fallback));
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return;
    const mq = globalThis.matchMedia(query);
    const onChange = (): void => {
      setValue(mq.matches);
    };
    mq.addEventListener('change', onChange);
    onChange();
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, [query]);
  return value;
}
