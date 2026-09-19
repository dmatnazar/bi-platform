/** Bir session-da bir gezek balans duýduryşy */
let shownKey = '';

export function shouldShowBalanceWarn(key: string): boolean {
  if (!key) return false;
  if (shownKey === key) return false;
  shownKey = key;
  return true;
}

/** Toast görkezmezden "görkezildi" diýip bellä */
export function markBalanceWarnShown(key: string) {
  if (key) shownKey = key;
}

export function balanceWarnKey(slugs: string[]): string {
  return [...slugs].map(String).sort().join('|');
}
