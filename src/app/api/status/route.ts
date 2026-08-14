import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { checkGatewayHealth, fetchCatalog } from '@/lib/gateway';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Connection / sync status for the top indicator bar.
 * - VPS Gateway health
 * - Catalog last sync time (live or cache)
 * - Configured poll interval
 */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const s = await getSettings();
  const gatewayOnline = await checkGatewayHealth();

  let catalogSyncedAt: string | null = null;
  let fromCache = false;
  let cachedAt: number | null = null;
  let tenantCount = 0;
  let endpointCount = 0;
  let staffCount = 0;

  try {
    const catalog = await fetchCatalog(false);
    catalogSyncedAt = catalog.syncedAt || null;
    fromCache = !!catalog.fromCache;
    tenantCount = catalog.tenants?.length || 0;
    endpointCount = catalog.endpoints?.length || 0;
    staffCount = catalog.staff?.length || 0;

    // Read cache file timestamp for precise "when did we last pull"
    try {
      const cacheFile = path.join(process.cwd(), 'data', 'catalog-cache.json');
      if (fs.existsSync(cacheFile)) {
        const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (typeof raw.cachedAt === 'number') cachedAt = raw.cachedAt;
        if (!catalogSyncedAt && raw.syncedAt) catalogSyncedAt = raw.syncedAt;
      }
    } catch {
      /* */
    }
  } catch {
    fromCache = true;
  }

  // "BI Client" = whether catalog data is available (from VPS or local cache).
  // When VPS is offline but cache exists, client data is still served from cache.
  const biClientDataAvailable = tenantCount > 0 || endpointCount > 0 || staffCount > 0;

  return NextResponse.json({
    gatewayOnline,
    biClientDataAvailable,
    fromCache,
    catalogSyncedAt,
    cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    catalogSyncIntervalSec: s.catalogSyncIntervalSec ?? 0,
    gatewayUrl: s.gatewayUrl,
    counts: { tenants: tenantCount, endpoints: endpointCount, staff: staffCount },
    checkedAt: new Date().toISOString(),
  });
}
