import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { getStaffById, upsertStaff } from '@/lib/db';
import { checkGatewayHealth, staffLookup, syncStaffToGateway, hashPasswordBcrypt } from '@/lib/gateway';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const body = await req.json();

  // Always update local staff record
  const local = await getStaffById(user.id);
  if (local) {
    const now = new Date().toISOString();
    const updated = {
      ...local,
      fullName: body.fullName?.trim() || local.fullName,
      phone: body.phone !== undefined ? body.phone : local.phone,
      email: body.email !== undefined ? body.email : local.email,
      updatedAt: now,
    };
    if (body.password && String(body.password).trim().length >= 6) {
      updated.passwordHash = await hashPassword(String(body.password).trim());
    }
    await upsertStaff(updated);
  }

  // Best-effort gateway sync
  const online = await checkGatewayHealth();
  if (!online) {
    return NextResponse.json({ ok: true, localOnly: true });
  }

  const lookup = await staffLookup(user.username);
  if (!lookup.ok || !lookup.data) {
    return NextResponse.json({ ok: true, localOnly: true });
  }
  const s = lookup.data;
  const tenantSlug = s.tenantSlug || user.companySlug;
  if (!tenantSlug) return NextResponse.json({ ok: true });

  let passwordHash = s.passwordHash || 'synced-from-bi:keep';
  if (body.password && String(body.password).trim().length >= 6) {
    try {
      passwordHash = hashPasswordBcrypt(String(body.password).trim());
    } catch {
      /* keep previous */
    }
  }

  await syncStaffToGateway(tenantSlug, [
    {
      id: s.id,
      fullName: body.fullName || s.fullName,
      username: s.username,
      passwordHash,
      role: s.role,
      tenantSlugs: s.tenantSlugs || [tenantSlug],
      phone: body.phone ?? s.phone,
      email: body.email ?? s.email,
      active: true,
    },
  ] as any);

  return NextResponse.json({ ok: true });
}
