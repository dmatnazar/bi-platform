import { NextResponse } from 'next/server';
import { readAppsCatalog } from '@/lib/apps-store';

/** Public list of client platforms (no secrets) */
export async function GET() {
  const cat = readAppsCatalog();
  const platforms = cat.platforms
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      order: p.order,
      hasFeed: Boolean(p.feedUrl || p.downloadUrl),
      docsCount: p.docs?.length || 0,
    }));
  return NextResponse.json({ platforms, updatedAt: cat.updatedAt });
}
