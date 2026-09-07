import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canHandleSupport } from '@/lib/auth';
import { countUnreadSupport } from '@/lib/db';

function isSupportStaff(user: any) {
  return canHandleSupport(user) || isSuperAdmin(user);
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const admin = isSupportStaff(user);
  const count = await countUnreadSupport({
    isAdmin: admin,
    userId: user.id,
    companyId: user.companyId,
    isSuperAdmin: isSuperAdmin(user),
  });

  return NextResponse.json({ count, isAdmin: admin });
}
