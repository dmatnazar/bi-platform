import { tm } from './locales/tm';
import { ru } from './locales/ru';
import type { Locale } from './types';

export type { Locale } from './types';
export { tm, ru };

const dicts: Record<Locale, Record<string, string>> = {
  tm: tm as unknown as Record<string, string>,
  ru: ru as unknown as Record<string, string>,
};

export const LOCALES: Locale[] = ['tm', 'ru'];
export const DEFAULT_LOCALE: Locale = 'tm';
export const STORAGE_KEY = 'bi-locale';

export function isLocale(v: unknown): v is Locale {
  return v === 'tm' || v === 'ru';
}

export function translate(locale: Locale, key: string, fallback?: string): string {
  const d = dicts[locale] || dicts.tm;
  if (d[key]) return d[key];
  if (dicts.tm[key]) return dicts.tm[key];
  return fallback ?? key;
}

export function getDict(locale: Locale): Record<string, string> {
  return dicts[locale] || dicts.tm;
}


/** Safe translate for non-React helpers (reads locale from localStorage). */
export function getT() {
  let locale = DEFAULT_LOCALE;
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY);
      if (isLocale(v)) locale = v;
    }
  } catch {
    /* */
  }
  return (key: string, fallback?: string) => translate(locale, key, fallback);
}
