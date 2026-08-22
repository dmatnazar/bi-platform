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
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

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

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export default function DevicesPage() {
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
    syncIntervalMin: 5,
    autoLogin: false,
    trayMinimize: true,
    notifyOnSync: true,
    offlineQueue: true,
    theme: 'dark' as 'dark' | 'light' | 'system',
    language: 'tk',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function openFirmaSazlamalary(d: Device) {
    setSettingsDevice(d);
    setSettingsForm({
      autostart: false,
      startMinimized: false,
      autoSync: true,
      syncIntervalMin: 5,
      autoLogin: false,
      trayMinimize: true,
      notifyOnSync: true,
      offlineQueue: true,
      theme: 'dark',
      language: 'tk',
    });
    try {
      const res = await fetch(
        `/api/device-settings?deviceId=${encodeURIComponent(d.id)}&tenantSlug=${encodeURIComponent(d.tenantSlug || '')}`
      );
      const data = await res.json();
      const row = (data.settings || [])[0];
      if (row?.settings) {
        setSettingsForm((f) => ({
          ...f,
          autostart: Boolean(row.settings.autostart),
          startMinimized: Boolean(row.settings.startMinimized),
          autoSync: row.settings.autoSync !== false,
          syncIntervalMin: Number(row.settings.syncIntervalMin) || 5,
          autoLogin: Boolean(row.settings.autoLogin),
          trayMinimize: row.settings.trayMinimize !== false,
          notifyOnSync: row.settings.notifyOnSync !== false,
          offlineQueue: row.settings.offlineQueue !== false,
          theme: (row.settings.theme as any) || 'dark',
          language: String(row.settings.language || 'tk'),
        }));
      }
    } catch {
      /* defaults */
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="h-6 w-6 text-indigo-400" />
            Enjamlar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Electron agent-leri tassyklamak, firma baglamak we petiklemek
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
                        Petikle
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
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
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
          <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-indigo-500/10 animate-in slide-in-from-bottom-4 duration-200">
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
                    <span>Sync interval (min)</span>
                    <input type="number" min={1} max={1440} value={settingsForm.syncIntervalMin}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, syncIntervalMin: Math.max(1, Number(e.target.value) || 5) }))}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white" />
                  </label>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Görnüş</p>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <label className="text-xs text-slate-400 space-y-1.5 block">
                    <span>Tema</span>
                    <select value={(settingsForm as any).theme || 'dark'}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, theme: e.target.value as any }))}
                      className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white">
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-400 space-y-1.5 block">
                    <span>Dil</span>
                    <select value={(settingsForm as any).language || 'tk'}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white">
                      <option value="tk">Türkmen</option>
                      <option value="ru">Русский</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </div>
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
