'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  UserCircle,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Shield,
  Building2,
  Save,
} from 'lucide-react';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { BalanceBadge } from '@/components/billing/BalanceBadge';
import { cn } from '@/lib/utils';

type PresetAvatar = { id: string; url: string; name: string };

export default function ProfilePage() {
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
    void load();
  }, [load]);

  const avatarUrl = selectedAvatar
    ? `/avatars/${encodeURIComponent(selectedAvatar)}`
    : null;

  async function saveProfile() {
    setSaving(true);
    try {
      const phone = phoneLocal ? `+993${phoneLocal.replace(/\D/g, '')}` : '';
      const body: Record<string, string> = {
        fullName,
        phone,
        email,
        username: login.trim(),
      };
      if (password.trim().length >= 6) body.password = password.trim();
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      toastSuccess('Profil täzelendi');
      await load();
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
      if (!res.ok) {
        toastError('Avatar', data.error);
        return;
      }
      setSelectedAvatar(data.selected);
      setPickerOpen(false);
      toastSuccess('Avatar saýlandy');
    } finally {
      setSavingAvatar(false);
    }
  }

  async function clearAvatar() {
    setSavingAvatar(true);
    try {
      await fetch('/api/profile/avatars', { method: 'DELETE' });
      setSelectedAvatar(null);
      toastSuccess('Avatar aýryldy');
    } finally {
      setSavingAvatar(false);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        Ýüklenýär...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-3 pb-6">
      {/* Compact header row */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl font-bold text-white leading-tight">Profil</h1>
        {user?.companySlug && (
          <BalanceBadge
            companySlug={user.companySlug}
            username={user.username}
            role={user.role}
            compact
          />
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        {/* Compact avatar row */}
        <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-800 shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <UserCircle className="h-8 w-8 text-slate-600" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{fullName || login}</p>
            <p className="text-[11px] text-slate-500 truncate">@{login}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                <Shield className="h-2.5 w-2.5 text-indigo-400" />
                {user.role}
              </span>
              {(user.companyName || user.companySlug) && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 max-w-[9rem] truncate">
                  <Building2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{user.companyName || user.companySlug}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 pb-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => setPickerOpen((v) => !v)}
            loading={savingAvatar}
          >
            Avatar saýla
          </Button>
          {selectedAvatar && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={clearAvatar}
              disabled={savingAvatar}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Aýyr
            </Button>
          )}
        </div>

        {pickerOpen && (
          <div className="px-3 sm:px-4 pb-3">
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-2">
              {avatars.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-3 text-center">
                  Avatar ýok. Admin <code className="text-slate-400">public/avatars</code> goýmaly.
                </p>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                  {avatars.map((a) => {
                    const on = selectedAvatar === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={savingAvatar}
                        onClick={() => void selectAvatar(a.id)}
                        className={cn(
                          'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                          on
                            ? 'border-indigo-400 ring-2 ring-indigo-500/30'
                            : 'border-slate-700 hover:border-slate-500'
                        )}
                        title={a.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                        {on && (
                          <span className="absolute inset-0 bg-indigo-500/25 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white drop-shadow" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-3 sm:px-4 pb-4 space-y-2.5 border-t border-slate-800/80 pt-3">
          <Input
            label="Doly ady"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Parol</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-10 px-3 pr-9 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Täze parol (min 6)"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Telefon</label>
            <div className="flex rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50">
              <span className="shrink-0 px-2.5 py-2 text-xs font-mono text-slate-400 bg-slate-950 border-r border-slate-700">
                +993
              </span>
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="61 123456"
                inputMode="numeric"
                className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Rol</label>
            <div className="h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-sm text-slate-400">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-medium text-slate-300 text-xs sm:text-sm">{user.role}</span>
              <span className="ml-auto text-[9px] text-slate-600">üýtgedip bolanok</span>
            </div>
          </div>

          <Button className="w-full h-10 mt-0.5" loading={saving} onClick={saveProfile}>
            <Save className="h-4 w-4" />
            Ýatda sakla
          </Button>
        </div>
      </div>
    </div>
  );
}
