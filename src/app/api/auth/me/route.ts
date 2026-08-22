import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { getStaffById, getStaffByUsername } from '@/lib/db';
import { checkGatewayHealth, fetchCatalog, decryptPasswordPlain } from '@/lib/gateway';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let phone: string | null = null;
  let email: string | null = null;
  let passwordPlain = '';
  let fullName = user.fullName || '';
  let username = user.username;

  try {
    const staff = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (staff) {
      phone = staff.phone || null;
      email = staff.email || null;
      fullName = staff.fullName || fullName;
      username = staff.username || username;
    }
  } catch {
    /* ignore */
  }

  // Enrich from VPS catalog (source of truth)
  try {
    if (await checkGatewayHealth()) {
      const catalog = await fetchCatalog(true);
      const remote = (catalog.staff || []).find(
        (s: any) =>
          s.id === user.id ||
          String(s.username || '').toLowerCase() === String(user.username || '').toLowerCase()
      );
      if (remote) {
        if (remote.phone) phone = remote.phone;
        if (remote.email) email = remote.email;
        if (remote.fullName) fullName = remote.fullName;
        if (remote.username) username = remote.username;
        if (remote.passwordEnc) {
          passwordPlain = decryptPasswordPlain(remote.passwordEnc) || '';
        }
      }
    }
  } catch {
    /* offline */
  }

  return NextResponse.json({
    user: {
      ...user,
      fullName,
      username,
      phone,
      email,
      /** Plain password when VPS has encrypted copy (for profile edit UI) */
      passwordPlain: passwordPlain || null,
    },
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
