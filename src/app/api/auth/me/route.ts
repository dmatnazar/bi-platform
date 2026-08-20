import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { getStaffById } from '@/lib/db';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
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
