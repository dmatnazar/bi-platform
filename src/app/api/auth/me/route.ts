import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { getStaffById, getStaffByUsername } from '@/lib/db';
import { staffLookup } from '@/lib/gateway';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // 1) Validate in local database
  try {
    const local = await getStaffByUsername(user.username);
    if (local && !local.active) {
      await clearSessionCookie();
      return NextResponse.json(
        {
          user: null,
          valid: false,
          code: 'session_invalidated',
          error: 'Hasabyňyz administrasiýa tarapyndan işjeň däl edildi.',
        },
        { status: 401 }
      );
    }
  } catch {
    /* ignore */
  }

  // 2) Validate against VPS Gateway
  try {
    const remote = await staffLookup(user.username);
    if (remote.status === 404) {
      await clearSessionCookie();
      return NextResponse.json(
        {
          user: null,
          valid: false,
          code: 'session_invalidated',
          error: 'Ulanyjy hasabyňyz administrasiýa tarapyndan pozuldy.',
        },
        { status: 401 }
      );
    }
    if (remote.status === 403 || (remote.ok && remote.data?.active === false)) {
      await clearSessionCookie();
      return NextResponse.json(
        {
          user: null,
          valid: false,
          code: 'session_invalidated',
          error:
            remote.data?.message ||
            'Hasabyňyz administrasiýa tarapyndan ýapyldy ýa-da ret edildi.',
        },
        { status: 401 }
      );
    }
  } catch {
    /* network hiccups don't invalidate session */
  }

  // Enrich with phone/email from local staff record (not stored in JWT)
  let phone: string | undefined;
  let email: string | undefined;
  try {
    const staff = await getStaffById(user.id);
    if (staff) {
      phone = staff.phone;
      email = staff.email;
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    user: {
      ...user,
      phone: phone ?? null,
      email: email ?? null,
    },
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
