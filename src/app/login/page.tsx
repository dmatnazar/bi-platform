'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Eye, EyeOff, AlertTriangle, Bell, CheckCircle2, X, Download, Monitor, Smartphone, Apple, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { Input } from '@/components/ui/Input';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [winDocsOpen, setWinDocsOpen] = useState(false);
  const [release, setRelease] = useState<{
    version?: string;
    downloadUrl?: string;
    fileName?: string;
    releaseNotes?: string;
    releaseDate?: string;
    size?: number;
    error?: string;
  } | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);

  async function openWindowsDocs() {
    setWinDocsOpen(true);
    setReleaseLoading(true);
    setRelease(null);
    try {
      const res = await fetch('/api/client-release', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setRelease({ error: data.error || data.hint || 'Release maglumaty ýok' });
      } else {
        setRelease(data);
      }
    } catch (e) {
      setRelease({ error: String(e) });
    } finally {
      setReleaseLoading(false);
    }
  }

  function downloadWindows() {
    const url = release?.downloadUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = release?.fileName || 'BI-Platform-Client-Setup.exe';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Check notifications when username typed (debounce)
  useEffect(() => {
    if (username.length < 3) {
      setNotifs([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/notifications?username=${encodeURIComponent(username)}&unreadOnly=1`)
        .then((r) => r.json())
        .then((d) => setNotifs(d.notifications || []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  async function dismissNotifs() {
    if (!username) return;
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    setNotifs([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setWarning('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'registration_pending' || data.error?.includes?.('tassyklan')) {
          setWarning(
            data.error ||
              'Hasaba alyş heniz tassyklanmady. Kompaniýa administratory (Electron) tassyklamagyny garaşyň.'
          );
        } else if (data.code === 'registration_rejected') {
          setWarning(data.error || 'Hasaba alyş islegiňiz ret edildi.');
        } else {
          setError(data.error || 'Giriş şowsuz');
        }
        return;
      }
      router.push('/dashboards');
      router.refresh();
    } catch {
      setError('Baglanyşyk säwligi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-10 relative overflow-hidden">
      {/* Animated orbs + tsParticles network (reporting / analytics vibe) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-slate-950">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
        <ParticlesBackground theme="login" className="absolute inset-0 z-[1]" />
        {/* Stronger veil on mobile so text stays readable over particles */}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(2_6_23)_90%)] sm:bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(2_6_23)_85%)]" />
        <div className="absolute inset-0 z-[2] bg-slate-950/15 sm:bg-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in px-0.5 sm:px-0">
        <div className="flex flex-col items-center mb-5 sm:mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3 sm:mb-4">
            <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-md">
            BI Platform
          </h1>
          <p className="text-white/95 text-sm sm:text-base mt-1.5 px-2 leading-relaxed font-medium drop-shadow">
            Hasabat we analitika merkezi
          </p>
        </div>

        {/* Notifications for this username */}
        {notifs.length > 0 && (
          <div className="mb-4 space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border px-4 py-3 text-sm flex gap-3 ${
                  n.type === 'registration_approved'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                {n.type === 'registration_approved' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs opacity-90 mt-0.5">{n.message}</p>
                </div>
                <button type="button" onClick={dismissNotifs} className="opacity-60 hover:opacity-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="bg-slate-900/55 border border-slate-500/50 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-5 ring-1 ring-white/10"
        >
          <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Giriş</h2>
            <p className="text-sm sm:text-base text-white/90 mt-1 leading-relaxed">
              Öz login we parolyňyz bilen giriň
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {warning && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <Input
            label="Login"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ulanyjy_ady"
            required
          />

          <div className="relative">
            <Input
              label="Parol"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-[38px] text-slate-500 hover:text-slate-300"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex justify-end -mt-2">
            <Link
              href="/forgot-password"
              className="text-xs text-indigo-300 hover:text-indigo-300"
            >
              Paroly ýatdan çykardyňyzmy?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            {loading ? 'Garaşyň...' : 'Girmek'}
          </Button>

          <p className="text-center text-xs sm:text-sm text-slate-400 leading-relaxed">
            Hasabyňyz ýokmy?{' '}
            <Link href="/register" className="text-indigo-300 hover:text-indigo-300 font-medium">
              Hasaba al
            </Link>
          </p>
        </form>

        <p className="text-center text-[11px] sm:text-xs text-slate-500 mt-4 sm:mt-6 px-2">
          Demo: <span className="text-slate-300">admin / admin123</span>
        </p>

        {/* Programmalar — OS clients */}
        <div className="mt-6 sm:mt-8">
          <p className="text-center text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 mb-3">
            Programmalar
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => void openWindowsDocs()}
              className="flex flex-col items-center gap-1 min-w-[56px] sm:min-w-[64px] group"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:bg-sky-500/30 transition">
                <Monitor className="h-5 w-5 text-sky-200" strokeWidth={1.75} />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-200 text-center leading-tight">Windows</span>
            </button>
            <button
              type="button"
              onClick={() => alert('iOS wersiýasy taýýarlanýar')}
              className="flex flex-col items-center gap-1 min-w-[56px] sm:min-w-[64px] group opacity-80"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-slate-500/20 border border-white/15 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:bg-white/15 transition">
                <Apple className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-300 text-center leading-tight">iOS</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Android wersiýasy taýýarlanýar')}
              className="flex flex-col items-center gap-1 min-w-[56px] sm:min-w-[64px] group opacity-80"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:bg-emerald-500/25 transition">
                <Smartphone className="h-5 w-5 text-emerald-200" strokeWidth={1.75} />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-300 text-center leading-tight">Android</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Linux wersiýasy taýýarlanýar')}
              className="flex flex-col items-center gap-1 min-w-[56px] sm:min-w-[64px] group opacity-80"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:bg-amber-500/25 transition">
                <Terminal className="h-5 w-5 text-amber-200" strokeWidth={1.75} />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-300 text-center leading-tight">Linux</span>
            </button>
          </div>
        </div>

        {/* Windows documentation + download modal */}
        {winDocsOpen && (
          <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWinDocsOpen(false)} />
            <div className="relative w-full sm:max-w-lg max-h-[min(92dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-600/80 bg-slate-900/95 shadow-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-sky-300" />
                    Windows · BI Platform Client
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Electron admin programma — firma, API, işgär we sync
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWinDocsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-3.5 space-y-2 text-sm text-slate-300">
                <p className="font-medium text-white text-xs uppercase tracking-wide">Dokumentasiýa</p>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <li>Windows Server 2012 / 2019 / 2022 we Windows 10/11 goldawly</li>
                  <li>Gurnalan soň VPS Gateway URL we device tassyklamasy gerek</li>
                  <li>Awto-täzeleýiş: Sazlamalar → Update feed (`/updates`)</li>
                  <li>Administrator hukugy diňe gurnamak / täzeleýiş üçin gerek bolup biler</li>
                  <li>Köp ulanyjy: her Windows user öz sessiýasynda açyp biler</li>
                </ul>
              </div>

              {releaseLoading && (
                <p className="text-sm text-slate-400">Wersiýa ýüklenýär...</p>
              )}
              {release?.error && (
                <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {release.error}
                </p>
              )}
              {release && !release.error && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-1">
                  <p className="text-sm text-white">
                    Soňky wersiýa:{' '}
                    <span className="font-semibold text-indigo-200">v{release.version}</span>
                  </p>
                  {release.fileName && (
                    <p className="text-[11px] text-slate-400 font-mono break-all">{release.fileName}</p>
                  )}
                  {release.releaseDate && (
                    <p className="text-[11px] text-slate-500">{release.releaseDate}</p>
                  )}
                  {release.releaseNotes && (
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap mt-2 leading-relaxed">
                      {release.releaseNotes}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={!release?.downloadUrl || releaseLoading}
                  onClick={downloadWindows}
                >
                  <Download className="h-4 w-4" />
                  Download .exe
                </Button>
                <Button variant="ghost" onClick={() => setWinDocsOpen(false)}>
                  Ýap
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
