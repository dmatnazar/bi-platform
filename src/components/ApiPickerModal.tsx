'use client';

/**
 * Reusable API picker — table + search + optional company auto-filter.
 * Used by widget config and dashboard filters.
 * Can open the full Admin → API-lar editor (add / edit) in an embed frame.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, Filter, Plus, Pencil, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApiPickerEndpoint {
  id: string;
  name: string;
  method?: string;
  pathTemplate?: string;
  tenantSlug?: string;
  dbKey?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  endpoints: ApiPickerEndpoint[];
  value?: string;
  onSelect: (ep: ApiPickerEndpoint) => void;
  /** Prefer showing this company's APIs first / default filter */
  preferredTenantSlug?: string;
  title?: string;
  /** Show Täze API / Üýtget (default true) */
  allowManage?: boolean;
  /** Called after embed editor closes so parent can refresh /api/catalog */
  onEndpointsChanged?: () => void;
}

function buildEditorSrc(opts: {
  mode: 'new' | 'edit';
  id?: string;
  tenant?: string;
}): string {
  const q = new URLSearchParams();
  q.set('embed', '1');
  if (opts.mode === 'new') {
    q.set('new', '1');
    if (opts.tenant) q.set('tenant', opts.tenant);
  } else if (opts.id) {
    q.set('edit', opts.id);
  }
  return `/admin/apis?${q.toString()}`;
}

