import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'support-uploads');

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Faýl ýok' }, { status: 400 });
    }
    const blob = file as File;
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Faýl 8MB-dan uly' }, { status: 400 });
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const id = crypto.randomUUID();
    const safeName = (blob.name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const filename = `${id}_${safeName}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buf);
    return NextResponse.json({
      attachment: {
        id,
        name: blob.name || safeName,
        mime: blob.type || 'application/octet-stream',
        size: blob.size,
        url: `/api/support/files/${filename}`,
        compressed: form.get('compressed') === '1',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ýükleme şowsuz' }, { status: 500 });
  }
}
