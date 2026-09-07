/**
 * Server-side session registry (file store).
 * Enables max-devices, warn/strict/kick policies, and remote revoke.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type SessionLoginPolicy = 'warn' | 'strict' | 'kick_oldest';

export interface AuthSession {
  id: string;
  userId: string;
  username: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  revokedAt?: string;
  revokedReason?: string;
}

type StoreFile = { sessions: AuthSession[] };

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'auth-sessions.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ sessions: [] }, null, 2), 'utf8');
  }
}

function read(): StoreFile {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { sessions: Array.isArray(raw?.sessions) ? raw.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

function write(data: StoreFile) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function listActiveSessionsForUser(userId: string): AuthSession[] {
  const now = Date.now();
  return read().sessions.filter(
    (s) =>
      s.userId === userId &&
      s.active &&
      // drop extremely stale (30d) from "active" view
      now - new Date(s.lastSeenAt || s.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000
  );
}

export function listAllSessions(opts?: { userId?: string; activeOnly?: boolean }): AuthSession[] {
  let list = read().sessions;
  if (opts?.userId) list = list.filter((s) => s.userId === opts.userId);
  if (opts?.activeOnly) list = list.filter((s) => s.active);
  return list.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function getSessionById(id: string): AuthSession | undefined {
  return read().sessions.find((s) => s.id === id);
}

export function touchSession(id: string): boolean {
  const data = read();
  const s = data.sessions.find((x) => x.id === id);
  if (!s || !s.active) return false;
  s.lastSeenAt = new Date().toISOString();
  write(data);
  return true;
}

export function revokeSession(id: string, reason: string): boolean {
  const data = read();
  const s = data.sessions.find((x) => x.id === id);
  if (!s) return false;
  s.active = false;
  s.revokedAt = new Date().toISOString();
  s.revokedReason = reason;
  write(data);
  return true;
}

export function revokeUserSessions(
  userId: string,
  opts?: { exceptSessionId?: string; reason?: string }
): number {
  const data = read();
  let n = 0;
  const reason = opts?.reason || 'revoked';
  for (const s of data.sessions) {
    if (s.userId !== userId || !s.active) continue;
    if (opts?.exceptSessionId && s.id === opts.exceptSessionId) continue;
    s.active = false;
    s.revokedAt = new Date().toISOString();
    s.revokedReason = reason;
    n++;
  }
  if (n) write(data);
  return n;
}

export function createSession(input: {
  userId: string;
  username: string;
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ip?: string;
}): AuthSession {
  const data = read();
  const now = new Date().toISOString();
  const session: AuthSession = {
    id: crypto.randomUUID(),
    userId: input.userId,
    username: input.username,
    deviceId: String(input.deviceId || 'unknown').slice(0, 128),
    deviceName: String(input.deviceName || 'Unknown device').slice(0, 120),
    userAgent: String(input.userAgent || '').slice(0, 300),
    ip: String(input.ip || '').slice(0, 80),
    createdAt: now,
    lastSeenAt: now,
    active: true,
  };
  data.sessions.push(session);
  // prune old inactive (>90d)
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  data.sessions = data.sessions.filter((s) => {
    if (s.active) return true;
    const t = new Date(s.revokedAt || s.lastSeenAt || s.createdAt).getTime();
    return t > cutoff;
  });
  write(data);
  return session;
}

export function publicSessionView(s: AuthSession) {
  return {
    id: s.id,
    deviceId: s.deviceId,
    deviceName: s.deviceName,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    active: s.active,
    username: s.username,
    userId: s.userId,
  };
}
