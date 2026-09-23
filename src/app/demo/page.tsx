'use client';

import { useEffect, useMemo, useState } from 'react';
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
    <div className="min-h-dvh bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <ParticlesBackground theme="login" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-white/90 to-slate-100 dark:from-slate-950/40 dark:via-slate-950/70 dark:to-slate-950" />
      </div>
      <div className="relative z-10">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/login" className="bi-tap p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {pick(loc, content?.brandTitle, isRu ? 'BI Platform — Демо' : 'BI Platform — Demo')}
              </p>
              <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                {pick(loc, content?.brandSubtitle)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle />
            {/* mobile: icon only */}
            <span className="sm:hidden">
              <ThemeToggle compact />
            </span>
            <span className="hidden sm:inline-flex">
              <ThemeToggle />
            </span>
            <Link
              href="/login"
              className="bi-tap inline-flex h-9 items-center rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 text-sm font-medium text-white shadow-md shadow-indigo-600/30"
            >
              {isRu ? 'Войти' : 'Giriş'}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-10 space-y-8 sm:space-y-16">
        {/* Banner carousel */}
        {banners.length > 0 && (
          <ScrollReveal className="relative overflow-hidden rounded-3xl border border-slate-700/80 min-h-[160px] sm:min-h-[220px]">
            <section className="relative min-h-[160px] sm:min-h-[220px] h-full">
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
                  <h2 className="text-lg sm:text-2xl font-bold text-white">{pick(loc, b.title)}</h2>
                  {b.subtitle && <p className="text-sm text-slate-300 mt-1">{pick(loc, b.subtitle)}</p>}
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

        {/* Hero */}
        <ScrollReveal>
        <section className="bi-hero-glow relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 p-6 sm:p-10" style={{ backgroundImage: 'linear-gradient(120deg, rgba(49,46,129,0.8), rgba(15,23,42,0.95), rgba(30,27,75,0.8), rgba(15,23,42,0.95))' }}>
          <div className="relative max-w-2xl space-y-4">
            <span className="bi-float inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              {pick(loc, content?.heroBadge, isRu ? 'Интерактивное демо' : 'Interaktiw demo')}
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              {pick(loc, content?.heroTitle, isRu ? 'Аналитика и дашборды — для вашего бизнеса' : 'Analitika we dashboard — siziň biznesiňiz üçin')}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {pick(loc, content?.heroText)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href="#dashboard" className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-sm font-medium text-white shadow-lg shadow-indigo-600/30">
                <LayoutDashboard className="h-4 w-4" />
                {pick(loc, content?.heroCtaPrimary, isRu ? 'Смотреть дашборд' : 'Dashboard gör')}
              </a>
              <a href="#partners" className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 hover:bg-slate-800/60 px-4 text-sm font-medium text-slate-200">
                <Building2 className="h-4 w-4" />
                {pick(loc, content?.heroCtaSecondary, 'Hasabym Group')}
              </a>
            </div>
          </div>
        </section>
        </ScrollReveal>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <ScrollReveal>
          <section className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{pick(loc, content?.capabilitiesTitle)}</h2>
              <p className="text-sm text-slate-400 mt-1">{pick(loc, content?.capabilitiesSubtitle)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {capabilities.map((c, idx) => (
                <ScrollReveal key={c.id} delay={Math.min(5, (idx % 5) + 1) as 1 | 2 | 3 | 4 | 5}>
                <div className="bi-cap-card rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 hover:border-indigo-500/40 h-full">
                  <h3 className="text-sm font-semibold text-white">{pick(loc, c.title)}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">{pick(loc, c.text)}</p>
                </div>
                </ScrollReveal>
              ))}
            </div>
          </section>
          </ScrollReveal>
        )}

        {/* Live dashboard */}
        <ScrollReveal>
        <section id="dashboard" className="scroll-mt-20 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-indigo-400" />
              {pick(loc, content?.dashboardTitle, isRu ? 'Демо-дашборд' : 'Demo dashboard')}
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">{pick(loc, content?.dashboardSubtitle)}</p>
          </div>
          <DemoDashboard />
        </section>
        </ScrollReveal>

        {/* Partners slider — infinite loop, no gaps */}
        <ScrollReveal>
        <section id="partners" className="scroll-mt-20 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{pick(loc, content?.partnersTitle, isRu ? 'Компании, с которыми мы работаем' : 'Biziň bilen işleşýän firmalar')}</h2>
            <p className="text-sm text-slate-400 mt-1">{pick(loc, content?.partnersSubtitle)}</p>
          </div>
          {partners.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 py-4">
              {(() => {
                // Enough copies so track is always wider than viewport → no empty gap
                const copies = Math.max(4, Math.ceil(12 / Math.max(partners.length, 1)));
                const loop = Array.from({ length: copies }, () => partners).flat();
                const half = loop.slice(0, Math.ceil(loop.length / 2) * 2);
                return (
                  <div className="bi-marquee-track" style={{ animationDuration: `${Math.max(18, half.length * 2.2)}s` }}>
                    {/* two identical halves for seamless -50% loop */}
                    {[0, 1].map((halfIdx) => (
                      <div key={halfIdx} className="flex gap-6 shrink-0">
                        {partners.concat(partners).map((p, i) => (
                          <div
                            key={`${halfIdx}-${p.id}-${i}`}
                            className="bi-partner-card inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-700/80 bg-slate-950/60 min-w-[150px] sm:min-w-[160px] shrink-0"
                          >
                            {p.iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.iconUrl} alt="" className="h-10 w-10 rounded-lg object-contain bg-white/5" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-indigo-300" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-slate-200 whitespace-nowrap">
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
            <p className="text-sm text-slate-500">{isRu ? 'Партнёры пока не добавлены' : 'Hyzmatdaşlar heniz goşulmadyk'}</p>
          )}
        </section>
        </ScrollReveal>

        {/* Benefits */}
        {benefits.length > 0 && (
          <ScrollReveal>
          <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-4">{pick(loc, content?.benefitsTitle)}</h2>
            <ul className="space-y-2.5">
              {benefits.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{pick(loc, b)}</span>
                </li>
              ))}
            </ul>
          </section>
          </ScrollReveal>
        )}

        {/* About */}
        <ScrollReveal>
        <section className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 p-6 sm:p-10 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">{pick(loc, content?.aboutTitle, 'Hasabym Group')}</h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{pick(loc, content?.aboutText1)}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{pick(loc, content?.aboutText2)}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={`mailto:${content?.contactEmail || 'info@hasabym.group'}`} className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 text-sm font-medium text-white shadow-lg shadow-cyan-600/30">
              <Mail className="h-4 w-4" />
              {content?.contactEmail || 'info@hasabym.group'}
            </a>
            <a href={`tel:${content?.contactPhone || '+993'}`} className="bi-tap inline-flex h-10 items-center gap-2 rounded-xl border border-slate-600 hover:bg-slate-800/60 px-4 text-sm font-medium text-slate-200">
              <Phone className="h-4 w-4" />
              {content?.contactPhone || '+993'}
            </a>
          </div>
        </section>
        </ScrollReveal>

        <footer className="pb-10 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} {pick(loc, content?.footerNote, 'Hasabym Group · BI Platform')}
        </footer>
      </main>
      </div>
    </div>
  );
}
