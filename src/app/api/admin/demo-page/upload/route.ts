import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { canManageDemoPage } from '@/lib/rbac';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_DIR = path.join(process.cwd(), 'data', 'demo-media');

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml',
]);

function ensureDir() {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !(isSuperAdmin(user) || canManageDemoPage(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file gerek' }, { status: 400 });
  }
  const blob = file as File;
  const mime = (blob.type || '').toLowerCase();
  if (mime && !ALLOWED.has(mime) && !blob.name.toLowerCase().match(/\.(png|jpe?g|webp|gif|svg)$/)) {
    return NextResponse.json({ error: 'Diňe surat: PNG, JPG, WEBP, GIF, SVG' }, { status: 400 });
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Faýl 20MB-dan uly bolmaly däl' }, { status: 400 });
  }
  ensureDir();
  const safe = (blob.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const name = `${Date.now().toString(36)}-${safe}`;
  fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
  const url = `/api/public/demo-media/${encodeURIComponent(name)}`;
  return NextResponse.json({ ok: true, url, name });
}
