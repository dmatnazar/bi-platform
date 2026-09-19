'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserCircle, Eye, EyeOff, X, GripHorizontal, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { BalanceBadge } from '@/components/billing/BalanceBadge';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

type PresetAvatar = { id: string; url: string; name: string };
const PANEL_POS = 'bi-profile-panel-pos';

export function broadcastAvatar(avatarId: string | null) {
  try {
    const url = avatarId ? `/avatars/${encodeURIComponent(avatarId)}` : null;
    window.dispatchEvent(new CustomEvent('bi-avatar-changed', { detail: { avatarId, avatarUrl: url } }));
  } catch { /* */ }
}

type Props = { open: boolean; onClose: () => void };

export function ProfilePanel({ open, onClose }: Props) {
  const { t } = useLocale();
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [avatars, setAvatars] = useState<PresetAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const a = () => setIsMobile(mq.matches);
    a();
    mq.addEventListener?.('change', a);
    return () => mq.removeEventListener?.('change', a);
  }, []);

  useEffect(() => {
    try {
      const r = localStorage.getItem(PANEL_POS);
      if (r) setPanelPos(JSON.parse(r));
    } catch { /* */ }
  }, []);

  function toLocalPhone(p?: string | null) {
    if (!p) return '';
    return String(p).replace(/^\+?993\s?/, '').replace(/\D/g, '').slice(0, 8);
  }

  const load = useCallback(async () => {
    const [meRes, avRes] = await Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/profile/avatars').then((r) => r.json()).catch(() => ({ avatars: [] })),
    ]);
    const u = meRes.user;
    setUser(u);
    setFullName(u?.fullName || '');
    setLogin(u?.username || '');
    setPhoneLocal(toLocalPhone(u?.phone));
    setEmail(u?.email || '');
    setPassword(u?.passwordPlain || '');
    setAvatars(avRes.avatars || []);
    setSelectedAvatar(avRes.selected || u?.avatar || null);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const avatarUrl = selectedAvatar
    ? selectedAvatar.startsWith('upload:')
      ? `/api/profile/avatar-file/${encodeURIComponent(selectedAvatar.slice(7))}`
      : `/avatars/${encodeURIComponent(selectedAvatar)}`
    : null;

  async function uploadCustom(file: File) {
    setSavingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/avatars', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('loadFailedLower'));
      setSelectedAvatar(data.selected);
      broadcastAvatar(data.selected);
      if (data.url) {
        window.dispatchEvent(
          new CustomEvent('bi-avatar-changed', { detail: { avatarId: data.selected, avatarUrl: data.url } })
        );
      }
      toastSuccess(t('avatarUploaded'));
    } catch (e) {
      toastError('Avatar', e instanceof Error ? e.message : String(e));
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const phone = phoneLocal ? `+993${phoneLocal.replace(/\D/g, '')}` : '';
      const body: Record<string, string> = { fullName, phone, email, username: login.trim() };
      if (password.trim().length >= 6) body.password = password.trim();
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'saklanmady');
      toastSuccess(t('profileSaved'));
      await load();
    } catch (e) {
      toastError(t('profile'), e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function selectAvatar(id: string) {
    setSavingAvatar(true);
    try {
      const res = await fetch('/api/profile/avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: id }),
      });
      const data = await res.json();
      if (!res.ok) { toastError('Avatar', data.error); return; }
      setSelectedAvatar(data.selected);
      setPickerOpen(false);
      broadcastAvatar(data.selected);
      toastSuccess(t('avatarSelected'));
    } finally {
      setSavingAvatar(false);
    }
  }

  async function clearAvatar() {
    setSavingAvatar(true);
    try {
      await fetch('/api/profile/avatars', { method: 'DELETE' });
      setSelectedAvatar(null);
      broadcastAvatar(null);
      toastSuccess(t('avatarRemoved'));
    } finally {
      setSavingAvatar(false);
    }
  }

  function clamp(x: number, y: number) {
    if (typeof window === 'undefined') return { x, y };
    const w = Math.min(420, window.innerWidth - 16);
    const h = Math.min(640, window.innerHeight - 24);
    return {
      x: Math.min(Math.max(8, window.innerWidth - w - 8), Math.max(8, x)),
      y: Math.min(Math.max(8, window.innerHeight - h - 8), Math.max(8, y)),
    };
  }

  function onDown(e: React.PointerEvent) {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    const base = panelPos || { x: (typeof window !== 'undefined' ? window.innerWidth - 436 : 16), y: 48 };
    drag.current = { px: e.clientX, py: e.clientY, ox: base.x, oy: base.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPanelPos(clamp(drag.current.ox + e.clientX - drag.current.px, drag.current.oy + e.clientY - drag.current.py));
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    setPanelPos((p) => {
      if (!p) return p;
      const c = clamp(p.x, p.y);
      try { localStorage.setItem(PANEL_POS, JSON.stringify(c)); } catch { /* */ }
      return c;
    });
  }

  if (!open || typeof document === 'undefined') return null;

  const h = isMobile
    ? Math.min(typeof window !== 'undefined' ? window.innerHeight * 0.9 : 640, 720)
    : Math.min(640, typeof window !== 'undefined' ? window.innerHeight - 24 : 640);
  const w = isMobile ? undefined : Math.min(420, typeof window !== 'undefined' ? window.innerWidth - 16 : 420);
  const pos = panelPos || (typeof window !== 'undefined' ? clamp(window.innerWidth - 436, 48) : { x: 16, y: 48 });

  return createPortal(
    <div className="fixed inset-0 z-[95] pointer-events-none">
      <div className="absolute inset-0 bg-black/35 pointer-events-auto" onClick={onClose} />
      <div
        className={cn(
          'pointer-events-auto absolute flex flex-col overflow-hidden bg-slate-950 border border-slate-700/80 shadow-2xl',
          isMobile ? 'inset-x-0 bottom-0 rounded-t-2xl' : 'rounded-2xl'
        )}
        style={isMobile ? { height: h } : { left: pos.x, top: pos.y, width: w, height: h }}
      >
        <div
          className={cn('shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/95', !isMobile && 'cursor-grab active:cursor-grabbing')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {!isMobile && <GripHorizontal className="h-4 w-4 text-slate-500" />}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-600 bg-slate-800 shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center"><UserCircle className="h-5 w-5 text-slate-500" /></div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">Profil</p>
              <p className="text-[10px] text-slate-500 truncate">{fullName || login || '…'}</p>
            </div>
          </div>
          <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {!user ? (
            <p className="text-sm text-slate-500 text-center py-8">{t('loading')}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPickerOpen((v) => !v)} className="h-16 w-16 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-800 shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><UserCircle className="h-8 w-8 text-slate-600" /></div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{fullName || login}</p>
                  <p className="text-[11px] text-slate-500">@{login}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    <button type="button" className="text-[11px] text-indigo-300 hover:underline" onClick={() => setPickerOpen((v) => !v)}>
                      Preset
                    </button>
                    <label className="text-[11px] text-sky-300 hover:underline cursor-pointer">
                      Surat ýükle
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void uploadCustom(f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
              {pickerOpen && (
                <div className="grid grid-cols-4 gap-2 p-2 rounded-xl border border-slate-700 bg-slate-900/80">
                  {avatars.map((a) => (
                    <button key={a.id} type="button" disabled={savingAvatar} onClick={() => void selectAvatar(a.id)}
                      className={cn('aspect-square rounded-xl overflow-hidden border-2', selectedAvatar === a.id ? 'border-indigo-400' : 'border-transparent')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url || `/avatars/${encodeURIComponent(a.id)}`} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400">Ady</label>
                <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <label className="text-[11px] text-slate-400">Login</label>
                <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" value={login} onChange={(e) => setLogin(e.target.value)} />
                <label className="text-[11px] text-slate-400">Telefon (+993)</label>
                <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                <label className="text-[11px] text-slate-400">Email</label>
                <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="text-[11px] text-slate-400">Parol</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPw((v) => !v)}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-slate-800 flex gap-2">
          <Button variant="ghost" className="flex-1 min-h-11" onClick={onClose}>Ýap</Button>
          <Button className="flex-1 min-h-11" loading={saving} onClick={() => void saveProfile()}><Save className="h-4 w-4" />{t('save')}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
