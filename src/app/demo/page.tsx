'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  Mail,
  Phone,
  Sparkles,
} from 'lucide-react';
import { DemoDashboard } from '@/components/demo/DemoDashboard';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLocale } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { cn } from '@/lib/utils';
import type { DemoPageContent } from '@/lib/demo-page-store';

function pick(loc: 'tm' | 'ru', t?: { tm: string; ru: string }, fallback = '') {
  if (!t) return fallback;
  return loc === 'ru' ? t.ru || t.tm : t.tm || t.ru;
}

export default function DemoPage() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isRu = locale === 'ru';
  const loc = isRu ? 'ru' : 'tm';
  const [content, setContent] = useState<DemoPageContent | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    fetch('/api/public/demo-page')
      .then((r) => r.json())
      .then((d) => setContent(d))
      .catch(() => setContent(null));
  }, []);

  const banners = content?.banners || [];
  const partners = content?.partners || [];
  const interval = content?.bannerIntervalMs || 5000;

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), interval);
    return () => clearInterval(t);
  }, [banners.length, interval]);

  const capabilities = content?.capabilities || [];
  const benefits = content?.benefits || [];

  return (
    <div className="min-h-dvh relative overflow-x-hidden" style={{ color: isLight ? '#0f172a' : '#f1f5f9' }}>
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        style={{ background: isLight ? '#f1f5f9' : '#020617' }}
        aria-hidden
      >
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
        <ParticlesBackground theme="login" className="absolute inset-0 z-[1] h-full w-full overflow-hidden" />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at center, transparent 35%, rgb(241 245 249) 92%)'
              : 'radial-gradient(ellipse at center, transparent 35%, rgb(2 6 23) 90%)',
          }}
        />
      </div>

      <div className="relative z-10">
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: isLight ? '#ffffff' : 'rgba(2, 6, 23, 0.92)',
          borderColor: isLight ? '#e2e8f0' : 'rgba(30, 41, 59, 0.8)',
        }}
      >
        <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/login"
              className="bi-tap p-2 rounded-xl shrink-0"
              style={{ color: isLight ? '#475569' : '#94a3b8' }}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4" style={{ color: '#ffffff' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                {pick(loc, content?.brandTitle, isRu ? 'BI Platform — Демо' : 'BI Platform — Demo')}
              </p>
              <p className="text-[10px] truncate hidden sm:block" style={{ color: '#64748b' }}>
                {pick(loc, content?.brandSubtitle)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle />
            <span className="sm:hidden"><ThemeToggle compact /></span>
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            <Link
              href="/login"
              className="bi-tap inline-flex h-9 items-center rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 text-sm font-medium shadow-md shadow-indigo-600/30"
              style={{ color: '#ffffff' }}
            >
              {isRu ? 'Войти' : 'Giriş'}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-10">
        {banners.length > 0 && (
          <ScrollReveal
            className="relative overflow-hidden rounded-3xl border min-h-[220px] sm:min-h-[300px]"
            style={{ borderColor: isLight ? '#cbd5e1' : 'rgba(51, 65, 85, 0.8)' }}
          >
            <section className="relative min-h-[220px] sm:min-h-[300px] h-full">
            {banners.map((b, i) => (
              <div
                key={b.id}
                className={cn(
                  'absolute inset-0 flex items-end',
                  i === bannerIdx ? 'bi-banner-active z-10' : 'bi-banner-inactive z-0 pointer-events-none'
                )}
                style={
                  b.imageUrl
                    ? { backgroundImage: `url(${b.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: 'linear-gradient(135deg,#312e81,#0f172a)' }
                }
              >
                <div className="w-full bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-5 sm:p-8">
                  <h2 className="text-lg sm:text-2xl font-bold bi-force-white">{pick(loc, b.title)}</h2>
                  {b.subtitle && <p className="text-sm mt-1 bi-force-white-muted">{pick(loc, b.subtitle)}</p>}
                </div>
              </div>
            ))}
            {banners.length > 1 && (
              <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBannerIdx(i)}
                    className={cn('bi-tap h-1.5 rounded-full transition-all', i === bannerIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40')}
                  />
                ))}
              </div>
            )}
            </section>
          </ScrollReveal>
        )}

        <ScrollReveal>
        <section
          className={cn('relative overflow-hidden rounded-3xl border p-6 sm:p-10', !isLight && 'bi-hero-glow')}
          style={
            isLight
              ? { backgroundColor: '#ffffff', borderColor: '#c7d2fe', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)' }
              : {
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  backgroundImage:
                    'linear-gradient(120deg, rgba(49,46,129,0.8), rgba(15,23,42,0.95), rgba(30,27,75,0.8), rgba(15,23,42,0.95))',
                }
          }
        >
          <div className="relative max-w-2xl space-y-4">
            <span
              className="bi-float inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium"
              style={
                isLight
                  ? { borderColor: '#c7d2fe', backgroundColor: '#eef2ff', color: '#4338ca' }
                  : { borderColor: 'rgba(129, 140, 248, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#c7d2fe' }
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              {pick(loc, content?.heroBadge, isRu ? 'Интерактивное демо' : 'Interaktiw demo')}
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {pick(loc, content?.heroTitle, isRu ? 'Аналитика и дашборды — для вашего бизнеса' : 'Analitika we dashboard — siziň biznesiňiz üçin')}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>
              {pick(loc, content?.heroText)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href="#dashboard" className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-sm font-medium shadow-lg shadow-indigo-600/30" style={{ color: '#ffffff' }}>
                <LayoutDashboard className="h-4 w-4" />
                {pick(loc, content?.heroCtaPrimary, isRu ? 'Смотреть дашборд' : 'Dashboard gör')}
              </a>
              <a
                href="#partners"
                className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium"
                style={
                  isLight
                    ? { borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b' }
                    : { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }
                }
              >
                <Building2 className="h-4 w-4" />
                {pick(loc, content?.heroCtaSecondary, 'Hasabym Group')}
              </a>
            </div>
          </div>
        </section>
        </ScrollReveal>

        {capabilities.length > 0 && (
          <ScrollReveal>
          <section className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                {pick(loc, content?.capabilitiesTitle)}
              </h2>
              <p className="text-sm mt-1" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
                {pick(loc, content?.capabilitiesSubtitle)}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {capabilities.map((c, idx) => (
                <ScrollReveal key={c.id} delay={Math.min(5, (idx % 5) + 1) as 1 | 2 | 3 | 4 | 5}>
                <div
                  className="bi-cap-card rounded-2xl border p-4 sm:p-5 h-full"
                  style={
                    isLight
                      ? { backgroundColor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' }
                      : { backgroundColor: 'rgba(15, 23, 42, 0.5)', borderColor: '#1e293b' }
                  }
                >
                  <h3 className="text-sm font-semibold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                    {pick(loc, c.title)}
                  </h3>
                  <p className="text-xs sm:text-sm mt-1.5 leading-relaxed" style={{ color: isLight ? '#334155' : '#94a3b8' }}>
                    {pick(loc, c.text)}
                  </p>
                </div>
                </ScrollReveal>
              ))}
            </div>
          </section>
          </ScrollReveal>
        )}

        <ScrollReveal>
        <section id="dashboard" className="scroll-mt-20 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              <LayoutDashboard className="h-6 w-6" style={{ color: isLight ? '#4f46e5' : '#818cf8' }} />
              {pick(loc, content?.dashboardTitle, isRu ? 'Демо-дашборд' : 'Demo dashboard')}
            </h2>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
              {pick(loc, content?.dashboardSubtitle)}
            </p>
          </div>
          <DemoDashboard />
        </section>
        </ScrollReveal>

        <ScrollReveal>
        <section id="partners" className="scroll-mt-20 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {pick(loc, content?.partnersTitle, isRu ? 'Компании, с которыми мы работаем' : 'Biziň bilen işleşýän firmalar')}
            </h2>
            <p className="text-sm mt-1" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
              {pick(loc, content?.partnersSubtitle)}
            </p>
          </div>
          {partners.length > 0 ? (
            <div
              className="overflow-hidden rounded-2xl border py-4"
              style={
                isLight
                  ? { backgroundColor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' }
                  : { backgroundColor: 'rgba(15, 23, 42, 0.4)', borderColor: '#1e293b' }
              }
            >
              {(() => {
                const copies = Math.max(4, Math.ceil(12 / Math.max(partners.length, 1)));
                const loop = Array.from({ length: copies }, () => partners).flat();
                const half = loop.slice(0, Math.ceil(loop.length / 2) * 2);
                return (
                  <div className="bi-marquee-track" style={{ animationDuration: `${Math.max(18, half.length * 2.2)}s` }}>
                    {[0, 1].map((halfIdx) => (
                      <div key={halfIdx} className="flex gap-6 shrink-0">
                        {partners.concat(partners).map((p, i) => (
                          <div
                            key={`${halfIdx}-${p.id}-${i}`}
                            className="bi-partner-card inline-flex items-center gap-3 px-4 py-2 rounded-xl border min-w-[150px] sm:min-w-[160px] shrink-0"
                            style={
                              isLight
                                ? { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
                                : { backgroundColor: 'rgba(2, 6, 23, 0.6)', borderColor: 'rgba(51, 65, 85, 0.8)' }
                            }
                          >
                            {p.iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.iconUrl} alt="" className="h-10 w-10 rounded-lg object-contain bg-white/5" />
                            ) : (
                              <div
                                className="h-10 w-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: isLight ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.2)' }}
                              >
                                <Building2 className="h-5 w-5" style={{ color: isLight ? '#4f46e5' : '#a5b4fc' }} />
                              </div>
                            )}
                            <span className="text-sm font-medium whitespace-nowrap" style={{ color: isLight ? '#1e293b' : '#e2e8f0' }}>
                              {isRu && p.nameRu ? p.nameRu : p.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#64748b' }}>
              {isRu ? 'Партнёры пока не добавлены' : 'Hyzmatdaşlar heniz goşulmadyk'}
            </p>
          )}
        </section>
        </ScrollReveal>

        {benefits.length > 0 && (
          <ScrollReveal>
          <section
            className="rounded-3xl border p-6 sm:p-8"
            style={
              isLight
                ? { backgroundColor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' }
                : { backgroundColor: 'rgba(15, 23, 42, 0.4)', borderColor: '#1e293b' }
            }
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {pick(loc, content?.benefitsTitle)}
            </h2>
            <ul className="space-y-2.5">
              {benefits.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: isLight ? '#1e293b' : '#cbd5e1' }}>
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: isLight ? '#059669' : '#34d399' }} />
                  <span className="leading-relaxed">{pick(loc, b)}</span>
                </li>
              ))}
            </ul>
          </section>
          </ScrollReveal>
        )}

        <ScrollReveal>
        <section
          className="rounded-3xl border p-6 sm:p-10 space-y-4"
          style={
            isLight
              ? { backgroundColor: '#ffffff', borderColor: 'rgba(6, 182, 212, 0.35)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)' }
              : {
                  borderColor: 'rgba(6, 182, 212, 0.25)',
                  backgroundImage: 'linear-gradient(to bottom right, rgba(8, 51, 68, 0.4), #0f172a, #020617)',
                }
          }
        >
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
            {pick(loc, content?.aboutTitle, 'Hasabym Group')}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: isLight ? '#1e293b' : '#cbd5e1' }}>
            {pick(loc, content?.aboutText1)}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
            {pick(loc, content?.aboutText2)}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={`mailto:${content?.contactEmail || 'info@hasabym.group'}`}
              className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 text-sm font-medium shadow-lg shadow-cyan-600/30"
              style={{ color: '#ffffff' }}
            >
              <Mail className="h-4 w-4" />
              {content?.contactEmail || 'info@hasabym.group'}
            </a>
            <a
              href={`tel:${content?.contactPhone || '+993'}`}
              className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium"
              style={
                isLight
                  ? { borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b' }
                  : { borderColor: '#475569', color: '#e2e8f0' }
              }
            >
              <Phone className="h-4 w-4" />
              {content?.contactPhone || '+993'}
            </a>
          </div>
        </section>
        </ScrollReveal>

        <footer className="pb-4 pt-2 text-center text-[11px]" style={{ color: isLight ? '#64748b' : '#475569' }}>
          © {new Date().getFullYear()} {pick(loc, content?.footerNote, 'Hasabym Group · BI Platform')}
        </footer>
      </main>
      </div>
    </div>
  );
}
