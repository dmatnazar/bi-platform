import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { fetchCatalog, staffLookup, decryptPasswordPlain } from '@/lib/gateway';

/**
 * Authenticated open of VPS public API from bi-platform UI.
 * GET /api/gateway/v1/{tenantSlug}/{dbKey}/...path
 * → GET {gateway}/api/v1/{tenantSlug}/{dbKey}/...path
 * with Basic auth from logged-in staff.
 */
type Ctx = { params: Promise<{ path: string[] }> };

async function resolveBasicAuth(username: string): Promise<string | null> {
  try {
    const catalog = await fetchCatalog(false);
    const staffRow = (catalog.staff || []).find(
      (s: any) => String(s.username || '').toLowerCase() === username.toLowerCase()
    );
    let plain = '';
    if (staffRow?.passwordEnc) plain = decryptPasswordPlain(staffRow.passwordEnc);
    if (!plain) {
      const lookup = await staffLookup(username);
      if (lookup.ok && lookup.data) {
        const d = lookup.data as any;
        if (d.passwordEnc) plain = decryptPasswordPlain(d.passwordEnc);
        else if (d.passwordPlain) plain = String(d.passwordPlain);
      }
    }
    if (!plain) return null;
    return 'Basic ' + Buffer.from(`${username}:${plain}`, 'utf8').toString('base64');
  } catch {
    return null;
  }
}

async function handle(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      {
        error: 'Giriş gerek',
        hint: 'Bu URL bi-platform session talap edýär. Daşarda açmak üçin Gateway URL + Basic Auth (login:parol) ulanyň.',
      },
      { status: 401 }
    );
  }

  const { path } = await ctx.params;
  if (!path || path.length < 2) {
    return NextResponse.json({ error: 'Path: tenantSlug/dbKey/... gerek' }, { status: 400 });
  }

  const settings = await getSettings();
  const base = (settings.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:4000').replace(
    /\/$/,
    ''
  );
  const search = req.nextUrl.search || '';
  const target = `${base}/api/v1/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-staff-username': String(user.username || ''),
    'x-staff-role': String(user.role || ''),
    'x-staff-id': String(user.id || user.username || ''),
  };

  const basic = user.username ? await resolveBasicAuth(user.username) : null;
  if (basic) headers.Authorization = basic;

  try {
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': ct },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Gateway baglanyşyk şowsuz', detail: String(err), target },
      { status: 502 }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
