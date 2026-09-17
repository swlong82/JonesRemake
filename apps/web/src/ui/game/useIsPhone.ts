/** Phone layout breakpoint (UX 7.2: < 768px). Falls back to the wide layout without matchMedia. */
import { useEffect, useState } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';

export function matchesPhone(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false;
  return globalThis.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matchesPhone);
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return;
    const mq = globalThis.matchMedia(PHONE_QUERY);
    const onChange = (): void => {
      setPhone(mq.matches);
    };
    mq.addEventListener('change', onChange);
    onChange();
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);
  return phone;
}
