import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { resolveMediaPath } from '@/lib/news-store';

type Ctx = { params: Promise<{ name: string }> };

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params;
  const full = resolveMediaPath(decodeURIComponent(name));
  if (!full) return NextResponse.json({ error: 'ýok' }, { status: 404 });
  const buf = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
