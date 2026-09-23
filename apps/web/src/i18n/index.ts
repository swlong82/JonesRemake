import type { CityPack } from '@hustle-ring/content';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import { pseudoBundle } from './pseudo.js';

/**
 * All user-facing strings go through keys (CLAUDE.md 1.3). Pack strings live in the `pack`
 * namespace. The pseudo-locale (M7.5) is generated from the English bundle at startup rather than
 * checked in, so a new key can never be missing from it.
 */
export const resources = {
  en: { translation: en, pack: {} },
  pseudo: { translation: pseudoBundle(en), pack: {} },
} as const;

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

/**
 * Register a pack's flat i18n map under the `pack` namespace (replaces the previous pack). The
 * pack's own strings get the same pseudo treatment, so a location name that overflows is visible
 * too.
 */
export function loadPackStrings(pack: CityPack, lng = 'en'): void {
  i18n.addResourceBundle(lng, 'pack', pack.i18n, false, true);
  if (lng === 'en') i18n.addResourceBundle('pseudo', 'pack', pseudoBundle(pack.i18n), false, true);
}

/** Switch the interface language (UX 7.1 Settings). */
export function setLanguage(lng: 'en' | 'pseudo'): void {
  if (i18n.language !== lng) void i18n.changeLanguage(lng);
}

/** Translate a pack key (flat keys with dots; nsSeparator `:` keeps them intact). */
export function tp(key: string, fallback?: string): string {
  const v = i18n.t(`pack:${key}`, { defaultValue: fallback ?? key });
  return v;
}

export default i18n;
