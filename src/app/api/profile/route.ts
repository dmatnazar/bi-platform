import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { getStaffById, getStaffByUsername, upsertStaff } from '@/lib/db';
import {
  checkGatewayHealth,
  staffLookup,
  syncStaffToGateway,
  hashPasswordBcrypt,
  gatewayFetch,
} from '@/lib/gateway';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const body = await req.json();

  const newUsername = body.username != null ? String(body.username).trim() : user.username;
  if (!newUsername || newUsername.length < 2) {
    return NextResponse.json({ error: 'Login gaty gysga' }, { status: 400 });
  }

  // Local staff
  let local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
  if (local) {
    // username uniqueness locally
    if (newUsername.toLowerCase() !== String(local.username).toLowerCase()) {
      const clash = await getStaffByUsername(newUsername);
      if (clash && clash.id !== local.id) {
        return NextResponse.json({ error: 'Bu login eýýäm ulanylýar' }, { status: 409 });
      }
    }
    const now = new Date().toISOString();
    const updated = {
      ...local,
      fullName: body.fullName?.trim() || local.fullName,
      username: newUsername,
      phone: body.phone !== undefined ? body.phone : local.phone,
      email: body.email !== undefined ? body.email : local.email,
      updatedAt: now,
    };
    if (body.password && String(body.password).trim().length >= 6) {
      updated.passwordHash = await hashPassword(String(body.password).trim());
    }
    await upsertStaff(updated);
    local = updated;
  }

  const online = await checkGatewayHealth();
  if (online) {
    const lookup = await staffLookup(user.username);
    const s = lookup.ok ? lookup.data : null;
    const tenantSlug = (s as any)?.tenantSlug || user.companySlug || '';
    if (tenantSlug) {
      let passwordHash = (s as any)?.passwordHash || 'synced-from-bi:keep';
      if (body.password && String(body.password).trim().length >= 6) {
        try {
          passwordHash = hashPasswordBcrypt(String(body.password).trim());
        } catch {
          /* */
        }
      }
      // Prefer single upsert if available
      const upsertRes = await gatewayFetch('POST', '/api/admin/staff-upsert/admin', {
        id: (s as any)?.id || user.id,
        tenantSlug,
        tenantSlugs: (s as any)?.tenantSlugs || [tenantSlug],
        fullName: body.fullName || (s as any)?.fullName || user.fullName,
        username: newUsername,
        passwordHash,
        passwordPlain: body.password && String(body.password).trim().length >= 6 ? String(body.password).trim() : undefined,
        role: (s as any)?.role || user.role,
        phone: body.phone ?? (s as any)?.phone ?? '',
        email: body.email ?? (s as any)?.email ?? '',
        active: true,
      });
      if (!upsertRes.ok) {
        // fallback bulk sync
        await syncStaffToGateway(tenantSlug, [
          {
            id: (s as any)?.id || user.id,
            fullName: body.fullName || (s as any)?.fullName,
            username: newUsername,
            passwordHash,
            role: (s as any)?.role || user.role,
            tenantSlugs: (s as any)?.tenantSlugs || [tenantSlug],
            phone: body.phone ?? (s as any)?.phone,
            email: body.email ?? (s as any)?.email,
            active: true,
          },
        ] as any);
      }
    }
  }

  // Refresh session if username/fullName changed
  const token = await createSessionToken({
    id: user.id,
    username: newUsername,
    fullName: body.fullName?.trim() || user.fullName,
    role: user.role,
    companyId: user.companyId,
    companySlug: user.companySlug,
    companyName: user.companyName,
    isSuperAdmin: user.isSuperAdmin,
  } as any);
  await setSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: newUsername,
      fullName: body.fullName?.trim() || user.fullName,
      phone: body.phone,
      email: body.email,
    },
  });
}
