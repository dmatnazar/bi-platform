'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { UserCheck, Check, X } from 'lucide-react';

interface Reg {
  id: string;
  companyName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  status: string;
  createdAt: string;
}

export default function RegistrationsPage() {
  const [list, setList] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/registrations?status=pending');
      const textBody = await res.text();
      let data: any = {};
      try {
        data = textBody ? JSON.parse(textBody) : {};
      } catch {
        data = {};
      }
      setList(Array.isArray(data.registrations) ? data.registrations : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, role: 'viewer' }),
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Hasaba alyş islegleri</h1>
        <p className="text-slate-400 text-sm mt-1">Täze işgärleri tassyklamak ýa-da ret etmek</p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Ýüklenýär...</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
          <UserCheck className="h-9 w-9 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400">Garaşylýan isleg ýok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-white">
                  {r.firstName} {r.lastName}
                </p>
                <p className="text-sm text-slate-400">
                  @{r.username} · {r.email} · {r.phone}
                </p>
                <p className="text-xs text-slate-500">
                  {r.companyName} · {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  loading={acting === r.id}
                  onClick={() => act(r.id, 'approve')}
                >
                  <Check className="h-4 w-4" />
                  Tassykla
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={acting === r.id}
                  onClick={() => act(r.id, 'reject')}
                >
                  <X className="h-4 w-4" />
                  Ret et
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
