'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  Link as LinkIcon,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

type AppDoc = {
  id: string;
  title: string;
  body: string;
  order: number;
  updatedAt?: string;
};

type AppPlatform = {
  id: string;
  name: string;
  status: 'available' | 'coming_soon';
  feedUrl?: string;
  downloadUrl?: string;
  order: number;
  docs: AppDoc[];
};

const ICONS: Record<string, typeof Monitor> = {
  windows: Monitor,
  ios: Smartphone,
  android: Tablet,
  linux: Terminal,
};

export default function AdminAppsPage() {
  const [platforms, setPlatforms] = useState<AppPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  // doc editor
  const [editDoc, setEditDoc] = useState<AppDoc | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docBody, setDocBody] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // platform meta edit
  const [feedUrl, setFeedUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [status, setStatus] = useState<'available' | 'coming_soon'>('coming_soon');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/apps');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ýüklenmedi');
      setPlatforms(data.platforms || []);
    } catch (e) {
      toastError('Programmalar ýüklenmedi', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = platforms.find((p) => p.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    setFeedUrl(selected.feedUrl || '');
    setDownloadUrl(selected.downloadUrl || '');
    setStatus(selected.status);
  }, [selected]);

  async function saveMeta() {
    if (!selected) return;
    setSavingMeta(true);
    try {
      const next = platforms.map((p) =>
        p.id === selected.id
          ? { ...p, feedUrl: feedUrl.trim(), downloadUrl: downloadUrl.trim(), status }
          : p
      );
      const res = await fetch('/api/admin/apps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'şowsuz');
      setPlatforms(data.platforms || next);
      toastSuccess('Saklandy');
    } catch (e) {
      toastError('Saklanmady', String(e));
    } finally {
      setSavingMeta(false);
    }
  }

  function startNewDoc() {
    setEditDoc({ id: '', title: '', body: '', order: selected?.docs.length || 0 });
    setDocTitle('');
    setDocBody('');
  }

  function startEditDoc(d: AppDoc) {
    setEditDoc(d);
    setDocTitle(d.title);
    setDocBody(d.body);
  }

  async function saveDoc() {
    if (!selected || !editDoc) return;
    setSavingDoc(true);
    try {
      const res = await fetch('/api/admin/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_doc',
          platformId: selected.id,
          doc: {
            id: editDoc.id || undefined,
            title: docTitle,
            body: docBody,
            order: editDoc.order,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'şowsuz');
      setPlatforms((prev) =>
        prev.map((p) => (p.id === selected.id ? data.platform : p))
      );
      setEditDoc(null);
      toastSuccess('Dokument saklandy');
    } catch (e) {
      toastError('Saklanmady', String(e));
    } finally {
      setSavingDoc(false);
    }
  }

  async function removeDoc(docId: string) {
    if (!selected) return;
    const ok = await confirmDialog({
      title: 'Dokumenty poz',
      message: 'Bu dokumentasiýa pozulsynmy?',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/admin/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_doc', platformId: selected.id, docId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'şowsuz');
      setPlatforms((prev) =>
        prev.map((p) => (p.id === selected.id ? data.platform : p))
      );
      toastSuccess('Pozuldy');
    } catch (e) {
      toastError('Pozulmady', String(e));
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Programmalar
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Client goşundylary (Windows, iOS…) we gurnama dokumentasiýasy
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Täzele
        </Button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Ýüklenýär...</p>
      ) : !selected ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {platforms
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((p) => {
              const Icon = ICONS[p.id] || Monitor;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="rounded-2xl border border-slate-700 bg-slate-900/70 hover:border-indigo-500/40 hover:bg-slate-900 p-4 text-left transition-all shadow-lg"
                >
                  <div className="h-11 w-11 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {p.status === 'available' ? 'Elýeterli' : 'Ýakyn wagtda'} ·{' '}
                    {p.docs?.length || 0} dok
                  </p>
                </button>
              );
            })}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setEditDoc(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Programmalar
          </button>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = ICONS[selected.id] || Monitor;
                return (
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                  </div>
                );
              })()}
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                <p className="text-xs text-slate-500">id: {selected.id}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Status</label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'available' | 'coming_soon')
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="available">Elýeterli (login-de açyk)</option>
                  <option value="coming_soon">Ýakyn wagtda</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                Feed URL (latest.yml)
              </label>
              <Input
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="http://VPS/updates/latest.yml"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Ýükle düwmesi bu YAML-dan soňky .exe ýoluny awtomatiki tapýar.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Alternatiw gönüden download URL (islege görä)
              </label>
              <Input
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="http://VPS/updates/BI-Platform-Client-Setup-1.0.11.exe"
              />
            </div>

            <Button loading={savingMeta} onClick={() => void saveMeta()} className="gap-1.5">
              <Save className="h-4 w-4" />
              Sazlamalary sakla
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                Dokumentasiýa
              </h3>
              <Button size="sm" variant="ghost" onClick={startNewDoc} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Goş
              </Button>
            </div>

            {editDoc && (
              <div className="rounded-xl border border-indigo-500/30 bg-slate-950 p-3 space-y-2">
                <Input
                  label="Ady"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Gurnama (gysga)"
                />
                <label className="text-xs text-slate-400 block">Mazmun</label>
                <textarea
                  value={docBody}
                  onChange={(e) => setDocBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y font-mono"
                  placeholder="1. Setup-y açyň...&#10;2. ..."
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditDoc(null)}>
                    Ýatyr
                  </Button>
                  <Button size="sm" loading={savingDoc} onClick={() => void saveDoc()}>
                    Sakla
                  </Button>
                </div>
              </div>
            )}

            {(selected.docs || []).length === 0 && !editDoc ? (
              <p className="text-sm text-slate-500 py-4 text-center">Dokument ýok</p>
            ) : (
              <ul className="space-y-2">
                {(selected.docs || [])
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((d) => (
                    <li
                      key={d.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 flex gap-2 items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100">{d.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 whitespace-pre-wrap">
                          {d.body}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditDoc(d)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800"
                        title="Üýtget"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeDoc(d.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        title="Poz"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
