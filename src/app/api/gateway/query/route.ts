import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { gatewayFetch } from '@/lib/gateway';
import { z } from 'zod';

const schema = z.object({
  tenantSlug: z.string().min(1),
  path: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('GET'),
  dbKey: z.string().optional(),
  params: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

/**
 * Ensure begin/end dates are full-day local strings before hitting VPS.
 * Never use Date()/toISOString here (UTC shift).
 */
function normalizeOutgoingParams(
  params?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> | undefined {
  if (!params) return params;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') {
      out[k] = v === '' ? null : v;
      continue;
    }
    if (typeof v === 'string') {
      const m = v.trim().replace(/T/g, ' ').match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) {
        const date = m[1];
        if (/end|gutar|dateto|until/i.test(k)) {
          out[k] = `${date} 23:59:59`;
          continue;
        }
        if (/begin|start|from|datefrom/i.test(k)) {
          out[k] = `${date} 00:00:00`;
          continue;
        }
      }
    }
    out[k] = v;
  }
  return out;
}

async function checkAgentOnline(
  base: string,
  tenantSlug: string
): Promise<{ online: boolean; detail?: string }> {
  try {
    const res = await fetch(`${base}/api/v1/${encodeURIComponent(tenantSlug)}/status/agent`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { online: false, detail: `agent-status HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { online: Boolean(data?.agentOnline || data?.online), detail: data?.message };
  } catch (e: any) {
    return { online: false, detail: e?.message || 'agent-status unreachable' };
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'nädogry' }, { status: 400 });
  }

  const { tenantSlug, path, method, dbKey, params: rawParams } = parsed.data;

  // ── Tenant isolation: non-super users may query any of their linked companies ──
  if (!isSuperAdmin(user)) {
    const allowedSlugs = new Set<string>(
      [user.companySlug, ...(user.tenantSlugs || [])].filter(Boolean).map(String)
    );
    if (!allowedSlugs.size || !allowedSlugs.has(tenantSlug)) {
      return NextResponse.json(
        {
          error: 'Bu kompaniýanyň maglumatyna rugsat ýok',
          detail: `Siziň firmalaryňyz: ${[...allowedSlugs].join(', ') || '—'}, sorag: ${tenantSlug}`,
        },
        { status: 403 }
      );
    }
  }

  const params = normalizeOutgoingParams(rawParams);
  const settings = await getSettings();
  const base = (settings.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:4000').replace(
    /\/$/,
    ''
  );
  const key = dbKey || 'primary';
  let p = path.startsWith('/') ? path : `/${path}`;

  const url = new URL(`${base}/api/v1/${tenantSlug}/${key}${p}`);
  // Always request debug params so we can surface them to the client
  url.searchParams.set('debug', '1');
  if (method === 'GET' && params) {
    for (const [k, v] of Object.entries(params)) {
      // null → boş string → VPS optional param = SQL NULL
      // Keep exact wall-clock string — do NOT use Date
      url.searchParams.set(k, v === null || v === undefined ? '' : String(v));
    }
  }

  console.log('[bi-gateway-query] outgoing params', JSON.stringify(params), 'url=', url.toString());

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-debug-params': '1',
        'x-staff-role': String(user.role || ''),
        'x-staff-id': String(user.id || user.username || ''),
        'x-billing-done': '1',
      },
      body: method === 'POST' ? JSON.stringify(params || {}) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ([]));
    if (!res.ok) {
      // Enrich 503 (agent offline / private DB) with live agent status
      if (res.status === 503) {
        const agent = await checkAgentOnline(base, tenantSlug);
        return NextResponse.json(
          {
            error:
              data?.error ||
              'Ýerli Electron Agent birikdirilmedik — hasabat üçin enjamda Electron işleýän bolmaly',
            detail: data?.detail || data,
            hint:
              data?.hint ||
              `«${tenantSlug}» kompaniýasynyň kompýuterinde Electron programmasyny açyň. Settings → Gateway URL VPS adresine degişli bolmaly. Device BI-da tassyklanan we firma baglanan bolmaly.`,
            tenantSlug,
            agentOnline: agent.online,
            agentDetail: agent.detail,
            status: 503,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: data?.error || 'API säwlik', detail: data, status: res.status },
        { status: res.status }
      );
    }
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
        ? data.rows
        : data?.data || [data];
    // REQ charge (company wallet) — dashboard filter / widget hits
    let reqBalance: number | undefined;
    try {
      const role = String(user.role || '');
      const isAdmin =
        role === 'admin' ||
        role === 'super_admin' ||
        role === 'superadmin' ||
        Boolean((user as any).isSuperAdmin);
      if (!isAdmin) {
        const cr = await gatewayFetch('POST', '/api/admin/billing/consume', {
          tenantSlug,
          staffId: String(user.id || user.username || ''),
          staffRole: role,
          endpointName: path,
        });
        if (typeof cr.data?.balance === 'number') reqBalance = cr.data.balance;
        if (cr.status === 402 || cr.data?.code === 'NO_CREDITS') {
          return NextResponse.json(
            {
              error: cr.data?.message || 'REQ balans gutardy',
              code: cr.data?.code || 'NO_CREDITS',
              suggestUpgrade: cr.data?.suggestUpgrade,
              periodEnd: cr.data?.periodEnd,
              rows: [],
            },
            { status: 402 }
          );
        }
      }
    } catch {
      /* ignore billing errors so data still shows if billing endpoint missing */
    }

    return NextResponse.json({
      rows,
      url: url.toString(),
      _debugParams: data?._debugParams || params,
      _bound: data?._bound,
      _via: data?._via,
      _reqBalance: reqBalance,
    });
  } catch (err) {
    const agent = await checkAgentOnline(base, tenantSlug);
    return NextResponse.json(
      {
        error: String(err),
        hint: agent.online
          ? 'Gateway-e ýetip bolmady, ýöne agent online görünýär — URL / network barlaň'
          : `Electron agent offline («${tenantSlug}»). Firma kompýuterinde Electron işleýärmi we Gateway URL dogrymy?`,
        agentOnline: agent.online,
        tenantSlug,
      },
      { status: 502 }
    );
  }
}
