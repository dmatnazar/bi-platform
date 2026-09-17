import fs from 'node:fs';
import path from 'node:path';

export type PushSubscriptionRow = {
  username: string;
  token: string;
  userAgent?: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'push-subscriptions.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

export function listPushTokens(): PushSubscriptionRow[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as PushSubscriptionRow[];
  } catch {
    return [];
  }
}

function save(rows: PushSubscriptionRow[]) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export function upsertPushToken(row: Omit<PushSubscriptionRow, 'updatedAt'> & { updatedAt?: string }) {
  const rows = listPushTokens().filter(
    (r) => !(r.username === row.username && r.token === row.token)
  );
  // one token per device: also drop same token other users
  const cleaned = rows.filter((r) => r.token !== row.token);
  cleaned.push({
    username: row.username,
    token: row.token,
    userAgent: row.userAgent,
    updatedAt: row.updatedAt || new Date().toISOString(),
  });
  save(cleaned);
}

export function removePushToken(username: string, token?: string) {
  let rows = listPushTokens();
  if (token) rows = rows.filter((r) => !(r.username === username && r.token === token));
  else rows = rows.filter((r) => r.username !== username);
  save(rows);
}

export function tokensForUser(username: string): string[] {
  return listPushTokens()
    .filter((r) => r.username.toLowerCase() === username.toLowerCase())
    .map((r) => r.token);
}
