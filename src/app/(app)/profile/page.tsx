'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserCircle, Camera, Trash2, Eye, EyeOff } from 'lucide-react';
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
  const [login, setLogin] = useState('');
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
    const u = d.user;
    setUser(u);
    setFullName(u?.fullName || '');
    setLogin(u?.username || '');
    setPhoneLocal(toLocalPhone(u?.phone));
    setEmail(u?.email || '');
    setPassword(u?.passwordPlain || '');
    if (u?.username) {
      const base = (await fetch('/api/settings/public').then((r) => r.json()).catch(() => ({})))
        .gatewayUrl;
      if (base) {
        setAvatarUrl(
          `${String(base).replace(/\/$/, '')}/api/avatars/${encodeURIComponent(u.username)}?t=${Date.now()}`
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
      setAvatarUrl((data.url || avatarUrl) + `?t=${Date.now()}`);
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
          <p className="text-sm text-slate-400">Hasap sazlamalary</p>
        </div>

        {/* Avatar row: photo + actions beside it */}
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-800">
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
                <UserCircle className="h-14 w-14 text-slate-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
              <label className="flex items-center gap-1.5">
                max
                <input
                  type="number"
                  min={64}
                  max={1024}
                  value={maxW}
                  onChange={(e) => setMaxW(Number(e.target.value) || 256)}
                  className="w-14 h-7 rounded-md border border-slate-700 bg-slate-950 px-1.5 text-slate-300"
                />
                px
              </label>
              <label className="flex items-center gap-1.5">
                hil
                <input
                  type="number"
                  min={0.3}
                  max={1}
                  step={0.05}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value) || 0.75)}
                  className="w-14 h-7 rounded-md border border-slate-700 bg-slate-950 px-1.5 text-slate-300"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Input label="Doly ady" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input
            label="Login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Parol</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Parol"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              VPS-de saklanan parol görkezilýär. Üýtgetmek üçin täze parol ýazyň (min 6).
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Telefon</label>
            <div className="flex rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50">
              <span className="shrink-0 px-3 py-2.5 text-sm font-mono text-slate-400 bg-slate-950 border-r border-slate-700">
                +993
              </span>
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="61 123456"
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white outline-none"
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
        </div>

        <Button className="w-full" loading={saving} onClick={saveProfile}>
          Ýatda sakla
        </Button>
      </div>
    </div>
  );
}
