'use client';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { useAppAnimations } from '@/lib/use-app-animations';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dashboard, DashboardExportPayload, DashboardWidget } from '@/lib/types';
import { generateId, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  LayoutDashboard,
  Clock,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
  Upload,
  X,
  Users,
  Building2,
  ArrowLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface CompanyBrief {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  initial: Dashboard[];
  canEdit: boolean;
  companies?: CompanyBrief[];
  userRole?: string;
  isSuperAdmin?: boolean;
  userCompanyId?: string;
  /** VPS slug → canonical company id for matching dashboards */
  companyIdBySlug?: Record<string, string>;
  userTenantSlugs?: string[];
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function remapWidgetIds(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((w) => ({ ...w, id: generateId() }));
}

export function DashboardListClient({
  initial,
  canEdit,
  companies = [],
  userRole = 'viewer',
  isSuperAdmin = false,
  userCompanyId = '',
  companyIdBySlug = {},
  userTenantSlugs = [],
}: Props) {
  const router = useRouter();
  const appAnimOn = useAppAnimations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  // Company drill-down: null = company list (admin/multi), set = dashboards of that company
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Soft restore: if user navigates back to /dashboards list after viewing one, keep list;
  // deep-links already open /dashboards/[id]. Remember last id for "soňky" badge only.
  useEffect(() => {
    try {
      const last = sessionStorage.getItem('bi-last-dashboard-id');
      if (last) setLastId(last);
    } catch {
      /* */
    }
  }, []);
  const [lastId, setLastId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [navPending, setNavPending] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Dashboard | null>(null);
  const [accessTarget, setAccessTarget] = useState<Dashboard | null>(null);
  const [staffOpts, setStaffOpts] = useState<{ id: string; fullName: string; username: string; role: string }[]>([]);
  const [selectedShare, setSelectedShare] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  /** Copy/move dashboard to another company */
  const [xferTarget, setXferTarget] = useState<Dashboard | null>(null);
  const [xferMode, setXferMode] = useState<'copy' | 'move'>('copy');
  const [xferCompanyId, setXferCompanyId] = useState('');
  const [xferBusy, setXferBusy] = useState(false);
  /** 1 = firma saýla, 2 = API deňeşdirme / confirm */
  const [xferStep, setXferStep] = useState<1 | 2>(1);
  const [xferDbKey, setXferDbKey] = useState('primary');
  const [xferDbOptions, setXferDbOptions] = useState<{ dbKey: string; label: string }[]>([
    { dbKey: 'primary', label: 'primary' },
  ]);
  /** Global policy for name conflicts */
  const [xferConflictPolicy, setXferConflictPolicy] = useState<'replace' | 'skip'>('skip');
  const [xferApiRows, setXferApiRows] = useState<
    {
      key: string;
      name: string;
      path: string;
      method: string;
      sourceId?: string;
      sqlQuery?: string;
      paramsSchema?: unknown;
      responseSchema?: unknown;
      cacheTtlSec?: number;
      authRequired?: boolean;
      conflict: boolean;
      targetId?: string;
      targetPath?: string;
      policy: 'replace' | 'skip' | 'create';
    }[]
  >([]);
  const [xferAnalyzeMsg, setXferAnalyzeMsg] = useState('');

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  // Companies that have at least one visible dashboard (or all companies for admin)
  function matchesCompany(d: Dashboard, companyId: string, slug?: string) {
    if (d.companyId === companyId) return true;
    if (slug && d.companyId === slug) return true;
    if (slug && d.companyId === companyIdBySlug[slug]) return true;
    const dashSlug = Object.entries(companyIdBySlug).find(([, id]) => id === d.companyId)?.[0];
    if (dashSlug && (dashSlug === slug || companyIdBySlug[dashSlug] === companyId)) return true;
    // A dashboard may be stored under a VPS tenant slug even when the selected
    // company object is represented by its numeric/UUID id.
    if (userTenantSlugs.includes(d.companyId) && (!slug || userTenantSlugs.includes(slug))) return true;
    return false;
  }

  const companyMap = useMemo(() => {
    const m = new Map<string, CompanyBrief>();
    for (const c of companies) m.set(c.id, c);
    return m;
  }, [companies]);

  const companiesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const resolveId = (companyId: string) => {
      if (companyMap.has(companyId)) return companyId;
      if (companyIdBySlug[companyId]) return companyIdBySlug[companyId];
      // companyId might already be VPS id
      return companyId;
    };
    for (const d of items) {
      const id = resolveId(d.companyId);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    const seenIds = new Set<string>();
    const seenSlugs = new Set<string>();
    const pushUnique = (
      list: { id: string; name: string; slug: string; count: number }[],
      c: { id: string; name: string; slug: string; count: number }
    ) => {
      const slugKey = (c.slug || '').toLowerCase();
      if (seenIds.has(c.id)) return;
      if (slugKey && seenSlugs.has(slugKey)) return;
      seenIds.add(c.id);
      if (slugKey) seenSlugs.add(slugKey);
      list.push(c);
    };
    const out: { id: string; name: string; slug: string; count: number }[] = [];
    // Admin/super: all companies (deduped), even empty
    if (isSuperAdmin || userRole === 'admin' || userRole === 'super_admin') {
      if (companies.length) {
        for (const c of companies) {
          pushUnique(out, { id: c.id, name: c.name, slug: c.slug, count: counts.get(c.id) || 0 });
        }
      }
      // Include companyIds from dashboards not in companies list
      for (const [id, count] of counts.entries()) {
        pushUnique(out, {
          id,
          name: companyMap.get(id)?.name || id,
          slug: companyMap.get(id)?.slug || id,
          count,
        });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    }
    for (const [id, count] of counts.entries()) {
      pushUnique(out, {
        id,
        name: companyMap.get(id)?.name || id,
        slug: companyMap.get(id)?.slug || id,
        count,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, companies, companyMap, isSuperAdmin, userRole]);

  // Auto-select if only one company (viewer of single firm)
  const showCompanyPicker = companiesWithCounts.length > 1 || isSuperAdmin || userRole === 'admin' || userRole === 'super_admin';

  const effectiveCompanyId = showCompanyPicker
    ? selectedCompanyId
    : companiesWithCounts[0]?.id || userCompanyId || null;

  const filtered = useMemo(() => {
    let list = items;
    if (effectiveCompanyId) {
      const slug = companyMap.get(effectiveCompanyId)?.slug;
      list = list.filter((d) => matchesCompany(d, effectiveCompanyId, slug));
    } else if (showCompanyPicker) {
      // Still on company list view — don't show dashboards yet
      list = [];
    }
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.description || '').toLowerCase().includes(s)
    );
  }, [items, q, effectiveCompanyId, showCompanyPicker]);

  const selectedCompanyName =
    companiesWithCounts.find((c) => c.id === effectiveCompanyId)?.name ||
    companyMap.get(effectiveCompanyId || '')?.name ||
    '';

  async function persistUpdate(id: string, patch: Partial<Dashboard>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ýalňyşlyk');
      setItems((prev) => prev.map((d) => (d.id === id ? data.dashboard : d)));
      flash('Ýatda saklandy');
      router.refresh();
      return data.dashboard as Dashboard;
    } catch (e) {
      flash(String(e));
      return null;
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Dashboardy poz',
      message: 'Bu dashboard we onuň widget-leri öçüriler. Amal yzyna alynmaýar.',
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Pozup bolmady');
      }
      setItems((prev) => prev.filter((d) => d.id !== id));
      flash('Pozuldy');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function duplicate(d: Dashboard) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${d.name} (nusga)`,
          description: d.description,
          widgets: remapWidgetIds(d.widgets),
          globalFilters: d.globalFilters || [],
          companyId: d.companyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nusga alynmady');
      if (d.globalFilters?.length && !data.dashboard.globalFilters?.length) {
        await fetch(`/api/dashboards/${data.dashboard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalFilters: d.globalFilters }),
        });
      }
      setItems((prev) => [data.dashboard, ...prev]);
      flash('Nusga döredildi');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  function openXfer(d: Dashboard, mode: 'copy' | 'move') {
    setXferTarget(d);
    setXferMode(mode);
    setXferCompanyId('');
    setXferStep(1);
    setXferApiRows([]);
    setXferDbKey('primary');
    setXferConflictPolicy('skip');
    setXferAnalyzeMsg('');
    setMenuId(null);
  }

  function closeXfer() {
    if (xferBusy) return;
    setXferTarget(null);
    setXferStep(1);
    setXferApiRows([]);
  }

  /** Widget + drillDown dataSource-lardan API salgylary */
  function collectWidgetApiKeys(widgets: DashboardWidget[]) {
    const keys: { path: string; method: string; tenantSlug: string; endpointId?: string }[] = [];
    const push = (ds?: DashboardWidget['dataSource'] | NonNullable<DashboardWidget['dataSource']>['drillDown']) => {
      if (!ds || !('path' in ds) || !ds.path) return;
      const path = ds.path.startsWith('/') ? ds.path : `/${ds.path}`;
      keys.push({
        path,
        method: (ds as any).method || 'GET',
        tenantSlug: (ds as any).tenantSlug || '',
        endpointId: (ds as any).endpointId,
      });
    };
    for (const w of widgets || []) {
      push(w.dataSource);
      push(w.dataSource?.drillDown as any);
    }
    return keys;
  }

  async function analyzeXferApis() {
    if (!xferTarget || !xferCompanyId) {
      flash('Maksat firma saýlaň');
      return;
    }
    setXferBusy(true);
    setXferAnalyzeMsg('API-lar deňeşdirilýär…');
    try {
      const targetCo = companies.find((c) => c.id === xferCompanyId);
      const targetSlug = targetCo?.slug || xferCompanyId;
      const res = await fetch('/api/catalog?force=1');
      const cat = await res.json();
      if (!res.ok) throw new Error(cat.error || 'Catalog alynmady');

      const allEps: any[] = cat.endpoints || [];
      const sourceKeys = collectWidgetApiKeys(xferTarget.widgets || []);
      // unique by path+method (prefer source tenant match)
      const seen = new Set<string>();
      const uniqueKeys: typeof sourceKeys = [];
      for (const k of sourceKeys) {
        const id = `${k.method.toUpperCase()}|${k.path.toLowerCase()}`;
        if (seen.has(id)) continue;
        seen.add(id);
        uniqueKeys.push(k);
      }

      const targetEps = allEps.filter((e) => e.tenantSlug === targetSlug);
      const targetByName = new Map<string, any>();
      for (const e of targetEps) {
        targetByName.set(String(e.name || '').trim().toLowerCase(), e);
      }

      const dbOpts =
        (cat.tenants || [])
          .find((t: any) => t.slug === targetSlug || t.id === xferCompanyId)
          ?.connections?.map((c: any) => ({
            dbKey: c.dbKey || 'primary',
            label: c.label || c.database || c.dbKey || 'primary',
          })) || [];
      setXferDbOptions(dbOpts.length ? dbOpts : [{ dbKey: 'primary', label: 'primary' }]);
      setXferDbKey(dbOpts[0]?.dbKey || 'primary');

      const rows = uniqueKeys.map((k) => {
        const src =
          allEps.find(
            (e) =>
              e.id === k.endpointId ||
              (e.tenantSlug === k.tenantSlug &&
                String(e.pathTemplate || '').toLowerCase() === k.path.toLowerCase() &&
                String(e.method || 'GET').toUpperCase() === k.method.toUpperCase())
          ) ||
          allEps.find(
            (e) =>
              String(e.pathTemplate || '').toLowerCase() === k.path.toLowerCase() &&
              String(e.method || 'GET').toUpperCase() === k.method.toUpperCase()
          );
        const name = String(src?.name || k.path.replace(/^\//, '') || 'API').trim();
        const conflictEp = targetByName.get(name.toLowerCase());
        const conflict = !!conflictEp;
        return {
          key: `${k.method}|${k.path}`,
          name,
          path: k.path,
          method: k.method.toUpperCase(),
          sourceId: src?.id,
          sqlQuery: src?.sqlQuery || '',
          paramsSchema: src?.paramsSchema,
          responseSchema: src?.responseSchema,
          cacheTtlSec: src?.cacheTtlSec,
          authRequired: src?.authRequired,
          conflict,
          targetId: conflictEp?.id,
          targetPath: conflictEp?.pathTemplate,
          policy: (conflict ? 'skip' : 'create') as 'replace' | 'skip' | 'create',
        };
      });

      setXferApiRows(rows);
      const nConflict = rows.filter((r) => r.conflict).length;
      setXferAnalyzeMsg(
        rows.length
          ? `${rows.length} API ulanylýar · ${nConflict} sany maksat firmada şol atly bar`
          : 'Bu dashboardda baglanan API ýok — diňe layout nusga alynar'
      );
      setXferStep(2);
    } catch (e) {
      flash(String(e));
    } finally {
      setXferBusy(false);
    }
  }

  function setAllConflictPolicy(policy: 'replace' | 'skip') {
    setXferConflictPolicy(policy);
    setXferApiRows((prev) =>
      prev.map((r) => (r.conflict ? { ...r, policy } : r))
    );
  }

  async function confirmXfer() {
    if (!xferTarget || !xferCompanyId) {
      flash('Maksat firma saýlaň');
      return;
    }
    if (xferStep === 1) {
      await analyzeXferApis();
      return;
    }
    setXferBusy(true);
    try {
      const targetCo = companies.find((c) => c.id === xferCompanyId);
      const targetSlug = targetCo?.slug || xferCompanyId;

      // Dashboard name conflict
      const sameName = items.find(
        (x) =>
          x.id !== xferTarget.id &&
          matchesCompany(x, xferCompanyId) &&
          x.name.trim().toLowerCase() === xferTarget.name.trim().toLowerCase()
      );
      if (sameName) {
        const ok = await confirmDialog({
          title: 'Dashboard eýýäm bar',
          message: `«${xferTarget.name}» bu firmada eýýäm bar. Replace — köne pozlup täze ýazylar. Skip — işlem ýatyrylýar.`,
          confirmLabel: 'Replace',
          cancelLabel: 'Skip',
        });
        if (!ok) {
          flash('Geçirildi (skip)');
          closeXfer();
          return;
        }
        await fetch(`/api/dashboards/${sameName.id}`, { method: 'DELETE' });
        setItems((prev) => prev.filter((x) => x.id !== sameName.id));
      }

      // Resolve API mapping: old path → new path/tenant/endpointId
      const pathMap = new Map<
        string,
        { path: string; tenantSlug: string; endpointId?: string; method: string }
      >();

      for (const row of xferApiRows) {
        const mapKey = `${row.method}|${row.path.toLowerCase()}`;
        if (row.conflict && row.policy === 'skip' && row.targetId) {
          pathMap.set(mapKey, {
            path: row.targetPath || row.path,
            tenantSlug: targetSlug,
            endpointId: row.targetId,
            method: row.method,
          });
          continue;
        }
        if (row.conflict && row.policy === 'replace' && row.targetId) {
          const up = await fetch('/api/endpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: row.targetId,
              tenantSlug: targetSlug,
              name: row.name,
              pathTemplate: row.path,
              method: row.method,
              dbKey: xferDbKey,
              sqlQuery: row.sqlQuery || undefined,
              paramsSchema: row.paramsSchema,
              responseSchema: row.responseSchema,
              cacheTtlSec: row.cacheTtlSec,
              authRequired: row.authRequired,
            }),
          });
          const ud = await up.json().catch(() => ({}));
          if (!up.ok) throw new Error(ud.error || `API replace şowsuz: ${row.name}`);
          pathMap.set(mapKey, {
            path: row.path,
            tenantSlug: targetSlug,
            endpointId: row.targetId,
            method: row.method,
          });
          continue;
        }
        // create
        const cr = await fetch('/api/endpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            create: true,
            tenantSlug: targetSlug,
            name: row.name,
            pathTemplate: row.path,
            method: row.method,
            dbKey: xferDbKey,
            sqlQuery: row.sqlQuery || 'SELECT 1 AS ok',
            paramsSchema: row.paramsSchema,
            responseSchema: row.responseSchema,
            cacheTtlSec: row.cacheTtlSec ?? 0,
            authRequired: row.authRequired ?? true,
          }),
        });
        const cd = await cr.json().catch(() => ({}));
        if (!cr.ok) {
          // duplicate path → use existing
          if (cr.status === 409 && cd.details?.id) {
            pathMap.set(mapKey, {
              path: row.path,
              tenantSlug: targetSlug,
              endpointId: cd.details.id,
              method: row.method,
            });
          } else {
            throw new Error(cd.error || `API döredilmedi: ${row.name}`);
          }
        } else {
          pathMap.set(mapKey, {
            path: row.path,
            tenantSlug: targetSlug,
            endpointId: cd.endpoint?.id,
            method: row.method,
          });
        }
      }

      const remapDs = (ds: any): any => {
        if (!ds?.path) return ds;
        const path = ds.path.startsWith('/') ? ds.path : `/${ds.path}`;
        const method = String(ds.method || 'GET').toUpperCase();
        const hit = pathMap.get(`${method}|${path.toLowerCase()}`);
        if (!hit) {
          return { ...ds, tenantSlug: targetSlug, dbKey: xferDbKey };
        }
        return {
          ...ds,
          tenantSlug: hit.tenantSlug,
          path: hit.path,
          method: hit.method,
          endpointId: hit.endpointId || ds.endpointId,
          dbKey: xferDbKey,
          drillDown: ds.drillDown ? remapDs(ds.drillDown) : ds.drillDown,
        };
      };

      const widgetsRemapped = remapWidgetIds(
        (xferTarget.widgets || []).map((w) => ({
          ...w,
          dataSource: w.dataSource ? remapDs(w.dataSource) : w.dataSource,
        }))
      );

      if (xferMode === 'move') {
        const res = await fetch(`/api/dashboards/${xferTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: xferCompanyId,
            widgets: widgetsRemapped.map((w, i) => ({
              ...w,
              id: (xferTarget.widgets || [])[i]?.id || w.id,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Göçürilmedi');
        setItems((prev) =>
          prev.map((x) =>
            x.id === xferTarget.id
              ? { ...x, companyId: xferCompanyId, widgets: data.dashboard?.widgets || widgetsRemapped }
              : x
          )
        );
        flash('Dashboard firmaya göçürildi (API baglanyşyklar täzelendi)');
      } else {
        const res = await fetch('/api/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: xferTarget.name,
            description: xferTarget.description,
            widgets: widgetsRemapped,
            globalFilters: xferTarget.globalFilters || [],
            companyId: xferCompanyId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Nusga alynmady');
        setItems((prev) => [data.dashboard, ...prev]);
        flash('Dashboard nusga alyndy · API-lar maksat firmada sazlandy');
      }
      closeXfer();
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setXferBusy(false);
    }
  }

  function exportDash(d: Dashboard) {
    const payload: DashboardExportPayload = {
      format: 'bi-platform-dashboard',
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: {
        name: d.name,
        description: d.description,
        widgets: d.widgets,
        globalFilters: d.globalFilters || [],
        version: d.version,
      },
    };
    const safe = d.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'dashboard';
    downloadJson(`${safe}.bi-dashboard.json`, payload);
    setMenuId(null);
    flash('Export edildi');
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      let name = '';
      let description: string | undefined;
      let widgets: DashboardWidget[] = [];
      let globalFilters: Dashboard['globalFilters'] = [];

      if (raw?.format === 'bi-platform-dashboard' && raw.dashboard) {
        name = raw.dashboard.name || 'Import edilen';
        description = raw.dashboard.description;
        widgets = remapWidgetIds(raw.dashboard.widgets || []);
        globalFilters = raw.dashboard.globalFilters || [];
      } else if (raw?.widgets && raw?.name) {
        // raw dashboard object
        name = raw.name;
        description = raw.description;
        widgets = remapWidgetIds(raw.widgets || []);
        globalFilters = raw.globalFilters || [];
      } else {
        throw new Error('Nädogry export faýly');
      }

      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, widgets, globalFilters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import şowsuz');

      if (globalFilters?.length) {
        await fetch(`/api/dashboards/${data.dashboard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalFilters }),
        });
      }

      setItems((prev) => [data.dashboard, ...prev]);
      flash('Import üstünlikli');
      router.refresh();
    } catch (e) {
      flash(String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function openAccess(d: Dashboard) {
    setAccessTarget(d);
    setSelectedShare([...(d.sharedWith || [])]);
    setMenuId(null);
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      if (res.ok) {
        const co = companyMap.get(d.companyId);
        const slug = co?.slug || companies.find((c) => c.id === d.companyId)?.slug || d.companyId;
        setStaffOpts(
          (data.staff || [])
            .filter((s: any) => {
              // Prefer same company: by companyId or tenantSlug
              if (s.companyId && s.companyId === d.companyId) return true;
              const memberships = Array.isArray(s.tenantSlugs) && s.tenantSlugs.length
                ? s.tenantSlugs
                : (s.tenantSlug ? [s.tenantSlug] : []);
              if (slug && memberships.includes(slug)) return true;
              if (d.companyId && memberships.includes(d.companyId)) return true;
              // If no company info on staff, include for admin
              if (!s.companyId && !s.tenantSlug) return true;
              return false;
            })
            .map((s: any) => ({
              id: s.id,
              fullName: s.fullName,
              username: s.username,
              role: s.role,
            }))
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function saveAccess() {
    if (!accessTarget) return;
    const updated = await persistUpdate(accessTarget.id, {
      sharedWith: selectedShare,
    } as any);
    if (updated) {
      setAccessTarget(null);
      flash('Dostup saklandy');
    }
  }

  function openEdit(d: Dashboard) {
    setEditTarget(d);
    setEditName(d.name);
    setEditDesc(d.description || '');
    setMenuId(null);
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return;
    const updated = await persistUpdate(editTarget.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    if (updated) setEditTarget(null);
  }

  return (
    <div className="relative space-y-6">
      {appAnimOn && (
        <ParticlesBackground theme="dashboard" className="pointer-events-none absolute inset-0 -z-10 opacity-60" />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {showCompanyPicker && effectiveCompanyId ? (
            <button
              type="button"
              onClick={() => { setSelectedCompanyId(null); setQ(''); }}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Firmalara dolan
            </button>
          ) : null}
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {showCompanyPicker && !effectiveCompanyId
              ? 'Firmalar'
              : selectedCompanyName
                ? `${selectedCompanyName} — Dashboardlar`
                : 'Dashboardlar'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {showCompanyPicker && !effectiveCompanyId
              ? 'Firma saýlaň — onuň dashboardlary açylar'
              : 'Hasabatlar we analitika'}
          </p>
        </div>
        {canEdit && effectiveCompanyId && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Link href={`/dashboards/new${effectiveCompanyId ? `?companyId=${encodeURIComponent(effectiveCompanyId)}` : ''}`}>
              <Button size="sm" disabled={busy}>
                <Plus className="h-4 w-4" />
                Täze
              </Button>
            </Link>
          </div>
        )}
      </div>

      {navPending && !navPending.startsWith('co:') && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] pointer-events-none">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl pointer-events-auto">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            Garaşyň…
          </div>
        </div>
      )}

      {/* Company picker for admin / multi-company */}
      {showCompanyPicker && !effectiveCompanyId && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companiesWithCounts.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-slate-400 text-sm">
              Firma ýok ýa-da siziň üçin görünýän dashboard ýok.
            </div>
          ) : (
            companiesWithCounts.map((c) => (
              <div
                key={c.id}
                className="group relative text-left rounded-2xl border border-slate-700/80 bg-slate-900/70 hover:border-indigo-500/50 hover:bg-slate-900 p-5 transition shadow-sm"
              >
              <button
                type="button"
                disabled={!!navPending}
                onClick={() => {
                  setNavPending(`co:${c.id}`);
                  setSelectedCompanyId(c.id);
                  // brief loading UX then clear
                  window.setTimeout(() => setNavPending(null), 400);
                }}
                className="w-full text-left disabled:opacity-60"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate group-hover:text-indigo-200">{c.name}</h3>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{c.slug}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {c.count} dashboard
                    </p>
                  </div>
                </div>
              </button>
              {canEdit && (
                <button
                  type="button"
                  title="Firma dashboardlary üçin ulanyjy dostupy"
                  className="absolute top-3 right-3 p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    const first = items.find((d) => d.companyId === c.id);
                    if (first) openAccess(first);
                    else flash('Bu firma üçin dashboard ýok — ilki dörediň');
                  }}
                >
                  <Users className="h-4 w-4" />
                </button>
              )}
              </div>
            ))
          )}
        </div>
      )}

      {effectiveCompanyId && (
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Dashboard gözle..."
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-slate-900/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      )}

      {effectiveCompanyId ? (
        filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
          <LayoutDashboard className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {items.length === 0 ? 'Heniz dashboard ýok' : 'Gözleg boýunça netije ýok'}
          </p>
          {canEdit && items.length === 0 && (
            <Link href={`/dashboards/new${effectiveCompanyId ? `?companyId=${encodeURIComponent(effectiveCompanyId)}` : ''}`} className="inline-block mt-4">
              <Button variant="secondary" size="sm">
                Ilkinji dashboardy döret
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 hover:border-indigo-500/40 hover:bg-slate-900 transition-all duration-200"
            >
              <Link
                href={navPending && navPending !== d.id ? '#' : `/dashboards/${d.id}`}
                onClick={(e) => {
                  if (navPending && navPending !== d.id) {
                    e.preventDefault();
                    return;
                  }
                  setNavPending(d.id);
                }}
                className={`block min-w-0 pr-10 ${navPending && navPending !== d.id ? 'pointer-events-none opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center group-hover:bg-indigo-500/25 transition-colors shrink-0">
                    <LayoutDashboard className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white group-hover:text-indigo-200 transition-colors">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="mt-1 text-sm text-slate-400 line-clamp-2">{d.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(d.updatedAt)}
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md shrink-0">
                    {d.widgets.length} widget
                  </span>
                </div>
                  </div>
                </div>
              </Link>

              {canEdit && (
                <div className="absolute top-3 right-3 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuId((id) => (id === d.id ? null : d.id));
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700"
                    aria-label="Hereketler"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === d.id && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-1 text-sm">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          Üýtget (ady)
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => duplicate(d)}
                          disabled={busy}
                        >
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          Nusga al (şol firma)
                        </button>
                        {isSuperAdmin && companies.length > 1 && (
                          <>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                              onClick={() => openXfer(d, 'copy')}
                              disabled={busy}
                            >
                              <Copy className="h-3.5 w-3.5 text-indigo-400" />
                              Firma-a nusga
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                              onClick={() => openXfer(d, 'move')}
                              disabled={busy}
                            >
                              <Building2 className="h-3.5 w-3.5 text-amber-400" />
                              Firma-a göçür
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => exportDash(d)}
                        >
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                          Export (.json)
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-slate-200 hover:bg-slate-800"
                          onClick={() => openAccess(d)}
                        >
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          Ulanyjy bagla
                        </button>
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-rose-400 hover:bg-rose-500/10"
                          onClick={() => remove(d.id)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Poz
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )
      ) : null}

      {/* Edit modal */}
      {xferTarget && (
        <div className="fixed inset-0 z-[2147482500] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => closeXfer()} />
          <div className="relative w-full max-w-lg max-h-[min(92dvh,720px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">
              {xferMode === 'move' ? 'Firma-a göçür' : 'Firma-a nusga'}
              <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                Ädim {xferStep}/2
              </span>
            </h3>
            <p className="text-xs text-slate-400 text-center truncate">{xferTarget.name}</p>

            {xferStep === 1 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs text-slate-400">Maksat firma</span>
                  <select
                    value={xferCompanyId}
                    onChange={(e) => setXferCompanyId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                  >
                    <option value="">— Saýlaň —</option>
                    {companies
                      .filter((c) => c.id !== xferTarget.companyId && c.slug !== xferTarget.companyId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.slug})
                        </option>
                      ))}
                  </select>
                </label>
                <p className="text-[11px] text-slate-500">
                  Soňky ädimde widget API-lary maksat firmadaky atlar bilen deňeşdiriler (Replace / Skip /
                  täze döret).
                </p>
              </>
            )}

            {xferStep === 2 && (
              <div className="space-y-3">
                {xferAnalyzeMsg && (
                  <p className="text-xs text-indigo-300/90 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                    {xferAnalyzeMsg}
                  </p>
                )}

                <label className="block space-y-1.5">
                  <span className="text-xs text-slate-400">
                    Täze / replace API-lar üçin DB baglanyşyk (maksat firma)
                  </span>
                  <select
                    value={xferDbKey}
                    onChange={(e) => setXferDbKey(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                  >
                    {xferDbOptions.map((o) => (
                      <option key={o.dbKey} value={o.dbKey}>
                        {o.label} ({o.dbKey})
                      </option>
                    ))}
                  </select>
                </label>

                {xferApiRows.some((r) => r.conflict) && (
                  <div className="flex flex-wrap gap-2 items-center text-[11px]">
                    <span className="text-slate-400">Ähli conflict:</span>
                    <button
                      type="button"
                      className={cn(
                        'rounded-lg px-2.5 py-1 border',
                        xferConflictPolicy === 'replace'
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                          : 'border-slate-700 text-slate-400'
                      )}
                      onClick={() => setAllConflictPolicy('replace')}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'rounded-lg px-2.5 py-1 border',
                        xferConflictPolicy === 'skip'
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-700 text-slate-400'
                      )}
                      onClick={() => setAllConflictPolicy('skip')}
                    >
                      Skip (sakla)
                    </button>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
                  {xferApiRows.length === 0 && (
                    <p className="text-xs text-slate-500 p-3">API ýok</p>
                  )}
                  {xferApiRows.map((r) => (
                    <div key={r.key} className="p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            {r.method} {r.path}
                          </p>
                        </div>
                        {r.conflict ? (
                          <span className="shrink-0 text-[10px] rounded-md bg-amber-500/15 text-amber-300 px-1.5 py-0.5">
                            Conflict
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] rounded-md bg-sky-500/15 text-sky-300 px-1.5 py-0.5">
                            Täze
                          </span>
                        )}
                      </div>
                      {r.conflict ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={cn(
                              'text-[11px] rounded-md px-2 py-1 border',
                              r.policy === 'replace'
                                ? 'border-amber-500/40 text-amber-200 bg-amber-500/10'
                                : 'border-slate-700 text-slate-400'
                            )}
                            onClick={() =>
                              setXferApiRows((prev) =>
                                prev.map((x) => (x.key === r.key ? { ...x, policy: 'replace' } : x))
                              )
                            }
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'text-[11px] rounded-md px-2 py-1 border',
                              r.policy === 'skip'
                                ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10'
                                : 'border-slate-700 text-slate-400'
                            )}
                            onClick={() =>
                              setXferApiRows((prev) =>
                                prev.map((x) => (x.key === r.key ? { ...x, policy: 'skip' } : x))
                              )
                            }
                          >
                            Skip
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500">
                          Maksat firmada dörediler · DB: {xferDbKey}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <b className="text-slate-400">Replace</b> — SQL/sazlama göçürilýär (şol atly API).{' '}
                  <b className="text-slate-400">Skip</b> — maksatdaky API saklanýar, widget oňa baglanýar.{' '}
                  <b className="text-slate-400">Täze</b> — saýlanan DB bilen döredilýär.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="flex-1"
                disabled={xferBusy}
                onClick={() => (xferStep === 2 ? setXferStep(1) : closeXfer())}
              >
                {xferStep === 2 ? 'Yza' : 'Ýatyr'}
              </Button>
              <Button
                className="flex-1"
                loading={xferBusy}
                disabled={xferStep === 1 ? !xferCompanyId : false}
                onClick={() => void confirmXfer()}
              >
                {xferStep === 1
                  ? 'Dowam · API barla'
                  : xferMode === 'move'
                    ? 'Göçür'
                    : 'Nusga al'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-[2147482500] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 shadow-2xl space-y-4 max-h-[min(90dvh,640px)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Dashboard üýtget</h3>
              <button type="button" onClick={() => setEditTarget(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Input label="Ady" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Goşmaça at / düşündiriş</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Gysga düşündiriş..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>
                Ýatyr
              </Button>
              <Button size="sm" loading={busy} onClick={saveEdit} disabled={!editName.trim()}>
                Ýatda sakla
              </Button>
            </div>
          </div>
        </div>
      )}

      {accessTarget && (
        <div className="fixed inset-0 z-[2147482500] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAccessTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 shadow-2xl space-y-4 max-h-[min(90dvh,640px)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Dashboard dostup</h3>
                <p className="text-xs text-slate-500 mt-0.5">{accessTarget.name}</p>
              </div>
              <button type="button" onClick={() => setAccessTarget(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Admin / editor ähli dashboardy görýär. Viewer diňe şu ýerde saýlananlar (we eýesi).
            </p>
            {staffOpts.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setSelectedShare(staffOpts.map((s) => s.id))}
                >
                  Hemmesini saýla
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setSelectedShare([])}
                >
                  Hemmesini aýyr
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-2">
              {staffOpts.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">Işgär sanawy boş ýa-da ýüklenmedi</p>
              ) : (
                staffOpts.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedShare.includes(s.id)}
                      onChange={(e) => {
                        setSelectedShare((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                        );
                      }}
                      className="rounded border-slate-600"
                    />
                    <span className="text-slate-200 flex-1 truncate">{s.fullName}</span>
                    <span className="text-[10px] text-slate-500">@{s.username} · {s.role}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAccessTarget(null)}>Ýatyr</Button>
              <Button size="sm" loading={busy} onClick={saveAccess}>Ýatda sakla</Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white shadow-xl max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  );
}
