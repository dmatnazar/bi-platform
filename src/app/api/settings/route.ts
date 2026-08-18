import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db';
import { checkGatewayHealth } from '@/lib/gateway';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DEFAULT_UI_PASSWORD = 'admin1001';

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
  const jwt = settings.jwtSecret || process.env.JWT_SECRET;
  if (jwt) lines.push(`JWT_SECRET=${jwt}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  if (settings.gatewayUrl) process.env.GATEWAY_URL = settings.gatewayUrl;
  if (settings.gatewayAdminSecret !== undefined) {
    process.env.GATEWAY_ADMIN_SECRET = settings.gatewayAdminSecret || '';
  }
}

export async function GET() {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const s = await getSettings();
  const gatewayUrl = process.env.GATEWAY_URL || s.gatewayUrl;
  const actualSecret = process.env.GATEWAY_ADMIN_SECRET || s.gatewayAdminSecret || '';
  const hasSecret = !!actualSecret;
  const online = await checkGatewayHealth();
  return NextResponse.json({
    settings: {
      gatewayUrl,
      gatewayAdminSecret: actualSecret,
      hasSecret,
      catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
      hasUiPassword: !!s.uiAdminPasswordHash,
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
  uiAdminPassword: z.string().min(4).optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
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

  // Update UI admin password if provided
  if (parsed.data.uiAdminPassword) {
    patch.uiAdminPasswordHash = await bcrypt.hash(parsed.data.uiAdminPassword, 10);
  }

  await updateSettings(patch as any);
  const s = await getSettings();

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
      hasUiPassword: !!s.uiAdminPasswordHash,
    },
  });
}

// ── Quick verify endpoint for ConnectionStatusBar gate ───────────────────────
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!password) {
    return NextResponse.json({ error: 'Parol gerek' }, { status: 400 });
  }

  const s = await getSettings();
  let ok = false;

  if (s.uiAdminPasswordHash) {
    ok = await bcrypt.compare(password, s.uiAdminPasswordHash);
  } else {
    // Default password: admin1001
    ok = password === DEFAULT_UI_PASSWORD;
  }

  if (!ok) {
    return NextResponse.json({ error: 'Parol nädogry' }, { status: 401 });
  }

  // Return current gateway settings
  const gatewayUrl = process.env.GATEWAY_URL || s.gatewayUrl;
  const gatewayAdminSecret = process.env.GATEWAY_ADMIN_SECRET || s.gatewayAdminSecret || '';
  const online = await checkGatewayHealth();

  return NextResponse.json({
    ok: true,
    settings: {
      gatewayUrl,
      gatewayAdminSecret,
      hasSecret: !!gatewayAdminSecret,
      catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
    },
    gatewayOnline: online,
  });
}
