import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany, isSuperAdmin } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db';
import { checkGatewayHealth } from '@/lib/gateway';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

function writeEnvFile(settings: {
  gatewayUrl?: string;
  gatewayAdminSecret?: string;
  jwtSecret?: string;
}) {
  const envPath = path.join(process.cwd(), '.env.local');
  let existing = '';
  try {
    if (fs.existsSync(envPath)) existing = fs.readFileSync(envPath, 'utf8');
  } catch {
    /* */
  }
  const lines = existing.split('\n').filter((l) => l.trim() && !/^(GATEWAY_URL|GATEWAY_ADMIN_SECRET|JWT_SECRET)=/.test(l));
  if (settings.gatewayUrl) lines.push(`GATEWAY_URL=${settings.gatewayUrl}`);
  if (settings.gatewayAdminSecret !== undefined) {
    lines.push(`GATEWAY_ADMIN_SECRET=${settings.gatewayAdminSecret || ''}`);
  }
  // Keep JWT if present in process or existing
  const jwt = settings.jwtSecret || process.env.JWT_SECRET;
  if (jwt) lines.push(`JWT_SECRET=${jwt}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  // Update process.env for current runtime
  if (settings.gatewayUrl) process.env.GATEWAY_URL = settings.gatewayUrl;
  if (settings.gatewayAdminSecret !== undefined) {
    process.env.GATEWAY_ADMIN_SECRET = settings.gatewayAdminSecret || '';
  }
}

export async function GET() {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  // Stored settings (JSON) are source of truth after UI save; env is bootstrap only
  const s = await getSettings();
  const gatewayUrl = s.gatewayUrl;
  const actualSecret = s.gatewayAdminSecret || '';
  const hasSecret = !!actualSecret;
  const online = await checkGatewayHealth();
  return NextResponse.json({
    settings: {
      gatewayUrl,
      // Authorized admins can reveal the secret in Settings UI
      gatewayAdminSecret: actualSecret,
      hasSecret,
      catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
    },
    gatewayOnline: online,
    version: '1.0.0',
  });
}

const patchSchema = z.object({
  gatewayUrl: z.string().min(1).optional(),
  gatewayAdminSecret: z.string().optional(),
  catalogSyncIntervalSec: z.number().int().min(0).max(3600).optional(),
  clearSecret: z.boolean().optional(),
});

function normalizeGatewayUrl(raw: string): string | null {
  let u = raw.trim().replace(/\/$/, '');
  if (!u) return null;
  // Allow host:port without scheme → default http
  if (!/^https?:\/\//i.test(u)) {
    u = `http://${u}`;
  }
  try {
    // Validate
    // eslint-disable-next-line no-new
    new URL(u);
    return u;
  } catch {
    return null;
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'nädogry' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.gatewayUrl) {
    const normalized = normalizeGatewayUrl(parsed.data.gatewayUrl);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Gateway URL nädogry. Mysal: http://216.250.13.39:4000 ýa-da localhost:4000' },
        { status: 400 }
      );
    }
    patch.gatewayUrl = normalized;
  }
  if (parsed.data.catalogSyncIntervalSec !== undefined) {
    patch.catalogSyncIntervalSec = parsed.data.catalogSyncIntervalSec;
  }
  if (parsed.data.clearSecret) patch.gatewayAdminSecret = '';
  else if (parsed.data.gatewayAdminSecret && parsed.data.gatewayAdminSecret !== '••••••••') {
    patch.gatewayAdminSecret = parsed.data.gatewayAdminSecret;
  }

  await updateSettings(patch as any);
  const s = await getSettings();

  // Persist critical settings to .env.local so they survive restart.
  // Use the values we just wrote (patch + stored), never stale process.env.
  const urlToWrite =
    (typeof patch.gatewayUrl === 'string' && patch.gatewayUrl) || s.gatewayUrl;
  const secretToWrite =
    patch.gatewayAdminSecret !== undefined
      ? String(patch.gatewayAdminSecret ?? '')
      : s.gatewayAdminSecret;
  writeEnvFile({
    gatewayUrl: urlToWrite,
    gatewayAdminSecret: secretToWrite,
  });
  // Keep in-memory env in sync for this process
  if (urlToWrite) process.env.GATEWAY_URL = urlToWrite;
  if (patch.gatewayAdminSecret !== undefined) {
    process.env.GATEWAY_ADMIN_SECRET = secretToWrite || '';
  }

  return NextResponse.json({
    ok: true,
    settings: {
      gatewayUrl: s.gatewayUrl,
      hasSecret: !!s.gatewayAdminSecret,
      catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
    },
  });
}
