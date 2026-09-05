'use client';

// Fix (2026): renaming an API on the /admin/apis page auto-regenerates its
// pathTemplate (see pathFromName() in admin/apis/page.tsx), but the endpoint's
// stable `id` never changes. Widgets used to fetch data using their own
// cached dataSource.path snapshot, so after a rename the old path 404'd on
// the gateway until the widget was re-opened, its API re-picked, and saved.
//
// This module gives widgets a live lookup: resolve the *current*
// tenantSlug/path/method/dbKey from the catalog by endpointId at fetch time,
// falling back to the widget's own stored snapshot when the endpoint can't
// be resolved (VPS offline, endpointId missing on older widgets, etc).
//
// The catalog is shared + lightly cached so a dashboard with many widgets
// doesn't fire one /api/catalog request per widget.

export interface CatalogEndpoint {
  id: string;
  tenantSlug: string;
  name: string;
  method: string;
  pathTemplate: string;
  dbKey?: string;
}

let cache: CatalogEndpoint[] | null = null;
let inflight: Promise<CatalogEndpoint[]> | null = null;
let lastFetchedAt = 0;
// Short TTL: cheap enough to re-check often, long enough to dedupe bursts
// of widgets mounting at once on a busy dashboard.
const TTL_MS = 30_000;

async function fetchCatalog(): Promise<CatalogEndpoint[]> {
  const res = await fetch('/api/catalog');
  const data = await res.json();
  return Array.isArray(data.endpoints) ? data.endpoints : [];
}

/** Shared, lightly-cached endpoint catalog. */
export async function getEndpointCatalog(force = false): Promise<CatalogEndpoint[]> {
  const stale = Date.now() - lastFetchedAt > TTL_MS;
  if (!force && cache && !stale) return cache;
  if (inflight) return inflight;
  inflight = fetchCatalog()
    .then((list) => {
      cache = list;
      lastFetchedAt = Date.now();
      return list;
    })
    .catch((err) => {
      // Keep serving the previous cache (if any) on a transient failure
      // rather than breaking every widget on the dashboard.
      if (cache) return cache;
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Resolve the live tenantSlug/path/method/dbKey for a widget's data source.
 * Prefers a lookup by stable endpointId (survives API renames); falls back
 * to the widget's own stored fields when the endpoint isn't found so old
 * widgets (created before endpointId existed) keep working unchanged.
 */
export function resolveLiveEndpoint(
  catalog: CatalogEndpoint[],
  ds:
    | { endpointId?: string; tenantSlug?: string; path?: string; method?: string; dbKey?: string }
    | undefined
) {
  if (!ds) return undefined;
  const match = ds.endpointId ? catalog.find((e) => e.id === ds.endpointId) : undefined;
  return {
    tenantSlug: match?.tenantSlug || ds.tenantSlug,
    path: match?.pathTemplate || ds.path,
    method: (match?.method || ds.method || 'GET') as string,
    dbKey: match?.dbKey || ds.dbKey || 'primary',
  };
}
