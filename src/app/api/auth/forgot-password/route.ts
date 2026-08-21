import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import {
  getStaffByUsername,
  getStaffByEmail,
  createPasswordResetToken,
} from '@/lib/db';
import { staffLookup } from '@/lib/gateway';
import { sendMail, buildResetEmailHtml, getMailConfig, isMailConfigured } from '@/lib/mail';

const schema = z.object({
  usernameOrEmail: z.string().min(2),
});

const RATE = new Map<string, number>();
const RATE_MS = 60_000;

function appBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumat nädogry' }, { status: 400 });
    }

    const key = parsed.data.usernameOrEmail.toLowerCase().trim();
    const last = RATE.get(key) || 0;
    if (Date.now() - last < RATE_MS) {
      return NextResponse.json(
        { error: 'Biraz garaşyň we gaýtadan synanyşyň (1 min).' },
        { status: 429 }
      );
    }
    RATE.set(key, Date.now());

    const mailCfg = await getMailConfig();
    if (!isMailConfigured(mailCfg)) {
      return NextResponse.json(
        {
          error:
            'E-poçta heniz sazlanmadyk. Administrator BI Sazlamalar → Gmail bölümünde SMTP goýmaly.',
        },
        { status: 503 }
      );
    }

    const input = key;
    let staff =
      (await getStaffByUsername(input)) ||
      (input.includes('@') ? await getStaffByEmail(input) : undefined);

    // Fallback: VPS catalog staff (email + id)
    if (!staff || !staff.active) {
      try {
        const uname = input.includes('@') ? input.split('@')[0] : input;
        const look = await staffLookup(uname);
        const s = look.ok ? look.data?.staff || look.data?.user || look.data : null;
        if (s && s.username && s.active !== false) {
          staff = {
            id: s.id,
            companyId: s.tenantSlug || s.companyId || '',
            fullName: s.fullName || s.username,
            email: s.email || (input.includes('@') ? input : ''),
            username: s.username,
            passwordHash: s.passwordHash || '',
            role: (s.role as any) || 'viewer',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } catch {
        /* ignore */
      }
    }

    // Also try catalog staff by email/username
    if ((!staff || !staff.email) && input.includes('@')) {
      try {
        const { fetchCatalog } = await import('@/lib/gateway');
        const cat = await fetchCatalog(true);
        const s = ((cat as any).staff || []).find(
          (x: any) => (x.email || '').toLowerCase() === input
        );
        if (s) {
          staff = {
            id: s.id,
            companyId: s.tenantSlug || '',
            fullName: s.fullName || s.username,
            email: s.email,
            username: s.username,
            passwordHash: '',
            role: (s.role as any) || 'viewer',
            active: s.active !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } catch {
        /* */
      }
    }

    // Always generic response to avoid account enumeration
    const generic = {
      ok: true,
      message:
        'Eger hasap tapylsa, paroly täzelemek üçin baglanyşyk e-poçta iberildi. Gutaryş möhleti 15 minut.',
    };

    if (!staff || !staff.active) {
      return NextResponse.json(generic);
    }

    const email = (staff.email || '').trim();
    if (!email || !email.includes('@')) {
      return NextResponse.json({
        ok: true,
        message:
          'Bu ulanyjyda e-poçta ýok. Administrator işgär profiline e-poçta goşmaly.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const minutes = 15;
    const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();

    await createPasswordResetToken({
      token,
      username: staff.username,
      staffId: staff.id,
      email,
      expiresAt,
    });

    const resetUrl = `${appBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
    const sent = await sendMail({
      to: email,
      subject: 'BI Platform — Paroly täzelemek',
      html: buildResetEmailHtml({
        fullName: staff.fullName || staff.username,
        resetUrl,
        minutes,
      }),
    });

    if (!sent.ok) {
      console.error('[forgot-password] mail error', sent.error);
      return NextResponse.json(
        { error: 'E-poçta iberip bolmady: ' + sent.error },
        { status: 502 }
      );
    }

    return NextResponse.json(generic);
  } catch (e: any) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ error: e?.message || 'Ýalňyşlyk' }, { status: 500 });
  }
}
