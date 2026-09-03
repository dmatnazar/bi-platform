'use client';

/**
 * Cross-browser fullscreen helpers.
 *
 * IMPORTANT PLATFORM LIMIT: iOS Safari does not implement the Fullscreen API
 * for arbitrary web content (only <video>). On iPhone/iPad this will silently
 * no-op — there is no JS workaround. The best we can do there is tell the
 * user to "Add to Home Screen" (which opens without Safari's UI at all).
 * Android Chrome/Firefox and all desktop browsers work fine.
 */

type FSDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
};

type FSElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export const FULLSCREEN_PREF_KEY = 'bi-fullscreen-pref';

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as FSElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as FSDoc;
  return !!(document.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
}

/**
 * Request fullscreen on the whole page. MUST be called synchronously inside
 * a real user gesture handler (click/submit) — browsers reject the request
 * otherwise. Safe to call speculatively; failures are swallowed.
 */
export function requestFullscreenSafe(target?: HTMLElement): void {
  if (typeof document === 'undefined') return;
  if (isFullscreenActive()) return;
  const el = (target || document.documentElement) as FSElement;
  try {
    const p = el.requestFullscreen
      ? el.requestFullscreen()
      : el.webkitRequestFullscreen
        ? el.webkitRequestFullscreen()
        : el.msRequestFullscreen
          ? el.msRequestFullscreen()
          : undefined;
    // Some browsers return a Promise that rejects if activation was lost —
    // swallow it so we never throw an unhandled rejection to the console.
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {});
    }
  } catch {
    /* not supported / denied — ignore */
  }
}

export function exitFullscreenSafe(): void {
  if (typeof document === 'undefined' || !isFullscreenActive()) return;
  const d = document as FSDoc;
  try {
    const p = document.exitFullscreen
      ? document.exitFullscreen()
      : d.webkitExitFullscreen
        ? d.webkitExitFullscreen()
        : d.msExitFullscreen
          ? d.msExitFullscreen()
          : undefined;
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function toggleFullscreenSafe(): void {
  if (isFullscreenActive()) exitFullscreenSafe();
  else requestFullscreenSafe();
}

/** Has the user explicitly turned auto-fullscreen off from the toggle button? */
export function fullscreenPrefDisabled(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_PREF_KEY) === 'off';
  } catch {
    return false;
  }
}

export function setFullscreenPref(enabled: boolean): void {
  try {
    localStorage.setItem(FULLSCREEN_PREF_KEY, enabled ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}
