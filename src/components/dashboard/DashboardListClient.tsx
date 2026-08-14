'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dashboard, DashboardExportPayload, DashboardWidget } from '@/lib/types';
import { generateId, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  LayoutDashboard,
  Clock,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
  Upload,
  X,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  initial: Dashboard[];
  canEdit: boolean;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function remapWidgetIds(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((w) => ({ ...w, id: generateId() }));
}

export function DashboardListClient({ initial, canEdit }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Dashboard | null>(null);
  const [accessTarget, setAccessTarget] = useState<Dashboard | null>(null);
  const [staffOpts, setStaffOpts] = useState<{ id: string; fullName: string; username: string; role: string }[]>([]);
  const [selectedShare, setSelectedShare] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.description || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  async function persistUpdate(id: string, patch: Partial<Dashboard>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ýalňyşlyk');
      setItems((prev) => prev.map((d) => (d.id === id ? data.dashboard : d)));
      flash('Ýatda saklandy');
      router.refresh();
      return data.dashboard as Dashboard;
    } catch (e) {
      flash(String(e));
      return null;
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Dashboardy poz',
      message: 'Bu dashboard we onuň widget-leri öçüriler. Amal yzyna alynmaýar.',
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Pozup bolmady');
      }
      setItems((prev) => prev.filter((d) => d.id !== id));
      flash('Pozuldy');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function duplicate(d: Dashboard) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${d.name} (nusga)`,
          description: d.description,
          widgets: remapWidgetIds(d.widgets),
          globalFilters: d.globalFilters || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nusga alynmady');
      // ensure globalFilters if API stripped them
      if (d.globalFilters?.length && !data.dashboard.globalFilters?.length) {
        await fetch(`/api/dashboards/${data.dashboard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalFilters: d.globalFilters }),
        });
      }
      setItems((prev) => [data.dashboard, ...prev]);
      flash('Nusga döredildi');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  function exportDash(d: Dashboard) {
    const payload: DashboardExportPayload = {
      format: 'bi-platform-dashboard',
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: {
        name: d.name,
        description: d.description,
        widgets: d.widgets,
        globalFilters: d.globalFilters || [],
        version: d.version,
      },
    };
    const safe = d.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'dashboard';
    downloadJson(`${safe}.bi-dashboard.json`, payload);
    setMenuId(null);
    flash('Export edildi');
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      let name = '';
      let description: string | undefined;
      let widgets: DashboardWidget[] = [];
      let globalFilters: Dashboard['globalFilters'] = [];

      if (raw?.format === 'bi-platform-dashboard' && raw.dashboard) {
        name = raw.dashboard.name || 'Import edilen';
        description = raw.dashboard.description;
        widgets = remapWidgetIds(raw.dashboard.widgets || []);
        globalFilters = raw.dashboard.globalFilters || [];
      } else if (raw?.widgets && raw?.name) {
        // raw dashboard object
        name = raw.name;
        description = raw.description;
        widgets = remapWidgetIds(raw.widgets || []);
        globalFilters = raw.globalFilters || [];
      } else {
        throw new Error('Nädogry export faýly');
      }

      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, widgets, globalFilters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import şowsuz');

      if (globalFilters?.length) {
        await fetch(`/api/dashboards/${data.dashboard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalFilters }),
        });
      }

      setItems((prev) => [data.dashboard, ...prev]);
      flash('Import üstünlikli');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function openAccess(d: Dashboard) {
    setAccessTarget(d);
    setSelectedShare([...(d.sharedWith || [])]);
    setMenuId(null);
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      if (res.ok) {
        setStaffOpts(
          (data.staff || []).map((s: any) => ({
            id: s.id,
            fullName: s.fullName,
            username: s.username,
            role: s.role,
          }))
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function saveAccess() {
    if (!accessTarget) return;
    const updated = await persistUpdate(accessTarget.id, {
      sharedWith: selectedShare,
    } as any);
    if (updated) {
      setAccessTarget(null);
      flash('Dostup saklandy');
    }
  }

  function openEdit(d: Dashboard) {
    setEditTarget(d);
    setEditName(d.name);
    setEditDesc(d.description || '');
    setMenuId(null);
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return;
    const updated = await persistUpdate(editTarget.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    if (updated) setEditTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboardlar</h1>
          <p className="text-slate-400 text-sm mt-1">Hasabatlar we analitika</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden xs:inline">Import</span>
              Import
            </Button>
            <Link href="/dashboards/new">
              <Button size="sm" disabled={busy}>
                <Plus className="h-4 w-4" />
                Täze
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Dashboard gözle..."
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-slate-900/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
          <LayoutDashboard className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {items.length === 0 ? 'Heniz dashboard ýok' : 'Gözleg boýunça netije ýok'}
          </p>
          {canEdit && items.length === 0 && (
            <Link href="/dashboards/new" className="inline-block mt-4">
              <Button variant="secondary" size="sm">
                Ilkinji dashboardy döret
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 hover:border-indigo-500/40 hover:bg-slate-900 transition-all duration-200"
            >
              <Link href={`/dashboards/${d.id}`} className="block min-w-0 pr-10">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center group-hover:bg-indigo-500/25 transition-colors shrink-0">
                    <LayoutDashboard className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white group-hover:text-indigo-200 transition-colors">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="mt-1 text-sm text-slate-400 line-clamp-2">{d.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(d.updatedAt)}
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md shrink-0">
                    {d.widgets.length} widget
                  </span>
                </div>
                  </div>
                </div>
              </Link>

              {canEdit && (
                <div className="absolute top-3 right-3 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuId((id) => (id === d.id ? null : d.id));
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700"
                    aria-label="Hereketler"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === d.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-1 text-sm">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          Üýtget (ady)
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => duplicate(d)}
                          disabled={busy}
                        >
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          Nusga al
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => exportDash(d)}
                        >
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                          Export (.json)
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => openAccess(d)}
                        >
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          Ulanyjy bagla
                        </button>
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-rose-400 hover:bg-rose-500/10"
                          onClick={() => remove(d.id)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Poz
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Dashboard üýtget</h3>
              <button type="button" onClick={() => setEditTarget(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Input label="Ady" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Goşmaça at / düşündiriş</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Gysga düşündiriş..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>
                Ýatyr
              </Button>
              <Button size="sm" loading={busy} onClick={saveEdit} disabled={!editName.trim()}>
                Ýatda sakla
              </Button>
            </div>
          </div>
        </div>
      )}

      {accessTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAccessTarget(null)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Dashboard dostup</h3>
                <p className="text-xs text-slate-500 mt-0.5">{accessTarget.name}</p>
              </div>
              <button type="button" onClick={() => setAccessTarget(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Admin / editor ähli dashboardy görýär. Viewer diňe şu ýerde saýlananlar (we eýesi).
            </p>
            {staffOpts.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setSelectedShare(staffOpts.map((s) => s.id))}
                >
                  Hemmesini saýla
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setSelectedShare([])}
                >
                  Hemmesini aýyr
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-2">
              {staffOpts.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">Işgär sanawy boş ýa-da ýüklenmedi</p>
              ) : (
                staffOpts.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedShare.includes(s.id)}
                      onChange={(e) => {
                        setSelectedShare((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                        );
                      }}
                      className="rounded border-slate-600"
                    />
                    <span className="text-slate-200 flex-1 truncate">{s.fullName}</span>
                    <span className="text-[10px] text-slate-500">@{s.username} · {s.role}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAccessTarget(null)}>Ýatyr</Button>
              <Button size="sm" loading={busy} onClick={saveAccess}>Ýatda sakla</Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white shadow-xl max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  );
}
