/**
 * Gmail / SMTP mailer for password reset.
 * Admin configures settings in BI → Sazlamalar.
 */
import type { DbSchema } from './types';
import { getSettings } from './db';

export type MailConfig = NonNullable<DbSchema['settings']['mail']>;

export async function getMailConfig(): Promise<MailConfig> {
  const s = await getSettings();
  return {
    enabled: Boolean(s.mail?.enabled),
    host: s.mail?.host || 'smtp.gmail.com',
    port: s.mail?.port ?? 587,
    secure: Boolean(s.mail?.secure),
    user: s.mail?.user || '',
    pass: s.mail?.pass || '',
    fromName: s.mail?.fromName || 'BI Platform',
    fromEmail: s.mail?.fromEmail || s.mail?.user || '',
  };
}

export function isMailConfigured(cfg: MailConfig): boolean {
  return Boolean(cfg.enabled && cfg.host && cfg.user && cfg.pass && cfg.fromEmail);
}

/**
 * Send email via nodemailer (lazy require so build works before npm install).
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = await getMailConfig();
  if (!isMailConfigured(cfg)) {
    return {
      ok: false,
      error: 'E-poçta sazlanmadyk. Admin BI → Sazlamalar → Gmail bölüminde SMTP doldurmaly.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer') as typeof import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port || 587,
      secure: Boolean(cfg.secure),
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName || 'BI Platform'}" <${cfg.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ' '),
    });
    return { ok: true };
  } catch (e: any) {
    console.error('[mail] send failed', e);
    return { ok: false, error: e?.message || String(e) };
  }
}

export function buildResetEmailHtml(opts: {
  fullName: string;
  resetUrl: string;
  minutes: number;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:28px;border:1px solid #334155">
    <h2 style="margin:0 0 12px;color:#fff">Paroly täzelemek</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.5">
      Salam${opts.fullName ? ` ${opts.fullName}` : ''},<br/><br/>
      Parolyňyzy täzelemek üçin isleg geldi. Aşakdaky düwmä basyň
      (baglanyşyk <strong>${opts.minutes} minut</strong> içinde işjeň):
    </p>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.resetUrl}"
         style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px">
        Paroly täzele
      </a>
    </p>
    <p style="color:#64748b;font-size:12px;line-height:1.5;word-break:break-all">
      Düwme işlemese şu linki göçüriň:<br/>${opts.resetUrl}
    </p>
    <p style="color:#64748b;font-size:12px;margin-top:20px">
      Eger bu islegi siz ugratmadyk bolsaňyz, bu haty äsgermän goýuň.
    </p>
  </div>
</body>
</html>`;
}
