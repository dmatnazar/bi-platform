'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Building2, Save } from 'lucide-react';

type Form = {
  name: string;
  slug: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  industry: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

const empty: Form = {
  name: '',
  slug: '',
  legalName: '',
  taxId: '',
  registrationNumber: '',
  industry: '',
  country: '',
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

export default function CompanyPage() {
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/company')
      .then((r) => r.json())
      .then((d) => {
        const c = d.company || {};
        setForm({
          name: c.name || '',
          slug: c.slug || '',
          legalName: c.legalName || '',
          taxId: c.taxId || '',
          registrationNumber: c.registrationNumber || '',
          industry: c.industry || '',
          country: c.country || '',
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
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Saklamak şowsuz');
        return;
      }
      setMsg(
        data.gatewaySynced
          ? 'Saklandy (ýerli + VPS)'
          : 'Ýerli saklandy (VPS offline bolsa diňe local)'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Ýüklenýär...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-400" />
          Kompaniýa
        </h1>
        <p className="text-slate-400 text-sm mt-1">Kompaniýa profili — ähli maglumatlar</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        {err && (
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            {err}
          </div>
        )}
        {msg && (
          <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
            {msg}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Ady *" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Slug" value={form.slug} disabled />
          <Input label="Kanuny ady" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
          <Input label="Salgyt belgisi" value={form.taxId} onChange={(e) => set('taxId', e.target.value)} />
          <Input label="Hasaba alyş №" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
          <Input label="Ugur / industriýa" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
          <Input label="Ýurt" value={form.country} onChange={(e) => set('country', e.target.value)} />
          <Input label="Şäher" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <Input label="Salgy" value={form.address} onChange={(e) => set('address', e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} />
          <Input label="Kontakt şahsy" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
          <Input label="Kontakt telefon" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          <Input label="Kontakt email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Bellikler</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" />
          Ýatda sakla
        </Button>
      </div>
    </div>
  );
}
