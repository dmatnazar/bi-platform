import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import crypto from 'node:crypto';

function gatewayUrl(): string {
  return (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
}

function adminSecret(): string {
  return process.env.GATEWAY_ADMIN_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function sign(body: unknown): string {
  const secret = adminSecret();
  if (!secret) throw new Error('GATEWAY_ADMIN_SECRET is not configured');
  const payload = body === undefined || body === null ? '{}' : JSON.stringify(body);
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { slug, name } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: 'Slug we name gerek' }, { status: 400 });
    }

    const secret = adminSecret();
    if (!secret) {
      return NextResponse.json({ error: 'Gateway Admin Secret sazlanmadyk' }, { status: 500 });
    }

    const base = gatewayUrl();
    const url = `${base}/api/admin/tenant-create`;
    const payload = JSON.stringify({ slug, name });
    const signature = sign({ slug, name });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Signature': signature,
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Kompaniýa döretmek bolmady' }, { status: res.status || 500 });
    }

    return NextResponse.json({ ok: true, tenant: data?.tenant });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Ýalňyşlyk ýüze çykdy', detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
