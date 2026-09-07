import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import {
  listAllSessions,
  listActiveSessionsForUser,
  revokeSession,
  publicSessionView,
} from '@/lib/session-store';

/** List own sessions; super admin can pass ?all=1 or ?userId= */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const all = req.nextUrl.searchParams.get('all') === '1';
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  if ((all || userId) && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  if (all) {
    const sessions = listAllSessions({ activeOnly: true }).map(publicSessionView);
    return NextResponse.json({ sessions, currentSessionId: user.sessionId });
  }
  if (userId) {
    const sessions = listActiveSessionsForUser(userId).map(publicSessionView);
    return NextResponse.json({ sessions, currentSessionId: user.sessionId });
  }

  const sessions = listActiveSessionsForUser(user.id).map(publicSessionView);
  return NextResponse.json({ sessions, currentSessionId: user.sessionId });
}

/** Revoke a session: own or super admin any */
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || body.sessionId || '').trim();
  if (!id) return NextResponse.json({ error: 'session id gerek' }, { status: 400 });

  const { getSessionById } = await import('@/lib/session-store');
  const target = getSessionById(id);
  if (!target) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });

  if (target.userId !== user.id && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  revokeSession(id, user.id === target.userId ? 'user_revoke' : 'admin_revoke');
  return NextResponse.json({ ok: true });
}
