'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  FolderOpen,
  Pause,
  Play,
  Square,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

type NewsMedia = { url: string; type: 'image' | 'video'; caption?: string };
type NewsItem = {
  id: string;
  title: string;
  body: string;
  images: string[];
  media?: NewsMedia[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  published: boolean;
  pinned?: boolean;
  unread?: boolean;
  viewCount?: number;
};

type LibFile = {
  name: string;
  url: string;
  size: number;
  mtime: string;
  type: 'image' | 'video' | 'other';
};

type UploadJob = {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'paused' | 'done' | 'error' | 'aborted';
  error?: string;
  xhr?: XMLHttpRequest;
};

const CONCURRENCY = 3;
/** Server bilen deň: 50 MB */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_LABEL = '50 MB';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [media, setMedia] = useState<NewsMedia[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editorMinimized, setEditorMinimized] = useState(false);
  const [published, setPublished] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<LibFile[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [fabPos, setFabPos] = useState({ x: 16, y: 16 });
  const fabDrag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const queueRunning = useRef(false);

  const uploading = jobs.some((j) => j.status === 'uploading' || j.status === 'queued' || j.status === 'paused');
  const overallProgress = (() => {
    const active = jobs.filter((j) => j.status === 'uploading' || j.status === 'queued' || j.status === 'done');
    if (!active.length) return null;
    const sum = active.reduce((s, j) => s + (j.status === 'done' ? 100 : j.progress), 0);
    return Math.round(sum / active.length);
  })();

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
        toastWarning('Okalmadyk habarlar', `Siziň ${n} sany okalmadyk habaryňyz bar`);
        sessionStorage.removeItem('bi-unread-news');
      }
    } catch {
      /* */
    }
  }, []);

  /** Bold / italic / underline — saýlanan tekst ýa-da täze bellik */
  function wrapSelection(before: string, after: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + before + after);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || 'tekst';
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function openItem(item: NewsItem) {
    setSelected(item);
    if (!item.unread) return;
    // Optimistic UI
    setItems((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? {
              ...n,
              unread: false,
              viewCount: item.unread ? (n.viewCount || 0) + 1 : n.viewCount,
            }
          : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setSelected((s) =>
      s && s.id === item.id
        ? {
            ...s,
            unread: false,
            viewCount: item.unread ? (s.viewCount || 0) + 1 : s.viewCount,
          }
        : s
    );
    try {
      await fetch(`/api/news/${item.id}`, { cache: 'no-store' });
    } catch {
      /* server markRead on GET */
    }
  }

  function openCreate() {
    setEditing(null);
    setTitle('');
    setBody('');
    setImages([]);
    setMedia([]);
    setPublished(true);
    setPinned(false);
    setJobs([]);
    setEditorMinimized(false);
    setEditorOpen(true);
  }

  function openEdit(item: NewsItem) {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setImages([...(item.images || [])]);
    setMedia(
      item.media?.length
        ? [...item.media]
        : (item.images || []).map((url) => ({ url, type: 'image' as const, caption: '' }))
    );
    setPublished(item.published);
    setPinned(!!item.pinned);
    setJobs([]);
    setEditorMinimized(false);
    setEditorOpen(true);
  }

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  async function runOneUpload(job: UploadJob): Promise<void> {
    const file = job.file;
    updateJob(job.id, { status: 'uploading', progress: 0 });
    try {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name);
      const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
      let out: File = file;
      let compressed = false;
      if (!isVideo && !isGif) {
        const { compressImageFile } = await import('@/lib/image-compress-client');
        const r = await compressImageFile(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.78,
        });
        out = r.file;
        compressed = r.compressed;
      }
      const fd = new FormData();
      fd.append('file', out);
      if (compressed) fd.append('compressed', '1');

      const data: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        updateJob(job.id, { xhr });
        xhr.open('POST', '/api/news/upload');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            updateJob(job.id, { progress: Math.round((ev.loaded / ev.total) * 100) });
          }
        };
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) resolve(j);
            else reject(new Error(j.error || 'ýüklenmedi'));
          } catch (e) {
            reject(e);
          }
        };
        xhr.onerror = () => reject(new Error('tor ýalňyşlygy'));
        xhr.onabort = () => reject(new Error('__abort__'));
        xhr.send(fd);
      });

      const entry: NewsMedia = { url: data.url, type: isVideo ? 'video' : 'image', caption: '' };
      setMedia((prev) => [...prev, entry]);
      if (!isVideo) setImages((prev) => [...prev, data.url]);
      updateJob(job.id, { status: 'done', progress: 100, xhr: undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === '__abort__') {
        updateJob(job.id, { status: 'aborted', xhr: undefined });
      } else {
        updateJob(job.id, { status: 'error', error: msg, xhr: undefined });
        toastError('Media', msg);
      }
    }
  }

  async function processQueue() {
    if (queueRunning.current) return;
    queueRunning.current = true;
    try {
      for (;;) {
        const list = jobsRef.current;
        const uploadingCount = list.filter((j) => j.status === 'uploading').length;
        const next = list.find((j) => j.status === 'queued');
        if (!next) break;
        if (uploadingCount >= CONCURRENCY) {
          await new Promise((r) => setTimeout(r, 120));
          continue;
        }
        // mark uploading before await so concurrency counts
        updateJob(next.id, { status: 'uploading' });
        // re-read after state
        await runOneUpload(next);
      }
    } finally {
      queueRunning.current = false;
      // if new queued arrived
      if (jobsRef.current.some((j) => j.status === 'queued')) {
        void processQueue();
      }
    }
  }

  function enqueueFiles(files: File[]) {
    if (!files.length) return;
    const ok: File[] = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toastError(
          'Faýl uly',
          `«${file.name}» (${formatBytes(file.size)}) — max ${MAX_UPLOAD_LABEL}. Ýüklenmedi.`
        );
        continue;
      }
      ok.push(file);
    }
    if (!ok.length) return;
    const newJobs: UploadJob[] = ok.map((file) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      status: 'queued' as const,
    }));
    setJobs((prev) => [...prev, ...newJobs]);
    setTimeout(() => void processQueue(), 30);
  }

  function setMediaCaption(url: string, caption: string) {
    setMedia((prev) => prev.map((m) => (m.url === url ? { ...m, caption } : m)));
  }

  function pauseJob(id: string) {
    const j = jobsRef.current.find((x) => x.id === id);
    if (j?.xhr && j.status === 'uploading') {
      j.xhr.abort();
      updateJob(id, { status: 'paused', xhr: undefined });
    } else if (j?.status === 'queued') {
      updateJob(id, { status: 'paused' });
    }
  }

  function resumeJob(id: string) {
    const j = jobsRef.current.find((x) => x.id === id);
    if (!j) return;
    if (j.status === 'paused' || j.status === 'aborted' || j.status === 'error') {
      updateJob(id, { status: 'queued', progress: 0, error: undefined });
      setTimeout(() => void processQueue(), 30);
    }
  }

  function stopJob(id: string) {
    const j = jobsRef.current.find((x) => x.id === id);
    if (j?.xhr) j.xhr.abort();
    updateJob(id, { status: 'aborted', xhr: undefined });
  }

  function stopAll() {
    for (const j of jobsRef.current) {
      if (j.xhr) j.xhr.abort();
      if (j.status === 'uploading' || j.status === 'queued' || j.status === 'paused') {
        updateJob(j.id, { status: 'aborted', xhr: undefined });
      }
    }
  }

  async function removeMediaItem(m: NewsMedia) {
    setMedia((prev) => prev.filter((x) => x.url !== m.url));
    if (m.type === 'image') setImages((prev) => prev.filter((x) => x !== m.url));
    // diskden poz
    try {
      const name = m.url.split('/').pop();
      if (name) {
        await fetch(`/api/news/media/${encodeURIComponent(decodeURIComponent(name))}`, {
          method: 'DELETE',
        });
      }
    } catch {
      /* */
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const res = await fetch('/api/news/media/list');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ýüklenmedi');
      setLibrary(data.files || []);
    } catch (e) {
      toastError('Kitaphana', String(e));
    } finally {
      setLibraryLoading(false);
    }
  }

  function pickFromLibrary(f: LibFile) {
    if (f.type === 'other') {
      toastError('Faýl', 'Goldanylmaýan görnüş');
      return;
    }
    const entry: NewsMedia = {
      url: f.url,
      type: f.type === 'video' ? 'video' : 'image',
      caption: '',
    };
    setMedia((prev) => {
      if (prev.some((x) => x.url === f.url)) return prev;
      return [...prev, entry];
    });
    if (f.type === 'image') {
      setImages((prev) => (prev.includes(f.url) ? prev : [...prev, f.url]));
    }
    toastSuccess('Goşuldy', f.name);
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
          body: JSON.stringify({
            title: title.trim(),
            body,
            images: media.filter((m) => m.type === 'image').map((m) => m.url),
            media,
            published,
            pinned,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'saklanmady');
        toastSuccess('Habar üýtgedildi');
      } else {
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            body,
            images: media.filter((m) => m.type === 'image').map((m) => m.url),
            media,
            published,
            pinned,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'saklanmady');
        toastSuccess('Habar goşuldy');
      }
      setEditorOpen(false);
      setEditorMinimized(false);
      await load();
    } catch (e) {
      toastError('Habar', String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Habary pozmalymy? Bagly surat/video hem öçüriler.')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'pozulmady');
      toastSuccess('Pozuldy');
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (e) {
      toastError('Poz', String(e));
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
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
      toastSuccess('Ählisi okaldy');
    } catch {
      /* */
    }
  }

  // FAB drag
  function onFabPointerDown(e: React.PointerEvent) {
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    fabDrag.current = { ox: fabPos.x, oy: fabPos.y, sx: e.clientX, sy: e.clientY };
  }
  function onFabPointerMove(e: React.PointerEvent) {
    if (!fabDrag.current) return;
    const dx = e.clientX - fabDrag.current.sx;
    const dy = e.clientY - fabDrag.current.sy;
    setFabPos({
      x: Math.max(8, Math.min(window.innerWidth - 72, fabDrag.current.ox + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 72, fabDrag.current.oy + dy)),
    });
  }
  function onFabPointerUp() {
    fabDrag.current = null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-indigo-400" />
          Habarlar
          {unreadCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {unreadCount} täze
            </span>
          )}
        </h1>
        <div className="flex-1" />
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Täze habar
          </Button>
        )}
        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onClick={() => void markAll()}>
            <CheckCheck className="h-4 w-4" /> Ählisini oka
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Ýüklenýär…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Habar ýok</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openItem(item)}
              className={`text-left rounded-2xl border p-3 space-y-2 transition-colors ${
                item.unread
                  ? 'border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10'
                  : 'border-slate-700/80 bg-slate-900/60 hover:bg-slate-900'
              }`}
            >
              <div className="flex gap-3">
                {(() => {
                  const m0 =
                    item.media?.[0] ||
                    (item.images?.[0] ? { url: item.images[0], type: 'image' as const } : null);
                  if (!m0) return null;
                  return m0.type === 'video' ? (
                    <video
                      src={m0.url}
                      className="h-16 w-20 rounded-lg object-cover border border-slate-700 bg-black shrink-0"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m0.url}
                      alt=""
                      className="h-16 w-20 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1">
                    {item.pinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium text-white line-clamp-2">{item.title}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formatDateTime(item.createdAt)}
                    {item.createdBy ? <span className="text-slate-600"> · {item.createdBy}</span> : null}
                    <span className="text-slate-600"> · {item.viewCount ?? 0} görüji</span>
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
              <h2 className="text-sm sm:text-base font-semibold text-white line-clamp-2 pr-2">
                {selected.title}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300"
                      onClick={() => {
                        openEdit(selected);
                        setSelected(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                      onClick={() => void deleteItem(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-[11px] text-slate-500">
                {formatDateTime(selected.createdAt)}
                {selected.pinned ? ' · Pin' : ''}
                {` · ${selected.viewCount ?? 0} görüji`}
              </p>
              {((selected.media && selected.media.length > 0) ||
                (selected.images && selected.images.length > 0)) && (
                <div className="grid grid-cols-1 gap-3">
                  {(selected.media?.length
                    ? selected.media
                    : selected.images.map((url) => ({
                        url,
                        type: 'image' as const,
                        caption: '',
                      }))
                  ).map((m) =>
                    m.type === 'video' ? (
                      <div key={m.url} className="space-y-1">
                        <video
                          src={m.url}
                          className="w-full max-h-[75vh] rounded-xl border border-slate-700 bg-black"
                          controls
                          playsInline
                          preload="auto"
                        />
                        {m.caption ? (
                          <p className="text-xs text-slate-400 px-0.5">{m.caption}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div key={m.url} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.url}
                          alt=""
                          className="w-full max-h-[75vh] object-contain rounded-xl border border-slate-700 bg-slate-950 cursor-zoom-in"
                          onClick={() => setLightboxUrl(m.url)}
                        />
                        {m.caption ? (
                          <p className="text-xs text-slate-400 px-0.5">{m.caption}</p>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              )}
              <div
                className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_a]:text-sky-400"
                dangerouslySetInnerHTML={{
                  __html: selected.body
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/__(.+?)__/g, '<u>$1</u>')
                    .replace(/_(.+?)_/g, '<em>$1</em>')
                    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
                    .replace(/^## (.+)$/gm, '<strong class="text-base">$1</strong>')
                    .replace(/\n/g, '<br/>'),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      {editorOpen && !editorMinimized && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              if (uploading) setEditorMinimized(true);
              else {
                setEditorOpen(false);
              }
            }}
          />
          <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/95">
              <h2 className="text-base font-semibold text-white">
                {editing ? 'Habary üýtget' : 'Täze habar'}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-white"
                  title="Minimize"
                  onClick={() => setEditorMinimized(true)}
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400"
                  onClick={() => {
                    if (uploading) setEditorMinimized(true);
                    else {
                      setEditorOpen(false);
                      setEditorMinimized(false);
                    }
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                placeholder="Sözbaşy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
                <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-slate-800 bg-slate-900/80">
                  <button
                    type="button"
                    className="h-7 min-w-[1.75rem] px-1.5 rounded-md text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
                    title="Bold"
                    onClick={() => wrapSelection('**', '**')}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="h-7 min-w-[1.75rem] px-1.5 rounded-md text-xs italic text-slate-300 hover:bg-slate-800 hover:text-white"
                    title="Italic"
                    onClick={() => wrapSelection('_', '_')}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className="h-7 min-w-[1.75rem] px-1.5 rounded-md text-xs underline text-slate-300 hover:bg-slate-800 hover:text-white"
                    title="Underline"
                    onClick={() => wrapSelection('__', '__')}
                  >
                    U
                  </button>
                  <span className="w-px h-4 bg-slate-700 mx-0.5" />
                  <button
                    type="button"
                    className="h-7 px-2 rounded-md text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Sözbaşy"
                    onClick={() => wrapSelection('## ', '')}
                  >
                    H
                  </button>
                  <button
                    type="button"
                    className="h-7 px-2 rounded-md text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Sanaw"
                    onClick={() => wrapSelection('- ', '')}
                  >
                    •
                  </button>
                  <button
                    type="button"
                    className="h-7 px-2 rounded-md text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Link"
                    onClick={() => wrapSelection('[', '](url)')}
                  >
                    Link
                  </button>
                </div>
                <textarea
                  ref={bodyRef}
                  className="w-full min-h-[140px] bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none resize-y"
                  placeholder="Tekst ýazyň… (**galyň**, _italik_)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Media list */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Media</p>
                <div className="flex flex-wrap gap-2">
                  {media.map((m) => (
                    <div
                      key={m.url}
                      className="w-full sm:w-[calc(50%-0.25rem)] rounded-xl border border-slate-700 bg-slate-950/60 p-2 space-y-1.5"
                    >
                      <div className="relative">
                        {m.type === 'video' ? (
                          <video
                            src={m.url}
                            className="h-28 w-full rounded-lg object-cover border border-slate-700 bg-black"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.url}
                            alt=""
                            className="h-28 w-full rounded-lg object-contain border border-slate-700 bg-slate-900 cursor-zoom-in"
                            onClick={() => setLightboxUrl(m.url)}
                          />
                        )}
                        <button
                          type="button"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-rose-600 text-white text-sm leading-none shadow"
                          onClick={() => void removeMediaItem(m)}
                          title="Poz"
                        >
                          ×
                        </button>
                      </div>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600"
                        placeholder="Düşündiriş (caption)…"
                        value={m.caption || ''}
                        onChange={(e) => setMediaCaption(m.url, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                {/* Upload jobs progress */}
                {jobs.length > 0 && (
                  <div className="space-y-1.5 rounded-xl border border-slate-700 bg-slate-950/80 p-2">
                    {jobs
                      .filter((j) => j.status !== 'done')
                      .map((j) => (
                        <div key={j.id} className="flex items-center gap-2 text-[11px]">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-slate-300">{j.file.name}</p>
                            <div className="h-1.5 rounded-full bg-slate-800 mt-0.5 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 transition-all"
                                style={{
                                  width: `${j.status === 'done' ? 100 : j.progress}%`,
                                }}
                              />
                            </div>
                            <p className="text-slate-500 mt-0.5">
                              {j.status === 'uploading' && `${j.progress}%`}
                              {j.status === 'queued' && 'Nobatda'}
                              {j.status === 'paused' && 'Pause'}
                              {j.status === 'error' && (j.error || 'Ýalňyşlyk')}
                              {j.status === 'aborted' && 'Stop'}
                            </p>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            {(j.status === 'uploading' || j.status === 'queued') && (
                              <button
                                type="button"
                                className="p-1 rounded bg-slate-800 text-amber-300"
                                onClick={() => pauseJob(j.id)}
                                title="Pause"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(j.status === 'paused' || j.status === 'aborted' || j.status === 'error') && (
                              <button
                                type="button"
                                className="p-1 rounded bg-slate-800 text-emerald-300"
                                onClick={() => resumeJob(j.id)}
                                title="Start"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {j.status !== 'done' && j.status !== 'aborted' && (
                              <button
                                type="button"
                                className="p-1 rounded bg-slate-800 text-rose-300"
                                onClick={() => stopJob(j.id)}
                                title="Stop"
                              >
                                <Square className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    {uploading && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          className="text-[11px] text-rose-300 hover:underline"
                          onClick={stopAll}
                        >
                          Ählisini stop
                        </button>
                        {overallProgress != null && (
                          <span className="text-[11px] text-slate-500">Jemi {overallProgress}%</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-slate-500">Max faýl: {MAX_UPLOAD_LABEL}. Her surat/video aşagynda düşündiriş ýazyp bilersiňiz.</p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 cursor-pointer hover:bg-indigo-500/20 transition-colors">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Faýl saýla
                    <input
                      type="file"
                      accept="image/*,image/gif,video/mp4,video/webm,video/ogg,video/quicktime"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = '';
                        enqueueFiles(files);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void openLibrary()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Öňki faýllar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                  />
                  Neşir et
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                  Ýokarda tut (pin)
                </label>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2 sticky bottom-0 bg-slate-900">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (uploading) setEditorMinimized(true);
                  else {
                    setEditorOpen(false);
                    setEditorMinimized(false);
                  }
                }}
              >
                {uploading ? 'Minimize' : 'Ýap'}
              </Button>
              <Button size="sm" className="flex-1" loading={saving} onClick={() => void saveEditor()}>
                Ýatda sakla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Library picker */}
      {libraryOpen && (
        <div className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setLibraryOpen(false)} />
          <div className="relative w-full sm:max-w-lg max-h-[80dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
              <h3 className="text-sm font-semibold text-white">Öň ýüklenen faýllar</h3>
              <button type="button" className="p-1.5 text-slate-400" onClick={() => setLibraryOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {libraryLoading && <p className="col-span-3 text-xs text-slate-500">Ýüklenýär…</p>}
              {!libraryLoading && library.length === 0 && (
                <p className="col-span-3 text-xs text-slate-500">Faýl ýok</p>
              )}
              {library.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => pickFromLibrary(f)}
                  className="rounded-lg border border-slate-700 overflow-hidden hover:border-indigo-500/50 text-left"
                >
                  {f.type === 'video' ? (
                    <video src={f.url} className="h-20 w-full object-cover bg-black" muted preload="metadata" />
                  ) : f.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-20 w-full object-cover" />
                  ) : (
                    <div className="h-20 flex items-center justify-center text-[10px] text-slate-500">
                      {f.name}
                    </div>
                  )}
                  <p className="px-1 py-0.5 text-[9px] text-slate-500 truncate">
                    {formatBytes(f.size)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Minimized FAB — draggable */}
      {editorMinimized && editorOpen && (
        <button
          type="button"
          className="fixed z-[250] h-14 min-w-[3.5rem] px-2 rounded-2xl bg-indigo-600 text-white shadow-2xl flex flex-col items-center justify-center touch-none"
          style={{ left: fabPos.x, top: fabPos.y, right: 'auto', bottom: 'auto' }}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onClick={() => {
            if (!fabDrag.current) setEditorMinimized(false);
          }}
          title="Habar redaktory"
        >
          <span className="text-[10px] font-bold">Habar</span>
          {uploading && overallProgress != null && (
            <span className="text-[9px] opacity-90">{overallProgress}%</span>
          )}
        </button>
      )}
    </div>
  );
}
