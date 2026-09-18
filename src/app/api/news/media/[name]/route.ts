import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { resolveMediaPath, deleteNewsMediaFile } from '@/lib/news-store';
import { getSession, rbacCanEditNews } from '@/lib/auth';

type Ctx = { params: Promise<{ name: string }> };

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
};

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}

/**
 * Progressive media: HTTP Range (stream while downloading).
 * DELETE removes file from data/news-media.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params;
  const full = resolveMediaPath(decodeURIComponent(name));
  if (!full) return NextResponse.json({ error: 'ýok' }, { status: 404 });

  const stat = fs.statSync(full);
  const size = stat.size;
  const ext = path.extname(full).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const range = req.headers.get('range');

  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (!m) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(full, { start, end });
    return new NextResponse(nodeStreamToWeb(stream), {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const stream = fs.createReadStream(full);
  return new NextResponse(nodeStreamToWeb(stream), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!rbacCanEditNews(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  const { name } = await ctx.params;
  const ok = deleteNewsMediaFile(decodeURIComponent(name));
  if (!ok) return NextResponse.json({ error: 'Faýl ýok' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
