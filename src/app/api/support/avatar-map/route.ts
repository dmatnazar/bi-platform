import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'node:path';
import fs from 'node:fs/promises';

const MAP_FILE = path.join(process.cwd(), 'data', 'user-avatars.json');

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(await fs.readFile(MAP_FILE, 'utf8'));
  } catch {
    map = {};
  }
  const out: Record<string, string> = {};
  for (const [k, id] of Object.entries(map)) {
    if (!id) continue;
    if (String(id).startsWith('upload:')) {
      out[k] = `/api/profile/avatar-file/${encodeURIComponent(String(id).slice(7))}`;
    } else {
      out[k] = `/avatars/${encodeURIComponent(String(id))}`;
    }
  }
  return NextResponse.json({ map: out });
}
