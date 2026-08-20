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
  // Prefer env, fall back to stored settings
  const s = await getSettings();
  const gatewayUrl = process.env.GATEWAY_URL || s.gatewayUrl;
  const actualSecret =
    process.env.GATEWAY_ADMIN_SECRET || s.gatewayAdminSecret || '';
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
  gatewayUrl: z.string().url().optional(),
  gatewayAdminSecret: z.string().optional(),
  catalogSyncIntervalSec: z.number().int().min(0).max(3600).optional(),
  clearSecret: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'nädogry' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.gatewayUrl) patch.gatewayUrl = parsed.data.gatewayUrl.replace(/\/$/, '');
  if (parsed.data.catalogSyncIntervalSec !== undefined) {
    patch.catalogSyncIntervalSec = parsed.data.catalogSyncIntervalSec;
  }
  if (parsed.data.clearSecret) patch.gatewayAdminSecret = '';
  else if (parsed.data.gatewayAdminSecret && parsed.data.gatewayAdminSecret !== '••••••••') {
    patch.gatewayAdminSecret = parsed.data.gatewayAdminSecret;
  }

  await updateSettings(patch as any);
  const s = await getSettings();

  // Persist critical settings to .env.local so they survive restart
  writeEnvFile({
    gatewayUrl: s.gatewayUrl,
    gatewayAdminSecret: s.gatewayAdminSecret,
  });

  return NextResponse.json({
    ok: true,
    settings: {
      gatewayUrl: s.gatewayUrl,
      hasSecret: !!s.gatewayAdminSecret,
      catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
    },
  });
}
