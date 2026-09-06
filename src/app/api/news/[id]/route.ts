import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany, isSuperAdmin } from '@/lib/auth';
import { getNews, updateNews, deleteNews, markRead, getReadIds } from '@/lib/news-store';

type Ctx = { params: Promise<{ id: string }> };

function canEdit(user: { role: string; isSuperAdmin?: boolean }) {
  return isSuperAdmin(user as any) || canManageCompany(user.role as any);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const { id } = await ctx.params;
  const item = getNews(id);
  if (!item) return NextResponse.json({ error: 'Habar ýok' }, { status: 404 });
  if (!item.published && !canEdit(user)) {
    return NextResponse.json({ error: 'Habar ýok' }, { status: 404 });
  }
  markRead(user.username, id);
  const readIds = getReadIds(user.username);
  return NextResponse.json({ item, unread: false, readIds });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const item = updateNews(id, {
    title: body.title,
    body: body.body,
    images: body.images,
    published: body.published,
    pinned: body.pinned,
  });
  if (!item) return NextResponse.json({ error: 'Habar ýok' }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  const { id } = await ctx.params;
  if (!deleteNews(id)) return NextResponse.json({ error: 'Habar ýok' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
