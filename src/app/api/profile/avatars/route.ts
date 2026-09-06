import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStaffById, getStaffByUsername, upsertStaff } from '@/lib/db';
import path from 'node:path';
import fs from 'node:fs/promises';

export const runtime = 'nodejs';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');
const MAP_FILE = path.join(process.cwd(), 'data', 'user-avatars.json');
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

type AvatarMap = Record<string, string>;

async function readMap(): Promise<AvatarMap> {
  try {
    const raw = await fs.readFile(MAP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: AvatarMap) {
  await fs.mkdir(path.dirname(MAP_FILE), { recursive: true });
  const tmp = MAP_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(map, null, 2), 'utf8');
  await fs.rename(tmp, MAP_FILE);
}

async function listAvatarFiles(): Promise<{ id: string; url: string; name: string }[]> {
  try {
    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const entries = await fs.readdir(AVATAR_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => {
        const ext = path.extname(name).toLowerCase();
        if (!ALLOWED.has(ext)) return false;
        if (name.toLowerCase().startsWith('readme')) return false;
        return true;
      })
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        id: name,
        name,
        url: `/avatars/${encodeURIComponent(name)}`,
      }));
  } catch {
    return [];
  }
}

function keyFor(user: { id?: string; username?: string }) {
  return String(user.username || user.id || '')
    .trim()
    .toLowerCase();
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const avatars = await listAvatarFiles();
  let selected: string | null = null;

  const map = await readMap();
  const k = keyFor(user);
  if (k && map[k]) selected = map[k];

  if (!selected) {
    try {
      const staff = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
      const a = (staff as any)?.avatar;
      if (a) selected = String(a);
    } catch {
      /* */
    }
  }

  if (selected && !avatars.some((a) => a.id === selected)) {
    selected = null;
  }

  return NextResponse.json({ avatars, selected });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.avatarId || body.id || '').trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    return NextResponse.json({ error: 'Nädogry avatar' }, { status: 400 });
  }

  const avatars = await listAvatarFiles();
  const found = avatars.find((a) => a.id === id);
  if (!found) {
    return NextResponse.json({ error: 'Avatar tapylmady' }, { status: 404 });
  }

  const map = await readMap();
  const k = keyFor(user);
  if (k) {
    map[k] = found.id;
    await writeMap(map);
  }

  try {
    let local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (local) {
      await upsertStaff({
        ...local,
        avatar: found.id,
        updatedAt: new Date().toISOString(),
      } as any);
    } else {
      await upsertStaff({
        id: user.id,
        companyId: user.companyId || 'unknown',
        fullName: user.fullName || user.username,
        username: user.username,
        passwordHash: 'synced-from-bi:keep',
        role: user.role,
        active: true,
        avatar: found.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }
  } catch {
    /* map already saved */
  }

  return NextResponse.json({ ok: true, selected: found.id, url: found.url });
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const map = await readMap();
  const k = keyFor(user);
  if (k && map[k]) {
    delete map[k];
    await writeMap(map);
  }

  try {
    const local = (await getStaffById(user.id)) || (await getStaffByUsername(user.username));
    if (local) {
      await upsertStaff({
        ...local,
        avatar: '',
        updatedAt: new Date().toISOString(),
      } as any);
    }
  } catch {
    /* */
  }

  return NextResponse.json({ ok: true, selected: null });
}
