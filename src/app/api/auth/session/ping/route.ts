import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { touchSession } from '@/lib/session-store';

/** Keep session alive / detect revoke */
export async function POST() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'no_session' }, { status: 401 });
  }
  if (user.sessionId) {
    const ok = touchSession(user.sessionId);
    if (!ok) {
      return NextResponse.json({ ok: false, code: 'revoked' }, { status: 401 });
    }
  }
  return NextResponse.json({ ok: true, sessionId: user.sessionId });
}
