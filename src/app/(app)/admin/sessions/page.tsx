'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastError, toastSuccess } from '@/components/ui/Toast';

interface Sess {
  id: string;
  userId: string;
  username: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
}

export default function AdminSessionsPage() {
  const [list, setList] = useState<Sess[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sessions?all=1');
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        toastError('Ýüklenmedi', data.error);
        return;
      }
      setList(data.sessions || []);
      setCurrentId(data.currentSessionId || null);
    } catch (e) {
      toastError('Ýüklenmedi', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setActing(id);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Ýapylyp bilmedi', data.error);
        return;
      }
      toastSuccess('Seans ýapyldy');
      await load();
    } finally {
      setActing(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-6 text-slate-400 text-sm">
        Bu sahypa diňe super admin üçin. Rugsat ýok.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-400" />
            Aktiw seanslar
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ähli ulanyjylaryň açyk enjam seanslary. Ýapmak — indiki request-de logout.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" />
          Täzele
        </Button>
      </div>

      {loading && list.length === 0 ? (
        <p className="text-slate-500 text-sm">Ýüklenýär…</p>
      ) : list.length === 0 ? (
        <p className="text-slate-500 text-sm">Aktiw seans ýok.</p>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 flex flex-wrap items-start gap-3"
            >
              <Monitor className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{s.username}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{s.userId.slice(0, 8)}…</span>
                  {s.id === currentId && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      şu enjam
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300 mt-0.5">{s.deviceName}</p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  IP {s.ip || '—'} · soňky {new Date(s.lastSeenAt).toLocaleString()} ·{' '}
                  {s.userAgent?.slice(0, 80)}
                </p>
              </div>
              {s.id !== currentId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-300 hover:text-rose-200"
                  loading={acting === s.id}
                  onClick={() => void revoke(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Ýap
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
