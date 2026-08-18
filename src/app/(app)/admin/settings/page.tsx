'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Server, RefreshCw, ShieldCheck, Eye, EyeOff, Info, Lock, KeyRound } from 'lucide-react';

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
  const [saving, setSaving] = useState<'gateway' | 'sync' | 'password' | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [version, setVersion] = useState('1.0.0');

  // UI password change
  const [newUiPass, setNewUiPass] = useState('');
  const [confirmUiPass, setConfirmUiPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setGatewayUrl(data.settings.gatewayUrl || '');
        setSecret(data.settings.gatewayAdminSecret || '');
        setSyncSec(String(data.settings.catalogSyncIntervalSec ?? 0));
        setOnline(!!data.gatewayOnline);
        if (data.version) setVersion(data.version);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showMsg(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

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
      showMsg('✓ Gateway sazlamalary saklandy');
      await load();
    } catch (e) {
      showMsg(String(e), 'err');
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
      showMsg('✓ Sync sazlamasy saklandy');
    } catch (e) {
      showMsg(String(e), 'err');
    } finally {
      setSaving(null);
    }
  }

  async function saveUiPassword() {
    if (!newUiPass) return showMsg('Täze parol gerek', 'err');
    if (newUiPass.length < 4) return showMsg('Parol azyndan 4 harp bolmaly', 'err');
    if (newUiPass !== confirmUiPass) return showMsg('Parollar gabat gelmeýär', 'err');
    setSaving('password');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiAdminPassword: newUiPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      showMsg('✓ Giriş paroly üýtgedildi');
      setNewUiPass('');
      setConfirmUiPass('');
    } catch (e) {
      showMsg(String(e), 'err');
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sazlamalar</h1>
        <p className="text-sm text-slate-400 mt-1">
          VPS Gateway baglanyşygy we sync — BI Platform v{version}
        </p>
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-3 py-2 border ${
          msgType === 'ok'
            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
            : 'text-rose-300 bg-rose-950/40 border-rose-800/60'
        }`}>
          {msg}
        </div>
      )}

      {/* VPS Gateway Section */}
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

      {/* Sync Section */}
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

      {/* UI Gateway Panel Password */}
      <section className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-400" />
          Gateway Giriş Paroly
        </h2>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          Ýokardaky ⚙ düwmä basylanda soralýan parol. Default:{' '}
          <span className="text-amber-300 font-mono">admin1001</span>.
          Üýtgetmek üçin täze paroly giriziň.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Täze parol</label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newUiPass}
                onChange={(e) => setNewUiPass(e.target.value)}
                placeholder="Azyndan 4 harp..."
                className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <button
                type="button"
                onClick={() => setShowNewPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Input
            label="Paroly tassyklaň"
            type="password"
            value={confirmUiPass}
            onChange={(e) => setConfirmUiPass(e.target.value)}
            placeholder="Gaýtadan giriziň..."
          />
        </div>

        <Button
          size="sm"
          loading={saving === 'password'}
          onClick={saveUiPassword}
          className="bg-amber-600 hover:bg-amber-500 text-white"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Paroly üýtget
        </Button>
      </section>
    </div>
  );
}
