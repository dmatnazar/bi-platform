import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany, isSuperAdmin } from '@/lib/auth';
import {
  listNews,
  createNews,
  getReadIds,
  unreadCount,
  markAllRead,
} from '@/lib/news-store';

function canEditNews(user: { role: string; isSuperAdmin?: boolean }) {
  return isSuperAdmin(user as any) || canManageCompany(user.role as any);
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const admin = canEditNews(user);
  const items = listNews({ includeDrafts: admin });
  const readIds = getReadIds(user.username);
  const readSet = new Set(readIds);
  const withMeta = items.map((n) => ({
    ...n,
    unread: n.published && !readSet.has(n.id),
  }));

  return NextResponse.json({
    items: withMeta,
    unreadCount: unreadCount(user.username),
    canEdit: admin,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!canEditNews(user)) {
    return NextResponse.json({ error: 'Diňe admin döredip bilýär' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.action === 'mark_all_read') {
    const items = listNews({ includeDrafts: false });
    markAllRead(
      user.username,
      items.map((n) => n.id)
    );
    return NextResponse.json({ ok: true, unreadCount: 0 });
  }

  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'Sözbaşy gerek' }, { status: 400 });

  const item = createNews({
    title,
    body: String(body.body || ''),
    images: Array.isArray(body.images) ? body.images.map(String) : [],
    published: body.published !== false,
    pinned: !!body.pinned,
    createdBy: user.username,
  });
  return NextResponse.json({ ok: true, item });
}
