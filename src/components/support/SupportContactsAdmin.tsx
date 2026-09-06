'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Headphones, Plus, Trash2, Save, RefreshCw, Pencil, X, Phone, Mail } from 'lucide-react';
import { toastSuccess, toastError } from '@/components/ui/Toast';

type Contact = {
  id: string;
  fullName: string;
  role?: string;
  phone?: string;
  telegram?: string;
  whatsapp?: string;
  imo?: string;
  gmail?: string;
  note?: string;
  order: number;
  active: boolean;
};

function emptyForm(): Contact {
  return {
    id: '',
    fullName: '',
    role: 'Tehniki goldaw',
    phone: '',
    telegram: '',
    whatsapp: '',
    imo: '',
    gmail: '',
    note: '',
    order: 0,
    active: true,
  };
}

export function SupportContactsAdmin() {
  const [intro, setIntro] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Contact>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/support-contacts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ýüklenmedi');
      setIntro(data.intro || '');
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (e) {
      toastError('Goldaw kontaktlary', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(nextContacts: Contact[], nextIntro?: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/support-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intro: nextIntro ?? intro, contacts: nextContacts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'saklanmady');
      setContacts(data.contacts || []);
      if (data.intro != null) setIntro(data.intro);
      toastSuccess('Tehniki goldaw saklandy');
      return true;
    } catch (e) {
      toastError('Saklamak', String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm(), order: contacts.length });
    setModalOpen(true);
  }

  function openEdit(c: Contact) {
    setEditingId(c.id);
    setForm({ ...c });
    setModalOpen(true);
  }

  async function saveModal() {
    if (!form.fullName.trim()) {
      toastError('Ady gerek', 'Ady Familiýasy ýazyň');
      return;
    }
    let next: Contact[];
    if (editingId) {
      next = contacts.map((c) => (c.id === editingId ? { ...form, id: editingId } : c));
    } else {
      const id = `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      next = [...contacts, { ...form, id, order: contacts.length }];
    }
    const ok = await persist(next);
    if (ok) setModalOpen(false);
  }

  async function remove(id: string) {
    await persist(contacts.filter((c) => c.id !== id));
  }

  async function saveIntro() {
    await persist(contacts, intro);
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Tehniki goldaw</h2>
            <p className="text-[11px] text-slate-500 leading-snug">
              Login «Tehniki goldaw» modalynyň işgärleri
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 w-full sm:w-auto justify-end">
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={openCreate} className="flex-1 sm:flex-none">
            <Plus className="h-3.5 w-3.5" />
            Goş
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400">Modal giriş teksti</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Tehniki meseleler boýunça..."
          />
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void saveIntro()} className="shrink-0">
            <Save className="h-3.5 w-3.5" />
            Teksti sakla
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Ýüklenýär…</p>
      ) : contacts.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-700 rounded-xl">
          Işgär ýok. «Goş» bilen täze kontakt goşuň.
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2.5">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5 shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{c.role || '—'}</p>
                  </div>
                  <span
                    className={
                      c.active
                        ? 'shrink-0 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded'
                        : 'shrink-0 text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded'
                    }
                  >
                    {c.active ? 'Aktiw' : 'Öçük'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  {c.phone ? (
                    <p className="flex items-center gap-1.5 text-slate-300">
                      <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="font-mono truncate">{c.phone}</span>
                    </p>
                  ) : null}
                  {c.gmail ? (
                    <p className="flex items-center gap-1.5 text-slate-300">
                      <Mail className="h-3 w-3 text-rose-400 shrink-0" />
                      <span className="truncate">{c.gmail}</span>
                    </p>
                  ) : null}
                  {(c.telegram || c.whatsapp || c.imo) && (
                    <p className="text-slate-500 truncate">
                      {[c.telegram && `TG: ${c.telegram}`, c.whatsapp && `WA: ${c.whatsapp}`, c.imo && `Imo: ${c.imo}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 py-2 text-xs text-sky-300 hover:bg-slate-800"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Üýtget
                  </button>
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 py-2 text-xs text-rose-400 hover:bg-slate-800"
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Poz
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 font-medium">Ady</th>
                  <th className="px-3 py-2 font-medium">Wezipe</th>
                  <th className="px-3 py-2 font-medium">Telefon</th>
                  <th className="px-3 py-2 font-medium">Telegram</th>
                  <th className="px-3 py-2 font-medium">WhatsApp</th>
                  <th className="px-3 py-2 font-medium">Gmail</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-white font-medium">{c.fullName}</td>
                    <td className="px-3 py-2 text-slate-400">{c.role || '—'}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{c.phone || '—'}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{c.telegram || '—'}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{c.whatsapp || '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{c.gmail || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          c.active
                            ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded'
                            : 'text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded'
                        }
                      >
                        {c.active ? 'Aktiw' : 'Öçük'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                          onClick={() => void remove(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
          <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-sm font-semibold text-white">
                {editingId ? 'Işgäri üýtget' : 'Täze işgär'}
              </h3>
              <button type="button" className="p-1.5 text-slate-400 hover:text-white" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Ady Familiýasy *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Wezipe</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={form.role || ''}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Telefon (jan / SMS)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white font-mono"
                    placeholder="+9936..."
                    value={form.phone || ''}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Gmail</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                    placeholder="name@gmail.com"
                    value={form.gmail || ''}
                    onChange={(e) => setForm((f) => ({ ...f, gmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Telegram (@username)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white font-mono"
                    value={form.telegram || ''}
                    onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">WhatsApp nomer</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white font-mono"
                    value={form.whatsapp || ''}
                    onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Imo nomer</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white font-mono"
                    value={form.imo || ''}
                    onChange={(e) => setForm((f) => ({ ...f, imo: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Bellik</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={form.note || ''}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 py-1">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Aktiw (login modalda görkez)
              </label>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2 sticky bottom-0 bg-slate-900 safe-area-pb">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>
                Ýap
              </Button>
              <Button size="sm" className="flex-1" loading={saving} onClick={() => void saveModal()}>
                <Save className="h-3.5 w-3.5" />
                Ýatda sakla
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
