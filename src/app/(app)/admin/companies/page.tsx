'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { useModalAnimations } from '@/lib/use-modal-animations';

interface Company {
  id: string;
  slug: string;
  name: string;
  isActive?: boolean;
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  industry?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  staffCount?: number;
  endpointCount?: number;
  connectionCount?: number;
  deviceCount?: number;
  updatedAt?: string;
}

const emptyForm = {
  name: '',
  slug: '',
  isActive: true,
  legalName: '',
  taxId: '',
  registrationNumber: '',
  industry: '',
  country: 'Turkmenistan',
  city: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
};

function PhoneField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (full: string) => void;
}) {
  const prefix = '+993';
  const local = value.startsWith(prefix)
    ? value.slice(prefix.length).trim()
    : value.replace(/^\+?\d{1,4}\s*/, '');

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-400">{label}</label>
      <div className="flex rounded-lg border border-slate-700 bg-slate-950 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50">
        <span className="shrink-0 px-2.5 py-2 text-sm font-mono text-slate-400 bg-slate-900 border-r border-slate-700 select-none">
          {prefix}
        </span>
        <input
          type="tel"
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none text-white"
          placeholder="61 123456"
          value={local}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d\s-]/g, '');
            onChange(digits ? `${prefix} ${digits}`.trim() : '');
          }}
        />
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const modalAnimOn = useModalAnimations();
  const [list, setList] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        setIsSuper(!!(u?.isSuperAdmin || u?.role === 'super_admin'));
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalog?refresh=1');
      const data = await res.json();
      if (!res.ok) {
        toastError('Yuklenmedi', data.error || 'Catalog sawlik');
        setList([]);
        return;
      }
      setList(data.tenants || []);
    } catch (e) {
      toastError('Yuklenmedi', String(e));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'name' && !editing) {
        next.slug = String(value)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, isActive: true });
    setModal(true);
  }

  function openEdit(c: Company) {
    void (async () => {
      try {
        const res = await fetch('/api/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lockAction: 'lock',
            entityType: 'tenant',
            entityId: c.id,
            openedBy: 'bi',
            name: c.name,
            slug: c.slug,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 423 || data.error === 'locked') {
          toastError('Uytgetmek mumkin dal', data.message || 'Bashga yerde acyk (is_open)');
          return;
        }
      } catch {
        /* offline — allow local */
      }
      setEditing(c);
      setForm({
        name: c.name || '',
        slug: c.slug || '',
        isActive: c.isActive !== false,
        legalName: c.legalName || '',
        taxId: c.taxId || '',
        registrationNumber: c.registrationNumber || '',
        industry: c.industry || '',
        country: c.country || 'Turkmenistan',
        city: c.city || '',
        address: c.address || '',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        contactPerson: c.contactPerson || '',
        contactPhone: c.contactPhone || '',
        contactEmail: c.contactEmail || '',
        notes: c.notes || '',
      });
      setModal(true);
    })();
  }

  async function save() {
    if (!form.name.trim()) {
      toastError('Ady gerek', 'Kompaniya adyny yazyn');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug || editing?.slug,
        name: form.name.trim(),
        isActive: form.isActive !== false,
        legalName: form.legalName || undefined,
        taxId: form.taxId || undefined,
        registrationNumber: form.registrationNumber || undefined,
        industry: form.industry || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        contactPerson: form.contactPerson || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak sowusuz', data.error);
        return;
      }
      toastSuccess('Kompaniya saklandy', 'VPS bilen sync');
      if (editing?.id) {
        void fetch('/api/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lockAction: 'unlock',
            entityType: 'tenant',
            entityId: editing.id,
            openedBy: 'bi',
            name: form.name,
            slug: form.slug || editing.slug,
          }),
        });
      }
      setModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(c: Company) {
    const staff = c.staffCount ?? 0;
    const eps = c.endpointCount ?? 0;
    const conns = c.connectionCount ?? 0;
    const devices = c.deviceCount ?? 0;
    if (staff > 0 || eps > 0 || conns > 0) {
      toastError(
        'Pozup bolmayar',
        `Bagly maglumat bar: ${staff} işgär, ${eps} API, ${conns} DB. Ilki olary aýyryň.`
      );
      return;
    }
    const ok = await confirmDialog({
      title: 'Kompaniýany poz',
      message: `"${c.name}" (${c.slug}) doly pozulsynmy? Bu amal yzyna alynmaýar.`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/company?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: c.slug, name: c.name, delete: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toastError(
          'Pozup bolmayar',
          data.message ||
            `Bagly: ${data.staffCount ?? 0} işgär, ${data.endpointCount ?? 0} API, ${data.connectionCount ?? 0} DB`
        );
        return;
      }
      if (!res.ok) {
        toastError('Pozmak sowusuz', data.error || res.statusText);
        return;
      }
      toastSuccess('Kompaniýa pozuldy', 'VPS bilen sync');
      await load();
    } catch (e) {
      toastError('Pozmak sowusuz', String(e));
    }
  }

  const columns = useMemo<DataTableColumn<Company>[]>(
    () => [
      {
        id: 'name',
        header: 'Ady',
        mobilePrimary: true,
        accessor: (r) => r.name,
        cell: (r) => (
          <span
            className={`font-medium inline-flex items-center gap-2 ${
              r.isActive === false ? 'text-slate-400' : 'text-white'
            }`}
          >
            <Building2 className="h-4 w-4 text-indigo-400" />
            {r.name}
          </span>
        ),
      },
      {
        id: 'slug',
        header: 'Slug',
        accessor: (r) => r.slug,
        cell: (r) => <span className="font-mono text-xs text-slate-400">{r.slug}</span>,
      },
      
      {
        id: 'staffCount',
        header: 'Işgär',
        accessor: (r) => r.staffCount ?? 0,
        cell: (r) => (
          <span className="text-sm tabular-nums text-slate-300">{r.staffCount ?? 0}</span>
        ),
      },
      {
        id: 'endpointCount',
        header: 'API',
        accessor: (r) => r.endpointCount ?? 0,
        cell: (r) => (
          <span className="text-sm tabular-nums text-emerald-400">{r.endpointCount ?? 0}</span>
        ),
      },
      {
        id: 'connectionCount',
        header: 'DB',
        accessor: (r) => r.connectionCount ?? 0,
        cell: (r) => (
          <span className="text-sm tabular-nums text-sky-400">{r.connectionCount ?? 0}</span>
        ),
      },
      {
        id: 'deviceCount',
        header: 'Device',
        accessor: (r) => r.deviceCount ?? 0,
        cell: (r) => (
          <span className="text-sm tabular-nums text-amber-400">{r.deviceCount ?? 0}</span>
        ),
      },
{
        id: 'active',
        header: 'Status',
        accessor: (r) => (r.isActive === false ? 0 : 1),
        cell: (r) => (
          <span
            className={
              r.isActive === false
                ? 'text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400'
                : 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400'
            }
          >
            {r.isActive === false ? 'Passiw' : 'Aktiw'}
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
              title="Uytget"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {r.isActive !== false && (
              <button
                type="button"
                onClick={() => void deactivate(r)}
                disabled={
                  (r.staffCount ?? 0) > 0 ||
                  (r.endpointCount ?? 0) > 0 ||
                  (r.connectionCount ?? 0) > 0
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                title={
                  (r.staffCount ?? 0) > 0 ||
                  (r.endpointCount ?? 0) > 0 ||
                  (r.connectionCount ?? 0) > 0
                    ? 'Bagly işgär/API/DB bar — pozup bolmaýar'
                    : 'Poz'
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/50';
  const labelCls = 'text-xs text-slate-400';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Kompaniyalar</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isSuper ? 'Super admin Â· ahli firmalar (aktiw + passiw) Â· VPS' : 'Sizin kompaniyaniz'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            Sync
          </Button>
          {isSuper && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Taze
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(r) => r.id || r.slug}
        storageKey="bi-companies"
        searchPlaceholder="Gozle..."
        emptyMessage={loading ? 'Yuklenyar...' : 'Kompaniya yok'}
        onRowClick={openEdit}
      />

      {modal && (
        <ModalPortal open={Boolean(modal)}>
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (editing?.id) {
                void fetch('/api/company', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    lockAction: 'unlock',
                    entityType: 'tenant',
                    entityId: editing.id,
                    openedBy: 'bi',
                  }),
                });
              }
              setModal(false);
            }}
          />
          <div className={`relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6 space-y-5 shadow-2xl shadow-indigo-500/10${modalAnimOn ? ' animate-in slide-in-from-bottom-4 duration-200' : ''}`}>
            <h3 className="text-lg font-semibold text-white text-center">
              {editing ? 'Kompaniyany uytget' : 'Taze kompaniya'}
            </h3>

            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Esasy maglumat</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Kompaniya ady *</label>
                  <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Mysal: Acme LLC" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Slug (URL ucin) *</label>
                  <input
                    className={`${inputCls} font-mono`}
                    value={form.slug}
                    onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    disabled={!!editing}
                    placeholder="acme-llc"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Kanuny ady</label>
                  <input className={inputCls} value={form.legalName} onChange={(e) => setField('legalName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Ugur / Industriya</label>
                  <input className={inputCls} value={form.industry} onChange={(e) => setField('industry', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Salgyt belgisi (TIN)</label>
                  <input className={inputCls} value={form.taxId} onChange={(e) => setField('taxId', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Hasaba alys belgisi</label>
                  <input className={inputCls} value={form.registrationNumber} onChange={(e) => setField('registrationNumber', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salgy we aragatnasyk</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Yurt</label>
                  <input className={inputCls} value={form.country} onChange={(e) => setField('country', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Saher</label>
                  <input className={inputCls} value={form.city} onChange={(e) => setField('city', e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className={labelCls}>Salgy</label>
                  <input className={inputCls} value={form.address} onChange={(e) => setField('address', e.target.value)} />
                </div>
                <PhoneField label="Telefon" value={form.phone} onChange={(v) => setField('phone', v)} />
                <div className="space-y-1.5">
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className={labelCls}>Web sahypa</label>
                  <input className={inputCls} value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Esasy kontakt sahsy</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Ady we familyasy</label>
                  <input className={inputCls} value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
                </div>
                <PhoneField label="Telefon" value={form.contactPhone} onChange={(v) => setField('contactPhone', v)} />
                <div className="space-y-1.5">
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} value={form.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-1.5">
              <label className={labelCls}>Belligler</label>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</h4>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600"
                  checked={form.isActive !== false}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span className="text-sm text-slate-200">
                  {form.isActive !== false ? 'Aktiw' : 'Passiw'}
                </span>
                <span className="text-xs text-slate-500">
                  (Passiw bolsa sanawda gorkezilyar, yone isjen dal)
                </span>
              </label>
            </section>

            <div className="flex gap-2 pt-1 border-t border-slate-800">
              <Button className="flex-1" loading={saving} onClick={() => void save()}>
                Yatda sakla Â· Sync
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (editing?.id) {
                    void fetch('/api/company', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        lockAction: 'unlock',
                        entityType: 'tenant',
                        entityId: editing.id,
                        openedBy: 'bi',
                      }),
                    });
                  }
                  setModal(false);
                }}
              >
                Yatyr
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
