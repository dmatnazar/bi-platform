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


/** Display date/time as day.month.year [HH:mm] */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    let s = String(iso).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}.${m}.${y}`;
    }
    // "YYYY-MM-DD HH:mm:ss" without Z — parse as local wall clock
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
      s = s.replace(' ', 'T');
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hasTime = /[T ]\d{2}:\d{2}/.test(String(iso));
    if (hasTime) {
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  } catch {
    return String(iso);
  }
}

export function formatCellValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  const s = String(value).trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?$/i
  );
  if (m) {
    // day.month.year hours:minute (wall clock from string)
    return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
  }
  if (/^(\d{4})-(\d{2})-(\d{2})$/.test(s)) {
    const [, y, mo, d] = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
    return `${d}.${mo}.${y}`;
  }
  return s;
}
