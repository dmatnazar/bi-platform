'use client';

import { useEffect, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Apple,
  Terminal,
  Download,
  X,
  ExternalLink,
  Clock,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { toastWarning } from '@/components/ui/Toast';

type PlatformSummary = {
  id: string;
  name: string;
  status: 'available' | 'coming_soon';
  hasFeed?: boolean;
  docsCount?: number;
};

type AppDoc = {
  id: string;
  title: string;
  body: string;
  order: number;
};

const ICONS: Record<string, typeof Monitor> = {
  windows: Monitor,
  ios: Apple,
  android: Smartphone,
  linux: Terminal,
};

export function LoginAppsSection() {
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [docs, setDocs] = useState<AppDoc[]>([]);
  const [platformName, setPlatformName] = useState('');
  const [hasDownload, setHasDownload] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch('/api/apps')
      .then((r) => r.json())
      .then((d) => setPlatforms(d.platforms || []))
      .catch(() => {});
  }, []);

  async function openPlatform(id: string, name: string, status: string) {
    if (status !== 'available') {
      toastWarning(name, `${name} wersiýasy taýýarlanýar · ýakyn wagtda elýeterli bolar`);
      return;
    }
    setOpenId(id);
    setPlatformName(name);
    setLoadingDocs(true);
    setDocs([]);
    try {
      const res = await fetch(`/api/apps/${id}`);
      const data = await res.json();
      setDocs(data.platform?.docs || []);
      setHasDownload(Boolean(data.platform?.hasDownload));
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }

  const sorted = platforms.slice().sort((a, b) => {
    const order = ['windows', 'ios', 'android', 'linux'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  return (
    <>
      <div className="mt-6 sm:mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
            Programmalar
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {sorted.map((p) => {
            const Icon = ICONS[p.id] || Monitor;
            const available = p.status === 'available';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPlatform(p.id, p.name, p.status)}
                className={cn(
                  'group relative flex flex-col items-center gap-1.5 w-[72px] sm:w-[84px] p-2.5 rounded-2xl border transition-all',
                  available
                    ? 'border-slate-600/80 bg-slate-900/70 hover:border-indigo-500/50 hover:bg-indigo-500/10 cursor-pointer shadow-lg shadow-black/20'
                    : 'border-slate-800/60 bg-slate-900/40 opacity-70 cursor-pointer hover:opacity-90'
                )}
                title={available ? `${p.name} — gurnama` : `${p.name} — ýakyn wagtda`}
              >
                <div
                  className={cn(
                    'h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center',
                    available
                      ? 'bg-gradient-to-br from-sky-500/20 to-indigo-600/30 text-sky-300 group-hover:from-sky-500/30 group-hover:to-indigo-500/40'
                      : 'bg-slate-800/80 text-slate-500'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'text-[11px] font-medium leading-tight',
                    available ? 'text-slate-200' : 'text-slate-500'
                  )}
                >
                  {p.name}
                </span>
                {!available && (
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 leading-none">
                    soň
                  </span>
                )}
                {available && (
                  <span className="text-[9px] text-indigo-400/90 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ýükle
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-center text-[10px] sm:text-[11px] text-slate-600 mt-3 px-4 leading-relaxed">
          Windows elýeterli. iOS, Android we Linux ýakyn wagtda işlenilýär.
        </p>
      </div>

      {mounted &&
        openId &&
        createPortal(
          <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpenId(null)}
            />
            <div className="relative w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[min(88dvh,720px)] rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-800 shrink-0 bg-gradient-to-r from-slate-900 to-slate-950">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/25 to-indigo-600/35 flex items-center justify-center text-sky-300">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                    {platformName} programmasyny ýükle
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Gurnama gollanmasy we soňky wersiýa
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {loadingDocs ? (
                  <p className="text-sm text-slate-500 text-center py-8">Ýüklenýär...</p>
                ) : docs.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <BookOpen className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="text-sm text-slate-400">Dokumentasiýa heniz goşulmady</p>
                  </div>
                ) : (
                  docs.map((d) => (
                    <section
                      key={d.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4"
                    >
                      <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 mb-2">
                        <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                        {d.title}
                      </h4>
                      <div className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {d.body}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-slate-800 p-3 sm:p-4 bg-slate-900/90 space-y-2">
                {hasDownload ? (
                  <a
                    href={`/api/apps/${openId}/download`}
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm py-3 shadow-lg shadow-indigo-900/40 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {platformName} programmasyny ýükle
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs px-3 py-2.5 text-center">
                    Ýükleme baglanyşygy heniz sazlanmady. Admin → Programmalar bölümünde
                    latest.yml URL goýuň.
                  </div>
                )}
                <p className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Soňky wersiýa latest.yml-dan awtomatiki alynýar
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
