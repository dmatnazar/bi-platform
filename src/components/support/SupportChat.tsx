'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportTicket, SupportCategory, SupportTicketStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  MessageCircle,
  Plus,
  Send,
  ArrowLeft,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  CircleDot,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: SupportCategory; label: string; icon: typeof Bug }[] = [
  { value: 'error', label: 'Säwlik / Error', icon: Bug },
  { value: 'suggestion', label: 'Teklip', icon: Lightbulb },
  { value: 'question', label: 'Sorag', icon: HelpCircle },
  { value: 'feedback', label: 'Pikir / maslahat', icon: MessageSquare },
  { value: 'other', label: 'Beýleki', icon: CircleDot },
];

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Açyk',
  in_progress: 'Işlenýär',
  resolved: 'Çözüldi',
  closed: 'Ýapyk',
  trashed: 'Pozulanlar',
};

const STATUS_COLOR: Record<SupportTicketStatus, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-400',
  trashed: 'bg-rose-500/15 text-rose-300',
};

const STATUS_TABS: { key: 'all' | SupportTicketStatus; label: string }[] = [
  { key: 'all', label: 'Ählisi' },
  { key: 'open', label: 'Açyk' },
  { key: 'in_progress', label: 'Işlenýär' },
  { key: 'resolved', label: 'Çözüldi' },
  { key: 'closed', label: 'Ýapyk' },
  { key: 'trashed', label: 'Pozulanlar' },
];

interface Props {
  mode: 'user' | 'admin';
}

type TicketListItem = SupportTicket & { messageCount?: number };

