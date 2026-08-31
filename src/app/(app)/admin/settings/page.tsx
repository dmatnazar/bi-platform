'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Server, RefreshCw, ShieldCheck, Eye, EyeOff, Info } from 'lucide-react';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';

const SYNC_OPTIONS = [
  { value: '0', label: 'Diňe el bilen' },
  { value: '15', label: 'Her 15 sekunt' },
  { value: '30', label: 'Her 30 sekunt' },
  { value: '60', label: 'Her 1 minut' },
  { value: '120', label: 'Her 2 minut' },
  { value: '300', label: 'Her 5 minut' },
];

function normalizeEmail(raw: string): string {
  return raw
    .replace(/[\u00A0\u2000-\u200B\u202F\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

function isValidEmail(raw: string): boolean {
  const t = normalizeEmail(raw);
  if (!t) return false;
  // Very lenient — server does final check; avoid false client rejects
  const at = t.indexOf('@');
  if (at < 1) return false;
  const domain = t.slice(at + 1);
  return domain.includes('.') && domain.length >= 3 && !t.includes(' ');
}

export default function SettingsPage() {
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [syncSec, setSyncSec] = useState('0');
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'gateway' | 'sync' | 'update' | 'mail' | null>(null);
  const [version, setVersion] = useState('1.0.0');

  const [upProtocol, setUpProtocol] = useState<'http' | 'https'>('https');
  const [upHost, setUpHost] = useState('');
  const [upPort, setUpPort] = useState('');
  const [upPath, setUpPath] = useState('/updates');
  const [upUsername, setUpUsername] = useState('');
  const [upPassword, setUpPassword] = useState('');
  const [showUpPass, setShowUpPass] = useState(false);

  const [mailEnabled, setMailEnabled] = useState(false);
  const [mailHost, setMailHost] = useState('smtp.gmail.com');
  const [mailPort, setMailPort] = useState('587');
  const [mailSecure, setMailSecure] = useState(false);
  const [mailUser, setMailUser] = useState('');
  /** Plaintext only while editing; never the server secret */
  const [mailPass, setMailPass] = useState('');
  const [hasMailPass, setHasMailPass] = useState(false);
  const [showMailPass, setShowMailPass] = useState(false);
  const [mailFromName, setMailFromName] = useState('BI Platform');
  const [mailFromEmail, setMailFromEmail] = useState('');
  const [mailTestTo, setMailTestTo] = useState('');

  const [supportTrashDays, setSupportTrashDays] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('bi-support-trash-days')) || '30'
  );

  const loadGateway = useCallback(async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (res.ok) {
      setGatewayUrl(data.settings?.gatewayUrl || '');
      setSecret(data.settings?.gatewayAdminSecret || '');
      setSyncSec(String(data.settings?.catalogSyncIntervalSec ?? 0));
      setOnline(!!data.gatewayOnline);
      if (data.version) setVersion(data.version);
    }
  }, []);

  const loadUpdateFeed = useCallback(async () => {
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
  }, []);

  const loadMail = useCallback(async () => {
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
        setHasMailPass(Boolean(m.hasPass || m.pass));
        // Real pass from API (admin-only) so eye can reveal stored App Password
        setMailPass(typeof m.pass === 'string' && m.pass && m.pass !== '••••••••' ? m.pass : '');
        setShowMailPass(false);
        setMailFromName(m.fromName || 'BI Platform');
        setMailFromEmail(m.fromEmail || m.user || '');
      }
    } catch {
      /* */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadGateway(), loadUpdateFeed(), loadMail()]);
      try {
        const days = localStorage.getItem('bi-support-trash-days');
        if (days) setSupportTrashDays(days);
      } catch {
        /* */
      }
    } finally {
      setLoading(false);
    }
  }, [loadGateway, loadUpdateFeed, loadMail]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function saveGateway() {
    setSaving('gateway');
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
      toastSuccess('Gateway saklandy');
      await loadGateway();
    } catch (e) {
      toastError('Gateway', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveSync() {
    setSaving('sync');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogSyncIntervalSec: Number(syncSec) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      toastSuccess('Sync saklandy');
      await loadGateway();
    } catch (e) {
      toastError('Sync', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveUpdateFeed() {
    setSaving('update');
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
      toastSuccess('Update feed saklandy', 'Ähli Electron enjamlary');
      await loadUpdateFeed();
    } catch (e) {
      toastError('Update feed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveMail(test = false) {
    setSaving('mail');
    try {
      // Prefer React state; fall back to DOM if state lag (mobile autofill etc.)
      let testToVal = mailTestTo;
      if (test && !normalizeEmail(testToVal)) {
        const el = document.querySelector<HTMLInputElement>('input[name="mailTestTo"]');
        if (el?.value) testToVal = el.value;
      }
      if (test) {
        const to = normalizeEmail(testToVal);
        if (!isValidEmail(to)) {
          toastError('Synag e-poçta', `Dogry e-poçta giriziň (mysal: siz@gmail.com). Häzirki: "${testToVal || 'boş'}"`);
          return;
        }
        if (!mailUser.trim()) {
          toastError('Gmail', 'Gmail ulanyjy gerek');
          return;
        }
        if (!hasMailPass && !mailPass.trim()) {
          toastError('App Password', 'App Password giriziň');
          return;
        }
      }

      const body: Record<string, unknown> = {
        enabled: mailEnabled,
        host: mailHost.trim() || 'smtp.gmail.com',
        port: Number(mailPort) || 587,
        secure: mailSecure,
        user: mailUser.trim(),
        fromName: mailFromName.trim() || 'BI Platform',
        fromEmail: mailFromEmail.trim() || mailUser.trim(),
      };
      if (mailPass.trim()) body.pass = mailPass.trim();
      if (test) body.testTo = normalizeEmail(testToVal);

      const res = await fetch('/api/mail-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            (typeof (data as { details?: unknown }).details === 'object'
              ? JSON.stringify((data as { details: unknown }).details)
              : null) ||
            'Şowsuz'
        );
      }

      if (test) {
        if ((data as { testOk?: boolean }).testOk) {
          toastSuccess('Synag haty iberildi', normalizeEmail(mailTestTo));
        } else {
          toastWarning('Saklandy, ýöne synag şowsuz', (data as { error?: string }).error || '');
        }
      } else {
        toastSuccess('Gmail / SMTP saklandy');
      }

      // Refresh only mail section (pass comes back from API for eye)
      await loadMail();
    } catch (e) {
      toastError('Gmail / SMTP', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function testHealth() {
    setOnline(null);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setOnline(!!data.gatewayOnline);
        toastSuccess(data.gatewayOnline ? 'Gateway online' : 'Gateway offline');
      }
    } catch {
      setOnline(false);
      toastError('Health', 'Barlap bolmady');
    }
  }

  if (loading) {
    return <p className="text-slate-500 text-sm p-4">Ýüklenýär...</p>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Sazlamalar</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          VPS Gateway baglanyşygy we sync · BI Platform v{version}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-start">
        {/* Gateway */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-400 shrink-0" />
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
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label={showSecret ? 'Gizle' : 'Görkez'}
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
            <Button size="sm" loading={saving === 'gateway'} onClick={() => void saveGateway()}>
              Sakla
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void testHealth()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Health barla
            </Button>
          </div>
        </section>

        {/* Sync */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3 sm:space-y-4">
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
          <Button size="sm" loading={saving === 'sync'} onClick={() => void saveSync()}>
            Sync sakla
          </Button>
        </section>

        {/* Update feed */}
        <section className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-4 sm:p-5 space-y-3 sm:space-y-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-violet-400" />
            Awtomatiki Täzelenme (ähli Electron)
          </h2>
          <p className="text-[11px] text-slate-500">
            Bu sazlama VPS-de saklanýar. Ähli Electron enjamlary start / sync wagtynda şu feed-i ulanýar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Select
              label="Protocol"
              value={upProtocol}
              onChange={(e) => setUpProtocol(e.target.value === 'http' ? 'http' : 'https')}
              options={[
                { value: 'https', label: 'https' },
                { value: 'http', label: 'http' },
              ]}
            />
            <Input label="Host" value={upHost} onChange={(e) => setUpHost(e.target.value)} placeholder="updates.example.com" />
            <Input label="Port" value={upPort} onChange={(e) => setUpPort(e.target.value)} placeholder="443 (boş = default)" />
            <Input label="Path" value={upPath} onChange={(e) => setUpPath(e.target.value)} placeholder="/updates" />
            <Input label="Username" value={upUsername} onChange={(e) => setUpUsername(e.target.value)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
              <div className="relative">
                <input
                  type={showUpPass ? 'text' : 'password'}
                  value={upPassword}
                  onChange={(e) => setUpPassword(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowUpPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {showUpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button size="sm" loading={saving === 'update'} onClick={() => void saveUpdateFeed()}>
            Update feed sakla (ähli Electron)
          </Button>
        </section>

        {/* Gmail */}
        <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-4 sm:p-5 space-y-3 sm:space-y-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Gmail / SMTP (Forgot password)
          </h2>
          <p className="text-[11px] text-slate-500">
            Işgärler «Paroly ýatdan çykardyňyzmy?» basanda şu Gmail arkaly 15 minutlyk baglanyşyk iberilýär.
            Gmail üçin <strong className="text-slate-400">App Password</strong> ulanyň (2FA gerekli).
          </p>
          <label className="flex items-center justify-between text-sm text-slate-200 max-w-xs">
            <span>Işjeň</span>
            <input
              type="checkbox"
              checked={mailEnabled}
              onChange={(e) => setMailEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="SMTP host"
              value={mailHost}
              onChange={(e) => setMailHost(e.target.value)}
              placeholder="smtp.gmail.com"
            />
            <Input
              label="Port"
              value={mailPort}
              onChange={(e) => setMailPort(e.target.value)}
              placeholder="587"
            />
            <Input
              label="Gmail ulanyjy"
              value={mailUser}
              onChange={(e) => setMailUser(e.target.value)}
              placeholder="you@gmail.com"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                App Password
                {hasMailPass && !mailPass ? (
                  <span className="ml-2 text-emerald-400/90 font-normal">· saklanan bar</span>
                ) : null}
              </label>
              <div className="relative">
                <input
                  type={showMailPass ? 'text' : 'password'}
                  value={mailPass}
                  onChange={(e) => setMailPass(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder={
                    hasMailPass
                      ? 'Täzelemek üçin ýazyň (boş = öňküsi galýar)'
                      : 'App Password giriziň'
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowMailPass((v) => !v)}
                  title={showMailPass ? 'Gizle' : 'Görkez'}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label={showMailPass ? 'Gizle' : 'Görkez'}
                >
                  {showMailPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Göz düwmesi saklanan / ýazylan App Password-y görkezýär ýa-da gizleýär.
              </p>
            </div>
            <Input
              label="From ady"
              value={mailFromName}
              onChange={(e) => setMailFromName(e.target.value)}
            />
            <Input
              label="From e-poçta"
              value={mailFromEmail}
              onChange={(e) => setMailFromEmail(e.target.value)}
              placeholder="you@gmail.com"
            />
          </div>
          <label className="flex items-center justify-between text-sm text-slate-200 max-w-xs">
            <span>Secure (SSL 465)</span>
            <input
              type="checkbox"
              checked={mailSecure}
              onChange={(e) => setMailSecure(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <Input
                label="Synag e-poçta"
                name="mailTestTo"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={mailTestTo}
                onChange={(e) => setMailTestTo(e.target.value)}
                placeholder="test@gmail.com"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={saving === 'mail'}
                onClick={() => void saveMail(true)}
              >
                Synag iber
              </Button>
              <Button size="sm" loading={saving === 'mail'} onClick={() => void saveMail(false)}>
                Gmail sakla
              </Button>
            </div>
          </div>
        </section>

        {/* Trash days */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3 xl:col-span-2">
          <h2 className="text-sm font-semibold text-white">Goldaw · Pozulanlar (Trash)</h2>
          <p className="text-[11px] text-slate-500">
            Admin ticket-i «trashed» edensoň, şu gün sanawyndan soň awtomatik doly pozulmagy üçin.
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
              } catch {
                /* */
              }
            }}
            className="w-full sm:max-w-xs h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100"
          />
        </section>
      </div>
    </div>
  );
}
