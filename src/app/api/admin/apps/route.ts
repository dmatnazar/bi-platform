import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  readAppsCatalog,
  writeAppsCatalog,
  saveDoc,
  deleteDoc,
  type AppPlatform,
} from '@/lib/apps-store';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  return NextResponse.json(readAppsCatalog());
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const platforms = (body.platforms || []) as AppPlatform[];
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'platforms gerekli' }, { status: 400 });
  }
  const cat = readAppsCatalog();
  cat.platforms = platforms.map((p, i) => ({
    id: String(p.id || '').trim() || `p-${i}`,
    name: String(p.name || p.id),
    status: p.status === 'available' ? 'available' : 'coming_soon',
    feedUrl: p.feedUrl ? String(p.feedUrl).trim() : '',
    downloadUrl: p.downloadUrl ? String(p.downloadUrl).trim() : '',
    order: typeof p.order === 'number' ? p.order : i,
    docs: Array.isArray(p.docs) ? p.docs : [],
  }));
  writeAppsCatalog(cat);
  return NextResponse.json(cat);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const action = body.action as string;
  const platformId = String(body.platformId || '');
  try {
    if (action === 'save_doc') {
      const p = saveDoc(platformId, {
        id: body.doc?.id,
        title: String(body.doc?.title || '').trim() || 'Dokument',
        body: String(body.doc?.body || ''),
        order: body.doc?.order,
      });
      return NextResponse.json({ platform: p });
    }
    if (action === 'delete_doc') {
      const p = deleteDoc(platformId, String(body.docId || ''));
      return NextResponse.json({ platform: p });
    }
    return NextResponse.json({ error: 'Näbelli action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
