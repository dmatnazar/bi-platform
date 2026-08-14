import { NextResponse } from 'next/server';
import { fetchCatalog } from '@/lib/gateway';
import { listCompanies } from '@/lib/db';

/** Public list of companies for registration dropdown — prefers VPS catalog */
export async function GET() {
  try {
    const catalog = await fetchCatalog();
    if (catalog.tenants.length > 0) {
      return NextResponse.json({
        companies: catalog.tenants.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
        })),
        source: catalog.fromCache ? 'cache' : 'gateway',
        syncedAt: catalog.syncedAt,
      });
    }

    // Fallback local seed companies
    const local = await listCompanies();
    return NextResponse.json({
      companies: local.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
      source: 'local',
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}
