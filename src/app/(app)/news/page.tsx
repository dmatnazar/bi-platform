'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Newspaper,
  Plus,
  RefreshCw,
  Pin,
  X,
  ImagePlus,
  Trash2,
  Pencil,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

type NewsItem = {
  id: string;
  title: string;
  body: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  published: boolean;
  pinned?: boolean;
  unread?: boolean;
};

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [published, setPublished] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ýüklenmedi');
      setItems(data.items || []);
      setCanEdit(!!data.canEdit);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (e) {
      toastError('Habarlar', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const n = sessionStorage.getItem('bi-unread-news');
      if (n && Number(n) > 0) {
        toastWarning('Okalmadyk habarlar', `Siziň ${n} sany okalmadyk habaryňyz bar.`);
        sessionStorage.removeItem('bi-unread-news');
      }
    } catch {
      /* */
    }
  }, []);

  async function openItem(item: NewsItem) {
    setSelected(item);
    try {
      const res = await fetch(`/api/news/${item.id}`);
      const data = await res.json();
      if (res.ok && data.item) {
        setSelected({ ...data.item, unread: false });
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, unread: false } : x))
        );
        setUnreadCount((c) => Math.max(0, c - (item.unread ? 1 : 0)));
      }
    } catch {
      /* */
    }
  }

  function openCreate() {
    setEditing(null);
    setTitle('');
    setBody('');
    setImages([]);
    setPublished(true);
    setPinned(false);
    setEditorOpen(true);
  }

  function openEdit(item: NewsItem) {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setImages([...(item.images || [])]);
    setPublished(item.published);
    setPinned(!!item.pinned);
    setEditorOpen(true);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/news/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ýüklenmedi');
      setImages((prev) => [...prev, data.url]);
      toastSuccess('Surat goşuldy');
    } catch (e) {
      toastError('Surat', String(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveEditor() {
    if (!title.trim()) {
      toastError('Sözbaşy gerek');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/news/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, images, published, pinned }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'şowsuz');
        toastSuccess('Habar üýtgedildi');
      } else {
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, images, published, pinned }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'şowsuz');
        toastSuccess('Habar döredildi');
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      toastError('Saklamak', String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (!confirm('Habar pozulsynmy?')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'şowsuz');
      toastSuccess('Pozuldy');
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (e) {
      toastError('Pozmak', String(e));
    }
  }

  async function markAll() {
    try {
      await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setUnreadCount(0);
      setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
      toastSuccess('Ählisi okaldy diýlip bellenildi');
    } catch {
      /* */
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 px-1 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-indigo-400 shrink-0" />
            Habarlar
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Platforma bildirişleri we täzelikler
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void markAll()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Ählisini oka
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Täze habar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-10 text-center">Ýüklenýär…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-14 text-center text-sm text-slate-500">
          Häzirçe habar ýok
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openItem(item)}
              className={`text-left rounded-2xl border p-3.5 sm:p-4 transition-all hover:border-indigo-500/40 hover:bg-slate-900/80 ${
                item.unread
                  ? 'border-rose-500/40 bg-rose-500/5 shadow-[0_0_0_1px_rgba(244,63,94,0.15)]'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <div className="flex gap-3">
                {item.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.images[0]}
                    alt=""
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover shrink-0 border border-slate-700"
                  />
                ) : (
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center shrink-0">
                    <Newspaper className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm sm:text-base font-semibold text-white line-clamp-2 flex-1">
                      {item.pinned && (
                        <Pin className="inline h-3.5 w-3.5 text-amber-400 mr-1 -mt-0.5" />
                      )}
                      {item.title}
                    </p>
                    {item.unread && (
                      <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-rose-500 mt-1.5 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                    {item.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] sm:text-[11px] text-slate-500">
                    <span>{formatDateTime(item.createdAt)}</span>
                    {!item.published && (
                      <span className="text-amber-400/90 border border-amber-500/30 px-1 rounded">
                        Draft
                      </span>
                    )}
                    {canEdit && (
                      <span className="text-slate-600">· {item.createdBy}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
              <h2 className="text-sm sm:text-base font-semibold text-white line-clamp-2 pr-2">
                {selected.title}
              </h2>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white shrink-0"
                onClick={() => setSelected(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-[11px] text-slate-500">
                {formatDateTime(selected.createdAt)}
                {selected.pinned ? ' · Pin' : ''}
              </p>
              {selected.images?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="w-full rounded-xl border border-slate-800 object-cover max-h-64"
                    />
                  ))}
                </div>
              )}
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selected.body}
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(selected)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Üýtget
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-400"
                    onClick={() => void removeItem(selected.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Poz
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 z-10">
              <h3 className="text-sm font-semibold text-white">
                {editing ? 'Habary üýtget' : 'Täze habar'}
              </h3>
              <button type="button" className="p-1.5 text-slate-400" onClick={() => setEditorOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Sözbaşy *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Mazmun</label>
                <textarea
                  className="mt-1 w-full min-h-[140px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white resize-y"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Habar teksti..."
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Suratlar</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((src) => (
                    <div key={src} className="relative h-16 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-700" />
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-600 text-white text-xs"
                        onClick={() => setImages((prev) => prev.filter((x) => x !== src))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 cursor-pointer hover:bg-slate-800">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {uploading ? 'Ýüklenýär…' : 'Surat goş'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                  Neşir et
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                  Ýokarda tut (pin)
                </label>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2 sticky bottom-0 bg-slate-900">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditorOpen(false)}>
                Ýap
              </Button>
              <Button size="sm" className="flex-1" loading={saving} onClick={() => void saveEditor()}>
                Ýatda sakla
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
