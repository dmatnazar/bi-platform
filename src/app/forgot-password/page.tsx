'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Şowsuz');
        return;
      }
      setDone(data.message || 'E-poçta iberildi (eger hasap bar bolsa).');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Paroly ýatdan çykardyňyzmy?</h1>
          <p className="text-sm text-slate-400">
            Login ýa-da e-poçtaňyzy ýazyň. Gmail arkaly 15 minutlyk täzeleme baglanyşygy iberiler.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4"
        >
          {error && (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          {done && (
            <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 flex gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{done}</span>
            </div>
          )}
          <Input
            label="Login ýa-da e-poçta"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="username ýa-da name@gmail.com"
            autoComplete="username"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Baglanyşyk iber
          </Button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-indigo-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Login sahypasyna gaýt
          </Link>
        </form>
      </div>
    </div>
  );
}
