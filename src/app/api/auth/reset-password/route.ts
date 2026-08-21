import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPasswordResetToken,
  markPasswordResetUsed,
  getStaffById,
  getStaffByUsername,
  upsertStaff,
} from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { updateStaffPasswordOnGateway } from '@/lib/gateway';

const getSchema = z.object({
  token: z.string().min(10),
});

const postSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6).max(128),
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const parsed = getSchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Token nädogry' }, { status: 400 });
  }
  const row = await getPasswordResetToken(token);
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Token tapylmady' }, { status: 404 });
  }
  if (row.usedAt) {
    return NextResponse.json({ ok: false, error: 'Bu baglanyşyk eýýäm ulanyldy' }, { status: 410 });
  }
  const expiresMs = Date.parse(row.expiresAt);
  if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Baglanyşygyň möhleti gutardy' }, { status: 410 });
  }
  return NextResponse.json({
    ok: true,
    username: row.username,
    email: row.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    expiresAt: row.expiresAt,
    expiresInSec: Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parol azyndan 6 belgi bolmaly' },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;
    const row = await getPasswordResetToken(token);
    if (!row) {
      return NextResponse.json({ error: 'Token tapylmady' }, { status: 404 });
    }
    if (row.usedAt) {
      return NextResponse.json({ error: 'Bu baglanyşyk eýýäm ulanyldy' }, { status: 410 });
    }
    if (Date.parse(row.expiresAt) < Date.now()) {
      return NextResponse.json({ error: 'Baglanyşygyň möhleti gutardy' }, { status: 410 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    // Update local BI staff if present
    let staff =
      (await getStaffById(row.staffId)) || (await getStaffByUsername(row.username));
    if (staff) {
      await upsertStaff({
        ...staff,
        passwordHash,
        updatedAt: now,
      });
    }

    // Update VPS gateway staff password
    try {
      await updateStaffPasswordOnGateway({
        id: row.staffId,
        username: row.username,
        passwordHash,
        passwordPlain: password,
      });
    } catch (e) {
      console.warn('[reset-password] VPS update failed', e);
    }

    await markPasswordResetUsed(token);

    return NextResponse.json({
      ok: true,
      message: 'Parol täzelendi. Indi täze parol bilen girip bilersiňiz.',
    });
  } catch (e: any) {
    console.error('[reset-password]', e);
    return NextResponse.json({ error: e?.message || 'Ýalňyşlyk' }, { status: 500 });
  }
}
