import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import { checkGatewayHealth } from '@/lib/gateway';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function readStoredSettings(): { gatewayUrl?: string; gatewayAdminSecret?: string } {
  try {
    const file = path.join(process.cwd(), 'data', 'bi-platform.json');
    if (!fs.existsSync(file)) return {};
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data.settings || {};
  } catch {
    return {};
  }
}

function gatewayUrl() {
  const stored = readStoredSettings().gatewayUrl;
  return (stored || process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
}

function adminSecret() {
  const stored = readStoredSettings().gatewayAdminSecret;
  return stored || process.env.GATEWAY_ADMIN_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function sign(body: unknown): string {
  const secret = adminSecret();
  const payload = body === undefined || body === null ? '{}' : JSON.stringify(body);
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  if (!adminSecret()) {
    return NextResponse.json({ error: 'GATEWAY_ADMIN_SECRET ýok' }, { status: 500 });
  }

  const body = await req.json();
  const tenantSlug = String(body.tenantSlug || '').trim();
  const sqlQuery = String(body.sqlQuery || '').trim();
  if (!tenantSlug || !sqlQuery) {
    return NextResponse.json({ error: 'tenantSlug we sqlQuery gerek' }, { status: 400 });
  }

  const payload = {
    tenantSlug,
    sqlQuery,
    dbKey: body.dbKey || 'primary',
    params: body.params || {},
    timeoutMs: body.timeoutMs || 35000,
  };

  try {
    const res = await fetch(`${gatewayUrl()}/api/admin/test-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Signature': sign(payload),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(40000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || data.message || 'Query şowsuz', details: data },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
