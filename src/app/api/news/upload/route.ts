import { NextRequest, NextResponse } from 'next/server';
import { getSession, rbacCanEditNews } from '@/lib/auth';
import { saveNewsMedia } from '@/lib/news-store';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!rbacCanEditNews(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file gerek' }, { status: 400 });
  }
  const blob = file as File;
  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Surat 5MB-dan uly bolmaly däl' }, { status: 400 });
  }
  const url = saveNewsMedia(blob.name || 'image.png', buf);
  return NextResponse.json({ ok: true, url });
}
