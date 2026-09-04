'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Check, X, Eye, EyeOff, CloudUpload, Users } from 'lucide-react';
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

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.id) setMeId(d.user.id);
        if (d.user?.username) setMeUsername(d.user.username);
      })
      .catch(() => {});
  }, []);

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
      setStaff(
        list.filter(
          (row: StaffRow) =>
            (meId ? row.id !== meId : true) &&
            true // login bolan işgär hem sanawda görünsin
        )
      );
      setRegs(r.registrations || []);
    } finally {
      setLoading(false);
    }
  }, [meId, meUsername]);

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
      tenantSlugs: companies[0]?.slug ? [companies[0].slug] : [],
    });
    setShowPw(false);
    setError('');
    setModal(true);
  }

  function openEdit(row: StaffRow) {
    setEditing(row);
    setForm({
      fullName: row.fullName,
      username: row.username,
      password: row.passwordReveal || '',
      role: row.role === 'admin' || row.role === 'editor' ? row.role : 'viewer',
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
      toastSuccess(
        editing ? 'Işgär üýtgedildi' : 'Işgär goşuldy',
        'VPS bilen sync edildi · Electron awto-çekip biler'
      );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Işgärler</h1>
          <p className="text-slate-400 text-sm mt-1">VPS arkaly Electron bilen sync</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={manualSync} loading={syncing || loading}>
            <CloudUpload className="h-4 w-4" />
            Sync
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Täze işgär
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
                options={[
                  { value: 'viewer', label: 'Viewer' },
                  { value: 'editor', label: 'Editor' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Firmalar</label>
              <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-1 space-y-0.5">
                {companies.length ? companies.map((c) => {
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
                }) : <div className="px-2 py-2 text-[11px] text-slate-500">Firma tapylmady</div>}
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
    </div>
  );
}
