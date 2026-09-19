export type Locale = 'tm' | 'ru';

export type TranslationKey = keyof typeof import('./locales/tm').tm;

export type Dict = Record<string, string>;
