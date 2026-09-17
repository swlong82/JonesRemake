import type { CityPack } from '@hustle-ring/content';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/** All user-facing strings go through keys (CLAUDE.md 1.3). Pack strings live in the `pack` namespace. */
export const resources = { en: { translation: en, pack: {} } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation', 'pack'],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
  keySeparator: false,
  nsSeparator: ':',
});

/** Register a pack's flat i18n map under the `pack` namespace (replaces the previous pack). */
export function loadPackStrings(pack: CityPack, lng = 'en'): void {
  i18n.addResourceBundle(lng, 'pack', pack.i18n, false, true);
}

/** Translate a pack key (flat keys with dots; nsSeparator `:` keeps them intact). */
export function tp(key: string, fallback?: string): string {
  const v = i18n.t(`pack:${key}`, { defaultValue: fallback ?? key });
  return v;
}

export default i18n;
