'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart3, Clock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{
    username?: string;
    expiresAt?: string;
    expiresInSec?: number;
    error?: string;
  }>({});
  const [left, setLeft] = useState(0);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setMeta({ error: 'Token ýok' });
      setLoading(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setMeta({ error: d.error || 'Nädogry token' });
        } else {
          setMeta(d);
          setLeft(d.expiresInSec || 0);
        }
      })
      .catch((e) => setMeta({ error: String(e) }))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Parol azyndan 6 belgi bolmaly');
      return;
    }
    if (password !== password2) {
      setError('Parollar gabat gelenok');
      return;
    }
    if (left <= 0) {
      setError('Möhleti gutardy — täze isleg ugradyň');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Şowsuz');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-slate-400 text-sm">Barlanýar...</p>;
  }

  if (meta.error) {
    return (
      <div className="text-center space-y-4">
        <p className="text-rose-300 text-sm">{meta.error}</p>
        <Link href="/forgot-password" className="text-indigo-400 text-sm hover:underline">
          Täze baglanyşyk sora
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-emerald-300 text-sm">Parol täzelendi. Login sahypasyna geçirilýär...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
          left <= 60
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        }`}
      >
        <Clock className="h-4 w-4" />
        <span>
          Galýan wagt: <strong className="font-mono">{fmt(left)}</strong>
        </span>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Ulanyjy: <span className="text-slate-200 font-mono">{meta.username}</span>
      </p>
      {error && (
        <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <div className="relative">
        <Input
          label="Täze parol"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          className="absolute right-3 top-8 text-slate-500"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Input
        label="Paroly gaýtala"
        type={show ? 'text' : 'password'}
        value={password2}
        onChange={(e) => setPassword2(e.target.value)}
        autoComplete="new-password"
        required
      />
      <Button type="submit" className="w-full" loading={saving} disabled={left <= 0}>
        Paroly sakla
      </Button>
      <Link href="/login" className="block text-center text-xs text-slate-500 hover:text-indigo-300">
        Login
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-base sm:text-xl font-bold text-white truncate leading-tight">Täze parol</h1>
          <p className="text-sm text-slate-400">Möhlet gutarmazdan öň parolyňyzy üýtgediň</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <Suspense fallback={<p className="text-slate-400 text-sm text-center">...</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
