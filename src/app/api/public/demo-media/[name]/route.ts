import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_DIR = path.join(process.cwd(), 'data', 'demo-media');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { name: raw } = await ctx.params;
  const name = decodeURIComponent(raw || '').replace(/[/\\]/g, '');
  if (!name || name.includes('..')) {
    return NextResponse.json({ error: 'Nädogry' }, { status: 400 });
  }
  const full = path.join(MEDIA_DIR, name);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: 'Tapylmady' }, { status: 404 });
  }
  const buf = fs.readFileSync(full);
  const ext = path.extname(name).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
