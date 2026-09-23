'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Server,
  Activity,
  Eye,
  EyeOff,
  ChevronRight,
  Building2,
  ArrowLeft,
  X,
  Folder,
  HardDrive,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toastSuccess, toastError, toastInfo } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

interface ConnRow {
  id: string;
  tenantSlug: string;
  tenantName: string;
  dbKey: string;
  label: string;
  database: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  isPrimary?: boolean;
  hasPassword?: boolean;
  dbType?: string;
  devices?: { id: string; name: string; status: string; hostname?: string }[];
}

interface TenantOpt {
  slug: string;
  name: string;
}

const emptyForm = {
  tenantSlug: '',
  label: '',
  database: '',
  host: '',
  port: 1433,
  username: '',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
  isPrimary: false,
  dbType: 'mssql' as 'mssql' | 'excel',
};

export default function ConnectionsPage() {
  const { t } = useLocale();

  const [list, setList] = useState<ConnRow[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ConnRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [listingDbs, setListingDbs] = useState(false);
  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [pickingExcel, setPickingExcel] = useState(false);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseParent, setBrowseParent] = useState('');
  const [browseEntries, setBrowseEntries] = useState<
    Array<{
      name: string;
      path: string;
      isDir?: boolean;
      isDrive?: boolean;
      isFile?: boolean;
      isQuick?: boolean;
      size?: number;
    }>
  >([]);

  // Database üýtgedilende API saýlaw modal
  type LinkedEp = {
    id: string;
    tenantSlug: string;
    name: string;
    method: string;
    pathTemplate: string;
    dbKey?: string;
    sqlQuery?: string;
    paramsSchema?: unknown;
    cacheTtlSec?: number;
    maxRows?: number;
    authRequired?: boolean;
  };
  const [apiPickOpen, setApiPickOpen] = useState(false);
  const [apiPickList, setApiPickList] = useState<LinkedEp[]>([]);
  const [apiPickSelected, setApiPickSelected] = useState<Set<string>>(new Set());
  const [apiPickOldDb, setApiPickOldDb] = useState('');
  const [apiPickNewDb, setApiPickNewDb] = useState('');
  const [apiPickDbKey, setApiPickDbKey] = useState('primary');

  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      if (!res.ok) {
        toastError(t('loadFailedCap'), data.error);
        setList([]);
        return;
      }
      setList(data.connections || []);
      setTenants(
        (data.tenants || []).map((t: { slug: string; name: string }) => ({
          slug: t.slug,
          name: t.name,
        }))
      );
    } catch (e) {
      toastError(t('loadFailedCap'), String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firmCards = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    for (const t of tenants) {
      map.set(t.slug, { slug: t.slug, name: t.name, count: 0 });
    }
    for (const c of list) {
      const cur = map.get(c.tenantSlug) || {
        slug: c.tenantSlug,
        name: c.tenantName || c.tenantSlug,
        count: 0,
      };
      cur.count += 1;
      if (c.tenantName) cur.name = c.tenantName;
      map.set(c.tenantSlug, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [list, tenants]);

  const firmConns = useMemo(
    () => (selectedFirm ? list.filter((c) => c.tenantSlug === selectedFirm) : []),
    [list, selectedFirm]
  );

  async function testConn(row: ConnRow) {
    setTestingId(row.id);
    try {
      const res = await fetch('/api/admin-test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: row.tenantSlug,
          dbKey: row.dbKey || 'primary',
          sqlQuery: 'SELECT 1 AS ok',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(t('testFailed'), data.error || res.statusText);
        return;
      }
      toastSuccess(t('connectionOk'), row.label || row.dbKey);
    } catch (e) {
      toastError('Test', String(e));
    } finally {
      setTestingId(null);
    }
  }

  function openCreate(firmSlug?: string) {
    setEditing(null);
    setShowPassword(false);
    setDbOptions([]);
    setForm({
      ...emptyForm,
      tenantSlug: firmSlug || selectedFirm || tenants[0]?.slug || '',
    });
    setModal(true);
  }

  function openEdit(c: ConnRow) {
    setEditing(c);
    setShowPassword(false);
    setDbOptions(c.database ? [c.database] : []);
    const isExcel =
      String(c.dbType || '').toLowerCase() === 'excel' ||
      /\.(xlsx|xls|xlsm|xlsb|csv)$/i.test(String(c.host || ''));
    setForm({
      tenantSlug: c.tenantSlug,
      label: c.label || c.dbKey || '',
      database: c.database || '',
      host: c.host || '',
      port: Number(c.port) || (isExcel ? 0 : 1433),
      username: c.username || '',
      // Catalog may return decrypted password (admin)
      password: c.password || '',
      encrypt: c.encrypt !== false,
      trustServerCertificate: c.trustServerCertificate !== false,
      isPrimary: Boolean(c.isPrimary),
      dbType: isExcel ? 'excel' : 'mssql',
    });
    setModal(true);
  }

  async function fetchDatabaseList() {
    if (!form.tenantSlug) {
      toastError('Zerur', t('selectCompanyFirst'));
      return;
    }
    if (form.dbType === 'excel') {
      toastInfo('Excel', t('sheetNameManual'));
      return;
    }
    if (!form.host.trim() || !form.username.trim()) {
      toastError('Zerur', 'Host we Username gerek');
      return;
    }
    if (!form.password.trim() && !editing?.hasPassword) {
      toastError('Zerur', t('passwordRequiredNewConn'));
      return;
    }
    setListingDbs(true);
    setDbOptions([]);
    try {
      // 1) Ad-hoc via Electron tunnel (works BEFORE save)
      const res = await fetch('/api/connections/list-databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: form.tenantSlug,
          host: form.host.trim(),
          port: Number(form.port) || 1433,
          username: form.username.trim(),
          password: form.password || undefined,
          encrypt: form.encrypt,
          trustServerCertificate: form.trustServerCertificate,
          dbKey: editing?.dbKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const names: string[] = Array.isArray(data.databases)
          ? data.databases.map(String).filter(Boolean)
          : [];
        if (names.length) {
          setDbOptions(names);
          toastSuccess(t('dbList'), `${names.length} sany`);
          return;
        }
      }

      // 2) Fallback: existing saved connection + admin-test-query
      if (editing?.dbKey) {
        const res2 = await fetch('/api/admin-test-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: form.tenantSlug,
            dbKey: editing.dbKey,
            sqlQuery:
              "SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb') ORDER BY name",
          }),
        });
        const data2 = await res2.json();
        if (res2.ok) {
          const rows = data2.rows || data2.data || data2.result || [];
          const names = (Array.isArray(rows) ? rows : [])
            .map((r: Record<string, unknown>) => String(r.name || r.NAME || Object.values(r)[0] || ''))
            .filter(Boolean);
          if (names.length) {
            setDbOptions(names);
            toastSuccess(t('dbList'), `${names.length} sany`);
            return;
          }
        }
      }

      toastError(
        t('dbList'),
        data?.error ||
          t('electronTunnelOffline')
      );
    } catch (e) {
      toastError(t('dbList'), String(e));
    } finally {
      setListingDbs(false);
    }
  }


  async function loadBrowseDir(dirPath: string) {
    if (!form.tenantSlug) {
      toastError('Zerur', t('selectCompanyFirst'));
      return;
    }
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch('/api/connections/agent-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: form.tenantSlug,
          action: 'listDir',
          path: dirPath || '',
          host: dirPath || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBrowseError(data.error || 'Papka alynmady — Electron online bolmaly');
        setBrowseEntries([]);
        return;
      }
      const entries = data.entries || data.rows || [];
      setBrowseEntries(entries);
      setBrowsePath(String(data.path || dirPath || ''));
      setBrowseParent(String(data.parent || ''));
    } catch (e) {
      setBrowseError(String(e));
      setBrowseEntries([]);
    } finally {
      setBrowseLoading(false);
    }
  }

  async function pickExcelOnElectron() {
    if (!form.tenantSlug) {
      toastError('Zerur', t('selectCompanyFirst'));
      return;
    }
    setBrowseOpen(true);
    setBrowsePath('');
    setBrowseParent('');
    setBrowseEntries([]);
    await loadBrowseDir('');
  }

  async function selectBrowseFile(filePath: string) {
    setForm((f) => ({ ...f, host: filePath }));
    setBrowseOpen(false);
    setPickingExcel(true);
    try {
      const res = await fetch('/api/connections/agent-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: form.tenantSlug,
          action: 'listSheets',
          host: filePath,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const sheets: string[] = data.sheets || data.databases || [];
        setSheetOptions(sheets.map(String));
        if (sheets.length) {
          setForm((f) => ({ ...f, host: filePath, database: sheets[0] }));
        }
        toastSuccess(t('excelSelected'), filePath.split(/[/\\]/).pop() || filePath);
      } else {
        toastSuccess(t('fileSelected'), filePath.split(/[/\\]/).pop() || filePath);
      }
    } catch {
      toastSuccess(t('fileSelected'), filePath.split(/[/\\]/).pop() || filePath);
    } finally {
      setPickingExcel(false);
    }
  }

  async function loadExcelSheets() {
    if (!form.tenantSlug || !form.host.trim()) {
      toastError('Zerur', t('needExcelPathFirst'));
      return;
    }
    setListingDbs(true);
    try {
      const res = await fetch('/api/connections/agent-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: form.tenantSlug,
          action: 'listSheets',
          host: form.host.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Sheet', data.error || 'Alynmady');
        return;
      }
      const sheets: string[] = data.sheets || data.databases || [];
      setSheetOptions(sheets.map(String));
      if (sheets.length && !form.database) {
        setForm((f) => ({ ...f, database: sheets[0] }));
      }
      toastSuccess('Sheet', `${sheets.length} sany`);
    } catch (e) {
      toastError('Sheet', String(e));
    } finally {
      setListingDbs(false);
    }
  }

  /** Fetch catalog endpoints linked to a tenant + dbKey */
  async function fetchLinkedApis(tenantSlug: string, dbKey: string): Promise<LinkedEp[]> {
    try {
      const res = await fetch('/api/catalog?refresh=1');
      const data = await res.json();
      const key = (dbKey || 'primary').trim() || 'primary';
      const all = (data.endpoints || []) as LinkedEp[];
      // 1) Şol tenant + dbKey
      let matched = all.filter(
        (e) => e.tenantSlug === tenantSlug && (e.dbKey || 'primary') === key
      );
      // 2) Hiç zat tapylmasa — şol tenant-yň ähli API-lary
      if (matched.length === 0) {
        matched = all.filter((e) => e.tenantSlug === tenantSlug);
      }
      return matched;
    } catch {
      return [];
    }
  }

  /** Saýlanan API-lary täze databaseName bilen update et */
  async function updateSelectedApis(
    apis: LinkedEp[],
    selectedIds: Set<string>,
    newDb: string,
    dbKey: string
  ): Promise<number> {
    let okCount = 0;
    for (const ep of apis) {
      if (!selectedIds.has(ep.id)) continue;
      try {
        const ures = await fetch('/api/endpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ep.id,
            tenantSlug: ep.tenantSlug,
            name: ep.name,
            pathTemplate: ep.pathTemplate,
            method: ep.method,
            dbKey: ep.dbKey || dbKey || 'primary',
            sqlQuery: ep.sqlQuery,
            paramsSchema: ep.paramsSchema,
            cacheTtlSec: ep.cacheTtlSec,
            maxRows: ep.maxRows,
            authRequired: ep.authRequired,
            databaseName: newDb,
          }),
        });
        if (ures.ok) okCount += 1;
      } catch {
        /* continue */
      }
    }
    return okCount;
  }

  /**
   * Saýlanan API-lara bagly widget-leriň dataSource.dbKey-ini täze DB baglanyşygyna
   * gabat getir we dashboard-lary sakla (sonky üýtgedilen DB ulanylsyn).
   */
  async function updateWidgetsForApis(
    selectedIds: Set<string>,
    dbKey: string,
    tenantSlug: string
  ): Promise<number> {
    if (selectedIds.size === 0) return 0;
    let widgetCount = 0;
    try {
      const res = await fetch('/api/dashboards');
      const data = await res.json();
      const dashboards = (data.dashboards || data || []) as Array<{
        id: string;
        widgets?: any[];
        [k: string]: unknown;
      }>;
      for (const dash of dashboards) {
        if (!Array.isArray(dash.widgets) || dash.widgets.length === 0) continue;
        let changed = false;
        const nextWidgets = dash.widgets.map((w: any) => {
          let wChanged = false;
          let next = w;
          const ds = w?.dataSource;
          if (ds?.endpointId && selectedIds.has(ds.endpointId)) {
            // Widget-i şu baglanyşygyň dbKey-ine bagla → täze database ulanylýar
            next = {
              ...next,
              dataSource: { ...ds, dbKey, tenantSlug: ds.tenantSlug || tenantSlug },
            };
            wChanged = true;
            widgetCount += 1;
          }
          // drillDown API hem saýlanan bolsa
          const dd = next?.dataSource?.drillDown;
          if (dd?.endpointId && selectedIds.has(dd.endpointId)) {
            next = {
              ...next,
              dataSource: {
                ...next.dataSource,
                drillDown: { ...dd, dbKey },
              },
            };
            wChanged = true;
            widgetCount += 1;
          }
          if (wChanged) changed = true;
          return next;
        });
        if (changed) {
          await fetch(`/api/dashboards/${dash.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        }
      }
    } catch {
      /* ignore widget sync errors */
    }
    return widgetCount;
  }

  /** Connection-y sakla + islege görä API/widget update */
  async function performSave(opts: {
    updateApis: boolean;
    selectedIds: Set<string>;
    linkedApis: LinkedEp[];
    newDb: string;
    dbKey: string;
  }) {
    setSaving(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          tenantSlug: form.tenantSlug,
          label: form.label,
          database: form.database,
          host: form.host.trim(),
          port: form.dbType === 'excel' ? 0 : Number(form.port) || 1433,
          username: form.dbType === 'excel' ? '' : form.username,
          password: form.password || undefined,
          encrypt: form.dbType === 'excel' ? false : form.encrypt,
          trustServerCertificate: form.trustServerCertificate,
          isPrimary: form.isPrimary,
          dbType: form.dbType || 'mssql',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(t('saveFailedLong'), data.error);
        return;
      }

      let apiOk = 0;
      let widgetOk = 0;
      if (opts.updateApis && opts.selectedIds.size > 0) {
        apiOk = await updateSelectedApis(
          opts.linkedApis,
          opts.selectedIds,
          opts.newDb,
          opts.dbKey
        );
        widgetOk = await updateWidgetsForApis(
          opts.selectedIds,
          opts.dbKey,
          form.tenantSlug
        );
      }

      if (apiOk > 0) {
        const extra =
          widgetOk > 0
            ? ` · ${t('widgetsUpdatedForDb').replace('{n}', String(widgetOk))}`
            : '';
        toastSuccess(
          t('connectionSaved'),
          t('apisUpdatedToNewDb').replace('{n}', String(apiOk)) + extra
        );
      } else if (opts.updateApis && opts.selectedIds.size > 0) {
        toastSuccess(t('connectionSaved'), 'VPS + Electron sync');
        toastError(t('apisUpdatePartialFail'));
      } else {
        toastSuccess(t('connectionSaved'), 'VPS + Electron sync');
      }

      setApiPickOpen(false);
      setModal(false);
      await load();
      if (form.tenantSlug) setSelectedFirm(form.tenantSlug);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.tenantSlug || !form.host.trim()) {
      toastError('Zerur', form.dbType === 'excel' ? t('needCompanyExcel') : t('needCompanyHost'));
      return;
    }
    if (!form.database.trim()) {
      toastError('Zerur', form.dbType === 'excel' ? t('enterSheetName') : t('selectOrTypeDatabase'));
      return;
    }
    if (form.dbType !== 'excel' && !form.username.trim()) {
      toastError('Zerur', 'Username gerek');
      return;
    }

    const oldDb = (editing?.database || '').trim();
    const newDb = form.database.trim();
    const dbKey = (editing?.dbKey || 'primary').trim() || 'primary';
    // Database üýtgedildimi (özüne deň däl) — boş → bir zat hem üýtgeşik hasaplanýar
    const dbChanged = Boolean(editing && newDb && oldDb !== newDb);

    // Database üýtgedilse → hemişe API saýlaw modal (awtomat update ýok)
    if (dbChanged) {
      const linked = await fetchLinkedApis(form.tenantSlug, dbKey);
      setApiPickList(linked);
      setApiPickSelected(new Set(linked.map((e) => e.id))); // default: hemmesi
      setApiPickOldDb(oldDb || '—');
      setApiPickNewDb(newDb);
      setApiPickDbKey(dbKey);
      setApiPickOpen(true);
      return; // saklamak modal tassyklansoň
    }

    // Database üýtgemedi → göni sakla
    await performSave({
      updateApis: false,
      selectedIds: new Set(),
      linkedApis: [],
      newDb,
      dbKey,
    });
  }

  async function remove(c: ConnRow) {
    // Bagly API bar bolsa — pozup bolanok (dostup bar bolsa-da)
    const linked = await fetchLinkedApis(c.tenantSlug, c.dbKey || 'primary');
    if (linked.length > 0) {
      toastError(
        t('connectionHasLinkedApis'),
        t('connectionHasLinkedApisDetail').replace('{n}', String(linked.length))
      );
      return;
    }

    const ok = await confirmDialog({
      title: t('deleteConnection'),
      message: `«${c.label || c.dbKey}» (${c.tenantName}) pozmak isleýärsiňizmi?`,
      confirmLabel: t('delete'),
      danger: true,
    });
    if (!ok) return;
    const res = await fetch('/api/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, tenantSlug: c.tenantSlug, dbKey: c.dbKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      toastError(t('deleteFailedLong'), data.error);
      return;
    }
    toastSuccess(t('deleted'));
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate leading-tight">
            <Database className="h-6 w-6 text-indigo-400" />
            DB baglanyşyklar
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ilki firma saýlaň → soň şol firmadaky database baglanyşyklary
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Täzele
          </Button>
          {selectedFirm && (
            <Button size="sm" onClick={() => openCreate(selectedFirm)}>
              <Plus className="h-3.5 w-3.5" />{t('newDb')}</Button>
          )}
        </div>
      </div>

      {!selectedFirm ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading && <p className="text-slate-500 text-sm col-span-full">{t('loading')}</p>}
          {!loading && firmCards.length === 0 && (
            <p className="text-slate-500 text-sm col-span-full">Firma ýok</p>
          )}
          {firmCards.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => setSelectedFirm(f.slug)}
              className="text-left rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-indigo-500/40 hover:bg-slate-900 p-4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{f.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{f.slug}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-300 shrink-0" />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                <span className="text-indigo-300 font-semibold">{f.count}</span> baglanyşyk
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedFirm(null)}>
              <ArrowLeft className="h-3.5 w-3.5" />{t('companies')}</Button>
            <span className="text-sm text-white font-medium">
              {firmCards.find((f) => f.slug === selectedFirm)?.name || selectedFirm}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">{selectedFirm}</span>
          </div>

          {firmConns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500 text-sm">
              Bu firmada baglanyşyk ýok.{' '}
              <button type="button" className="text-indigo-400 hover:underline" onClick={() => openCreate(selectedFirm)}>{t('addNew')}</button>
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  id: 'label',
                  header: t('name'),
                  mobilePrimary: true,
                  accessor: (c) => c.label || c.dbKey,
                },
                {
                  id: 'type',
                  header: t('viewType'),
                  accessor: (c) => c.dbType || 'mssql',
                },
                {
                  id: 'host',
                  header: 'Host / DB',
                  accessor: (c) => `${c.host || ''}/${c.database || ''}`,
                  cell: (c) => (
                    <span className="font-mono text-[11px] text-slate-400">
                      {String(c.dbType || '').toLowerCase() === 'excel'
                        ? `EXCEL · ${c.host || '—'} · ${c.database || '—'}`
                        : `${c.host || '—'}:${c.port || 1433} / ${c.database || '—'}`}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  header: t('actions'),
                  sortable: false,
                  accessor: () => '',
                  cell: (c) => (
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Test"
                        disabled={testingId === c.id}
                        onClick={() => void testConn(c)}
                        className="bi-action-icon bi-action-ok p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-40"
                      >
                        <Activity className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t('edit')}
                        onClick={() => openEdit(c)}
                        className="bi-action-icon bi-action-primary p-1.5 rounded-lg text-indigo-300 hover:bg-indigo-500/15"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t('delete')}
                        onClick={() => void remove(c)}
                        className="bi-action-icon bi-action-danger p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={firmConns}
              rowKey={(c) => c.id}
              storageKey="bi-connections-v1"
              searchPlaceholder={t('search')}
              emptyMessage={t('noConnections')}
            />
          )}
        </div>
      )}

      {modal && (
        <ModalPortal open={modal}>
          <div className="fixed inset-0 z-[2147482500] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
            <div className="relative w-full sm:max-w-lg max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">
                {editing ? t('editConnection') : t('newConnection')}
              </h3>

              <Select
                label={t('company')}
                value={form.tenantSlug}
                onChange={(e) => setForm((f) => ({ ...f, tenantSlug: e.target.value }))}
                options={tenants.map((t) => ({ value: t.slug, label: t.name || t.slug }))}
              />
              <Input
                label={t('label')}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Primary"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      dbType: 'mssql',
                      port: 1433,
                      encrypt: true,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    form.dbType !== 'excel'
                      ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Microsoft SQL Server
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      dbType: 'excel',
                      port: 0,
                      username: '',
                      encrypt: false,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    form.dbType === 'excel'
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Excel / CSV faýl
                </button>
              </div>

              {form.dbType === 'excel' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Excel faýl ýoly (Electron kompýuterinde) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={form.host}
                        onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                        placeholder="C:\data\sales.xlsx"
                        className="flex-1 h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={pickingExcel}
                        onClick={() => void pickExcelOnElectron()}
                      >
                        Saýla…
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      «Saýla» → BI-da Electron kompýuteriniň papkalary (agent online bolmaly).
                    </p>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      {sheetOptions.length > 0 ? (
                        <Select
                          label="List (Sheet) *"
                          value={form.database}
                          onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                          options={sheetOptions.map((s) => ({ value: s, label: s }))}
                        />
                      ) : (
                        <Input
                          label="List (Sheet) *"
                          value={form.database}
                          onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                          placeholder="Sheet1"
                        />
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={listingDbs}
                      onClick={() => void loadExcelSheets()}
                    >
                      Sheet al
                    </Button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Faýl paroly (islege görä)
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder={t('canLeaveEmpty')}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Faýl Electron online kompýuterde bolmaly. Sync soň Electron-da peýda bolýar.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        label={t('host')}
                        value={form.host}
                        onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                        placeholder="10.0.0.5"
                      />
                    </div>
                    <Input
                      label={t('port')}
                      value={String(form.port)}
                      onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))}
                    />
                  </div>
                  <Input
                    label="Username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    autoComplete="off"
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/80 px-3 pr-10 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                        autoComplete="new-password"
                        placeholder={editing?.hasPassword && !form.password ? t('savedPasswordExists') : ''}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={listingDbs}
                      onClick={() => void fetchDatabaseList()}
                    >
                      <Database className="h-3.5 w-3.5" />
                      Bar bolan DB al we test
                    </Button>
                  </div>

                  {dbOptions.length > 0 ? (
                    <Select
                      label={t('database')}
                      value={form.database}
                      onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                      options={dbOptions.map((d) => ({ value: d, label: d }))}
                    />
                  ) : (
                    <Input
                      label={t('database')}
                      value={form.database}
                      onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                      placeholder="MyDb"
                    />
                  )}
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.encrypt}
                  onChange={(e) => setForm((f) => ({ ...f, encrypt: e.target.checked }))}
                />
                Encrypt
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.trustServerCertificate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, trustServerCertificate: e.target.checked }))
                  }
                />
                Trust server certificate
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                />
                Primary
              </label>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" loading={saving} onClick={() => void save()}>{t('save')}</Button>
                <Button variant="ghost" onClick={() => setModal(false)}>{t('cancel')}</Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {browseOpen && (
        <ModalPortal open={browseOpen}>
          <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/70 p-3 sm:p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">Excel faýl saýla</h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Electron kompýuteri · {form.tenantSlug || 'firma'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  onClick={() => setBrowseOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  disabled={!browseParent && !browsePath}
                  onClick={() => void loadBrowseDir(browseParent || '')}
                >
                  ← Yza
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => void loadBrowseDir('')}
                >
                  Baş sahypa
                </button>
                <span className="text-[11px] text-slate-500 font-mono truncate flex-1" title={browsePath}>
                  {browsePath || 'Bystro dostup / Diskler'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-[260px] px-2 py-2">
                {browseLoading && <p className="text-xs text-slate-400 p-3">{t('loading')}</p>}
                {browseError && <p className="text-xs text-rose-400 p-3">{browseError}</p>}
                {!browseLoading && !browseError && browseEntries.length === 0 && (
                  <p className="text-xs text-slate-500 p-3">Boş ýa-da Excel faýl ýok</p>
                )}
                {!browsePath && (
                  <>
                    {browseEntries.some((e: any) => e.isQuick) && (
                      <>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 px-3 pt-1 pb-0.5">
                          Bystro dostup
                        </p>
                        <ul className="space-y-0.5 mb-2">
                          {browseEntries
                            .filter((e: any) => e.isQuick)
                            .map((e) => (
                              <li key={`q-${e.path}`}>
                                <button
                                  type="button"
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-200"
                                  onClick={() => void loadBrowseDir(e.path)}
                                >
                                  <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                                  <span className="truncate">{e.name}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      </>
                    )}
                    {browseEntries.some((e) => e.isDrive) && (
                      <>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 px-3 pt-1 pb-0.5">
                          Diskler
                        </p>
                        <ul className="space-y-0.5">
                          {browseEntries
                            .filter((e) => e.isDrive)
                            .map((e) => (
                              <li key={`d-${e.path}`}>
                                <button
                                  type="button"
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-200"
                                  onClick={() => void loadBrowseDir(e.path)}
                                >
                                  <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                                  <span className="truncate">{e.name}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
                {!!browsePath && (
                  <ul className="space-y-0.5">
                    {browseEntries.map((e) => (
                      <li key={e.path}>
                        <button
                          type="button"
                          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-200"
                          onClick={() => {
                            if (e.isDir || e.isDrive) void loadBrowseDir(e.path);
                            else void selectBrowseFile(e.path);
                          }}
                        >
                          {e.isDir || e.isDrive ? (
                            <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">{e.name}</span>
                          {e.isFile && e.size != null && (
                            <span className="ml-auto text-[10px] text-slate-500 shrink-0">
                              {e.size > 1024 * 1024
                                ? `${(e.size / (1024 * 1024)).toFixed(1)} MB`
                                : `${Math.max(1, Math.round(e.size / 1024))} KB`}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
                Diňe .xlsx / .xls / .csv. Papka üstüne basyp içine giriň.
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Database üýtgedilende — API saýlaw modal */}
      {apiPickOpen && (
        <ModalPortal open={apiPickOpen}>
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">
                  {t('dbChangedUpdateApisTitle')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('dbChangedUpdateApisMsg')
                    .replace('{oldDb}', apiPickOldDb)
                    .replace('{newDb}', apiPickNewDb)
                    .replace('{n}', String(apiPickList.length))}
                </p>
                <p className="text-[11px] text-amber-300/90 mt-1">
                  {t('dbChangedSelectApisHint')}
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/80">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() =>
                    setApiPickSelected(new Set(apiPickList.map((x) => x.id)))
                  }
                >
                  {t('selectAll')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setApiPickSelected(new Set())}
                >
                  {t('deselectAll')}
                </Button>
                <span className="ml-auto text-[11px] text-slate-500">
                  {apiPickSelected.size}/{apiPickList.length}
                </span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-2 py-2 space-y-0.5">
                {apiPickList.length === 0 ? (
                  <p className="text-xs text-slate-500 px-2 py-4 text-center">
                    Bu baglanyşyga bagly API ýok. Diňe baglanyşygy saklap bilersiňiz.
                  </p>
                ) : (
                  apiPickList.map((ep) => (
                    <label
                      key={ep.id}
                      className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/60 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-slate-600"
                        checked={apiPickSelected.has(ep.id)}
                        onChange={(e) => {
                          setApiPickSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(ep.id);
                            else next.delete(ep.id);
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-white truncate">{ep.name}</span>
                        <span className="block text-[11px] text-slate-500 font-mono truncate">
                          {ep.method} {ep.pathTemplate}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/50">
                <Button
                  className="flex-1"
                  loading={saving}
                  disabled={apiPickSelected.size === 0}
                  onClick={() =>
                    void performSave({
                      updateApis: true,
                      selectedIds: apiPickSelected,
                      linkedApis: apiPickList,
                      newDb: apiPickNewDb,
                      dbKey: apiPickDbKey,
                    })
                  }
                >
                  {t('dbChangedUpdateApisYes')}
                  {apiPickSelected.size > 0 ? ` (${apiPickSelected.size})` : ''}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  loading={saving}
                  onClick={() =>
                    void performSave({
                      updateApis: false,
                      selectedIds: new Set(),
                      linkedApis: apiPickList,
                      newDb: apiPickNewDb,
                      dbKey: apiPickDbKey,
                    })
                  }
                >
                  {t('dbChangedUpdateApisNo')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setApiPickOpen(false)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
}
