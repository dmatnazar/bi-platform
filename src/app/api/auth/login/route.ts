import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import {
  listActiveSessionsForUser,
  createSession,
  revokeUserSessions,
  revokeSession,
  publicSessionView,
  type SessionLoginPolicy,
} from '@/lib/session-store';

import { staffLookup, verifyPasswordHash } from '@/lib/gateway';
import { getStaffByUsername, verifyPassword as localVerify } from '@/lib/auth-local';
import { getCompanyById, ensureDemoUsers } from '@/lib/db';
import type { SessionUser, StaffRole } from '@/lib/types';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  deviceName: z.string().optional(),
  /** User confirmed replacing other sessions (after session_limit warning) */
  confirmReplace: z.boolean().optional(),
});

/**
 * Roles preserved as stored in staff:
 * super_admin | admin | editor | viewer
 * (no remapping — previous map elevated admin→super_admin and editor→admin)
 */
function mapRole(role: string): StaffRole {
  const r = String(role || '').toLowerCase().replace(/\s+/g, '_');
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'editor') return 'editor';
  return 'viewer';
}

function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

/**
 * Enforce max concurrent devices / login policy, then create session + JWT cookie.
 * Returns NextResponse on block/warn, or null if caller should continue with... actually returns response always for success path.
 */
async function issueSessionResponse(
  req: NextRequest,
  user: SessionUser,
  opts: { deviceId?: string; deviceName?: string; confirmReplace?: boolean }
): Promise<NextResponse> {
  const settings = await getSettings();
  const maxDevices = Math.max(1, Number((settings as any).maxConcurrentDevices) || 1);
  const policy = (String((settings as any).sessionLoginPolicy || 'warn') as SessionLoginPolicy);
  const deviceId = String(opts.deviceId || `web-${user.id}`).slice(0, 128);
  const deviceName = String(opts.deviceName || 'Web brauzer').slice(0, 120);
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || '';

  let active = listActiveSessionsForUser(user.id);
  // Same device reconnect: revoke old sessions for this deviceId only, don't count as conflict
  const sameDevice = active.filter((s) => s.deviceId === deviceId);
  for (const s of sameDevice) {
    revokeSession(s.id, 'same_device_relogin');
  }
  active = listActiveSessionsForUser(user.id);

  if (active.length >= maxDevices) {
    if (policy === 'strict' && !opts.confirmReplace) {
      return NextResponse.json(
        {
          error: 'Bu hasap başga enjamda açyk. Iň köp enjam çägine ýetdi.',
          code: 'session_limit_strict',
          maxDevices,
          sessions: active.map(publicSessionView),
        },
        { status: 403 }
      );
    }
    if (policy === 'warn' && !opts.confirmReplace) {
      return NextResponse.json(
        {
          error: 'Bu hasap başga enjamda açyk. Dowam etseňiz beýleki seanslar ýapylar.',
          code: 'session_limit',
          maxDevices,
          sessions: active.map(publicSessionView),
        },
        { status: 409 }
      );
    }
    // confirmReplace or kick_oldest
    if (policy === 'kick_oldest' && !opts.confirmReplace) {
      // drop oldest until room for 1 new
      const sorted = [...active].sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt));
      const need = active.length - maxDevices + 1;
      for (let i = 0; i < need && i < sorted.length; i++) {
        revokeSession(sorted[i].id, 'kick_oldest');
      }
    } else {
      // warn confirmed or strict shouldn't reach here with confirm; replace all others
      revokeUserSessions(user.id, { reason: 'replaced_by_new_login' });
    }
  }

  const session = createSession({
    userId: user.id,
    username: user.username,
    deviceId,
    deviceName,
    userAgent: ua,
    ip,
  });
  // Ensure under max (edge)
  const after = listActiveSessionsForUser(user.id);
  if (after.length > maxDevices) {
    const sorted = [...after].filter((s) => s.id !== session.id).sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt));
    for (const s of sorted) {
      if (listActiveSessionsForUser(user.id).length <= maxDevices) break;
      revokeSession(s.id, 'enforce_max');
    }
  }

  user.sessionId = session.id;
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
      tenantSlugs: user.tenantSlugs,
      tenantIds: user.tenantIds,
      isSuperAdmin: user.isSuperAdmin,
      sessionId: session.id,
    },
  });
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

    // VPS is the source of truth for Electron-synced staff. This must be checked
    // before the local cache, otherwise an old local record can hide tenantSlugs.
    const remote = await staffLookup(username);

    if (remote.status === 403 && remote.data?.error === 'registration_pending') {
      return NextResponse.json(
        { error: remote.data.message || 'Hasaba alyş heniz tassyklanmady.', code: 'registration_pending' },
        { status: 403 }
      );
    }
    if (remote.status === 403 && remote.data?.error === 'registration_rejected') {
      return NextResponse.json(
        { error: remote.data.message || 'Hasaba alyş ret edildi.', code: 'registration_rejected' },
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
          { error: 'Parol VPS-de ýok ýa-da synag placeholder. Electron-da işgäre täze parol goýup Sync ediň.', code: 'password_missing' },
          { status: 401 }
        );
      }
      if (!verifyPasswordHash(password, hash)) {
        return NextResponse.json(
          { error: 'Parol nädogry (VPS hasaby tapyldy, parol gabat gelmedi)', code: 'bad_password' },
          { status: 401 }
        );
      }

      const role = mapRole(remote.data.role);
      // Multi-tenant: one staff can belong to several companies (tenantSlugs / tenantIds)
      const toStringList = (value: unknown, fallback: unknown): string[] => {
        const raw = Array.isArray(value) ? value : (fallback != null ? [fallback] : []);
        return Array.from(
          new Set(
            raw
              .map((s: unknown) => String(s ?? '').trim())
              .filter((s): s is string => s.length > 0)
          )
        );
      };
      const tenantSlugs = toStringList(remote.data.tenantSlugs, remote.data.tenantSlug);
      const tenantIds = toStringList(
        remote.data.tenantIds,
        remote.data.tenantId || remote.data.tenantSlug
      );
      const user: SessionUser = {
        id: String(remote.data.id ?? ''),
        username: String(remote.data.username ?? ''),
        fullName: String(remote.data.fullName ?? ''),
        role,
        companyId: String(remote.data.tenantId || remote.data.tenantSlug || ''),
        companySlug: remote.data.tenantSlug ? String(remote.data.tenantSlug) : undefined,
        companyName: remote.data.tenantName ? String(remote.data.tenantName) : undefined,
        tenantSlugs,
        tenantIds,
        isSuperAdmin: role === 'super_admin',
      };

      return issueSessionResponse(req, user, {
        deviceId: parsed.data.deviceId,
        deviceName: parsed.data.deviceName,
        confirmReplace: parsed.data.confirmReplace,
      });
    }

    // Offline/demo fallback only. A local cached record must never override a
    // successful VPS staff lookup because it may contain only one company.
    if (remote.status === 0) {
      const local = await getStaffByUsername(username);
      if (local && local.active && await localVerify(password, local.passwordHash)) {
        const company = await getCompanyById(local.companyId);
        const user: SessionUser = {
          id: local.id,
          username: local.username,
          fullName: local.fullName,
          role: local.role,
          companyId: local.companyId,
          companySlug: company?.slug,
          companyName: company?.name,
          tenantSlugs: (local as any).tenantSlugs || (company?.slug ? [company.slug] : []),
          tenantIds: (local as any).tenantIds || (local.companyId ? [local.companyId] : []),
          isSuperAdmin: Boolean(local.isSuperAdmin || local.role === 'super_admin'),
        };
        return issueSessionResponse(req, user, {
          deviceId: parsed.data.deviceId,
          deviceName: parsed.data.deviceName,
          confirmReplace: parsed.data.confirmReplace,
        });
      }
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
