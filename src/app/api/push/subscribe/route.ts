import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertPushToken, removePushToken } from '@/lib/push-store';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  if (!token) return NextResponse.json({ error: 'token gerek' }, { status: 400 });
  upsertPushToken({
    username: user.username,
    token,
    userAgent: req.headers.get('user-agent') || undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  removePushToken(user.username, body.token ? String(body.token) : undefined);
  return NextResponse.json({ ok: true });
}
