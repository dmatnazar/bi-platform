'use client';

import { useEffect, useState } from 'react';
import { Headphones, Phone, X, User, Mail, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Contact = {
  id: string;
  fullName: string;
  role?: string;
  phone?: string;
  telegram?: string;
  whatsapp?: string;
  imo?: string;
  gmail?: string;
  note?: string;
};

function digitsOnly(s: string) {
  return s.replace(/[^\d+]/g, '');
}

function telHref(phone: string) {
  return `tel:${digitsOnly(phone)}`;
}

function smsHref(phone: string, text: string) {
  // iOS uses &body=, Android often ?body=
  const n = digitsOnly(phone);
  return `sms:${n}?body=${encodeURIComponent(text)}&body=${encodeURIComponent(text)}`;
}

function waHref(phone: string, text: string) {
  const n = digitsOnly(phone).replace(/^\+/, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function tgHref(usernameOrPhone: string, text: string) {
  const u = usernameOrPhone.trim().replace(/^@/, '');
  if (/^\+?\d{8,}$/.test(u)) {
    return `https://t.me/+${u.replace(/^\+/, '')}`;
  }
  return `https://t.me/${u}?text=${encodeURIComponent(text)}`;
}

function imoHref(phone: string) {
  return `imo://chat?phone=${digitsOnly(phone)}`;
}

function mailHref(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function IconImo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.3 1.9.4 3.1.4 5.52 0 10-4.1 10-9.2S17.52 2 12 2zm.1 14.1h-.2c-2.5 0-4.5-1.9-4.5-4.2 0-.3.3-.6.6-.6s.6.3.6.6c0 1.6 1.5 3 3.3 3h.2c.3 0 .6.3.6.6s-.3.6-.6.6zm3.6-2.3c-.1.2-.3.3-.5.3h-.1c-.2 0-.3-.1-.4-.2l-1.4-1.8c-.4.2-.9.4-1.4.4-1.9 0-3.4-1.4-3.4-3.2S9.9 6.1 11.8 6.1s3.4 1.4 3.4 3.2c0 .7-.2 1.3-.6 1.8l1 1.3c.2.2.1.5-.1.6z" />
    </svg>
  );
}

const btnBase =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors';

export function LoginSupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [intro, setIntro] = useState('Tehniki meseleler boýunça biziň bilen habarlaşyň.');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch('/api/public/support-contacts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.intro) setIntro(d.intro);
        setContacts(Array.isArray(d.contacts) ? d.contacts : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center px-3 pb-10 sm:pb-0 pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Tehniki goldaw"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl overflow-hidden max-h-[min(78dvh,560px)] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Tehniki goldaw</p>
            <p className="text-[11px] text-slate-500 truncate">{intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Ýap"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          {loading && <p className="text-center text-xs text-slate-500 py-8">Ýüklenýär…</p>}
          {!loading && contacts.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-8">
              Häzirçe kontakt goşulmadyk.
            </p>
          )}
          {contacts.map((c) => {
            const msg = `Salam, ${c.fullName}! BI Platform boýunça tehniki kömek gerek.`;
            const mailSub = 'BI Platform — tehniki goldaw';
            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5 shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 text-indigo-200 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{c.fullName}</p>
                    {c.role ? <p className="text-[11px] text-slate-400 truncate">{c.role}</p> : null}
                    {c.note ? <p className="text-[10px] text-slate-500 mt-0.5">{c.note}</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {c.phone ? (
                    <a
                      href={telHref(c.phone)}
                      className={cn(btnBase, 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25')}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Jan
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a
                      href={smsHref(c.phone, msg)}
                      className={cn(btnBase, 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25')}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      SMS
                    </a>
                  ) : null}
                  {c.telegram ? (
                    <a
                      href={tgHref(c.telegram, msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(btnBase, 'bg-[#229ED9]/20 text-[#5ac8fa] border-[#229ED9]/40 hover:bg-[#229ED9]/30')}
                    >
                      <IconTelegram className="h-3.5 w-3.5" />
                      Telegram
                    </a>
                  ) : null}
                  {c.whatsapp ? (
                    <a
                      href={waHref(c.whatsapp, msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(btnBase, 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/35 hover:bg-[#25D366]/25')}
                    >
                      <IconWhatsApp className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  ) : null}
                  {c.imo ? (
                    <a
                      href={imoHref(c.imo)}
                      className={cn(btnBase, 'bg-[#0D5EFF]/15 text-[#6B9EFF] border-[#0D5EFF]/35 hover:bg-[#0D5EFF]/25')}
                      title={c.imo}
                    >
                      <IconImo className="h-3.5 w-3.5" />
                      Imo
                    </a>
                  ) : null}
                  {c.gmail ? (
                    <a
                      href={mailHref(c.gmail, mailSub, msg)}
                      className={cn(btnBase, 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25')}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Gmail
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 text-xs font-medium text-white hover:bg-slate-700"
          >
            Ýap
          </button>
        </div>
      </div>
    </div>
  );
}
