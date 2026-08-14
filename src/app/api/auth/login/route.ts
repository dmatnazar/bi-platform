import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { staffLookup, verifyPasswordHash } from '@/lib/gateway';
import { getStaffByUsername, verifyPassword as localVerify } from '@/lib/auth-local';
import { getCompanyById, ensureDemoUsers } from '@/lib/db';
import type { SessionUser, StaffRole } from '@/lib/types';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Electron roles: admin | editor | viewer
 * - admin  → platform super admin (ähli kompaniýalar)
 * - editor → company admin
 * - viewer → viewer
 */
function mapRole(role: string): StaffRole {
  const r = String(role || '').toLowerCase();
  if (r === 'super_admin' || r === 'admin') return 'super_admin';
  if (r === 'editor') return 'admin';
  return 'viewer';
}

export async function POST(req: NextRequest) {
  try {
    // Ensure demo admin/viewer always exist
    await ensureDemoUsers();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const { username, password } = parsed.data;

    // 1) LOCAL first (demo admin always works offline)
    const local = await getStaffByUsername(username);
    if (local && local.active) {
      const valid = await localVerify(password, local.passwordHash);
      if (valid) {
        const company = await getCompanyById(local.companyId);
        const user: SessionUser = {
          id: local.id,
          username: local.username,
          fullName: local.fullName,
          role: local.role,
          companyId: local.companyId,
          companySlug: company?.slug,
          companyName: company?.name,
          isSuperAdmin: Boolean(
            local.isSuperAdmin ||
              local.role === 'super_admin' ||
              local.role === 'admin'
          ),
        };
        const token = await createSessionToken(user);
        await setSessionCookie(token);
        return NextResponse.json({
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            companyId: user.companyId,
            companyName: user.companyName,
            companySlug: user.companySlug,
            isSuperAdmin: user.isSuperAdmin,
          },
        });
      }
    }

    // 2) VPS hub staff (Electron-synced)
    const remote = await staffLookup(username);

    if (remote.status === 403 && remote.data?.error === 'registration_pending') {
      return NextResponse.json(
        {
          error: remote.data.message || 'Hasaba alyş heniz tassyklanmady.',
          code: 'registration_pending',
        },
        { status: 403 }
      );
    }
    if (remote.status === 403 && remote.data?.error === 'registration_rejected') {
      return NextResponse.json(
        {
          error: remote.data.message || 'Hasaba alyş ret edildi.',
          code: 'registration_rejected',
        },
        { status: 403 }
      );
    }

    if (remote.status === 403 && remote.data?.error === 'account_inactive') {
      return NextResponse.json(
        { error: remote.data.message || 'Hasap öçürilen', code: 'account_inactive' },
        { status: 403 }
      );
    }

    if (remote.ok && remote.data) {
      const hash = remote.data.passwordHash || '';
      if (!hash || remote.data.passwordUsable === false) {
        return NextResponse.json(
          {
            error:
              'Parol VPS-de ýok ýa-da synag placeholder. Electron-da işgäre täze parol goýup Sync ediň.',
            code: 'password_missing',
          },
          { status: 401 }
        );
      }
      const valid = verifyPasswordHash(password, hash);
      if (!valid) {
        return NextResponse.json(
          { error: 'Parol nädogry (VPS hasaby tapyldy, parol gabat gelmedi)', code: 'bad_password' },
          { status: 401 }
        );
      }

      const role = mapRole(remote.data.role);
      const user: SessionUser = {
        id: remote.data.id,
        username: remote.data.username,
        fullName: remote.data.fullName,
        role,
        companyId: remote.data.tenantId || remote.data.tenantSlug,
        companySlug: remote.data.tenantSlug,
        companyName: remote.data.tenantName,
        isSuperAdmin: role === 'super_admin',
      };

      const token = await createSessionToken(user);
      await setSessionCookie(token);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          companyId: user.companyId,
          companyName: user.companyName,
          companySlug: user.companySlug,
          isSuperAdmin: user.isSuperAdmin,
        },
      });
    }

    if (remote.status === 404) {
      return NextResponse.json(
        {
          error:
            remote.data?.message ||
            'Bu ulanyjy VPS staff sanawynda ýok. Electron-da Sync ediň ýa-da username dogrylygyny barlaň.',
          code: 'not_synced',
          detail: remote.data,
        },
        { status: 401 }
      );
    }
    if (remote.status === 0) {
      return NextResponse.json(
        {
          error: 'VPS Gateway bagly däl. GATEWAY_URL we ADMIN secret barlaň (BI Settings).',
          code: 'gateway_offline',
          detail: remote.data,
        },
        { status: 503 }
      );
    }
    if (remote.status === 403) {
      return NextResponse.json(
        {
          error: remote.data?.error || 'VPS rugsat ýok (HMAC secret gabat gelmeýän bolup biler)',
          code: 'forbidden',
          detail: remote.data,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        error: 'Login şowsuz',
        code: 'unknown',
        status: remote.status,
        detail: remote.data,
      },
      { status: 401 }
    );
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json(
      { error: 'Serwerde säwlik', detail: String(err) },
      { status: 500 }
    );
  }
}
