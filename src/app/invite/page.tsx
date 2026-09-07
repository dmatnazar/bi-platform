'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart3, Clock, Eye, EyeOff, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type MemberForm = {
  fullName: string;
  username: string;
  password: string;
  password2: string;
  phone: string;
  email: string;
};

const emptyMember = (): MemberForm => ({
  fullName: '',
  username: '',
  password: '',
  password2: '',
  phone: '',
  email: '',
});

function InviteForm() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{
    role?: string;
    tenantSlugs?: string[];
    remainingSeats?: number;
    seats?: number;
    expiresInSec?: number;
    error?: string;
  }>({});
  const [left, setLeft] = useState(0);
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState<MemberForm[]>([emptyMember()]);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setMeta({ error: 'Token ýok' });
      setLoading(false);
      return;
    }
    fetch(`/api/staff/invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setMeta({ error: d.error || 'Nädogry invite' });
        } else {
          setMeta(d);
          setLeft(d.expiresInSec || 0);
          const n = Math.max(1, Number(d.remainingSeats || d.seats || 1));
          setMembers(Array.from({ length: n }, () => emptyMember()));
          setStep(0);
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

  const total = members.length;
  const current = members[step] || emptyMember();

  function patchCurrent(patch: Partial<MemberForm>) {
    setMembers((prev) => prev.map((m, i) => (i === step ? { ...m, ...patch } : m)));
  }

  function validateStep(): string | null {
    const m = members[step];
    if (!m.fullName.trim() || m.fullName.trim().length < 2) return 'Ady azyndan 2 belgi';
    if (!m.username.trim() || m.username.trim().length < 3) return 'Login azyndan 3 belgi';
    if (!/^[A-Za-z0-9._-]+$/.test(m.username.trim())) return 'Login: diňe latyn, san, . _ -';
    if (m.password.length < 6) return 'Parol azyndan 6 belgi';
    if (m.password !== m.password2) return 'Parollar gabat gelenok';
    // unique username among steps
    const u = m.username.trim().toLowerCase();
    for (let i = 0; i < members.length; i++) {
      if (i !== step && members[i].username.trim().toLowerCase() === u) {
        return `Login gaýtalanýar (işgär ${i + 1})`;
      }
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    if (step < total - 1) setStep((s) => s + 1);
  }

  function prev() {
    setError('');
    if (step > 0) setStep((s) => s - 1);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    // validate all
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.fullName.trim() || m.username.trim().length < 3 || m.password.length < 6) {
        setError(`Işgär ${i + 1}: ähli meýdanlary dolduryň`);
        setStep(i);
        return;
      }
      if (m.password !== m.password2) {
        setError(`Işgär ${i + 1}: parollar gabat gelenok`);
        setStep(i);
        return;
      }
    }
    if (left <= 0) {
      setError('Möhleti gutardy — täze invite soraň');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/staff/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          members: members.map((m) => {
            const digits = m.phone.replace(/\D/g, '').slice(0, 8);
            return {
              fullName: m.fullName.trim(),
              username: m.username.trim(),
              password: m.password,
              phone: digits ? `+993${digits}` : undefined,
              email: m.email.trim() || undefined,
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Şowsuz');
        return;
      }
      setCreatedCount(data.count || members.length);
      setDone(true);
      setTimeout(() => router.push('/login'), 3500);
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
        <Link href="/login" className="text-indigo-400 text-sm hover:underline">
          Login
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-emerald-300 text-sm">
          {createdCount} işgär goşuldy. Login sahypasyna geçirilýär...
        </p>
      </div>
    );
  }

  const roleLabel = meta.role || '—';
  const firms = (meta.tenantSlugs || []).join(', ') || '—';

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div
        className={`sticky top-0 z-10 flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3 text-sm shadow-lg ${
          left <= 0
            ? 'border-rose-500/50 bg-rose-500/15 text-rose-200'
            : left <= 60
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 shrink-0" />
          <span className="text-xs uppercase tracking-wide opacity-80">Galýan wagt</span>
        </div>
        <strong className="font-mono text-2xl tabular-nums leading-tight">
          {fmt(left)}
        </strong>
        {left <= 0 && (
          <span className="text-xs text-rose-300">Möhlet gutardy — täze invite gerek</span>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-1.5 text-xs">
        <p className="text-slate-400">
          Rol:{' '}
          <span className="text-white font-medium">{roleLabel}</span>
          <span className="text-slate-600"> · üýtgedip bolanok</span>
        </p>
        <p className="text-slate-400">
          Firma:{' '}
          <span className="text-white font-medium break-all">{firms}</span>
        </p>
        <p className="text-slate-400">
          Işgär: <span className="text-indigo-300 font-medium">{step + 1}</span>
          <span className="text-slate-500"> / {total}</span>
        </p>
      </div>

      {/* progress dots */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {members.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-indigo-400' : 'w-2 bg-slate-600'
              }`}
              aria-label={`Işgär ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <Input
          label="Doly ady"
          value={current.fullName}
          onChange={(e) => patchCurrent({ fullName: e.target.value })}
          placeholder="Ady Familiýasy"
          required
        />
        <Input
          label="Login"
          value={current.username}
          onChange={(e) => patchCurrent({ username: e.target.value })}
          placeholder="username"
          autoComplete="off"
          required
        />
        <div className="relative">
          <Input
            label="Parol"
            type={showPw ? 'text' : 'password'}
            value={current.password}
            onChange={(e) => patchCurrent({ password: e.target.value })}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="absolute right-2 top-8 p-1.5 text-slate-400 hover:text-white"
            onClick={() => setShowPw((v) => !v)}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          label="Paroly gaýtala"
          type={showPw ? 'text' : 'password'}
          value={current.password2}
          onChange={(e) => patchCurrent({ password2: e.target.value })}
          autoComplete="new-password"
          required
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Telefon (islege görä)</label>
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            <span className="flex items-center px-3 bg-slate-950 text-slate-400 text-sm border-r border-slate-700 select-none">
              +993
            </span>
            <input
              className="flex-1 h-11 bg-slate-900/80 px-3 text-sm text-white outline-none placeholder:text-slate-500"
              value={current.phone}
              onChange={(e) =>
                patchCurrent({ phone: e.target.value.replace(/\D/g, '').slice(0, 8) })
              }
              placeholder="6X XXXXXX"
              inputMode="numeric"
              autoComplete="tel-national"
            />
          </div>
        </div>
        <Input
          label="Email (islege görä)"
          type="email"
          value={current.email}
          onChange={(e) => patchCurrent({ email: e.target.value })}
        />
      </div>

      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" className="flex-1" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
            Yza
          </Button>
        )}
        {step < total - 1 ? (
          <Button type="button" className="flex-1" onClick={next}>
            Indiki
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" className="flex-1" loading={saving} disabled={left <= 0}>
            Ýatda sakla ({total})
          </Button>
        )}
      </div>
    </form>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 mx-auto">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Täze işgär</h1>
          <p className="text-sm text-slate-400">Invite arkaly hasaba alyş</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <Suspense fallback={<p className="text-center text-slate-400 text-sm">...</p>}>
            <InviteForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
