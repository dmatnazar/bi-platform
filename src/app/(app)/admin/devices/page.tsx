'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Trash2,
  RefreshCw,
  Cpu,
  HardDrive,
  Globe,
  Building2,
  Search,
  ShieldCheck,
  Power,
  Copy,
  Check,
  Info,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import type { Device, DeviceStatus } from '@/lib/types';

interface CompanyOption {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assignSlugs, setAssignSlugs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanySlug, setNewCompanySlug] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    setApiHint(null);
    try {
      const res = await fetch('/api/admin/devices');
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Enjamlary ýükläp bolmady';
        setApiError(msg);
        setApiHint(data.debug?.hint || null);
        setGatewayUrl(data.debug?.gatewayUrl || '');
        toastError(msg);
        setDevices([]);
        return;
      }
      setDevices(data.devices || []);
      setCompanies(data.companies || []);
      setGatewayUrl(data.debug?.gatewayUrl || '');
    } catch {
      toastError('Serwere baglanyp bolmady');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openApproveModal = (dev: Device) => {
    setSelectedDevice(dev);
    setAssignName(dev.name || dev.hostname || 'Client Server');
    const existingSlug = dev.tenantSlug || dev.companySlugs?.[0] || companies[0]?.slug || '';
    setAssignSlugs(existingSlug ? [existingSlug] : []);
    setShowNewCompany(false);
    setNewCompanyName('');
    setNewCompanySlug('');
    setModalOpen(true);
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !newCompanySlug.trim()) return;
    setCreatingCompany(true);
    try {
      const res = await fetch('/api/admin/tenant-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName.trim(), slug: newCompanySlug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Kompaniýa döretmek bolmady');
        return;
      }
      toastSuccess('Täze kompaniýa dörediňiz!');
      setCompanies((prev) => [...prev, data.tenant]);
      setAssignSlugs((prev) => [...prev, data.tenant.slug]);
      setShowNewCompany(false);
      setNewCompanyName('');
      setNewCompanySlug('');
      fetchDevices();
    } catch {
      toastError('Ýalňyşlyk ýüze çykdy');
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDevice || assignSlugs.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          deviceId: selectedDevice.id,
          tenantSlugs: assignSlugs,
          name: assignName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Tassyklap bolmady');
        return;
      }
      toastSuccess('Enjam üstünlikli tassyklandy we kärhanalar baglandy!');
      setModalOpen(false);
      fetchDevices();
    } catch {
      toastError('Ýalňyşlyk ýüze çykdy');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (dev: Device) => {
    const nextStatus: DeviceStatus = dev.status === 'approved' ? 'blocked' : 'approved';
    const actionLabel = nextStatus === 'approved' ? 'açmak (işletmek)' : 'petiklemek';

    const confirmed = await confirmDialog({
      title: `Enjamy ${actionLabel}`,
      message: `"${dev.name || dev.hostname}" enjamyny ${actionLabel} isleýärsiňizmi?`,
      confirmLabel: nextStatus === 'approved' ? 'Açmak' : 'Petiklemek',
      danger: nextStatus === 'blocked',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-status',
          deviceId: dev.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Ýagdaýy üýtgedip bolmady');
        return;
      }
      toastSuccess(`Enjam ${nextStatus === 'approved' ? 'açyldy' : 'petiklendi'}`);
      fetchDevices();
    } catch {
      toastError('Ýalňyşlyk ýüze çykdy');
    }
  };

  const handleDelete = async (dev: Device) => {
    const confirmed = await confirmDialog({
      title: 'Enjamy pozmak',
      message: `"${dev.name || dev.hostname}" enjamyny doly pozmak isleýärsiňizmi? Bu enjam täzeden gurnalýança işlemez.`,
      confirmLabel: 'Pozmak',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          deviceId: dev.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Pozup bolmady');
        return;
      }
      toastSuccess('Enjam pozuldy');
      fetchDevices();
    } catch {
      toastError('Ýalňyşlyk ýüze çykdy');
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.name?.toLowerCase().includes(q) ||
        d.hostname?.toLowerCase().includes(q) ||
        d.companyName?.toLowerCase().includes(q) ||
        d.companyNames?.some((n) => n.toLowerCase().includes(q)) ||
        d.tenantSlug?.toLowerCase().includes(q) ||
        d.companySlugs?.some((s) => s.toLowerCase().includes(q)) ||
        d.ipAddress?.toLowerCase().includes(q) ||
        d.macAddress?.toLowerCase().includes(q)
      );
    });
  }, [devices, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: devices.length,
      approved: devices.filter((d) => d.status === 'approved').length,
      pending: devices.filter((d) => d.status === 'pending').length,
      blocked: devices.filter((d) => d.status === 'blocked').length,
    };
  }, [devices]);

  const isDeviceOnline = (lastSeenAt: string) => {
    if (!lastSeenAt) return false;
    const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
    return diff < 90; // Active within last 90 seconds
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Server className="h-7 w-7 text-indigo-400" />
            Enjamlar we Serwerler (Devices)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Kärhanalaryň ofislerinde gurnalan Electron Desktop agentlerini tassyklamak we dolandyrmak.
          </p>
          {gatewayUrl && (
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Gateway: {gatewayUrl}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Täzelemek
          </Button>
        </div>
      </div>

      {/* Error / Hint Banner */}
      {apiError && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{apiError}</span>
          </div>
          {apiHint && (
            <p className="text-xs text-amber-200/80 ml-6">{apiHint}</p>
          )}
          <div className="ml-6">
            <Link href="/admin/settings" className="text-xs text-amber-300 underline hover:text-amber-200">
              Sazlamalar sahypasyna gitmek →
            </Link>
          </div>
        </div>
      )}

      {/* Empty State Help */}
      {!apiError && devices.length === 0 && !loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-slate-300 font-medium">Enjamlar görünmeýär</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Electron Desktop programmany ilkinji gezek run edeniňizde, enjam awtomatiki gurnalýar
                we <span className="text-amber-300">"Administrator tassyklamagyna garaşylýar"</span> ýagdaýynda
                durýar. Bi-platform şu wagtky VPS Gateway-den enjamlary görkezýär:
              </p>
              <ul className="text-xs text-slate-400 list-disc list-inside space-y-1 ml-1">
                <li>BI Platform Settings ({gatewayUrl || 'localhost:4000'}) üsti bilen giriş bolsa</li>
                <li>Electron-da şol bir VPS Gateway-iň Secret-iňiň duran bolsa</li>
                <li>Enjam tassyklananda (status = approved) şu sahypada görünýär</li>
              </ul>
              <p className="text-xs text-slate-400">
                <Link href="/admin/settings" className="text-indigo-300 underline hover:text-indigo-200">
                  VPS Gateway sazlamalaryny barlamak
                </Link>
                {' '}— Electron we BI Platform üçin aýry sazlamalar gerek.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Jemi Enjamlar</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/80 text-slate-300">
            <Server className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-400 uppercase tracking-wider font-medium">Tassyklanan (Active)</p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.approved}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-900/40 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/20 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400 uppercase tracking-wider font-medium">Tassyklama Garaşýan</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{stats.pending}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-900/40 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-red-900/40 bg-red-950/20 flex items-center justify-between">
          <div>
            <p className="text-xs text-red-400 uppercase tracking-wider font-medium">Petiklenen (Blocked)</p>
            <p className="text-2xl font-bold text-red-300 mt-1">{stats.blocked}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-red-900/40 text-red-400">
            <Ban className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Enjam, host, firma, IP gözle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 shrink-0">Ýagdaýy:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Ählisi ({devices.length})</option>
            <option value="approved">Tassyklanan ({stats.approved})</option>
            <option value="pending">Garaşýan ({stats.pending})</option>
            <option value="blocked">Petiklenen ({stats.blocked})</option>
          </select>
        </div>
      </div>

      {/* Devices List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {loading && devices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-3" />
            Enjamlar ýüklenýär...
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Server className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-300">Enjam tapylmady</p>
            <p className="text-xs text-slate-500 mt-1">
              Kompýuterde täze Electron gurnalanda bu ýere awtomatiki düşer.
            </p>
          </div>
        ) : isMobile ? (
          /* Mobile Card View */
          <div className="p-3 space-y-3">
            {filteredDevices.map((dev) => {
              const online = isDeviceOnline(dev.lastSeenAt);
              const statusBadge = dev.status === 'approved' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/60 text-[11px] font-medium text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Tassyklanan
                </span>
              ) : dev.status === 'pending' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-800/60 text-[11px] font-medium text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Garaşýar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/70 border border-red-800/60 text-[11px] font-medium text-red-300">
                  <Ban className="h-3 w-3" />
                  Petiklenen
                </span>
              );

              return (
                <div key={dev.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        dev.status === 'approved'
                          ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/50'
                          : dev.status === 'pending'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                          : 'bg-red-950/60 text-red-400 border border-red-800/50'
                      }`}>
                        <Server className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {dev.name || dev.hostname || 'Client Server'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          v{dev.appVersion || '1.0.0'}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                      online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80' : 'bg-slate-600'
                    }`} title={online ? 'Online' : 'Offline'} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Host</span>
                      <span className="text-slate-200 font-mono truncate">{dev.hostname}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">IP</span>
                      <span className="text-slate-200 font-mono truncate">{dev.ipAddress || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Kärhana</span>
                      {dev.companyName || dev.tenantSlug ? (
                        <span className="inline-flex items-center gap-1 text-slate-200">
                          <Building2 className="h-3 w-3 text-indigo-400 shrink-0" />
                          {dev.companyName || dev.tenantSlug}
                        </span>
                      ) : (
                        <span className="text-amber-400/90 italic flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Baglanmadyk
                        </span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Aýratynlyklary</span>
                      <span className="text-slate-300">
                        {dev.cpuModel || 'CPU Model'} • RAM: {dev.ramGb ? `${dev.ramGb} GB` : '—'} • {dev.osPlatform} {dev.osRelease}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      {statusBadge}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {dev.status === 'pending' || !dev.tenantSlug ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => openApproveModal(dev)}
                          className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Tassyklamak
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openApproveModal(dev)}
                          className="text-xs px-2.5 py-1.5 text-slate-300 hover:text-white"
                          title="Kärhanany / Adyny üýtgetmek"
                        >
                          Üýtgetmek
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleStatus(dev)}
                        className={`text-xs px-2 py-1.5 ${
                          dev.status === 'approved'
                            ? 'text-amber-400 hover:bg-amber-950/40 border-amber-900/40'
                            : 'text-emerald-400 hover:bg-emerald-950/40 border-emerald-900/40'
                        }`}
                        title={dev.status === 'approved' ? 'Enjamy petiklemek' : 'Enjamy açmak'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDelete(dev)}
                        className="text-xs px-2 py-1.5 text-red-400 hover:bg-red-950/40 border-red-900/40"
                        title="Pozmak"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Enjam & Host</th>
                  <th className="px-4 py-3.5">Aýratynlyklary</th>
                  <th className="px-4 py-3.5">Tor (IP / MAC)</th>
                  <th className="px-4 py-3.5">Baglanan Kärhana</th>
                  <th className="px-4 py-3.5">Ýagdaýy</th>
                  <th className="px-4 py-3.5 text-right">Hereketler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDevices.map((dev) => {
                  const online = isDeviceOnline(dev.lastSeenAt);
                  return (
                    <tr key={dev.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Host */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 p-2 rounded-lg ${
                            dev.status === 'approved'
                              ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/50'
                              : dev.status === 'pending'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                              : 'bg-red-950/60 text-red-400 border border-red-800/50'
                          }`}>
                            <Server className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {dev.name || dev.hostname || 'Client Server'}
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                v{dev.appVersion || '1.0.0'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                              <span>Host: {dev.hostname}</span>
                              <span>•</span>
                              <button
                                onClick={() => copyToClipboard(dev.id, dev.id)}
                                className="text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                title="Device ID göçürmek"
                              >
                                {dev.id.slice(0, 10)}...
                                {copiedId === dev.id ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Hardware specs */}
                      <td className="px-4 py-3.5 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-slate-500" />
                          <span className="truncate max-w-[200px]" title={dev.cpuModel}>
                            {dev.cpuModel || 'CPU Model'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                          <span>RAM: {dev.ramGb ? `${dev.ramGb} GB` : '—'}</span>
                          <span>•</span>
                          <span>{dev.osPlatform} {dev.osRelease}</span>
                        </div>
                      </td>

                      {/* Network specs */}
                      <td className="px-4 py-3.5 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Globe className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-slate-200">{dev.ipAddress || '—'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          MAC: {dev.macAddress || '—'}
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3.5">
                        {dev.companyName || dev.tenantSlug ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-200">
                            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                            <span>{dev.companyName || dev.tenantSlug}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-400/90 italic flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Baglanmadyk
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 space-y-1">
                        <div className="flex items-center gap-2">
                          {dev.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/60 text-[11px] font-medium text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Tassyklanan
                            </span>
                          ) : dev.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-800/60 text-[11px] font-medium text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              Garaşýar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/70 border border-red-800/60 text-[11px] font-medium text-red-300">
                              <Ban className="h-3 w-3" />
                              Petiklenen
                            </span>
                          )}

                          {/* Live heartbeat status */}
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80' : 'bg-slate-600'
                            }`}
                            title={online ? 'Online (Agent bagly)' : 'Offline'}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {online ? 'Häzir online' : `Soňky: ${dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleTimeString() : '—'}`}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {dev.status === 'pending' || !dev.tenantSlug ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => openApproveModal(dev)}
                              className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Tassyklamak
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openApproveModal(dev)}
                              className="text-xs px-2.5 py-1 text-slate-300 hover:text-white"
                              title="Kärhanany / Adyny üýtgetmek"
                            >
                              Üýtgetmek
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleToggleStatus(dev)}
                            className={`text-xs px-2 py-1 ${
                              dev.status === 'approved'
                                ? 'text-amber-400 hover:bg-amber-950/40 border-amber-900/40'
                                : 'text-emerald-400 hover:bg-emerald-950/40 border-emerald-900/40'
                            }`}
                            title={dev.status === 'approved' ? 'Enjamy petiklemek' : 'Enjamy açmak'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDelete(dev)}
                            className="text-xs px-2 py-1 text-red-400 hover:bg-red-950/40 border-red-900/40"
                            title="Pozmak"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tassyklamak we Kärhana Baglamak */}
      {modalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Enjamy Tassyklamak & Baglamak
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Enjam Ady (Bellik):</label>
                <input
                  type="text"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  placeholder="mysal: Tudana Serwer 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Kärhanalar (Birnäçe saýlap bolýar):</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-700 rounded-lg p-2.5 bg-slate-950">
                  {companies.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Kärhana tapylmady</p>
                  ) : (
                    companies.map((c) => {
                      const checked = assignSlugs.includes(c.slug);
                      const toggle = () => {
                        setAssignSlugs((prev) =>
                          checked ? prev.filter((s) => s !== c.slug) : [...prev, c.slug]
                        );
                      };
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                            checked ? 'bg-indigo-950/50 border border-indigo-800/50' : 'hover:bg-slate-800/50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={toggle}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                          <span className="text-sm text-slate-200 flex-1">{c.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">({c.slug})</span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* New Company Button */}
                {!showNewCompany && (
                  <button
                    type="button"
                    onClick={() => setShowNewCompany(true)}
                    className="mt-2 w-full py-2 px-3 rounded-lg border border-dashed border-slate-600 text-xs text-slate-300 hover:border-indigo-500 hover:text-indigo-300 hover:bg-indigo-950/20 transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Taze kompaniýa
                  </button>
                )}

                {/* New Company Form */}
                {showNewCompany && (
                  <div className="mt-2 p-3 rounded-lg border border-slate-700 bg-slate-950 space-y-2">
                    <p className="text-xs text-slate-300 font-medium">Taze kompaniýa döretmek</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Ady</label>
                        <input
                          type="text"
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          placeholder="Kompaniýa ady"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Slug</label>
                        <input
                          type="text"
                          value={newCompanySlug}
                          onChange={(e) => setNewCompanySlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                          placeholder="slug"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreateCompany}
                        disabled={creatingCompany || !newCompanyName.trim() || !newCompanySlug.trim()}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {creatingCompany ? 'Döredilýär...' : 'Döret'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCompany(false); setNewCompanyName(''); setNewCompanySlug(''); }}
                        className="py-1.5 px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition"
                      >
                        Ýatyr
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-1">
                  Saýlanan kärhanalar bu enjama birnäçe kompaniýa maglumatlaryny we sinhronizasiýasyny işleder.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <div><strong className="text-slate-300">Host:</strong> {selectedDevice.hostname}</div>
                <div><strong className="text-slate-300">OS:</strong> {selectedDevice.osPlatform} {selectedDevice.osRelease}</div>
                <div><strong className="text-slate-300">IP:</strong> {selectedDevice.ipAddress || '—'}</div>
                <div><strong className="text-slate-300">Device ID:</strong> <span className="font-mono text-[11px] text-slate-400">{selectedDevice.id}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Ýatyrmak
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                disabled={saving || assignSlugs.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {saving ? 'Ýazylýar...' : 'Tassyklamak & Baglamak'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
