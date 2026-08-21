import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, canManageCompany, isSuperAdmin } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db';
import { getMailConfig, isMailConfigured, sendMail } from '@/lib/mail';

export async function GET() {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const cfg = await getMailConfig();
  return NextResponse.json({
    mail: {
      ...cfg,
      pass: cfg.pass ? '••••••••' : '',
      hasPass: Boolean(cfg.pass),
      configured: isMailConfigured(cfg),
    },
  });
}

const schema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().optional(),
  testTo: z.string().email().optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'nädogry', details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getSettings();
  const prev = current.mail || {};
  const next = {
    ...prev,
    enabled: parsed.data.enabled ?? prev.enabled ?? false,
    host: parsed.data.host ?? prev.host ?? 'smtp.gmail.com',
    port: parsed.data.port ?? prev.port ?? 587,
    secure: parsed.data.secure ?? prev.secure ?? false,
    user: parsed.data.user ?? prev.user ?? '',
    fromName: parsed.data.fromName ?? prev.fromName ?? 'BI Platform',
    fromEmail: parsed.data.fromEmail ?? prev.fromEmail ?? parsed.data.user ?? prev.user ?? '',
    pass:
      parsed.data.pass && parsed.data.pass !== '••••••••'
        ? parsed.data.pass
        : prev.pass || '',
  };

  await updateSettings({ mail: next });

  if (parsed.data.testTo) {
    const sent = await sendMail({
      to: parsed.data.testTo,
      subject: 'BI Platform — SMTP synag',
      html: `<p>SMTP synag üstünlikli. Gmail/SMTP dogry işleýär.</p>`,
    });
    if (!sent.ok) {
      return NextResponse.json(
        { ok: true, saved: true, testOk: false, error: sent.error },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, saved: true, testOk: true });
  }

  return NextResponse.json({
    ok: true,
    mail: { ...next, pass: next.pass ? '••••••••' : '', hasPass: Boolean(next.pass) },
  });
}
