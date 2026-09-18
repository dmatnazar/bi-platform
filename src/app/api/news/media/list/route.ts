import { NextResponse } from 'next/server';
import { getSession, rbacCanEditNews } from '@/lib/auth';
import { listNewsMediaFiles } from '@/lib/news-store';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!rbacCanEditNews(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  return NextResponse.json({ files: listNewsMediaFiles() });
}