export function ApiPickerModal({
  open,
  onClose,
  endpoints,
  value,
  onSelect,
  preferredTenantSlug,
  title = 'API saýlaň (data source)',
  allowManage = true,
  onEndpointsChanged,
}: Props) {
  const [q, setQ] = useState('');
  const [slugFilter, setSlugFilter] = useState<string>(preferredTenantSlug || '');
  const [autoFilter, setAutoFilter] = useState(Boolean(preferredTenantSlug));
  const [sortKey, setSortKey] = useState<'name' | 'method' | 'path' | 'tenant' | 'db'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  /** highlighted row (for Üýtget) — may differ from committed value until Saýla */
  const [highlightId, setHighlightId] = useState<string | undefined>(value);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  useEffect(() => {
    if (open) {
      setQ('');
      setHighlightId(value);
      setEditorSrc(null);
      if (preferredTenantSlug) {
        setSlugFilter(preferredTenantSlug);
        setAutoFilter(true);
      }
      // Parent catalog empty → ask refresh (widget/filter onEndpointsChanged)
      if ((!endpoints || endpoints.length === 0) && onEndpointsChanged) {
        onEndpointsChanged();
      }
    }
  }, [open, preferredTenantSlug, value, endpoints, onEndpointsChanged]);

  // Listen for embed editor close
  useEffect(() => {
    if (!editorSrc) return;
    function onMsg(ev: MessageEvent) {
      if (ev?.data?.type === 'bi-api-editor-closed') {
        setEditorSrc(null);
        onEndpointsChanged?.();
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [editorSrc, onEndpointsChanged]);

  const tenantOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of endpoints) {
      if (e.tenantSlug) set.add(e.tenantSlug);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tk'));
  }, [endpoints]);

  const filtered = useMemo(() => {
    let list = [...endpoints];
    const activeSlug = autoFilter ? preferredTenantSlug || slugFilter : slugFilter;
    if (activeSlug) {
      list = list.filter((e) => e.tenantSlug === activeSlug);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((e) => {
        const hay = `${e.name} ${e.method || ''} ${e.pathTemplate || ''} ${e.tenantSlug || ''} ${e.dbKey || ''}`.toLowerCase();
        return hay.includes(query);
      });
    }
    list.sort((a, b) => {
      if (preferredTenantSlug && !activeSlug) {
        const ap = a.tenantSlug === preferredTenantSlug ? 0 : 1;
        const bp = b.tenantSlug === preferredTenantSlug ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      const av =
        sortKey === 'method'
          ? a.method || ''
          : sortKey === 'path'
            ? a.pathTemplate || ''
            : sortKey === 'tenant'
              ? a.tenantSlug || ''
              : sortKey === 'db'
                ? a.dbKey || ''
                : a.name || '';
      const bv =
        sortKey === 'method'
          ? b.method || ''
          : sortKey === 'path'
            ? b.pathTemplate || ''
            : sortKey === 'tenant'
              ? b.tenantSlug || ''
              : sortKey === 'db'
                ? b.dbKey || ''
                : b.name || '';
      const cmp = String(av).localeCompare(String(bv), 'tk', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [endpoints, q, slugFilter, autoFilter, preferredTenantSlug, sortKey, sortDir]);

  const highlighted = useMemo(
    () => endpoints.find((e) => e.id === highlightId),
    [endpoints, highlightId]
  );

  function openNew() {
    setEditorSrc(
      buildEditorSrc({
        mode: 'new',
        tenant: preferredTenantSlug || slugFilter || highlighted?.tenantSlug || '',
      })
    );
  }

  function openEdit(ep?: ApiPickerEndpoint) {
    const target = ep || highlighted;
    if (!target?.id) return;
    setEditorSrc(buildEditorSrc({ mode: 'edit', id: target.id }));
  }

  function closeEditor() {
    setEditorSrc(null);
    onEndpointsChanged?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[min(92dvh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            <p className="text-[10px] text-slate-500">
              {filtered.length} / {endpoints.length} API
              {preferredTenantSlug ? ` · dashboard firma: ${preferredTenantSlug}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-800 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Gözle: ady, path, method, firma…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {preferredTenantSlug && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={autoFilter}
                  onChange={(e) => {
                    setAutoFilter(e.target.checked);
                    if (e.target.checked) setSlugFilter(preferredTenantSlug);
                    else setSlugFilter('');
                  }}
                />
                <Filter className="h-3 w-3 text-indigo-400" />
                Awto: diňe bu firma
              </label>
            )}
            <select
              value={autoFilter ? preferredTenantSlug || '' : slugFilter}
              disabled={autoFilter && !!preferredTenantSlug}
              onChange={(e) => {
                setAutoFilter(false);
                setSlugFilter(e.target.value);
              }}
              className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-white disabled:opacity-60"
            >
              <option value="">Ähli firmalar</option>
              {tenantOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {allowManage && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-emerald-700/50 bg-emerald-950/40 text-[11px] text-emerald-300 hover:bg-emerald-900/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Täze API
                </button>
                <button
                  type="button"
                  disabled={!highlighted?.id}
                  onClick={() => openEdit()}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-indigo-700/50 bg-indigo-950/40 text-[11px] text-indigo-300 hover:bg-indigo-900/40 disabled:opacity-40 disabled:pointer-events-none"
                  title={highlighted ? `Üýtget: ${highlighted.name}` : 'Ilki setir saýlaň'}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Üýtget
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                {(
                  [
                    ['method', 'Method', ''],
                    ['name', 'Ady', ''],
                    ['path', 'Path', 'hidden sm:table-cell'],
                    ['tenant', 'Firma', ''],
                    ['db', 'DB', 'hidden md:table-cell'],
                    ['act', '', 'w-10'],
                  ] as const
                ).map(([key, label, cls]) => (
                  <th
                    key={key}
                    className={`px-3 py-2 font-medium ${key !== 'act' ? 'cursor-pointer select-none hover:text-indigo-300' : ''} ${cls}`}
                    onClick={key !== 'act' ? () => toggleSort(key as typeof sortKey) : undefined}
                  >
                    {label}
                    {key !== 'act' && sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Netije ýok
                    {allowManage && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={openNew}
                          className="inline-flex items-center gap-1 text-emerald-400 hover:underline text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Täze API döret
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const selected = highlightId === e.id || value === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => {
                        setHighlightId(e.id);
                        onSelect(e);
                        onClose();
                      }}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selected
                          ? 'bg-indigo-500/15 text-white'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            e.method === 'POST'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          )}
                        >
                          {e.method || 'GET'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium max-w-[140px] sm:max-w-none truncate">
                        {e.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-400 hidden sm:table-cell max-w-[200px] truncate">
                        {e.pathTemplate}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{e.tenantSlug}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell">
                        {e.dbKey || 'primary'}
                      </td>
                      <td className="px-2 py-2.5">
                        {allowManage && (
                          <button
                            type="button"
                            title="Üýtget"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setHighlightId(e.id);
                              openEdit(e);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Admin API editor embed — same module as /admin/apis */}
      {editorSrc && (
        <div className="fixed inset-0 z-[2147483010] flex flex-col bg-slate-950">
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900">
            <p className="text-xs text-slate-400 truncate">
              API-lar redaktory (Admin modul)
            </p>
            <div className="flex items-center gap-2">
              <a
                href={editorSrc.replace('embed=1&', '').replace('embed=1', '')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Täze tab
              </a>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Ýap / täzele
              </button>
            </div>
          </div>
          <iframe
            title="API editor"
            src={editorSrc}
            className="flex-1 w-full border-0 bg-slate-950"
          />
        </div>
      )}
    </div>
  );
}
