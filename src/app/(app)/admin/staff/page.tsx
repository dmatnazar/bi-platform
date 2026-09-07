'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Check, X, Eye, EyeOff, CloudUpload, Users, UserPlus, Share2, Copy, QrCode, List, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { toastSuccess, toastError, toastInfo } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { useModalAnimations } from '@/lib/use-modal-animations';

interface StaffRow {
  id: string;
  fullName: string;
  username: string;
  role: string;
  phone?: string;
  email?: string;
  active: boolean;
  tenantSlug: string;
  tenantSlugs?: string[];
  passwordReveal?: string;
  updatedAt?: string;
  companyName: string;
}

interface Reg {
  id: string;
  companyName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  status: string;
  createdAt: string;
}

function phoneLocal(p?: string) {
  if (!p) return '';
  return p.replace(/^\+?993/, '').replace(/\D/g, '').slice(0, 8);
}

export default function StaffPage() {
  const modalAnimOn = useModalAnimations();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  type StaffForm = {
    fullName: string;
    username: string;
    password: string;
    role: string;
    phoneLocal: string;
    email: string;
    active: boolean;
    tenantSlugs: string[];
  };

  const [form, setForm] = useState<StaffForm>({
    fullName: '',
    username: '',
    password: '',
    role: 'viewer',
    phoneLocal: '',
    email: '',
    active: true,
    tenantSlugs: [],
  });
  const [companies, setCompanies] = useState<{ slug: string; name: string }[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [meUsername, setMeUsername] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string>('viewer');
  const [meTenantSlugs, setMeTenantSlugs] = useState<string[]>([]);
  const [meIsSuper, setMeIsSuper] = useState(false);
  const [canInvite, setCanInvite] = useState(false);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteSlugs, setInviteSlugs] = useState<string[]>([]);
  const [inviteSeats, setInviteSeats] = useState('1');
  const [inviteTtlMinutes, setInviteTtlMinutes] = useState('3');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    token: string;
    url: string;
    expiresInSec: number;
    seats: number;
    role: string;
    tenantSlugs: string[];
  } | null>(null);
  const [inviteLeft, setInviteLeft] = useState(0);
  const [invitesListOpen, setInvitesListOpen] = useState(false);
  type InviteRow = {
    token: string;
    url: string;
    role: string;
    tenantSlugs: string[];
    seats: number;
    usedSeats: number;
    remainingSeats: number;
    expiresAt: string;
    expiresInSec: number;
    expired: boolean;
    active: boolean;
    createdAt: string;
  };
  const [invitesList, setInvitesList] = useState<InviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteActionToken, setInviteActionToken] = useState<string | null>(null);
  const [topUpMinutes, setTopUpMinutes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        if (!u) return;
        if (u.id) setMeId(u.id);
        if (u.username) setMeUsername(u.username);
        if (u.role) setMeRole(String(u.role));
        setMeIsSuper(Boolean(u.isSuperAdmin || u.role === 'super_admin'));
        const slugs = [
          ...(Array.isArray(u.tenantSlugs) ? u.tenantSlugs : []),
          u.companySlug || '',
        ]
          .map((s: string) => String(s || '').trim())
          .filter(Boolean);
        setMeTenantSlugs(Array.from(new Set(slugs)));
        // invite_staff: super always; admin/editor default true (server still enforces)
        const role = String(u.role || '');
        setCanInvite(
          Boolean(u.isSuperAdmin || role === 'super_admin' || role === 'admin' || role === 'editor')
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!inviteResult || inviteLeft <= 0) return;
    const tmr = setInterval(() => setInviteLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tmr);
  }, [inviteResult, inviteLeft > 0]);

  const roleOptions = useMemo(() => {
    if (meIsSuper) {
      return [
        { value: 'viewer', label: 'Viewer' },
        { value: 'editor', label: 'Editor' },
        { value: 'admin', label: 'Admin' },
        { value: 'super_admin', label: 'Super admin' },
      ];
    }
    // admin: viewer + editor
    if (meRole === 'admin') {
      return [
        { value: 'viewer', label: 'Viewer' },
        { value: 'editor', label: 'Editor' },
      ];
    }
    // editor: only viewer
    return [{ value: 'viewer', label: 'Viewer' }];
  }, [meRole, meIsSuper]);

  const visibleCompanies = useMemo(() => {
    if (meIsSuper) return companies;
    // admin + editor: only own firms
    if (!meTenantSlugs.length) return [];
    return companies.filter((c) => meTenantSlugs.includes(c.slug));
  }, [companies, meIsSuper, meTenantSlugs]);


  function openInvite() {
    setInviteRole(roleOptions[0]?.value || 'viewer');
    setInviteSlugs(visibleCompanies[0]?.slug ? [visibleCompanies[0].slug] : []);
    setInviteSeats('1');
    setInviteTtlMinutes('3');
    setInviteResult(null);
    setInviteLeft(0);
    setInviteOpen(true);
  }

  async function createInvite() {
    const seats = Math.max(1, Math.min(50, parseInt(inviteSeats, 10) || 1));
    const ttlMinutes = Math.max(1, Math.min(180, parseInt(inviteTtlMinutes, 10) || seats * 3));
    if (!inviteSlugs.length) {
      toastError('Firma saýlaň');
      return;
    }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlugs: inviteSlugs,
          role: inviteRole,
          seats,
          ttlMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Invite şowsuz', data.error);
        return;
      }
      setInviteResult({
        token: data.token,
        url: data.url,
        expiresInSec: data.expiresInSec,
        seats: data.seats,
        role: data.role,
        tenantSlugs: data.tenantSlugs,
      });
      setInviteLeft(data.expiresInSec || ttlMinutes * 60);
      toastSuccess('Invite döredildi', `${seats} işgär · ${Math.floor((data.expiresInSec || 0) / 60)} min möhlet`);
    } catch (e: any) {
      toastError('Invite şowsuz', String(e));
    } finally {
      setInviteBusy(false);
    }
  }

  async function shareInvite() {
    if (!inviteResult?.url) return;
    const text = `BI Platform — işgär invite\n${inviteResult.url}\nMöhlet: ${Math.floor(inviteLeft / 60)}:${String(inviteLeft % 60).padStart(2, '0')}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'BI Platform invite',
          text,
          url: inviteResult.url,
        });
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    try {
      await navigator.clipboard.writeText(inviteResult.url);
      toastInfo('Link göçürildi', 'Clipboard — islän messengeriňize goýuň');
    } catch {
      toastInfo('Link', inviteResult.url);
    }
  }

  async function copyInviteLink() {
    if (!inviteResult?.url) return;
    try {
      await navigator.clipboard.writeText(inviteResult.url);
      toastSuccess('Göçürildi', 'Invite link clipboard-da');
    } catch {
      toastError('Göçürip bolmady');
    }
  }

  function fmtInviteLeft(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function loadInvitesList() {
    setInvitesLoading(true);
    try {
      const res = await fetch('/api/staff/invite');
      const data = await res.json();
      if (!res.ok) {
        toastError('Invite sanawy', data.error);
        return;
      }
      setInvitesList(Array.isArray(data.invites) ? data.invites : []);
    } catch (e: any) {
      toastError('Invite sanawy', String(e));
    } finally {
      setInvitesLoading(false);
    }
  }

  function openInvitesList() {
    setInvitesListOpen(true);
    void loadInvitesList();
  }

  async function downloadInviteQr(url: string, token: string) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&format=png&data=${encodeURIComponent(url)}`;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = `invite-qr-${token.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
      toastSuccess('QR ýüklendi', 'PNG faýl');
    } catch (e: any) {
      // fallback: open in new tab
      window.open(qrUrl, '_blank');
      toastInfo('QR', 'Täze tab-da açyldy — saklaň');
    }
  }

  async function deleteInvite(token: string) {
    const ok = await confirmDialog({
      title: 'Invite pozulsynmy?',
      message: 'Link we QR indi işlemeginden galýar.',
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    setInviteActionToken(token);
    try {
      const res = await fetch(`/api/staff/invite?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Pozup bolmady', data.error);
        return;
      }
      toastSuccess('Invite pozuldy');
      if (inviteResult?.token === token) {
        setInviteResult(null);
        setInviteLeft(0);
      }
      await loadInvitesList();
    } finally {
      setInviteActionToken(null);
    }
  }

  async function topUpInvite(token: string) {
    const mins = Math.max(1, Math.min(180, parseInt(topUpMinutes[token] || '10', 10) || 10));
    setInviteActionToken(token);
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, addMinutes: mins }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Uzatmak şowsuz', data.error);
        return;
      }
      toastSuccess('Möhlet uzadyldy', `+${mins} min · galýan ${fmtInviteLeft(data.expiresInSec || 0)}`);
      if (inviteResult?.token === token && data.invite) {
        setInviteLeft(data.expiresInSec || 0);
        setInviteResult((prev) =>
          prev
            ? { ...prev, expiresInSec: data.expiresInSec, url: data.invite.url || prev.url }
            : prev
        );
      }
      await loadInvitesList();
    } finally {
      setInviteActionToken(null);
    }
  }

  function reopenInviteInModal(row: InviteRow) {
    setInviteResult({
      token: row.token,
      url: row.url,
      expiresInSec: row.expiresInSec,
      seats: row.remainingSeats || row.seats,
      role: row.role,
      tenantSlugs: row.tenantSlugs,
    });
    setInviteLeft(row.expiresInSec || 0);
    setInvitesListOpen(false);
    setInviteOpen(true);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetch('/api/staff').then((x) => x.json()),
        fetch('/api/registrations?status=pending').then((x) => x.json()),
      ]);
      const list = (s.staff || []).map((row: StaffRow) => ({
        ...row,
        companyName: row.companyName || row.tenantSlug || '',
      }));
      const allowedRoles =
        meIsSuper
          ? null
          : meRole === 'admin' || meRole === 'editor'
            ? new Set(['viewer', 'editor'])
            : new Set<string>();
      setStaff(
        list.filter((row: StaffRow) => {
          if (meId && row.id === meId) return false;
          if (allowedRoles && !allowedRoles.has(String(row.role || '').toLowerCase())) {
            return false;
          }
          return true;
        })
      );
      setRegs(r.registrations || []);
    } finally {
      setLoading(false);
    }
  }, [meId, meUsername, meRole, meIsSuper]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => {
        const list = (d.companies || []).map((c: { slug: string; name: string }) => ({
          slug: c.slug,
          name: c.name,
        }));
        setCompanies(list);
      })
      .catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      fullName: '',
      username: '',
      password: '',
      role: 'viewer',
      phoneLocal: '',
      email: '',
      active: true,
      tenantSlugs: (visibleCompanies[0]?.slug
        ? [visibleCompanies[0].slug]
        : meTenantSlugs[0]
          ? [meTenantSlugs[0]]
          : []),
    });
    setShowPw(false);
    setError('');
    setModal(true);
  }

  function openEdit(row: StaffRow) {
    // Editor may only open/edit viewer staff
    if (meRole === 'editor' && String(row.role || '').toLowerCase() !== 'viewer') {
      toastError('Rugsat ýok', 'Editor diňe viewer işgärleri üýtgedip bilýär');
      return;
    }
    // Admin may not open admin / super_admin
    if (
      meRole === 'admin' &&
      !meIsSuper &&
      ['admin', 'super_admin'].includes(String(row.role || '').toLowerCase())
    ) {
      toastError('Rugsat ýok', 'Admin diňe viewer we editor işgärleri üýtgedip bilýär');
      return;
    }
    setEditing(row);
    setForm({
      fullName: row.fullName,
      username: row.username,
      password: row.passwordReveal || '',
      role: (() => {
        const allowed = roleOptions.map((o) => o.value);
        if (allowed.includes(row.role)) return row.role;
        return 'viewer';
      })(),
      phoneLocal: phoneLocal(row.phone),
      email: row.email || '',
      active: row.active,
      tenantSlugs: Array.isArray(row.tenantSlugs) && row.tenantSlugs.length ? row.tenantSlugs : (row.tenantSlug ? [row.tenantSlug] : []),
    });
    setShowPw(false);
    setError('');
    setModal(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const phone = form.phoneLocal
        ? `+993${form.phoneLocal.replace(/\D/g, '').slice(0, 8)}`
        : undefined;
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          fullName: form.fullName,
          username: form.username,
          password: form.password || undefined,
          role: form.role,
          phone,
          email: form.email,
          active: form.active,
          tenantSlugs: form.tenantSlugs.length ? form.tenantSlugs : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Saklamak şowsuz');
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      setModal(false);
      if (data.warning) {
        toastInfo(editing ? 'Işgär üýtgedildi' : 'Işgär goşuldy', String(data.warning));
      } else {
        toastSuccess(
          editing ? 'Işgär üýtgedildi' : 'Işgär goşuldy',
          'VPS bilen sync edildi · Electron awto-çekip biler'
        );
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: StaffRow) {
    const ok = await confirmDialog({
      title: 'Işgäri poz',
      message: `"${row.fullName}" (@${row.username}) pozulsynmy?\nBu amal VPS-e hem ýazylar.`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(
      `/api/staff?id=${encodeURIComponent(row.id)}&username=${encodeURIComponent(row.username)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (!res.ok) {
      toastError('Pozmak şowsuz', data.error);
      return;
    }
    toastSuccess('Pozuldy', 'VPS bilen sync edildi');
    await load();
  }

  async function resolveReg(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, role: 'viewer' }),
      });
      if (!res.ok) {
        toastError('Amal şowsuz');
        return;
      }
      toastSuccess(action === 'approve' ? 'Tassyklanyldy' : 'Ret edildi');
      await load();
    } finally {
      setActing(null);
    }
  }

  async function manualSync() {
    setSyncing(true);
    try {
      await load();
      toastInfo('Täzelendi', 'VPS catalog-dan işgärler çekildi');
    } finally {
      setSyncing(false);
    }
  }

  const columns = useMemo<DataTableColumn<StaffRow>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Ady',
        mobilePrimary: true,
        accessor: (r) => r.fullName,
        cell: (r) => <span className="font-medium text-white">{r.fullName}</span>,
      },
      {
        id: 'username',
        header: 'Login',
        accessor: (r) => r.username,
        cell: (r) => <span className="text-slate-400">@{r.username}</span>,
      },
      {
        id: 'company',
        header: 'Firma',
        accessor: (r) => r.companyName || r.tenantSlug || '',
        cell: (r) => (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
            {r.companyName || r.tenantSlug || '—'}
          </span>
        ),
      },
      { id: 'phone', header: 'Telefon', accessor: (r) => r.phone || '' },
      { id: 'email', header: 'Email', accessor: (r) => r.email || '' },
      {
        id: 'role',
        header: 'Rol',
        accessor: (r) => r.role,
        cell: (r) => (
          <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300">
            {r.role}
          </span>
        ),
      },
      {
        id: 'active',
        header: 'Status',
        accessor: (r) => (r.active ? 1 : 0),
        cell: (r) => (
          <span className={r.active ? 'text-emerald-400 text-xs' : 'text-slate-500 text-xs'}>
            {r.active ? 'Işjeň' : 'Öçürilen'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Amal',
        sortable: false,
        accessor: () => '',
        cell: (r) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => openEdit(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => remove(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-2xl font-bold text-white truncate leading-tight">Işgärler</h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate leading-snug">VPS arkaly Electron bilen sync</p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={manualSync} loading={syncing || loading}>
            <CloudUpload className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Sync</span>
          </Button>
          {canInvite && (
            <>
              <Button variant="secondary" size="sm" onClick={openInvite}>
                <UserPlus className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Invite</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={openInvitesList}>
                <List className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Invites</span>
              </Button>
            </>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Täze işgär</span>
          </Button>
        </div>
      </div>

      {regs.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-amber-200">
            Hasaba alyş islegleri ({regs.length})
          </h2>
          {regs.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-white font-medium">
                  {r.firstName} {r.lastName}{' '}
                  <span className="text-slate-500">@{r.username}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {r.email} · {r.phone} · {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={acting === r.id} onClick={() => resolveReg(r.id, 'approve')}>
                  <Check className="h-4 w-4" />
                  Tassykla
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={acting === r.id}
                  onClick={() => resolveReg(r.id, 'reject')}
                >
                  <X className="h-4 w-4" />
                  Ret
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={staff}
        rowKey={(r) => r.id}
        storageKey="bi-staff"
        searchPlaceholder="Gözle..."
        emptyMessage={loading ? 'Ýüklenýär...' : 'Işgär ýok'}
        onRowClick={openEdit}
      />

      {modal && (
        <ModalPortal open={Boolean(modal)}>
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setModal(false)} />
          <div className={`relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl shadow-indigo-500/15 flex flex-col max-h-[min(86vh,560px)]${modalAnimOn ? ' animate-in slide-in-from-bottom-4 duration-200' : ''}`}>
            <div className="shrink-0 px-4 pt-3.5 pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white leading-tight">
                    {editing ? 'Işgäri üýtget' : 'Täze işgär'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">VPS bilen sync bolýar</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2">
            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Doly ady"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <Input
                label="Login"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Parol {editing ? '(üýtget)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-2.5 pr-9 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Telefon</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                  <span className="flex items-center px-2 bg-slate-950 text-slate-400 text-[11px] border-r border-slate-700 select-none">
                    +993
                  </span>
                  <input
                    className="flex-1 h-9 bg-slate-950 px-2 text-sm text-white outline-none"
                    value={form.phoneLocal}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        phoneLocal: e.target.value.replace(/\D/g, '').slice(0, 8),
                      }))
                    }
                    placeholder="6X XXXXXX"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Select
                label="Rol"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                options={roleOptions}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Firmalar</label>
              <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-1 space-y-0.5">
                {visibleCompanies.length ? visibleCompanies.map((c) => {
                  const checked = (form.tenantSlugs || []).includes(c.slug);
                  return (
                    <label
                      key={c.slug}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-500/30'
                          : 'text-slate-300 hover:bg-slate-900 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-600"
                        checked={checked}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          tenantSlugs: e.target.checked
                            ? Array.from(new Set([...(f.tenantSlugs || []), c.slug]))
                            : (f.tenantSlugs || []).filter((slug) => slug !== c.slug),
                        }))}
                      />
                      <span className="truncate">{c.name || c.slug}</span>
                    </label>
                  );
                }) : <div className="px-2 py-2 text-[11px] text-slate-500">Firma tapylmady (diňe size degişli firmalar)</div>}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 pt-0.5">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Işjeň hasap
            </label>
            </div>
            <div className="shrink-0 border-t border-slate-800 px-3.5 py-2.5 space-y-1 bg-slate-900/95 rounded-b-2xl">
            <div className="flex gap-2">
              <Button className="flex-1 h-9 text-sm" loading={saving} onClick={save}>
                Ýatda sakla
              </Button>
              <Button variant="ghost" className="h-9 text-sm" onClick={() => setModal(false)}>
                Ýatyr
              </Button>
            </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Staff invite modal */}
      <ModalPortal open={Boolean(inviteOpen)}>
        <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setInviteOpen(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-300" />
                Invite — işgär çagyrmak
              </h2>
              <button type="button" className="p-1.5 text-slate-400 hover:text-white" onClick={() => setInviteOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!inviteResult ? (
                <>
                  <div>
                    <label className="text-xs text-slate-400">Firma (birnäçe)</label>
                    <div className="mt-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
                      {visibleCompanies.length === 0 ? (
                        <p className="text-xs text-slate-500 p-3">Firma ýok</p>
                      ) : (
                        visibleCompanies.map((c) => {
                          const on = inviteSlugs.includes(c.slug);
                          return (
                            <label
                              key={c.slug}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-900"
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  setInviteSlugs((prev) =>
                                    on ? prev.filter((s) => s !== c.slug) : [...prev, c.slug]
                                  );
                                }}
                              />
                              <span className="truncate">{c.name || c.slug}</span>
                              <span className="text-[10px] text-slate-500 ml-auto">{c.slug}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Rol (diňe 1)</label>
                    <select
                      className="mt-1 w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Näçe işgär</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={inviteSeats}
                      onChange={(e) => {
                        const v = e.target.value;
                        setInviteSeats(v);
                        const n = Math.max(1, Math.min(50, parseInt(v, 10) || 1));
                        // default suggestion: 3 min × seats (user can still change)
                        setInviteTtlMinutes(String(n * 3));
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Möhlet (minut)</label>
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={inviteTtlMinutes}
                      onChange={(e) => setInviteTtlMinutes(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Link näçe minut işjeň bolsun (1–180). Mysal: 10 → 10 minut.
                    </p>
                  </div>

                  <Button className="w-full" loading={inviteBusy} onClick={() => void createInvite()}>
                    <QrCode className="h-4 w-4" />
                    Döret
                  </Button>
                </>
              ) : (
                <>
                  <div
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      inviteLeft <= 60
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                    }`}
                  >
                    Möhlet: <strong className="tabular-nums">{fmtInviteLeft(inviteLeft)}</strong>
                    <span className="text-xs opacity-70">({inviteResult.seats} işgär)</span>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(inviteResult.url)}`}
                      alt="Invite QR"
                      className="rounded-xl border border-slate-700 bg-white p-2 w-[200px] h-[200px]"
                    />
                    <p className="text-[11px] text-slate-400 text-center break-all px-2">{inviteResult.url}</p>
                    <p className="text-[11px] text-slate-500 text-center">
                      Rol: <span className="text-slate-300">{inviteResult.role}</span>
                      {' · '}
                      Firma: <span className="text-slate-300">{inviteResult.tenantSlugs.join(', ')}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="flex-1" onClick={() => void shareInvite()}>
                      <Share2 className="h-4 w-4" />
                      Ugrat
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => void copyInviteLink()}>
                      <Copy className="h-4 w-4" />
                      Link göçür
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      void downloadInviteQr(inviteResult.url, inviteResult.token || 'invite')
                    }
                  >
                    <Download className="h-4 w-4" />
                    QR PNG ýükle
                  </Button>
                  <p className="text-[11px] text-slate-500 text-center">
                    Telefonda «Ugrat» — messenger saýlap ugradyň. QR skan ýa-da link bilen açylýar.
                  </p>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setInviteResult(null);
                      setInviteLeft(0);
                    }}
                  >
                    Täze invite
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Active invites list */}
      <ModalPortal open={Boolean(invitesListOpen)}>
        <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setInvitesListOpen(false)} />
          <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <List className="h-4 w-4 text-indigo-300" />
                Active invites
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-white"
                  title="Täzele"
                  onClick={() => void loadInvitesList()}
                >
                  <RefreshCw className={`h-4 w-4 ${invitesLoading ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" className="p-1.5 text-slate-400 hover:text-white" onClick={() => setInvitesListOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {invitesLoading && invitesList.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Ýüklenýär...</p>
              ) : invitesList.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  Active invite ýok. «Invite» bilen dörediň.
                </p>
              ) : (
                invitesList.map((row) => (
                  <div
                    key={row.token}
                    className={`rounded-xl border p-3 space-y-2 ${
                      row.active
                        ? 'border-emerald-700/40 bg-emerald-950/20'
                        : 'border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium">
                          {row.role}
                          <span className="text-slate-500 font-normal">
                            {' · '}
                            {row.usedSeats}/{row.seats} ulanyldy
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {(row.tenantSlugs || []).join(', ')}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${
                          row.active
                            ? 'border-emerald-600/50 text-emerald-300'
                            : 'border-rose-600/40 text-rose-300'
                        }`}
                      >
                        {row.active ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtInviteLeft(row.expiresInSec)}
                          </span>
                        ) : (
                          'möhleti gutardy'
                        )}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 break-all font-mono">{row.url}</p>

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={() => reopenInviteInModal(row)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Aç
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={() => void downloadInviteQr(row.url, row.token)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        QR PNG
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(row.url);
                            toastSuccess('Link göçürildi');
                          } catch {
                            toastInfo('Link', row.url);
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Link
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="h-8 text-xs"
                        loading={inviteActionToken === row.token}
                        onClick={() => void deleteInvite(row.token)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Poz
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        className="w-16 h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                        value={topUpMinutes[row.token] ?? '10'}
                        onChange={(e) =>
                          setTopUpMinutes((prev) => ({ ...prev, [row.token]: e.target.value }))
                        }
                        title="Goşuljak minut"
                      />
                      <span className="text-[11px] text-slate-500">min</span>
                      <Button
                        size="sm"
                        className="h-8 text-xs flex-1"
                        loading={inviteActionToken === row.token}
                        onClick={() => void topUpInvite(row.token)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {row.expired ? 'Täzeden aç (+min)' : 'Top-up'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </ModalPortal>


    </div>
  );
}
