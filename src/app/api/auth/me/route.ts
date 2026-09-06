import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { getStaffById, getStaffByUsername } from '@/lib/db';
import { checkGatewayHealth, fetchCatalog, decryptPasswordPlain } from '@/lib/gateway';
import path from 'node:path';
import fs from 'node:fs/promises';

async function readAvatarMap(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'user-avatars.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

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
  let avatar: string | null = null;

  try {
    const staff = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (staff) {
      phone = staff.phone || null;
      email = staff.email || null;
      fullName = staff.fullName || fullName;
      username = staff.username || username;
      avatar = (staff as any).avatar || null;
    }
  } catch {
    /* ignore */
  }

  // Dedicated avatar map (survives missing local staff / profile save)
  try {
    const map = await readAvatarMap();
    const k = String(user.username || '').toLowerCase();
    if (k && map[k]) avatar = map[k];
  } catch {
    /* */
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
      avatar,
      avatarUrl: avatar ? `/avatars/${encodeURIComponent(avatar)}` : null,
      passwordPlain: passwordPlain || null,
    },
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
