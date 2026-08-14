'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Eye, EyeOff, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface CompanyOpt {
  id: string;
  name: string;
  slug: string;
}

type SubmitPhase =
  | 'idle'
  | 'sending'
  | 'on_vps'
  | 'delivered'
  | 'approved'
  | 'rejected'
  | 'error';

export default function RegisterPage() {
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [tenantSlug, setTenantSlug] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [regId, setRegId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {});
  }, []);

  // Poll registration status after submit
  useEffect(() => {
    if (!regId || phase === 'approved' || phase === 'rejected' || phase === 'error') return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/auth/registration-status?id=${regId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'approved') {
          setPhase('approved');
          setStatusMsg('Hasaba alyş tassyklanyldy! Indi giriş edip bilersiňiz.');
        } else if (data.status === 'rejected') {
          setPhase('rejected');
          setStatusMsg(
            'Hasaba alyş ret edildi.' + (data.note ? ` Sebäp: ${data.note}` : '')
          );
        } else if (data.deliveredAt) {
          setPhase('delivered');
          setStatusMsg(
            'Üstünlikli ugradyldy — kompaniýa administratory (Electron) islegiňizi gördi we tassyklamagyny garaşýar.'
          );
        } else {
          setPhase('on_vps');
          setStatusMsg(
            'Isleg serwere (VPS) ýetdi. Kompaniýa Electron programmasyna ýetmezden garaşylýar — administrator internete birigensoň peýda bolar.'
          );
        }
      } catch {
        /* keep last phase */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [regId, phase]);

  function normalizePhoneLocal(raw: string) {
    // only digits, max 8 for TM mobile after +993
    return raw.replace(/\D/g, '').slice(0, 8);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (phoneLocal.length < 8) {
      setError('Telefon belgisi doly däl (+993 bilen 8 san)');
      return;
    }
    setPhase('sending');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          firstName,
          lastName,
          phone: `+993${phoneLocal}`,
          email,
          username,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase('error');
        setError(data.error || 'Hasaba alyş şowsuz');
        return;
      }
      setRegId(data.registrationId);
      setPhase('on_vps');
      setStatusMsg(
        'Isleg serwere iberildi. Electron-a ýetişi barlanýar...'
      );
    } catch {
      setPhase('error');
      setError('Baglanyşyk säwligi — serwere ýetmedi. Internetiňizi barlaň.');
    }
  }

  if (phase === 'approved' || phase === 'rejected' || phase === 'delivered' || phase === 'on_vps') {
    const ok = phase === 'approved' || phase === 'delivered';
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4 animate-fade-in">
          <div
            className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
              phase === 'approved'
                ? 'bg-emerald-500/15'
                : phase === 'rejected'
                  ? 'bg-rose-500/15'
                  : phase === 'delivered'
                    ? 'bg-emerald-500/15'
                    : 'bg-amber-500/15'
            }`}
          >
            {phase === 'approved' || phase === 'delivered' ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : phase === 'rejected' ? (
              <AlertTriangle className="h-8 w-8 text-rose-400" />
            ) : (
              <Clock className="h-8 w-8 text-amber-400" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-white">
            {phase === 'approved'
              ? 'Tassyklanyldy'
              : phase === 'rejected'
                ? 'Ret edildi'
                : phase === 'delivered'
                  ? 'Üstünlikli ugradyldy'
                  : 'Serwerde garaşylýar'}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">{statusMsg}</p>
          {phase === 'on_vps' && (
            <p className="text-xs text-amber-400/90 flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Electron internete birigensoň status üýtgeýär...
            </p>
          )}
          {(phase === 'approved' || phase === 'rejected') && (
            <Link href="/login">
              <Button variant="secondary" className="mt-2">
                Giriş sahypasyna
              </Button>
            </Link>
          )}
          {phase === 'delivered' && (
            <p className="text-xs text-slate-500">
              Tassyklanandan soň bu sahypa awtomatik täzelener ýa-da giriş edip bilersiňiz.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-3">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Hasaba alyş</h1>
          <p className="text-slate-400 text-sm mt-1">Kompaniýaňyzy saýlaň we maglumatlary dolduryň</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <Select
            label="Kompaniýa"
            name="tenantSlug"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="Kompaniýa saýlaň"
            required
            options={companies.map((c) => ({ value: c.slug, label: c.name }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ady"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Familiýasy"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          {/* Phone with static +993 */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Telefon</label>
            <div className="flex h-11 rounded-xl overflow-hidden border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 bg-slate-900/80">
              <span className="flex items-center px-3 bg-slate-800/80 text-slate-300 text-sm font-medium border-r border-slate-700 select-none">
                +993
              </span>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(normalizePhoneLocal(e.target.value))}
                placeholder="6X XXXXXX"
                required
                className="flex-1 bg-transparent px-3 text-slate-100 placeholder:text-slate-500 outline-none text-sm"
              />
            </div>
          </div>

          <Input
            label="Email (Gmail)"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ulanyjy@gmail.com"
            required
          />

          <Input
            label="Login"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />

          <div className="relative">
            <Input
              label="Parol"
              name="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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

          <Button type="submit" className="w-full" loading={phase === 'sending'} size="lg">
            {phase === 'sending' ? 'Iberilýär...' : 'Hasaba al'}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Eýýäm hasabyňyz barmy?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Giriş
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
