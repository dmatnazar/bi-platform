import { NextRequest, NextResponse } from 'next/server';
import { listNotifications, markNotificationsRead } from '@/lib/gateway';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
  const res = await listNotifications(username, req.nextUrl.searchParams.get('unreadOnly') === '1');
  if (!res.ok) return NextResponse.json({ notifications: [] });
  return NextResponse.json({ notifications: res.data.notifications || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  await markNotificationsRead(body);
  return NextResponse.json({ ok: true });
}
