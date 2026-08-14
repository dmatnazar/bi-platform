'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserCircle, Camera, Trash2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/components/ui/Toast';

function compressImage(file: File, maxW: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [maxW, setMaxW] = useState(256);
  const [quality, setQuality] = useState(0.75);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toLocalPhone(p?: string | null) {
    if (!p) return '';
    return String(p).replace(/^\+?993\s?/, '').replace(/\D/g, '').slice(0, 8);
  }

  async function load() {
    const d = await fetch('/api/auth/me').then((r) => r.json());
    setUser(d.user);
    setFullName(d.user?.fullName || '');
    setPhoneLocal(toLocalPhone(d.user?.phone));
    setEmail(d.user?.email || '');
    setPassword('');
    if (d.user?.username) {
      const base = (await fetch('/api/settings/public').then((r) => r.json()).catch(() => ({})))
        .gatewayUrl;
      if (base) {
        setAvatarUrl(
          `${String(base).replace(/\/$/, '')}/api/avatars/${encodeURIComponent(d.user.username)}?t=${Date.now()}`
        );
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const phone = phoneLocal ? `+993${phoneLocal.replace(/\D/g, '')}` : '';
      const body: Record<string, string> = { fullName, phone, email };
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
      setPassword('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file || !user?.username) return;
    try {
      const dataUrl = await compressImage(file, maxW, quality);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Avatar ýüklenmedi', data.error);
        return;
      }
      toastSuccess('Avatar saklandy');
      setAvatarUrl(data.url + `?t=${Date.now()}`);
    } catch (e) {
      toastError('Surat ýalňyşlygy', String(e));
    }
  }

  async function removeAvatar() {
    const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
    if (res.ok) {
      setAvatarUrl('');
      toastSuccess('Avatar pozuldy');
    }
  }

  if (!user) return <p className="text-slate-500 text-sm">Ýüklenýär...</p>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-2">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white">Profil</h1>
          <p className="text-sm text-slate-400">@{user.username}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-800">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
                onError={() => setAvatarUrl('')}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <UserCircle className="h-16 w-16 text-slate-600" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              Surat
            </Button>
            {avatarUrl && (
              <Button size="sm" variant="ghost" onClick={removeAvatar}>
                <Trash2 className="h-4 w-4" />
                Poz
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          <div className="flex gap-3 text-xs text-slate-400 items-center">
            <label className="flex items-center gap-1">
              max
              <input
                type="number"
                className="w-16 h-7 rounded bg-slate-950 border border-slate-700 px-1"
                value={maxW}
                onChange={(e) => setMaxW(Number(e.target.value) || 256)}
              />
              px
            </label>
            <label className="flex items-center gap-1">
              hil
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="1"
                className="w-14 h-7 rounded bg-slate-950 border border-slate-700 px-1"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value) || 0.75)}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Input label="Doly ady" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Login" value={user.username} disabled />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Parol (üýtgetmek üçin)</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Täze parol (min 6)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? 'Gizle' : 'Görkez'}
              </button>
            </div>
          </div>
          <Input label="Rol" value={user.role} disabled />
          <Input label="Kompaniýa" value={user.companyName || user.companySlug || '—'} disabled />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Telefon</label>
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/40">
              <span className="shrink-0 px-3 py-2.5 text-sm font-mono text-slate-400 bg-slate-900 border-r border-slate-700 select-none">
                +993
              </span>
              <input
                type="tel"
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                placeholder="61 123456"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, '').slice(0, 10))}
              />
            </div>
          </div>
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <Button className="w-full" loading={saving} onClick={saveProfile}>
          Ýatda sakla
        </Button>
      </div>
    </div>
  );
}
