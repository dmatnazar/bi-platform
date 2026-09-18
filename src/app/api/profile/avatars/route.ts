import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStaffById, getStaffByUsername, upsertStaff } from '@/lib/db';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'user-avatar-uploads');
const MAP_FILE = path.join(process.cwd(), 'data', 'user-avatars.json');

type MapFile = Record<string, string>;

function keyFor(user: { id?: string; username?: string }) {
  return String(user.username || user.id || '').toLowerCase();
}

async function readMap(): Promise<MapFile> {
  try {
    return JSON.parse(await fs.readFile(MAP_FILE, 'utf8')) as MapFile;
  } catch {
    return {};
  }
}

async function writeMap(map: MapFile) {
  await fs.mkdir(path.dirname(MAP_FILE), { recursive: true });
  await fs.writeFile(MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
}

function isUploadId(id: string) {
  return id.startsWith('upload:');
}

function uploadUrl(id: string) {
  return `/api/profile/avatar-file/${encodeURIComponent(id.slice('upload:'.length))}`;
}

async function deleteUploadIfNeeded(id: string | undefined | null) {
  if (!id || !isUploadId(id)) return;
  const name = path.basename(id.slice('upload:'.length));
  if (!name || name === '.' || name === '..') return;
  const full = path.join(UPLOAD_DIR, name);
  try {
    if (fsSync.existsSync(full)) await fs.unlink(full);
  } catch {
    /* */
  }
}

async function listAvatarFiles() {
  try {
    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const names = await fs.readdir(AVATAR_DIR);
    return names
      .filter((n) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n) && !n.startsWith('.'))
      .map((name) => ({
        id: name,
        name,
        url: `/avatars/${encodeURIComponent(name)}`,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const avatars = await listAvatarFiles();
  const map = await readMap();
  const k = keyFor(user);
  let selected = k ? map[k] || null : null;

  if (!selected) {
    try {
      const staff = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
      const a = (staff as any)?.avatar;
      if (a) selected = String(a);
    } catch {
      /* */
    }
  }

  let selectedUrl: string | null = null;
  if (selected) {
    selectedUrl = isUploadId(selected) ? uploadUrl(selected) : `/avatars/${encodeURIComponent(selected)}`;
  }

  return NextResponse.json({ avatars, selected, selectedUrl });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const ct = req.headers.get('content-type') || '';
  const map = await readMap();
  const k = keyFor(user);
  const prev = k ? map[k] : null;

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file gerek' }, { status: 400 });
    }
    const blob = file as File;
    if (!blob.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Diňe surat' }, { status: 400 });
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 });
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(blob.name || '') || '.jpg';
    const safeExt = /^\.(png|jpe?g|gif|webp)$/i.test(ext) ? ext.toLowerCase() : '.jpg';
    const name = `${String(user.id || user.username)}-${Date.now().toString(36)}${safeExt}`.replace(
      /[^\w.-]/g,
      '_'
    );
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    const id = `upload:${name}`;
    if (k) {
      map[k] = id;
      await writeMap(map);
    }
    await deleteUploadIfNeeded(prev);
    try {
      const local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
      if (local) {
        await upsertStaff({ ...local, avatar: id, updatedAt: new Date().toISOString() } as any);
      }
    } catch {
      /* */
    }
    return NextResponse.json({ ok: true, selected: id, url: uploadUrl(id) });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.avatarId || body.id || '').trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    return NextResponse.json({ error: 'Nädogry avatar' }, { status: 400 });
  }

  const avatars = await listAvatarFiles();
  const found = avatars.find((a) => a.id === id);
  if (!found) return NextResponse.json({ error: 'Avatar tapylmady' }, { status: 404 });

  if (k) {
    map[k] = found.id;
    await writeMap(map);
  }
  await deleteUploadIfNeeded(prev);

  try {
    const local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (local) {
      await upsertStaff({ ...local, avatar: found.id, updatedAt: new Date().toISOString() } as any);
    }
  } catch {
    /* */
  }

  return NextResponse.json({ ok: true, selected: found.id, url: found.url });
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const map = await readMap();
  const k = keyFor(user);
  const prev = k ? map[k] : null;
  if (k && map[k]) {
    delete map[k];
    await writeMap(map);
  }
  await deleteUploadIfNeeded(prev);

  try {
    const local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (local) {
      await upsertStaff({ ...local, avatar: '', updatedAt: new Date().toISOString() } as any);
    }
  } catch {
    /* */
  }

  return NextResponse.json({ ok: true, selected: null });
}
