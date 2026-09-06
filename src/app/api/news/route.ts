import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, actorTenantSlugs, rbacCanEditNews } from '@/lib/auth';
import {
  listNews,
  createNews,
  getReadIds,
  unreadCount,
  markAllRead,
} from '@/lib/news-store';

function newsVisibleTo(user: any, n: { tenantSlugs?: string[]; published?: boolean }) {
  if (isSuperAdmin(user)) return true;
  const targets = Array.isArray(n.tenantSlugs) ? n.tenantSlugs : [];
  // empty tenantSlugs = platform-wide (super-created) — viewers of any firm can read
  if (!targets.length) return true;
  const mine = new Set(actorTenantSlugs(user));
  return targets.some((s) => mine.has(String(s)));
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const canEdit = rbacCanEditNews(user);
  let items = listNews({ includeDrafts: canEdit && isSuperAdmin(user) });
  // Non-super editors: drafts only for their firms; published filtered by scope
  items = items.filter((n) => newsVisibleTo(user, n));
  if (!isSuperAdmin(user) && canEdit) {
    // editors/admins also see own-firm drafts
    const all = listNews({ includeDrafts: true });
    const mine = new Set(actorTenantSlugs(user));
    const extra = all.filter((n) => {
      if (n.published) return false;
      const targets = Array.isArray(n.tenantSlugs) ? n.tenantSlugs : [];
      return targets.some((s) => mine.has(String(s)));
    });
    const ids = new Set(items.map((i) => i.id));
    for (const e of extra) if (!ids.has(e.id)) items.push(e);
  }

  const readIds = getReadIds(user.username);
  const readSet = new Set(readIds);
  const withMeta = items.map((n) => ({
    ...n,
    unread: n.published && !readSet.has(n.id),
  }));

  return NextResponse.json({
    items: withMeta,
    unreadCount: unreadCount(user.username),
    canEdit,
    myTenantSlugs: actorTenantSlugs(user),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!rbacCanEditNews(user)) {
    return NextResponse.json({ error: 'Habar döretmäge rugsat ýok' }, { status: 403 });
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

  let tenantSlugs: string[] = Array.isArray(body.tenantSlugs)
    ? body.tenantSlugs.map(String).filter(Boolean)
    : [];
  if (!isSuperAdmin(user)) {
    const mine = new Set(actorTenantSlugs(user));
    tenantSlugs = tenantSlugs.filter((s) => mine.has(s));
    if (!tenantSlugs.length) {
      // default to all actor firms
      tenantSlugs = [...mine];
    }
    if (!tenantSlugs.length) {
      return NextResponse.json({ error: 'Firma saýlanmady' }, { status: 400 });
    }
  }
  // super may leave empty = all firms

  const item = createNews({
    title,
    body: String(body.body || ''),
    images: Array.isArray(body.images) ? body.images.map(String) : [],
    published: body.published !== false,
    pinned: !!body.pinned,
    createdBy: user.username,
    tenantSlugs,
  } as any);
  return NextResponse.json({ ok: true, item });
}
