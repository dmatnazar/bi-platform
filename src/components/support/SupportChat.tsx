'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
};

const STATUS_COLOR: Record<SupportTicketStatus, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-400',
};

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/support/tickets');
    const data = await res.json();
    if (res.ok) setTickets(data.tickets || []);
    setLoading(false);
  }, []);

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

  async function sendReply() {
    if (!activeId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${activeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şowsuz');
      setReply('');
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
          {mode === 'user' && (
            <Button size="sm" onClick={() => setComposing(true)}>
              <Plus className="h-3.5 w-3.5" />
              Täze
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Ýüklenýär...</p>
          ) : tickets.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {mode === 'user'
                ? 'Heniz ýüzlenme ýok. Teklip, säwlik ýa-da sorag ýazyň.'
                : 'Açyk ticket ýok.'}
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors',
                  activeId === t.id && 'bg-indigo-500/10'
                )}
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
                </div>
                {mode === 'admin' && (
                  <p className="mt-1 text-[11px] text-slate-500 truncate">
                    {t.userName} · @{t.userUsername}
                  </p>
                )}
              </button>
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
          <div className="flex flex-col h-full p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-base font-semibold text-white">Täze ýüzlenme</h3>
            </div>
            <p className="text-xs text-slate-500">
              Bu hat diňe adminlere gidýär. Teklip, maslahat, säwlik ýa-da sorag ýazyň.
            </p>
            <Input
              label="Tema"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Gysga tema..."
            />
            <Select
              label="Görnüşi"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Hat</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Jikme-jik ýazyň..."
              />
            </div>
            <div className="flex gap-2 justify-end">
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
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                      <p className="text-[10px] opacity-60 mt-1 text-right">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {active.status !== 'closed' ? (
              <div className="p-3 border-t border-slate-800 flex gap-2 items-end">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder={mode === 'admin' ? 'Jogap ýazyň...' : 'Adminlere ýazyň...'}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <Button size="sm" loading={sending} onClick={sendReply} disabled={!reply.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
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
