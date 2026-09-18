import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ name: string }> };

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'user-avatar-uploads');
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const { name } = await ctx.params;
  const safe = path.basename(decodeURIComponent(name));
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) {
    return NextResponse.json({ error: 'ýok' }, { status: 404 });
  }
  const buf = fs.readFileSync(full);
  const ext = path.extname(safe).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
