import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { countUnreadSupport } from '@/lib/db';

function isAdminRole(role: string) {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const admin = isAdminRole(user.role) || isSuperAdmin(user);
  const count = await countUnreadSupport({
    isAdmin: admin,
    userId: user.id,
    companyId: user.companyId,
    isSuperAdmin: isSuperAdmin(user),
  });

  return NextResponse.json({ count, isAdmin: admin });
}
