'use client';

import { useEffect, useState } from 'react';
import { Headphones, Phone, Mail, User, MessageSquare } from 'lucide-react';
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

const btn =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors';

export default function TechSupportPage() {
  const [intro, setIntro] = useState('Tehniki meseleler boýunça biziň bilen habarlaşyň.');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/support-contacts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.intro) setIntro(d.intro);
        setContacts(Array.isArray(d.contacts) ? d.contacts : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 px-1 sm:px-0">
      <div>
        <h1 className="text-base sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Headphones className="h-5 w-5 text-cyan-400 shrink-0" />
          Tehniki goldaw
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">{intro}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-10 text-center">Ýüklenýär…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-14 text-center text-sm text-slate-500">
          Kontakt goşulmadyk
        </div>
      ) : (
        <div className="grid gap-3">
          {contacts.map((c) => {
            const msg = `Salam, ${c.fullName}! BI Platform boýunça tehniki kömek gerek.`;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500/25 to-indigo-500/20 text-cyan-200 flex items-center justify-center border border-cyan-500/20 shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{c.fullName}</p>
                    {c.role && <p className="text-xs text-slate-400">{c.role}</p>}
                    {c.note && <p className="text-[11px] text-slate-500 mt-0.5">{c.note}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.phone && (
                    <a href={`tel:${digitsOnly(c.phone)}`} className={cn(btn, 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30')}>
                      <Phone className="h-3.5 w-3.5" /> Jan
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`sms:${digitsOnly(c.phone)}?body=${encodeURIComponent(msg)}`}
                      className={cn(btn, 'bg-teal-500/15 text-teal-300 border-teal-500/30')}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> SMS
                    </a>
                  )}
                  {c.telegram && (
                    <a
                      href={`https://t.me/${c.telegram.replace(/^@/, '')}?text=${encodeURIComponent(msg)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(btn, 'bg-[#229ED9]/20 text-[#5ac8fa] border-[#229ED9]/40')}
                    >
                      <IconTelegram className="h-3.5 w-3.5" /> Telegram
                    </a>
                  )}
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${digitsOnly(c.whatsapp).replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(btn, 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/35')}
                    >
                      <IconWhatsApp className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {c.gmail && (
                    <a
                      href={`mailto:${c.gmail}?subject=${encodeURIComponent('BI Platform — tehniki goldaw')}&body=${encodeURIComponent(msg)}`}
                      className={cn(btn, 'bg-rose-500/15 text-rose-300 border-rose-500/30')}
                    >
                      <Mail className="h-3.5 w-3.5" /> Gmail
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
