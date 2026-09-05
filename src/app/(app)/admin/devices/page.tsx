'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Server,
  RefreshCw,
  Check,
  Ban,
  Trash2,
  Building2,
  Cpu,
  HardDrive,
  Globe,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { useModalAnimations } from '@/lib/use-modal-animations';

interface Device {
  id: string;
  name?: string;
  hostname?: string;
  osPlatform?: string;
  osRelease?: string;
  ramGb?: number;
  cpuModel?: string;
  ipAddress?: string;
  tenantSlug?: string;
  companyName?: string;
  companySlugs?: string[];
  companyNames?: string[];
  status: string;
  appVersion?: string;
  lastSeenAt?: string;
  createdAt?: string;
}

interface TenantOpt {
  slug: string;
  name: string;
}

/** Online if last sync/heartbeat < 5 minutes, else Offline */
function isDeviceOnline(lastSeenAt?: string): 'online' | 'offline' {
  if (!lastSeenAt) return 'offline';
  const ms = Date.now() - Date.parse(lastSeenAt);
  if (!Number.isFinite(ms)) return 'offline';
  return ms < 5 * 60 * 1000 ? 'online' : 'offline';
}

function formatLastSync(lastSeenAt?: string): string {
  if (!lastSeenAt) return 'Sync: —';
  const t = Date.parse(lastSeenAt);
  if (!Number.isFinite(t)) return 'Sync: —';
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Sync: ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const onlineStyle = {
  online: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  offline: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
} as const;

const onlineLabel = { online: 'Online', offline: 'Offline' } as const;

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export default function DevicesPage() {
  const modalAnimOn = useModalAnimations();
  const [devices, setDevices] = useState<Device[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  const [settingsDevice, setSettingsDevice] = useState<Device | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    autostart: false,
    startMinimized: false,
    autoSync: true,
    /** Seconds — same as Electron Settings (15, 30, 60, 120, 300, 0=manual) */
    syncIntervalSec: 30,
    autoLogin: false,
    autoLoginUsername: '',
    trayMinimize: true,
    notifyOnSync: true,
    offlineQueue: true,
    /** 0 = off; minutes of idle before admin auto sign-out */
    autoSignOutMin: 0,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [cmdActing, setCmdActing] = useState<'restart' | 'check_update' | null>(null);
  const [staffOpts, setStaffOpts] = useState<{ username: string; fullName: string; tenantSlug?: string }[]>([]);

  async function openFirmaSazlamalary(d: Device) {
    setSettingsDevice(d);
    setSettingsForm({
      autostart: false,
      startMinimized: false,
      autoSync: true,
      syncIntervalSec: 30,
      autoLogin: false,
      autoLoginUsername: '',
      trayMinimize: true,
      notifyOnSync: true,
      offlineQueue: true,
      autoSignOutMin: 0,
    });
    setStaffOpts([]);
    try {
      const res = await fetch(
        `/api/device-settings?deviceId=${encodeURIComponent(d.id)}&tenantSlug=${encodeURIComponent(d.tenantSlug || '')}`
      );
      const data = await res.json();
      const row = (data.settings || [])[0];
      if (row?.settings) {
        let sec = Number(row.settings.syncIntervalSec ?? 0);
        if (!sec || sec <= 0) {
          const min = Number(row.settings.syncIntervalMin ?? 0);
          if (min > 0 && min <= 14) sec = Math.round(min * 60);
          else if (min > 14) sec = Math.round(min);
          else sec = 30;
        }
        setSettingsForm((f) => ({
          ...f,
          autostart: Boolean(row.settings.autostart),
          startMinimized: Boolean(row.settings.startMinimized),
          autoSync: row.settings.autoSync !== false,
          syncIntervalSec: sec,
          autoLogin: Boolean(row.settings.autoLogin),
          autoLoginUsername: String(row.settings.autoLoginUsername || ''),
          trayMinimize: row.settings.trayMinimize !== false,
          notifyOnSync: row.settings.notifyOnSync !== false,
          offlineQueue: row.settings.offlineQueue !== false,
          autoSignOutMin: Math.max(0, Number(row.settings.autoSignOutMin) || 0),
        }));
      }
    } catch {
      /* defaults */
    }
    // Firma işgärleri — auto login saýlawy
    try {
      const slug = d.tenantSlug || '';
      const sRes = await fetch('/api/staff');
      const sData = await sRes.json().catch(() => ({}));
      let list = (sData.staff || []) as { username: string; fullName: string; tenantSlug?: string; active?: boolean }[];
      if (slug) {
        list = list.filter((s) => !s.tenantSlug || s.tenantSlug === slug || s.active !== false);
      }
      setStaffOpts(
        list
          .filter((s) => s.username)
          .map((s) => ({ username: s.username, fullName: s.fullName || s.username, tenantSlug: s.tenantSlug }))
      );
    } catch {
      setStaffOpts([]);
    }
  }

  async function sendDeviceCommand(action: 'restart' | 'check_update') {
    if (!settingsDevice) return;
    setCmdActing(action);
    try {
      const res = await fetch('/api/device-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: settingsDevice.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Buýruk', data.error || 'şowsuz');
        return;
      }
      if (data.delivered) {
        toastSuccess(
          action === 'restart' ? 'Restart ugradyldy' : 'Check update ugradyldy',
          data.message || 'Electron kabul etdi'
        );
      } else {
        toastWarning(
          'Enjam offline?',
          data.message || 'Device-events bagly däl — Electron açyk we online bolmaly'
        );
      }
    } catch (e) {
      toastError('Buýruk', e instanceof Error ? e.message : String(e));
    } finally {
      setCmdActing(null);
    }
  }

  async function saveFirmaSazlamalary() {
    if (!settingsDevice) return;
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/device-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: settingsDevice.id,
          tenantSlug: settingsDevice.tenantSlug || '',
          settings: settingsForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      toastSuccess('Firma sazlamalary saklandy', 'VPS + Electron sync');
      setSettingsDevice(null);
    } finally {
      setSettingsSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Enjamlar', data?.error || 'Ýüklenmedi');
        setDevices([]);
        return;
      }
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setTenants(Array.isArray(data.tenants) ? data.tenants : []);
    } catch (e: any) {
      toastError('Enjamlar', e?.message || 'Network error');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => devices.filter((d) => d.status === 'pending').length,
    [devices]
  );

  function openApprove(d: Device) {
    setApproveId(d.id);
    setSelectedSlugs(d.companySlugs?.length ? [...d.companySlugs] : d.tenantSlug ? [d.tenantSlug] : []);
  }

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function submitApprove() {
    if (!approveId || selectedSlugs.length === 0) {
      toastError('Firma saýla', 'Iň az bir firma saýlamaly');
      return;
    }
    setActing(approveId);
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id: approveId, tenantSlugs: selectedSlugs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Tassyklama', data?.error || 'Şowsuz');
        return;
      }
      toastSuccess('Tassyklanyldy', selectedSlugs.join(', '));
      setApproveId(null);
      await load();
    } finally {
      setActing(null);
    }
  }

  async function setStatus(id: string, status: 'pending' | 'approved' | 'blocked', tenantSlugs?: string[]) {
    setActing(id);
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', id, status, tenantSlugs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Status', data?.error || 'Şowsuz');
        return;
      }
      toastSuccess('Status üýtgedildi', status);
      await load();
    } finally {
      setActing(null);
    }
  }

  async function removeDevice(d: Device) {
    const ok = await confirmDialog({
      title: 'Enjamy poz',
      message: `«${d.hostname || d.id}» enjamy pozulsynmy? Tunnel we baglanyşyk ýitýär.`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    setActing(d.id);
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: d.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Pozmak', data?.error || 'Şowsuz');
        return;
      }
      toastSuccess('Pozuldy', d.hostname || d.id);
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate leading-tight">
            <Server className="h-6 w-6 text-indigo-400" />
            Enjamlar
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate leading-snug">
            Electron agent-leri tassyklamak, firma baglamak we duruzmak üçin ulanylýar.
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {pendingCount} garaşylýar
              </span>
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Täzele
        </Button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Ýüklenýär...</p>
      ) : devices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
          <Server className="h-9 w-9 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400">Enjam ýok</p>
          <p className="text-xs text-slate-500 mt-1">
            Electron ilkinji gezek açylanda şu ýerde görünýär
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const slugs = d.companySlugs?.length
              ? d.companySlugs
              : d.tenantSlug
                ? [d.tenantSlug]
                : [];
            const names = d.companyNames?.length
              ? d.companyNames
              : d.companyName
                ? [d.companyName]
                : [];
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white truncate">
                        {d.hostname || d.name || d.id}
                      </p>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                          statusStyle[d.status] || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                      {(() => {
                        const o = isDeviceOnline(d.lastSeenAt);
                        return (
                          <span className="inline-flex flex-col sm:flex-row sm:items-center gap-1">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md border font-medium inline-flex items-center gap-1 ${onlineStyle[o]}`}
                              title={d.lastSeenAt || 'lastSeen ýok'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  o === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                                }`}
                              />
                              {onlineLabel[o]}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatLastSync(d.lastSeenAt)}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs font-mono text-slate-500 break-all">{d.id}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 mt-1">
                      {d.osPlatform && (
                        <span className="inline-flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          {d.osPlatform} {d.osRelease || ''}
                        </span>
                      )}
                      {d.ramGb != null && (
                        <span className="inline-flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {d.ramGb} GB
                        </span>
                      )}
                      {d.ipAddress && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {d.ipAddress}
                        </span>
                      )}
                      {d.appVersion && <span>v{d.appVersion}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                      {slugs.length === 0 ? (
                        <span className="text-xs text-amber-400">Firma baglanmadyk</span>
                      ) : (
                        slugs.map((s, i) => (
                          <span
                            key={s}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 font-mono"
                          >
                            {names[i] || s} ({s})
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {(d.status === 'pending' || d.status === 'blocked' || slugs.length === 0) && (
                      <Button
                        size="sm"
                        onClick={() => openApprove(d)}
                        disabled={acting === d.id}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Tassykla / Firma
                      </Button>
                    )}
                    {d.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openApprove(d)}
                        disabled={acting === d.id}
                      >
                        <Building2 className="h-3.5 w-3.5 mr-1" />
                        Firmalary üýtget
                      </Button>
                    )}
                    {d.status !== 'blocked' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void setStatus(d.id, 'blocked')}
                        disabled={acting === d.id}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Duruz
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void removeDevice(d)}
                      disabled={acting === d.id}
                      className="text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Firma Sazlamalary"
                      onClick={() => openFirmaSazlamalary(d)}
                      disabled={acting === d.id}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve modal */}
      {approveId && (
        <ModalPortal open={Boolean(approveId)}>
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className={`bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl${modalAnimOn ? ' animate-in slide-in-from-bottom-4 duration-200' : ''}`}>
            <h2 className="text-lg font-bold text-white">Firma bagla we tassykla</h2>
            <p className="text-xs text-slate-400">
              Saýlanan firmalar üçin Electron tunnel we sync açylýar. BI hasabatlary şol firmalar bilen işleýär.
            </p>
            {tenants.length === 0 ? (
              <p className="text-sm text-amber-400">
                Katalogda firma ýok. Ilki «Ähli firmalar» ýa-da Electron üsti bilen firma dörediň.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {tenants.map((t) => (
                  <label
                    key={t.slug}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSlugs.includes(t.slug)}
                      onChange={() => toggleSlug(t.slug)}
                      className="rounded"
                    />
                    <span className="text-sm text-white">{t.name}</span>
                    <span className="text-[11px] font-mono text-slate-500 ml-auto">{t.slug}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setApproveId(null)}
              >
                Ýatyr
              </Button>
              <Button
                size="sm"
                loading={acting === approveId}
                disabled={selectedSlugs.length === 0}
                onClick={() => void submitApprove()}
              >
                Tassykla
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {settingsDevice && (
        <ModalPortal open={Boolean(settingsDevice)}>
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSettingsDevice(null)} />
          <div className={`relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-indigo-500/10${modalAnimOn ? ' animate-in slide-in-from-bottom-4 duration-200' : ''}`}>
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
              <h3 className="text-lg font-semibold text-white text-center">Firma Sazlamalary</h3>
              <p className="text-xs text-slate-400 text-center mt-1 truncate">
                {settingsDevice.name || settingsDevice.hostname || settingsDevice.id}
              </p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Başlatmak</p>
                <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  {([
                    ['autostart', 'Autostart (Windows bilen açylsyn)'],
                    ['startMinimized', 'Minimized başlat'],
                    ['trayMinimize', 'Ýapylanda tray-e düşsün'],
                    ['autoLogin', 'Awto login'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1.5">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean((settingsForm as any)[key])}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-600 accent-indigo-500"
                      />
                    </label>
                  ))}
                  {settingsForm.autoLogin && (
                    <label className="block pt-2 space-y-1.5">
                      <span className="text-xs text-slate-400">Awto login ulanyjy (firma işgäri)</span>
                      <select
                        value={settingsForm.autoLoginUsername}
                        onChange={(e) =>
                          setSettingsForm((f) => ({ ...f, autoLoginUsername: e.target.value }))
                        }
                        className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                      >
                        <option value="">— Saýlaň —</option>
                        {staffOpts.map((s) => (
                          <option key={s.username} value={s.username}>
                            {s.fullName} ({s.username})
                            {s.tenantSlug ? ` · ${s.tenantSlug}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500">
                        Electron açylanda şu ulanyjy bilen awto giriş (parol Electron-da saklanan bolmaly).
                      </p>
                    </label>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Sync</p>
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1">
                    <span>Auto sync</span>
                    <input type="checkbox" checked={settingsForm.autoSync}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, autoSync: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-600 accent-indigo-500" />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1">
                    <span>Offline queue</span>
                    <input type="checkbox" checked={(settingsForm as any).offlineQueue !== false}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, offlineQueue: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-600 accent-indigo-500" />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1">
                    <span>Sync notification</span>
                    <input type="checkbox" checked={(settingsForm as any).notifyOnSync !== false}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, notifyOnSync: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-600 accent-indigo-500" />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1">
                    <span>Sync interval</span>
                    <select
                      value={String(settingsForm.syncIntervalSec ?? 30)}
                      onChange={(e) =>
                        setSettingsForm((f) => ({
                          ...f,
                          syncIntervalSec: Number(e.target.value),
                        }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    >
                      <option value="15">Her 15 sekunt</option>
                      <option value="30">Her 30 sekunt</option>
                      <option value="60">Her 1 minut</option>
                      <option value="120">Her 2 minut</option>
                      <option value="300">Her 5 minut</option>
                      <option value="0">Diňe el bilen</option>
                    </select>
                  </label>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Howpsuzlyk</p>
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-200 py-1">
                    <span className="min-w-0">
                      Auto sign-out (min)
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Admin girişde işsizlik timer — 0 = öçürilen
                      </span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={480}
                      value={settingsForm.autoSignOutMin}
                      onChange={(e) =>
                        setSettingsForm((f) => ({
                          ...f,
                          autoSignOutMin: Math.max(0, Math.min(480, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Remote amallar</p>
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cmdActing === 'restart'}
                    disabled={!!cmdActing}
                    onClick={() => void sendDeviceCommand('restart')}
                  >
                    Restart Electron
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cmdActing === 'check_update'}
                    disabled={!!cmdActing}
                    onClick={() => void sendDeviceCommand('check_update')}
                  >
                    Check update
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Electron açyk we device-events ONLINE bolmaly. Update bar bolsa Electron-da modal çykýar.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" loading={settingsSaving} onClick={saveFirmaSazlamalary}>
                  Ýatda sakla
                </Button>
                <Button variant="ghost" onClick={() => setSettingsDevice(null)}>
                  Ýatyr
                </Button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
}
