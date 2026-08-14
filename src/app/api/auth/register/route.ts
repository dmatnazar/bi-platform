import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRegistration, hashPasswordBcrypt } from '@/lib/gateway';

const schema = z.object({
  tenantSlug: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email(),
  username: z.string().min(3).max(40),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Maglumatlar nädogry', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const passwordHash = hashPasswordBcrypt(data.password);

    const res = await createRegistration({
      tenantSlug: data.tenantSlug,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      passwordHash,
      requestedRole: 'viewer',
    });

    if (!res.ok) {
      const msg =
        res.data?.error === 'Username already taken'
          ? 'Bu login eýýäm ulanylýar'
          : res.data?.error === 'Company not found'
            ? 'Kompaniýa tapyimady'
            : typeof res.data?.error === 'string'
              ? res.data.error
              : 'Hasaba alyş şowsuz (gateway)';
      return NextResponse.json({ error: msg }, { status: res.status || 502 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Öňünden hasaba alyndy. Kompaniýa administratory tassyklamagyny garaşyň.',
      registrationId: res.data.registrationId,
    });
  } catch (err) {
    console.error('register error', err);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}
