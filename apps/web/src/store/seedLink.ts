/**
 * A "play this seed" link opened at startup (M12.10). Read once from the address, held here until
 * the setup screen takes it, so the pre-filled seed and city survive the route change.
 */
import { create } from 'zustand';
import { parseSeedLink, type SeedLink } from '../share/shareCard';

interface SeedLinkStore {
  link: SeedLink | null;
  set: (link: SeedLink | null) => void;
}

export const useSeedLink = create<SeedLinkStore>((set) => ({
  link: null,
  set: (link) => {
    set({ link });
  },
}));

/** Take the link from a query string, if it has a valid one; returns whether one was found. */
export function captureSeedLink(search: string): boolean {
  const link = parseSeedLink(search);
  if (link) useSeedLink.getState().set(link);
  return link !== null;
}