export function SupportChat({ mode }: Props) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('question');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string; compressed?: boolean }[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const composeScrollRef = useRef<HTMLDivElement>(null);
  /** Mobile keyboard inset (px) from visualViewport */
  const [kbInset, setKbInset] = useState(0);

  // Keep compose / reply above the mobile keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset > 40 ? inset : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const scrollFocusedIntoView = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    // After keyboard opens, scroll the focused field into the visible area
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 280);
  }, []);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/support/tickets');
    const data = await res.json();
    if (res.ok) setTickets(data.tickets || []);
    setLoading(false);
  }, []);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      trashed: 0,
    };
    for (const t of tickets) {
      c.all += 1;
      const s = t.status || 'open';
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    if (statusFilter === 'all') {
      // default list: everything except trash
      return tickets.filter((t) => t.status !== 'trashed');
    }
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const loadTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/support/tickets/${id}`);
    const data = await res.json();
    if (res.ok) {
      setActive(data.ticket);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                unreadForUser: mode === 'user' ? 0 : t.unreadForUser,
                unreadForAdmin: mode === 'admin' ? 0 : t.unreadForAdmin,
                status: data.ticket.status,
                lastMessageAt: data.ticket.lastMessageAt,
              }
            : t
        )
      );
    }
  }, [mode]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!activeId) {
      setActive(null);
      return;
    }
    loadTicket(activeId);
    pollRef.current = setInterval(() => loadTicket(activeId), 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId, loadTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages?.length]);

  async function createTicket() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setComposing(false);
      setSubject('');
      setBody('');
      setCategory('question');
      await loadList();
      setActiveId(data.ticket.id);
    } catch (e) {
      alert(String(e));
    } finally {
      setSending(false);
    }
  }

  async function compressImage(file: File): Promise<{ blob: Blob; compressed: boolean }> {
    if (!file.type.startsWith('image/')) return { blob: file, compressed: false };
    try {
      const bitmap = await createImageBitmap(file);
      const max = 1600;
      let { width, height } = bitmap;
      if (width > max || height > max) {
        const scale = Math.min(max / width, max / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { blob: file, compressed: false };
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.82)
      );
      return { blob, compressed: true };
    } catch {
      return { blob: file, compressed: false };
    }
  }

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: { file: File; preview?: string; compressed?: boolean }[] = [];
    for (const f of Array.from(list).slice(0, 5)) {
      const { blob, compressed } = await compressImage(f);
      const file = new File([blob], f.name.replace(/\.(png|webp|gif)$/i, '.jpg'), {
        type: blob.type || f.type,
      });
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      next.push({ file, preview, compressed });
    }
    setPendingFiles((p) => [...p, ...next].slice(0, 8));
  }

  async function sendReply() {
    if (!activeId || (!reply.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      const attachments: any[] = [];
      for (const pf of pendingFiles) {
        const fd = new FormData();
        fd.append('file', pf.file);
        if (pf.compressed) fd.append('compressed', '1');
        const up = await fetch('/api/support/upload', { method: 'POST', body: fd });
        const ud = await up.json();
        if (up.ok && ud.attachment) attachments.push(ud.attachment);
      }
      const res = await fetch(`/api/support/tickets/${activeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply, attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setReply('');
      setPendingFiles([]);
      setActive(data.ticket);
      loadList();
    } catch (e) {
      alert(String(e));
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: SupportTicketStatus) {
    if (!activeId) return;
    const res = await fetch(`/api/support/tickets/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setActive(data.ticket);
      loadList();
    }
  }

  async function hardDeleteTicket(id: string) {
    if (!confirm('Bu ticket we ähli faýllary doly pozular. Dowam?')) return;
    const res = await fetch(`/api/support/tickets/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Pozup bolmady');
      return;
    }
    if (activeId === id) {
      setActiveId(null);
      setActive(null);
    }
    await loadList();
  }

  async function moveToTrash(id: string) {
    const res = await fetch(`/api/support/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'trashed' }),
    });
    if (res.ok) {
      if (activeId === id) {
        setActiveId(null);
        setActive(null);
      }
      await loadList();
      setStatusFilter('trashed');
    }
  }

  const unread = (t: TicketListItem) =>
    mode === 'admin' ? t.unreadForAdmin || 0 : t.unreadForUser || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100dvh-8rem)] min-h-[420px]">
      {/* List */}
      <div
        className={cn(
          'lg:w-80 shrink-0 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden',
          activeId ? 'hidden lg:flex' : 'flex'
        )}
      >
        <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="h-4 w-4 text-indigo-400 shrink-0" />
            <h2 className="text-sm font-semibold text-white truncate">
              {mode === 'admin' ? 'Goldaw ticketleri' : 'Meniň ýüzlenmelerim'}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* User: checkbox filter — Ählisi / Açyk (trashed never shown to user) */}
            {mode === 'user' && (
              <label
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 hover:border-slate-600"
                title={statusFilter === 'open' ? 'Diňe açyk' : 'Ählisi (açyk we beýlekiler)'}
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={statusFilter === 'open'}
                  onChange={(e) => {
                    setStatusFilter(e.target.checked ? 'open' : 'all');
                    setActiveId(null);
                    setActive(null);
                  }}
                />
                <span className="whitespace-nowrap">
                  {statusFilter === 'open' ? 'Açyk' : 'Ählisi'}
                </span>
              </label>
            )}
            {mode === 'user' && (
              <Button size="sm" onClick={() => setComposing(true)}>
                <Plus className="h-3.5 w-3.5" />
                Täze
              </Button>
            )}
          </div>
        </div>

        {/* Admin: full status tabs (incl. Pozulanlar). User: no tabs — checkbox above */}
        {mode === 'admin' && (
          <div className="px-2 pt-2 pb-1 border-b border-slate-800/80 flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? statusCounts.all - (statusCounts.trashed || 0)
                  : statusCounts[tab.key] || 0;
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setActiveId(null);
                    setActive(null);
                  }}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-lg border transition-colors inline-flex items-center gap-1',
                    active
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'min-w-[1.1rem] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center',
                      active ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Ýüklenýär...</p>
          ) : visibleTickets.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {statusFilter === 'trashed'
                ? 'Pozulan ticket ýok'
                : mode === 'user'
                  ? 'Heniz ýüzlenme ýok. Teklip, säwlik ýa-da sorag ýazyň.'
                  : 'Bu bölümde ticket ýok.'}
            </div>
          ) : (
            visibleTickets.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors',
                  activeId === t.id && 'bg-indigo-500/10'
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className="w-full text-left px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100 truncate">{t.subject}</p>
                    {unread(t) > 0 && (
                      <span className="shrink-0 h-5 min-w-5 px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
                        {unread(t)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', STATUS_COLOR[t.status])}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {CATEGORIES.find((c) => c.value === t.category)?.label}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {(t.messageCount ?? t.messages?.length ?? 0)} hat
                    </span>
                  </div>
                  {mode === 'admin' && (
                    <p className="mt-1 text-[11px] text-slate-500 truncate">
                      {t.userName} · @{t.userUsername}
                    </p>
                  )}
                </button>
                {mode === 'admin' && t.status === 'trashed' && (
                  <div className="px-3 pb-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void hardDeleteTicket(t.id)}
                      className="text-[10px] px-2 py-1 rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/15"
                    >
                      Düýbünden poz
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread / compose */}
      <div
        className={cn(
          'flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 min-w-0 overflow-hidden',
          !activeId && !composing ? 'hidden lg:flex' : 'flex'
        )}
      >
        {composing ? (
          <div
            className="flex flex-col h-full min-h-0"
            style={kbInset > 0 ? { paddingBottom: kbInset } : undefined}
          >
            <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 sm:pt-5 shrink-0">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-base font-semibold text-white">Täze ýüzlenme</h3>
            </div>
            <div
              ref={composeScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 space-y-3"
            >
              <p className="text-xs text-slate-500">
                Bu hat diňe adminlere gidýär. Teklip, maslahat, säwlik ýa-da sorag ýazyň.
              </p>
              <Input
                label="Tema"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Gysga tema..."
                onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              />
              <Select
                label="Görnüşi"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Hat</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Jikme-jik ýazyň..."
                  onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
                />
              </div>
            </div>
            <div className="shrink-0 flex gap-2 justify-end px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-900/90 backdrop-blur-sm">
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                Ýatyr
              </Button>
              <Button size="sm" loading={sending} onClick={createTicket}>
                Iber
              </Button>
            </div>
          </div>
        ) : !activeId || !active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Ticket saýlaň ýa-da täze ýüzlenme dörediň</p>
            {mode === 'user' && (
              <Button className="mt-4" size="sm" onClick={() => setComposing(true)}>
                <Plus className="h-4 w-4" />
                Täze ýüzlenme
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="px-3 sm:px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white truncate">{active.subject}</h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {mode === 'admin' && `${active.userName} · `}
                  {CATEGORIES.find((c) => c.value === active.category)?.label}
                </p>
              </div>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md', STATUS_COLOR[active.status])}>
                {STATUS_LABEL[active.status]}
              </span>
              {mode === 'admin' && (
                <>
                  <select
                    value={active.status}
                    onChange={(e) => setStatus(e.target.value as SupportTicketStatus)}
                    className="h-8 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300 px-2"
                  >
                    {(Object.keys(STATUS_LABEL) as SupportTicketStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {active.status !== 'trashed' ? (
                    <button
                      type="button"
                      onClick={() => void moveToTrash(active.id)}
                      className="h-8 px-2 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800"
                      title="Pozulanlara geçir"
                    >
                      Trash
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void hardDeleteTicket(active.id)}
                      className="h-8 px-2 rounded-lg border border-rose-500/40 text-[11px] text-rose-300 hover:bg-rose-500/15"
                      title="Faýllar bilen doly poz"
                    >
                      Düýbünden poz
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {active.messages.map((m) => {
                const mine =
                  mode === 'admin' ? m.isStaffReply : !m.isStaffReply;
                return (
                  <div
                    key={m.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm',
                        mine
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-slate-800 text-slate-100 rounded-bl-md'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium opacity-80">
                          {m.authorName}
                          {m.isStaffReply ? ' · Admin' : ''}
                        </span>
                      </div>
                      {m.body && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                      )}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.attachments.map((a) =>
                            a.mime?.startsWith('image/') ? (
                              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt={a.name} className="max-h-40 rounded-lg border border-white/10" />
                              </a>
                            ) : (
                              <a
                                key={a.id}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-indigo-300 underline break-all"
                              >
                                {a.name}
                              </a>
                            )
                          )}
                        </div>
                      )}
                      {mine && (
                        <div className="mt-1 flex justify-end text-[10px] opacity-80">
                          {m.readAt ? (
                            <span className="text-sky-300" title="Okaldy">✓✓</span>
                          ) : m.deliveredAt ? (
                            <span title="Baryp ýetdi">✓✓</span>
                          ) : (
                            <span title="Ugradyldy">✓</span>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] opacity-60 mt-1 text-right">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {active.status !== 'closed' && active.status !== 'trashed' ? (
              <div
                className="p-3 border-t border-slate-800 space-y-2 shrink-0 bg-slate-900/90 backdrop-blur-sm"
                style={kbInset > 0 ? { paddingBottom: Math.max(12, kbInset) } : undefined}
              >
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="hidden"
                  onChange={(e) => {
                    void onPickFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((pf, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 inline-flex items-center gap-1 border border-slate-700"
                      >
                        {pf.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pf.preview} alt="" className="h-6 w-6 rounded object-cover" />
                        ) : (
                          <Paperclip className="h-3 w-3" />
                        )}
                        <span className="max-w-[100px] truncate">{pf.file.name}</span>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-rose-400"
                          onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 sm:gap-2 items-end">
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      title="Faýl"
                      onClick={() => {
                        if (fileRef.current) {
                          fileRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,image/*';
                          fileRef.current.click();
                        }
                      }}
                      className="h-9 w-9 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Surat"
                      onClick={() => {
                        if (fileRef.current) {
                          fileRef.current.accept = 'image/*';
                          fileRef.current.click();
                        }
                      }}
                      className="h-9 w-9 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder={mode === 'admin' ? 'Jogap ýazyň...' : 'Adminlere ýazyň...'}
                    className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                    onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    loading={sending}
                    onClick={() => void sendReply()}
                    disabled={!reply.trim() && pendingFiles.length === 0}
                    className="h-9 w-9 p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t border-slate-800 text-center text-xs text-slate-500">
                Bu ticket ýapyk
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
