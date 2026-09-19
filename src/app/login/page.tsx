'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Eye, EyeOff, AlertTriangle, Bell, CheckCircle2, X, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { Input } from '@/components/ui/Input';
import { ToastHost } from '@/components/ui/Toast';
import { LoginAppsSection } from '@/components/apps/LoginAppsSection';
import { LoginSupportModal } from '@/components/support/LoginSupportModal';
import { requestFullscreenSafe, fullscreenPrefDisabled } from '@/lib/fullscreen';
import { InstallAppBanner } from '@/components/pwa/InstallAppBanner';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLocale } from '@/components/LocaleProvider';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
}

export default function LoginPage() {
  const { t } = useLocale();

  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [authAnim, setAuthAnim] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [sessionConflict, setSessionConflict] = useState<{
    sessions: { deviceName: string; ip: string; lastSeenAt: string }[];
    maxDevices: number;
    code: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem('bi-auth-animations');
        if (cached === '0') setAuthAnim(false);
        const res = await fetch('/api/settings/public', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && typeof data.authAnimations === 'boolean') {
          setAuthAnim(data.authAnimations);
          localStorage.setItem('bi-auth-animations', data.authAnimations ? '1' : '0');
        }
        if (!cancelled && typeof data.registrationEnabled === 'boolean') {
          setRegistrationEnabled(data.registrationEnabled);
        }
      } catch {
        /* keep default / cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function getDeviceId(): string {
    try {
      let id = localStorage.getItem('bi-device-id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('bi-device-id', id);
      }
      return id;
    } catch {
      return 'web-unknown';
    }
  }

  function deviceName(): string {
    try {
      const ua = navigator.userAgent || '';
      if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobil brauzer';
      return 'Web brauzer';
    } catch {
      return 'Web';
    }
  }

  async function doLogin(confirmReplace = false) {
    setError('');
    setWarning('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          deviceId: getDeviceId(),
          deviceName: deviceName(),
          confirmReplace,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'session_limit' || res.status === 409) {
          setSessionConflict({
            sessions: data.sessions || [],
            maxDevices: data.maxDevices || 1,
            code: data.code || 'session_limit',
          });
          setLoading(false);
          return;
        }
        if (data.code === 'session_limit_strict') {
          setError(
            data.error ||
              t('sessionDeviceLimit')
          );
          setLoading(false);
          return;
        }
        if (data.code === 'registration_pending' || data.error?.includes?.('tassyklan')) {
          setWarning(
            data.error ||
              t('regNotYetApproved')
          );
        } else if (data.code === 'registration_rejected') {
          setWarning(data.error || t('regRequestRejected'));
        } else {
          setError(data.error || t('loginFailed'));
        }
        setLoading(false);
        return;
      }
      setSessionConflict(null);
      // Habar sany — background (login-i saklama)
      void (async () => {
        try {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 1200);
          const nr = await fetch('/api/news', { cache: 'no-store', signal: ac.signal });
          clearTimeout(t);
          const nd = await nr.json().catch(() => ({}));
          const uc = Number(nd.unreadCount) || 0;
          if (uc > 0) sessionStorage.setItem('bi-unread-news', String(uc));
        } catch {
          /* */
        }
      })();
      // Hard navigate — router.push + refresh server layout/catalog garaşyp t('waitShort') saklaýardy
      try {
        window.location.assign('/dashboards');
      } catch {
        router.push('/dashboards');
        setLoading(false);
      }
      // 8s-den soň heniz şu sahypada bolsa loading öçür
      window.setTimeout(() => setLoading(false), 8000);
    } catch {
      setError(t('connectionFailed'));
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Only auto-fullscreen when Settings → "Awto doly ekran" is enabled.
    try {
      const auto = localStorage.getItem('bi-fullscreen-auto') === '1';
      if (auto && !fullscreenPrefDisabled()) requestFullscreenSafe();
    } catch {
      /* ignore */
    }
    setSessionConflict(null);
    await doLogin(false);
  }


  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-10 relative overflow-hidden">
      {/* Fixed viewport background — does not grow with page scroll / canvas size */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        style={{ background: isLight ? '#f1f5f9' : '#020617' }}
        aria-hidden
      >
        {authAnim && (
          <>
            <div className="login-orb login-orb-a" />
            <div className="login-orb login-orb-b" />
            <div className="login-orb login-orb-c" />
            <ParticlesBackground theme="login" className="absolute inset-0 z-[1] h-full w-full overflow-hidden" />
          </>
        )}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at center, transparent 35%, rgb(241 245 249) 92%)'
              : 'radial-gradient(ellipse at center, transparent 35%, rgb(2 6 23) 90%)',
          }}
        />
      </div>

      {/* Theme toggle — login */}
      <div className="fixed top-3 right-3 z-20 flex items-center gap-2">
        <ThemeToggle compact />
        <LanguageToggle compact />
      </div>

      <div
        className={`relative z-10 w-full max-w-md px-0.5 sm:px-0 ${authAnim ? 'animate-fade-in' : ''}`}
      >
        <div className="flex flex-col items-center mb-5 sm:mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3 sm:mb-4">
            <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-md">
            BI Platform
          </h1>
          <p className="text-white/95 text-sm sm:text-base mt-1.5 px-2 leading-relaxed font-medium drop-shadow">
            {t('analyticsCenter')}
          </p>
        </div>

        {/* Notifications for this username */}
        <InstallAppBanner className="mb-4 sm:mb-5" />

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

        
        {sessionConflict && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-white">Başga enjamda seans açyk</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Bu hasap eýýäm giren. Max enjam: <b>{sessionConflict.maxDevices}</b>.
                Dowam etseňiz beýleki seans(lar) ýapylar.
              </p>
              <ul className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                {(sessionConflict.sessions || []).map((s, i) => (
                  <li key={i}>
                    · {s.deviceName || t('deviceOne')} — {s.ip || t('noIp')} —{' '}
                    {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : ''}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSessionConflict(null)}
                >{t('cancel')}</Button>
                <Button
                  type="button"
                  size="sm"
                  loading={loading}
                  onClick={() => void doLogin(true)}
                >
                  Dowam et we beýlekini ýap
                </Button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="bg-slate-900/55 border border-slate-500/50 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-5 ring-1 ring-white/10"
        >
          <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('loginTitle')}</h2>
            <p className="text-sm sm:text-base text-white/90 mt-1 leading-relaxed">
              {t('loginWithCredentials')}
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
            label={t('loginLabel')}
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('username')}
            required
          />

          <div className="relative">
            <Input
              label={t('password')}
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
              {t('forgotPasswordQ')}
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            {loading ? t('wait') : t('signInAlt')}
          </Button>

          {registrationEnabled && (
            <p className="text-center text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-indigo-300 hover:text-indigo-300 font-medium">
                {t('registerLink')}
              </Link>
            </p>
          )}

          <p className="text-center text-xs sm:text-sm text-slate-500">
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="inline-flex items-center gap-1.5 text-cyan-300/90 hover:text-cyan-200 font-medium underline-offset-2 hover:underline"
            >
              <Headphones className="h-3.5 w-3.5" />
              {t('techSupport')}
            </button>
          </p>
        </form>

        {/* Programmalar — docs + download from Admin → Programmalar (apps.json) */}
        <LoginAppsSection />
        <LoginSupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
        <ToastHost />
      </div>
    </div>
  );
}
