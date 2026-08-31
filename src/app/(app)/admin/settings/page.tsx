'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Server, RefreshCw, ShieldCheck, Eye, EyeOff, Info } from 'lucide-react';

const SYNC_OPTIONS = [
  { value: '0', label: 'Diňe el bilen' },
  { value: '15', label: 'Her 15 sekunt' },
  { value: '30', label: 'Her 30 sekunt' },
  { value: '60', label: 'Her 1 minut' },
  { value: '120', label: 'Her 2 minut' },
  { value: '300', label: 'Her 5 minut' },
];

export default function SettingsPage() {
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [syncSec, setSyncSec] = useState('0');
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'gateway' | 'sync' | 'update' | 'mail' | null>(null);
  const [msg, setMsg] = useState('');
  const [version, setVersion] = useState('1.0.0');

  // Electron auto-update feed (global for all devices) — stored on VPS
  const [upProtocol, setUpProtocol] = useState<'http' | 'https'>('https');
  const [upHost, setUpHost] = useState('');
  const [upPort, setUpPort] = useState('');
  const [upPath, setUpPath] = useState('/updates');
  const [upUsername, setUpUsername] = useState('');
  const [upPassword, setUpPassword] = useState('');
  const [showUpPass, setShowUpPass] = useState(false);

  // Gmail / SMTP for forgot-password
  const [mailEnabled, setMailEnabled] = useState(false);
  const [mailHost, setMailHost] = useState('smtp.gmail.com');
  const [mailPort, setMailPort] = useState('587');
  const [mailSecure, setMailSecure] = useState(false);
  const [mailUser, setMailUser] = useState('');
  const [mailPass, setMailPass] = useState('');
  const [mailFromName, setMailFromName] = useState('BI Platform');
  const [mailFromEmail, setMailFromEmail] = useState('');
  const [mailTestTo, setMailTestTo] = useState('');
  const [showMailPass, setShowMailPass] = useState(false);
  const [supportTrashDays, setSupportTrashDays] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('bi-support-trash-days')) || '30'
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setGatewayUrl(data.settings.gatewayUrl || '');
        // Real secret returned for authorized admins — eye toggle can show it
        setSecret(data.settings.gatewayAdminSecret || '');
        setSyncSec(String(data.settings.catalogSyncIntervalSec ?? 0));
        setOnline(!!data.gatewayOnline);
        if (data.version) setVersion(data.version);
      }
      // Load global Electron update feed from VPS
      try {
        const uf = await fetch('/api/update-feed');
        const ud = await uf.json();
        if (uf.ok && ud.updateFeed) {
          const f = ud.updateFeed;
          setUpProtocol(f.protocol === 'http' ? 'http' : 'https');
          setUpHost(f.host || '');
          setUpPort(f.port ? String(f.port) : '');
          setUpPath(f.path || '/updates');
          setUpUsername(f.username || '');
          setUpPassword(f.password && f.password !== '••••' ? f.password : '');
        }
      } catch {
        /* offline */
      }
      try {
        const mr = await fetch('/api/mail-settings');
        const md = await mr.json();
        if (mr.ok && md.mail) {
          const m = md.mail;
          setMailEnabled(Boolean(m.enabled));
          setMailHost(m.host || 'smtp.gmail.com');
          setMailPort(String(m.port ?? 587));
          setMailSecure(Boolean(m.secure));
          setMailUser(m.user || '');
          setMailPass(m.hasPass ? '••••••••' : '');
          setMailFromName(m.fromName || 'BI Platform');
          setMailFromEmail(m.fromEmail || m.user || '');
        }
      } catch {
        /* */
      }
      try {
        const days = typeof window !== 'undefined' ? localStorage.getItem('bi-support-trash-days') : null;
        if (days) setSupportTrashDays(days);
      } catch {
        /* */
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGateway() {
    setSaving('gateway');
    setMsg('');
    try {
      const body: Record<string, string> = { gatewayUrl };
      if (secret && secret !== '••••••••') body.gatewayAdminSecret = secret;
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setMsg('Gateway sazlamalary saklandy');
      // Keep typed secret visible after save; refresh other fields
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveSync() {
    setSaving('sync');
    setMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogSyncIntervalSec: Number(syncSec) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setMsg('Sync özüni alyş saklandy');
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveMail(test = false) {
    setSaving('mail' as any);
    setMsg('');
    try {
      const body: Record<string, unknown> = {
        enabled: mailEnabled,
        host: mailHost.trim() || 'smtp.gmail.com',
        port: Number(mailPort) || 587,
        secure: mailSecure,
        user: mailUser.trim(),
        fromName: mailFromName.trim() || 'BI Platform',
        fromEmail: mailFromEmail.trim() || mailUser.trim(),
      };
      if (mailPass && mailPass !== '••••••••') body.pass = mailPass;
      if (test && mailTestTo.trim()) body.testTo = mailTestTo.trim();
      const res = await fetch('/api/mail-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      if (test) {
        setMsg(data.testOk ? 'Synag haty iberildi' : `Saklandy, ýöne synag: ${data.error || 'şowsuz'}`);
      } else {
        setMsg('Gmail / SMTP sazlamalary saklandy');
      }
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveUpdateFeed() {
    setSaving('update');
    setMsg('');
    try {
      const res = await fetch('/api/update-feed', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: upProtocol,
          host: upHost.trim(),
          port: upPort.trim(),
          path: upPath.trim() || '/updates',
          username: upUsername,
          password: upPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setMsg('Awtomatiki täzelenme (ähli Electron) VPS-e ýazyldy');
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function testHealth() {
    setOnline(null);
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (res.ok) setOnline(!!data.gatewayOnline);
  }

  if (loading) return <p className="text-slate-500 text-sm">Ýüklenýär...</p>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sazlamalar</h1>
        <p className="text-sm text-slate-400 mt-1">
          VPS Gateway baglanyşygy we sync — Electron Settings bilen meňzeş · BI Platform v{version}
        </p>
      </div>

      {msg && (
        <div className="text-sm text-slate-200 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-400" />
            VPS Gateway
          </h2>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-md ${
              online === true
                ? 'bg-emerald-500/15 text-emerald-300'
                : online === false
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-slate-700 text-slate-400'
            }`}
          >
            {online === true ? 'Online' : online === false ? 'Offline' : '...'}
          </span>
        </div>
        <Input
          label="Gateway URL"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="http://localhost:4000"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Admin Sync Secret</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="GATEWAY_ADMIN_SECRET"
              className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Electron-daky ADMIN_SYNC_SECRET bilen birmeňzeş bolmaly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={saving === 'gateway'} onClick={saveGateway}>
            Sakla
          </Button>
          <Button size="sm" variant="secondary" onClick={testHealth}>
            <RefreshCw className="h-3.5 w-3.5" />
            Health barla
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-indigo-400" />
          Sync özüni alyş
        </h2>
        <Select
          label="Catalog awto-täzeleme"
          value={syncSec}
          onChange={(e) => setSyncSec(e.target.value)}
          options={SYNC_OPTIONS}
        />
        <p className="text-[11px] text-slate-500 flex gap-1">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          API katalogynyň cache täzeleniş aralygy (gateway catalog).
        </p>
        <Button size="sm" loading={saving === 'sync'} onClick={saveSync}>
          Sync sakla
        </Button>
      </section>

      <section className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Server className="h-4 w-4 text-violet-400" />
          Awtomatiki Täzelenme (ähli Electron)
        </h2>
        <p className="text-[11px] text-slate-500">
          Bu sazlama VPS-de saklanýar. Ähli Electron enjamlary start / sync wagtynda şu feed-i
          ulanýar. Electron-daky ýerli üýtgetme diňe wagtlaýyn override hökmünde galýar.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Protocol"
            value={upProtocol}
            onChange={(e) => setUpProtocol(e.target.value === 'http' ? 'http' : 'https')}
            options={[
              { value: 'https', label: 'https' },
              { value: 'http', label: 'http' },
            ]}
          />
          <Input
            label="Host"
            value={upHost}
            onChange={(e) => setUpHost(e.target.value)}
            placeholder="updates.example.com"
          />
          <Input
            label="Port"
            value={upPort}
            onChange={(e) => setUpPort(e.target.value)}
            placeholder="443"
          />
          <Input
            label="Path"
            value={upPath}
            onChange={(e) => setUpPath(e.target.value)}
            placeholder="/updates"
          />
          <Input
            label="Username"
            value={upUsername}
            onChange={(e) => setUpUsername(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <div className="relative">
              <input
                type={showUpPass ? 'text' : 'password'}
                value={upPassword}
                onChange={(e) => setUpPassword(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={() => setShowUpPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showUpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button size="sm" loading={saving === 'update'} onClick={saveUpdateFeed}>
          Update feed sakla (ähli Electron)
        </Button>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Gmail / SMTP (Forgot password)
        </h2>
        <p className="text-[11px] text-slate-500">
          Işgärler «Paroly ýatdan çykardyňyzmy?» basanda şu Gmail arkaly 15 minutlyk baglanyşyk iberilýär.
          Gmail üçin <strong className="text-slate-400">App Password</strong> ulanyň (2FA gerekli).
        </p>
        <label className="flex items-center justify-between text-sm text-slate-200">
          <span>Işjeň</span>
          <input
            type="checkbox"
            checked={mailEnabled}
            onChange={(e) => setMailEnabled(e.target.checked)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input label="SMTP host" value={mailHost} onChange={(e) => setMailHost(e.target.value)} placeholder="smtp.gmail.com" />
          <Input label="Port" value={mailPort} onChange={(e) => setMailPort(e.target.value)} placeholder="587" />
          <Input label="Gmail ulanyjy" value={mailUser} onChange={(e) => setMailUser(e.target.value)} placeholder="you@gmail.com" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">App Password</label>
            <div className="relative">
              <input
                type={showMailPass ? 'text' : 'password'}
                value={mailPass}
                onChange={(e) => setMailPass(e.target.value)}
                onFocus={() => {
                  // Masked placeholder from server — clear so user can type & eye toggle works
                  if (mailPass === '••••••••') setMailPass('');
                }}
                className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="App Password giriziň"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (mailPass === '••••••••') setMailPass('');
                  setShowMailPass((v) => !v);
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                tabIndex={-1}
                aria-label={showMailPass ? 'Gizle' : 'Görkez'}
              >
                {showMailPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Input label="From ady" value={mailFromName} onChange={(e) => setMailFromName(e.target.value)} />
          <Input label="From e-poçta" value={mailFromEmail} onChange={(e) => setMailFromEmail(e.target.value)} placeholder="you@gmail.com" />
        </div>
        <label className="flex items-center justify-between text-sm text-slate-200">
          <span>Secure (SSL 465)</span>
          <input type="checkbox" checked={mailSecure} onChange={(e) => setMailSecure(e.target.checked)} />
        </label>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Input label="Synag e-poçta" value={mailTestTo} onChange={(e) => setMailTestTo(e.target.value)} placeholder="test@gmail.com" />
          </div>
          <Button size="sm" variant="secondary" loading={saving === 'mail'} onClick={() => saveMail(true)}>
            Synag iber
          </Button>
          <Button size="sm" loading={saving === 'mail'} onClick={() => saveMail(false)}>
            Gmail sakla
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">Goldaw · Pozulanlar (Trash)</h2>
        <p className="text-[11px] text-slate-500">
          Admin ticket-i «trashed» edensoň, şu gün sanawyndan soň awtomatik doly pozulmagy üçin (klient tarapynda ýatda saklanýar; VPS job soň goşulyp bilner).
        </p>
        <label className="text-xs text-slate-400">Nace günden soň doly pozulsın?</label>
        <input
          type="number"
          min={1}
          max={365}
          value={supportTrashDays}
          onChange={(e) => {
            setSupportTrashDays(e.target.value);
            try {
              localStorage.setItem('bi-support-trash-days', e.target.value);
            } catch { /* */ }
          }}
          className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100"
        />
      </section>

      </div>
    </div>
  );
}
