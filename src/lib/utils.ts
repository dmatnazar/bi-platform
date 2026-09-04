import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Browser + Node safe UUID (avoids crypto.randomUUID missing in some contexts) */
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // RFC4122-ish v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable date format (SSR + client same) — avoids hydration mismatch */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${day}.${month}.${year} ${h}:${m}:${s}`;
  } catch {
    return iso;
  }
}


/** Display value for tables/charts — ISO datetime → "YYYY-MM-DD HH:mm" */
export function formatCellValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  const s = String(value);
  // 2026-09-04T16:13:29.000Z or 2026-09-04T16:13:29
  const m = s.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (m) {
    return `${m[1]} ${m[2]}:${m[3]}`;
  }
  // date only
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}
