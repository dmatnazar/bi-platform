import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/db';

/**
 * Proxy to VPS Gateway so the browser never talks to gateway directly
 * (avoids CORS + keeps API keys server-side later).
 *
 * Usage: GET /api/gateway/{tenantSlug}/sales/monthly?from=2026-01-01
 *   → GET {GATEWAY_URL}/api/{tenantSlug}/sales/monthly?from=...
 */
type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  }

  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Path gerek' }, { status: 400 });
  }

  const settings = await getSettings();
  const base = settings.gatewayUrl.replace(/\/$/, '');
  const search = req.nextUrl.search || '';
  const target = `${base}/api/${path.join('/')}${search}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward body for non-GET
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      // timeout-ish
      signal: AbortSignal.timeout(30000),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    console.error('gateway proxy error', err);
    return NextResponse.json(
      { error: 'Gateway bilen baglanyşyk şowsuz', detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
