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
  // Admin settings: return real pass so App Password eye can show stored value.
  // Only reachable by canManageCompany / superAdmin (checked above).
  return NextResponse.json({
    mail: {
      ...cfg,
      pass: cfg.pass || '',
      hasPass: Boolean(cfg.pass),
      configured: isMailConfigured(cfg),
    },
  });
}

/** Coerce port from string/number; empty email fields allowed */
const schema = z.object({
  enabled: z.union([z.boolean(), z.string()]).optional().transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    return v === 'true' || v === '1';
  }),
  host: z.string().optional(),
  port: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : undefined;
    }),
  secure: z.union([z.boolean(), z.string()]).optional().transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    return v === 'true' || v === '1';
  }),
  user: z.string().optional(),
  pass: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().optional(),
  /** empty string → undefined so zod.email is not applied */
  testTo: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v || '').trim();
      return t || undefined;
    })
    .pipe(z.string().email().optional()),
});

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON okalyp bilinmedi' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsg = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v || []).join(', ')}`)
      .join('; ');
    return NextResponse.json(
      {
        error: fieldMsg || 'Nädogry maglumat',
        details: flat,
      },
      { status: 400 }
    );
  }

  const current = await getSettings();
  const prev = (current as any).mail || {};
  const d = parsed.data;

  const next = {
    ...prev,
    enabled: d.enabled ?? prev.enabled ?? false,
    host: (d.host ?? prev.host ?? 'smtp.gmail.com').toString().trim() || 'smtp.gmail.com',
    port: d.port ?? prev.port ?? 587,
    secure: d.secure ?? prev.secure ?? false,
    user: (d.user ?? prev.user ?? '').toString().trim(),
    fromName: (d.fromName ?? prev.fromName ?? 'BI Platform').toString().trim() || 'BI Platform',
    fromEmail: (
      d.fromEmail ??
      prev.fromEmail ??
      d.user ??
      prev.user ??
      ''
    )
      .toString()
      .trim(),
    pass:
      d.pass && d.pass !== '••••••••' && d.pass.trim() !== ''
        ? d.pass.trim()
        : prev.pass || '',
  };

  // Gmail: port 465 → secure true; 587 → STARTTLS (secure false)
  if (next.port === 465) next.secure = true;
  if (next.port === 587) next.secure = false;

  await updateSettings({ mail: next });

  if (d.testTo) {
    if (!next.user || !next.pass) {
      return NextResponse.json(
        {
          error: 'Synag üçin Gmail ulanyjy we App Password gerek. Ilki saklaň, soň synag iberiň.',
          mail: { ...next, pass: next.pass ? '••••••••' : '', hasPass: Boolean(next.pass) },
        },
        { status: 400 }
      );
    }
    const sent = await sendMail({
      to: d.testTo,
      subject: 'BI Platform — SMTP synag',
      html: `<p>SMTP synag üstünlikli. Gmail/SMTP dogry işleýär.</p><p style="color:#64748b;font-size:12px">${new Date().toISOString()}</p>`,
    });
    if (!sent.ok) {
      return NextResponse.json(
        {
          error: sent.error || 'SMTP synag şowsuz',
          testOk: false,
          mail: { ...next, pass: next.pass ? '••••••••' : '', hasPass: Boolean(next.pass) },
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      testOk: true,
      mail: { ...next, pass: next.pass ? '••••••••' : '', hasPass: Boolean(next.pass) },
    });
  }

  return NextResponse.json({
    ok: true,
    mail: { ...next, pass: next.pass ? '••••••••' : '', hasPass: Boolean(next.pass) },
  });
}
