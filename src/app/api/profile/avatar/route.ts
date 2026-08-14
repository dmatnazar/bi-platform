import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import crypto from 'node:crypto';

function sign(body: unknown, secret: string) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body ?? {})).digest('hex');
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const { imageBase64 } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: 'surat gerek' }, { status: 400 });

  const settings = await getSettings();
  const base = (settings.gatewayUrl || process.env.GATEWAY_URL || '').replace(/\/$/, '');
  const secret = process.env.GATEWAY_ADMIN_SECRET || '';
  if (!base || !secret) return NextResponse.json({ error: 'Gateway sazlama ýok' }, { status: 500 });

  const payload = { username: user.username, imageBase64 };
  const res = await fetch(`${base}/api/admin/avatar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': sign(payload, secret),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error || 'ýükleme şowsuz' }, { status: 502 });
  const url = data.url?.startsWith('http') ? data.url : `${base}${data.url}`;
  return NextResponse.json({ ok: true, url });
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const settings = await getSettings();
  const base = (settings.gatewayUrl || process.env.GATEWAY_URL || '').replace(/\/$/, '');
  const secret = process.env.GATEWAY_ADMIN_SECRET || '';
  const payload = { username: user.username };
  await fetch(`${base}/api/admin/avatar`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': sign(payload, secret),
    },
    body: JSON.stringify(payload),
  });
  return NextResponse.json({ ok: true });
}
