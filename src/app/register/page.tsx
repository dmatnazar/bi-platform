'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Eye, EyeOff, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Plus, Building2 } from 'lucide-react';

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
  const [authAnim, setAuthAnim] = useState(true);
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
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, []);


  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [tenantSlug, setTenantSlug] = useState('');
  const [companyModal, setCompanyModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [tariffs, setTariffs] = useState<
    {
      id: string;
      name: string;
      priceMonthly: number;
      includedCredits: number;
      description?: string;
      code: string;
      currency?: string;
      maxStaff?: number;
      maxApiCallsDay?: number;
      maxConnections?: number;
    }[]
  >([]);
  const [newTariffId, setNewTariffId] = useState('tariff_free');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyErr, setCompanyErr] = useState('');
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
    fetch('/api/billing?action=tariffs')
      .then((r) => r.json())
      .then((d) => {
        const list = d.tariffs || [];
        setTariffs(list);
        const free = list.find((t: any) => t.code === 'free');
        if (free) setNewTariffId(free.id);
      })
      .catch(() => {});
  }, []);

  function slugifyName(name: string) {
    const map: Record<string, string> = {
      ý: 'y', Ý: 'y', ä: 'a', Ä: 'a', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
      ň: 'n', Ň: 'n', ş: 's', Ş: 's', ç: 'c', Ç: 'c', ž: 'z', Ž: 'z',
      ə: 'e', Ə: 'e', ı: 'i', İ: 'i', ğ: 'g', Ğ: 'g',
    };
    const s = name
      .split('')
      .map((ch) => map[ch] ?? ch)
      .join('');
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 60);
  }

  async function createCompany() {
    setCompanyErr('');
    if (!newName.trim() || !newSlug.trim()) {
      setCompanyErr('Firma ady we slug gerek');
      return;
    }
    setCreatingCompany(true);
    try {
      const res = await fetch('/api/public/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          tariffId: newTariffId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompanyErr(data.error || 'Döredip bolmady');
        return;
      }
      const c = data.company;
      setCompanies((prev) => {
        if (prev.some((x) => x.slug === c.slug)) return prev;
        return [...prev, { id: c.id, name: c.name, slug: c.slug }];
      });
      setTenantSlug(c.slug);
      setCompanyModal(false);
      setNewName('');
      setNewSlug('');
    } catch {
      setCompanyErr('Baglanyşyk säwligi');
    } finally {
      setCreatingCompany(false);
    }
  }

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
      <div className="min-h-dvh flex relative items-center justify-center px-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-slate-950 z-0">
        {authAnim && (
          <>
            <div className="login-orb login-orb-a" />
            <div className="login-orb login-orb-b" />
            <div className="login-orb login-orb-c" />
            <ParticlesBackground theme="login" className="absolute inset-0 z-[1] h-full w-full overflow-hidden" />
          </>
        )}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(2_6_23)_85%)]" />
      </div>

        <div className={`max-w-md w-full text-center space-y-4 ${authAnim ? 'animate-fade-in' : ''}`}>
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
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-slate-950 z-0">
        {authAnim && (
          <>
            <div className="login-orb login-orb-a" />
            <div className="login-orb login-orb-b" />
            <div className="login-orb login-orb-c" />
            <ParticlesBackground theme="login" className="absolute inset-0 z-[1] h-full w-full overflow-hidden" />
          </>
        )}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_25%,rgb(2_6_23)_88%)]" />
      </div>

      <div className={`relative z-10 w-full max-w-lg ${authAnim ? 'animate-fade-in' : ''}`}>
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-3">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-base sm:text-xl font-bold text-white truncate leading-tight">Hasaba alyş</h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate leading-snug">Kompaniýaňyzy saýlaň we maglumatlary dolduryň</p>
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-300">Kompaniýa</label>
              <button
                type="button"
                onClick={() => {
                  setCompanyErr('');
                  setCompanyModal(true);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Täze firma
              </button>
            </div>
            <Select
              name="tenantSlug"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="Kompaniýa saýlaň"
              required
              options={companies.map((c) => ({ value: c.slug, label: c.name }))}
            />
            <p className="text-[11px] text-slate-500">
              Sanawda ýok bolsa «Täze firma» basyp goşuň (tarif saýlap bilersiňiz).
            </p>
          </div>

          {companyModal && (
            <ModalPortal open>
              <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCompanyModal(false)} />
                <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-white">Täze firma</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Firma VPS-e ýazylýar. Tarif saýlaň — aýda şol mukdarda REQ berilýär. Galan balans soň
                    top-up bilen doldurylýar.
                  </p>
                  {companyErr && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-3 py-2">
                      {companyErr}
                    </div>
                  )}
                  <Input
                    label="Firma ady *"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setNewSlug(slugifyName(e.target.value));
                    }}
                    placeholder="Mysal: Acme LLC"
                  />
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-300">Slug (URL)</label>
                    <input
                      readOnly
                      value={newSlug}
                      className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/50 px-3 text-sm text-slate-400 font-mono cursor-not-allowed outline-none"
                      placeholder="firma-adyndan awto"
                      title="Slug firma adyndan awtomatiki emele gelýär — el bilen üýtgedip bolmaýar"
                    />
                    <p className="text-[10px] text-slate-500">Firma adyndan awto — üýtgedip bolmaýar</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Tarif</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(tariffs.length
                        ? tariffs
                        : [
                            {
                              id: 'tariff_free',
                              code: 'free',
                              name: 'Free',
                              priceMonthly: 0,
                              includedCredits: 500,
                              description: 'Başlangyç',
                              maxStaff: 3,
                              maxApiCallsDay: 100,
                              maxConnections: 1,
                              currency: 'TMT',
                            },
                          ]
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNewTariffId(t.id)}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                            newTariffId === t.id
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-slate-700 bg-slate-950/80 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex justify-between gap-2 items-start">
                            <div className="min-w-0">
                              <span className="font-medium text-white">{t.name}</span>
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500 font-mono">
                                {t.code}
                              </span>
                            </div>
                            <span className="text-indigo-300 text-xs shrink-0">
                              {t.priceMonthly === 0
                                ? 'Mugt'
                                : `${t.priceMonthly} ${t.currency || 'TMT'}/aý`}
                            </span>
                          </div>
                          {t.description ? (
                            <p className="text-[11px] text-slate-400 mt-1">{t.description}</p>
                          ) : null}
                          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                            <span>
                              Aýlyk REQ:{' '}
                              <strong className="text-slate-300">
                                {(t.includedCredits ?? 0).toLocaleString?.() ?? t.includedCredits}
                              </strong>
                            </span>
                            <span>
                              Max işgär:{' '}
                              <strong className="text-slate-300">{t.maxStaff ?? '—'}</strong>
                            </span>
                            <span>
                              Günde max REQ (sorag):{' '}
                              <strong className="text-slate-300">{t.maxApiCallsDay ?? '—'}</strong>
                            </span>
                            <span>
                              Max DB baglanyşyk:{' '}
                              <strong className="text-slate-300">{t.maxConnections ?? '—'}</strong>
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1" loading={creatingCompany} onClick={() => void createCompany()}>
                      Firma döret
                    </Button>
                    <Button variant="ghost" type="button" onClick={() => setCompanyModal(false)}>
                      Ýatyr
                    </Button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

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
