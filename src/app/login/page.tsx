'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Eye, EyeOff, AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react';
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
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Animated orbs + tsParticles network (reporting / analytics vibe) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-slate-950">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
        <ParticlesBackground theme="login" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(2_6_23)_85%)]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BI Platform</h1>
          <p className="text-slate-300 text-sm mt-1">Hasabat we analitika merkezi</p>
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
          className="bg-slate-900/85 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5 ring-1 ring-white/5"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Giriş</h2>
            <p className="text-sm text-slate-300 mt-0.5">Öz login we parolyňyz bilen giriň</p>
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
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Paroly ýatdan çykardyňyzmy?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            {loading ? 'Garaşyň...' : 'Girmek'}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Hasabyňyz ýokmy?{' '}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Hasaba al
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Demo: <span className="text-slate-400">admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
