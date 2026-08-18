'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate } from '@/lib/utils';
import {
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Settings2,
  X,
  Eye,
  EyeOff,
  Lock,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Status {
  gatewayOnline: boolean;
  biClientDataAvailable: boolean;
  fromCache: boolean;
  catalogSyncedAt: string | null;
  cachedAt: string | null;
  catalogSyncIntervalSec: number;
  checkedAt: string;
  counts: { tenants: number; endpoints: number; staff: number };
  scoped?: { endpoints: number; staff: number; companyName?: string };
}

interface GatewaySettings {
  gatewayUrl: string;
  gatewayAdminSecret: string;
  hasSecret: boolean;
  catalogSyncIntervalSec: number;
}

function Dot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0',
        ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : warn ? 'bg-amber-400' : 'bg-rose-500'
      )}
    />
  );
}

interface Props {
  isSuperAdmin?: boolean;
  companyName?: string;
}

// ── Gateway Quick Panel ─────────────────────────────────────────────────────
function GatewayPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'auth' | 'settings'>('auth');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [gwUrl, setGwUrl] = useState('');
  const [gwSecret, setGwSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [gwOnline, setGwOnline] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgType, setSaveMsgType] = useState<'ok' | 'err'>('ok');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Parol nädogry');
        return;
      }
      // Unlock: load settings
      setGwUrl(data.settings.gatewayUrl || '');
      setGwSecret(data.settings.gatewayAdminSecret || '');
      setGwOnline(data.gatewayOnline);
      setStep('settings');
    } catch {
      setAuthError('Serwere baglanyp bolmady');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const body: Record<string, string> = { gatewayUrl: gwUrl };
      if (gwSecret && gwSecret !== '••••••••') body.gatewayAdminSecret = gwSecret;
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ýalňyşlyk');
      setSaveMsg('✓ Saklandy');
      setSaveMsgType('ok');
      // Test health after save
      const statusRes = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setGwOnline(statusData.gatewayOnline);
      }
    } catch (err) {
      setSaveMsg(String(err));
      setSaveMsgType('err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-[200] w-[340px] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-top-2 duration-150"
      style={{ minWidth: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Gateway Sazlamalary</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'auth' ? (
        /* ── Auth Step ── */
        <form onSubmit={handleAuth} className="p-4 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Gateway sazlamalaryny açmak üçin administrator parolyny giriziň.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Parol</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-9 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {authError && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={authLoading || !password}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {authLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Giriş'
            )}
          </button>
        </form>
      ) : (
        /* ── Settings Step ── */
        <form onSubmit={handleSave} className="p-4 space-y-3">
          {/* Online indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium',
              gwOnline
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', gwOnline ? 'bg-emerald-400' : 'bg-rose-500')} />
              VPS {gwOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Gateway URL</label>
            <input
              type="text"
              value={gwUrl}
              onChange={(e) => setGwUrl(e.target.value)}
              placeholder="http://ip:4000"
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Admin Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={gwSecret}
                onChange={(e) => setGwSecret(e.target.value)}
                placeholder="ADMIN_SYNC_SECRET"
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 pr-9 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {saveMsg && (
            <p className={cn(
              'text-xs flex items-center gap-1',
              saveMsgType === 'ok' ? 'text-emerald-400' : 'text-rose-400'
            )}>
              {saveMsgType === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {saveMsg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Sakla
            </button>
            <button
              type="button"
              onClick={() => { setStep('auth'); setPassword(''); }}
              className="px-3 h-9 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Çyk
            </button>
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            Doly sazlamalar üçin → Sazlamalar sahypasy
          </p>
        </form>
      )}
    </div>
  );
}

// ── Main ConnectionStatusBar ─────────────────────────────────────────────────
export function ConnectionStatusBar({ isSuperAdmin = false, companyName }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!status?.catalogSyncIntervalSec || status.catalogSyncIntervalSec <= 0) return;
    const id = setInterval(load, status.catalogSyncIntervalSec * 1000);
    return () => clearInterval(id);
  }, [status?.catalogSyncIntervalSec, load]);

  const syncLabel =
    status?.cachedAt || status?.catalogSyncedAt
      ? formatDate(status.cachedAt || status.catalogSyncedAt || '')
      : '—';

  const intervalLabel =
    !status || status.catalogSyncIntervalSec <= 0
      ? 'el bilen'
      : `her ${status.catalogSyncIntervalSec}s`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400 px-1 py-1.5">
      {/* VPS Status */}
      <div className="inline-flex items-center gap-1.5" title="VPS Gateway">
        <Dot ok={!!status?.gatewayOnline} />
        {status?.gatewayOnline ? (
          <Cloud className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className={status?.gatewayOnline ? 'text-emerald-300' : 'text-rose-300'}>
          VPS {status?.gatewayOnline ? 'online' : 'offline'}
        </span>
      </div>

      {/* Admin-only extra info */}
      {isSuperAdmin && (
        <>
          <div
            className="inline-flex items-center gap-1.5"
            title={status?.fromCache ? 'Local cache-den' : 'VPS-den täze'}
          >
            <Dot
              ok={!!status?.biClientDataAvailable}
              warn={status?.fromCache && status?.biClientDataAvailable}
            />
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <span
              className={
                status?.biClientDataAvailable
                  ? status.fromCache
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                  : 'text-rose-300'
              }
            >
              BI {status?.biClientDataAvailable ? (status.fromCache ? 'cache' : 'live') : 'ýok'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 text-slate-500" title="Sync">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            <span>
              Sync: <span className="text-slate-300">{syncLabel}</span>
              <span className="mx-1 opacity-40">·</span>
              {intervalLabel}
            </span>
          </div>

          {status && (
            <span className="text-slate-600 hidden sm:inline">
              {status.counts.tenants} firma · {status.counts.endpoints} API · {status.counts.staff} işgär
            </span>
          )}
        </>
      )}

      {/* Company name for non-admin */}
      {!isSuperAdmin && (companyName || status?.scoped?.companyName) && (
        <span className="text-slate-500 truncate max-w-[200px]">
          {companyName || status?.scoped?.companyName}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* ⚙ Gateway Quick Settings Button */}
      <div className="relative">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title="Gateway sazlamalary"
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors border',
            panelOpen
              ? 'bg-indigo-600/20 border-indigo-600/50 text-indigo-300'
              : 'border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-800/50'
          )}
        >
          <Settings2 className={cn('h-3.5 w-3.5', panelOpen && 'rotate-45 transition-transform')} />
          <span className="hidden sm:inline">Gateway</span>
        </button>

        {panelOpen && (
          <GatewayPanel onClose={() => setPanelOpen(false)} />
        )}
      </div>
    </div>
  );
}
