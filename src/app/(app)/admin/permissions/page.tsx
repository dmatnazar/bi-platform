'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Save,
  RotateCcw,
  Lock,
  Check,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError, toastInfo } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

type StaffRole = 'super_admin' | 'admin' | 'editor' | 'viewer';
type PermissionKey = string;

interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  superOnly?: boolean;
}

type Matrix = Record<StaffRole, Partial<Record<PermissionKey, boolean>>>;

const ROLE_META: {
  id: StaffRole;
  label: string;
  short: string;
  color: string;
  locked?: boolean;
}[] = [
  {
    id: 'super_admin',
    label: 'Super admin',
    short: 'Super',
    color: 'from-amber-500 to-orange-600',
    locked: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    short: 'Admin',
    color: 'from-indigo-500 to-violet-600',
  },
  {
    id: 'editor',
    label: 'Editor',
    short: 'Editor',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    short: 'Viewer',
    color: 'from-slate-500 to-slate-600',
  },
];

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [defs, setDefs] = useState<PermissionDef[]>([]);
  const [groups, setGroups] = useState<{ group: string; items: PermissionDef[] }[]>([]);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeRole, setActiveRole] = useState<StaffRole>('admin');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      if (!res.ok) {
        setForbidden(true);
        return;
      }
      if (!data.matrix || !data.defs) {
        setForbidden(true);
        return;
      }
      setDefs(data.defs);
      setGroups(data.groups || []);
      setMatrix(data.matrix);
      setDirty(false);
    } catch {
      toastError('Ýüklenmedi', 'Rugsatlar alynmady');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(role: StaffRole, key: PermissionKey) {
    if (role === 'super_admin') return;
    const def = defs.find((d) => d.key === key);
    if (def?.superOnly) return;
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        [role]: {
          ...prev[role],
          [key]: !prev[role]?.[key],
        },
      };
      return next;
    });
    setDirty(true);
  }

  function setAllInGroup(role: StaffRole, groupItems: PermissionDef[], value: boolean) {
    if (role === 'super_admin') return;
    setMatrix((prev) => {
      if (!prev) return prev;
      const row = { ...prev[role] };
      for (const item of groupItems) {
        if (item.superOnly) continue;
        row[item.key] = value;
      }
      return { ...prev, [role]: row };
    });
    setDirty(true);
  }

  async function save() {
    if (!matrix) return;
    setSaving(true);
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      setMatrix(data.matrix);
      setDirty(false);
      toastSuccess('Saklandy', 'Rol rugsatlary täzelendi');
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    const ok = await confirmDialog({
      title: 'Deslapky rugsatlar',
      message:
        'Ähli üýtgeşmeler pozular we deslapky (zawod) rugsatlar dikeldiler. Dowam edilsinmi?',
      confirmLabel: 'Dikelt',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Dikelmedi', data.error);
        return;
      }
      setMatrix(data.matrix);
      setDirty(false);
      toastInfo('Dikeldildi', 'Deslapky rugsatlar ýüklendi');
    } finally {
      setSaving(false);
    }
  }

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            i.key.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter]);

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-rose-300" />
        </div>
        <h1 className="text-lg font-semibold text-white">Rugsat ýok</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Bu modul diňe <span className="text-amber-300">super admin</span> üçin açyk.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-white leading-tight">Rugsatlar</h1>
            <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 leading-snug">
              Rol boýunça modul we amal rugsatlary · diňe super admin
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={resetDefaults}
            disabled={saving || loading}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Deslapky</span>
          </Button>
          <Button
            size="sm"
            onClick={save}
            loading={saving}
            disabled={!dirty || loading}
            className="flex-1 sm:flex-none"
          >
            <Save className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Sakla{dirty ? ' *' : ''}</span>
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 flex gap-2 text-[11px] sm:text-xs text-amber-100/90">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <p>
          <strong className="text-amber-200">Super admin</strong> hemişe ähli rugsatlara eýe we
          üýtgedilmeýär. Diňe <strong className="text-amber-200">admin / editor / viewer</strong>{' '}
          üçin bellikleri üýtgedip bilersiňiz. Käbir rugsatlar (slug, tarif, programmalar…) diňe
          super admin-de galýar.
        </p>
      </div>

      {/* Role tabs — horizontal scroll on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {ROLE_META.map((r) => {
          const active = activeRole === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRole(r.id)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition-colors',
                active
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full bg-gradient-to-br',
                  r.color
                )}
              />
              <span className="sm:hidden">{r.short}</span>
              <span className="hidden sm:inline">{r.label}</span>
              {r.locked && <Lock className="h-3 w-3 text-amber-400/80" />}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Rugsat gözle..."
          className="w-full h-9 pl-3 pr-3 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {loading || !matrix ? (
        <div className="text-center text-slate-500 text-sm py-12">Ýüklenýär...</div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((g) => {
            const isCollapsed = collapsed[g.group];
            const enabledCount = g.items.filter((i) => matrix[activeRole]?.[i.key]).length;
            return (
              <div
                key={g.group}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden"
              >
                <div className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-800/40 transition-colors">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [g.group]: !c[g.group] }))
                    }
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-white flex-1 truncate">
                      {g.group}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-500 tabular-nums">
                      {enabledCount}/{g.items.length}
                    </span>
                  </button>
                  {activeRole !== 'super_admin' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="text-[10px] px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40"
                        onClick={() => setAllInGroup(activeRole, g.items, true)}
                        title="Ählisini aç"
                      >
                        Ähli
                      </button>
                      <button
                        type="button"
                        className="text-[10px] px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/40"
                        onClick={() => setAllInGroup(activeRole, g.items, false)}
                        title="Ählisini ýap"
                      >
                        Hiç
                      </button>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <ul className="border-t border-slate-800/80 divide-y divide-slate-800/60">
                    {g.items.map((item) => {
                      const on = Boolean(matrix[activeRole]?.[item.key]);
                      const locked =
                        activeRole === 'super_admin' || Boolean(item.superOnly);
                      return (
                        <li
                          key={item.key}
                          className={cn(
                            'flex items-start sm:items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3',
                            locked && 'opacity-70'
                          )}
                        >
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggle(activeRole, item.key)}
                            className={cn(
                              'mt-0.5 sm:mt-0 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                              on
                                ? 'bg-indigo-500 border-indigo-400 text-white'
                                : 'bg-slate-950 border-slate-600 text-transparent',
                              locked && 'cursor-not-allowed'
                            )}
                            aria-checked={on}
                            role="checkbox"
                          >
                            {on && <Check className="h-3 w-3" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm text-slate-100 font-medium">
                                {item.label}
                              </span>
                              {item.superOnly && (
                                <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                  Super only
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {!filteredGroups.length && (
            <p className="text-center text-slate-500 text-sm py-8">Tapylmady</p>
          )}
        </div>
      )}

      {/* Sticky mobile save bar */}
      {dirty && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur px-3 py-2.5 flex gap-2 safe-area-pb">
          <Button variant="secondary" className="flex-1 h-10" onClick={load} disabled={saving}>
            Ýatyr
          </Button>
          <Button className="flex-1 h-10" loading={saving} onClick={save}>
            <Save className="h-4 w-4" />
            Sakla
          </Button>
        </div>
      )}
    </div>
  );
}
