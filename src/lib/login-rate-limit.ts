/**
 * In-memory login rate limit + account lockout.
 * Single-instance Next.js üçin ýeterlik. Multi-instance üçin Redis / Upstash gerek.
 *
 * - IP + username: max 5 synanyşyk / 10 minut → 429
 * - Username lockout: 5 nädogry paroldan soň 10 minut blok
 */

type Bucket = {
  /** Sliding window timestamps (ms) of attempts */
  hits: number[];
  /** Fail count toward lockout (username key only) */
  fails: number;
  /** Lock until this timestamp (ms), 0 = not locked */
  lockedUntil: number;
};

const WINDOW_MS = 10 * 60 * 1000; // 10 minut
const MAX_ATTEMPTS = 5; // IP+username per window
const MAX_FAILS_BEFORE_LOCK = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minut

const store = new Map<string, Bucket>();

/** Periodically prune to avoid unbounded growth */
let lastPrune = 0;
function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, b] of store) {
    b.hits = b.hits.filter((t) => now - t < WINDOW_MS);
    if (b.hits.length === 0 && b.lockedUntil < now && b.fails === 0) {
      store.delete(key);
    }
  }
}

function getBucket(key: string): Bucket {
  let b = store.get(key);
  if (!b) {
    b = { hits: [], fails: 0, lockedUntil: 0 };
    store.set(key, b);
  }
  return b;
}

function normalizeUsername(username: string): string {
  return String(username || '').trim().toLowerCase();
}

export function getClientIp(req: { headers: Headers }): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  return 'unknown';
}

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      status: 429;
      error: string;
      code: 'rate_limited' | 'account_locked';
      retryAfterSec: number;
    };

/**
 * Call before verifying password.
 * Counts this attempt toward IP+username window.
 * Also checks username lockout.
 */
export function checkLoginRateLimit(ip: string, username: string): RateLimitResult {
  const now = Date.now();
  prune(now);

  const userKey = `u:${normalizeUsername(username)}`;
  const comboKey = `c:${ip}:${normalizeUsername(username)}`;

  const userBucket = getBucket(userKey);
  if (userBucket.lockedUntil > now) {
    const retryAfterSec = Math.ceil((userBucket.lockedUntil - now) / 1000);
    return {
      ok: false,
      status: 429,
      error: 'Köp synanyşyk, garaşyň',
      code: 'account_locked',
      retryAfterSec,
    };
  }

  const combo = getBucket(comboKey);
  combo.hits = combo.hits.filter((t) => now - t < WINDOW_MS);
  if (combo.hits.length >= MAX_ATTEMPTS) {
    const oldest = combo.hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return {
      ok: false,
      status: 429,
      error: 'Köp synanyşyk, garaşyň',
      code: 'rate_limited',
      retryAfterSec,
    };
  }

  // Record attempt now (counts even if password later fails or succeeds)
  combo.hits.push(now);
  return { ok: true };
}

/** Wrong password / unknown user — bump fail counter, maybe lock username */
export function recordLoginFailure(username: string): void {
  const now = Date.now();
  const userKey = `u:${normalizeUsername(username)}`;
  const b = getBucket(userKey);
  if (b.lockedUntil > now) return;
  b.fails += 1;
  if (b.fails >= MAX_FAILS_BEFORE_LOCK) {
    b.lockedUntil = now + LOCKOUT_MS;
    b.fails = 0;
  }
}

/** Successful login — clear lockout and fails for username */
export function recordLoginSuccess(username: string): void {
  const userKey = `u:${normalizeUsername(username)}`;
  const b = store.get(userKey);
  if (b) {
    b.fails = 0;
    b.lockedUntil = 0;
  }
}

/** Generic credential error (enumeration-safe) */
export const GENERIC_LOGIN_ERROR = 'Login ýa-da parol nädogry';
