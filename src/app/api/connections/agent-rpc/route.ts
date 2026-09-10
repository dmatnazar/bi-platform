import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageConnections, canAccessTenant } from '@/lib/auth';
import { checkGatewayHealth, agentRpcOnGateway } from '@/lib/gateway';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageConnections(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json();
  const tenantSlug = String(body?.tenantSlug || '').trim();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug gerek' }, { status: 400 });
  }
  if (!canAccessTenant(user, tenantSlug)) {
    return NextResponse.json({ error: 'Bu firma üçin rugsat ýok' }, { status: 403 });
  }
  const res = await agentRpcOnGateway({
    tenantSlug,
    action: String(body.action || ''),
    host: body.host || body.path,
    filePath: body.filePath || body.host,
    path: body.path || body.host || body.dir,
    database: body.database || body.sheet,
    sheet: body.sheet || body.database,
    timeoutMs: body.timeoutMs || 120_000,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || res.data?.message || 'Agent RPC şowsuz' },
      { status: res.status === 502 ? 502 : 502 }
    );
  }
  return NextResponse.json(res.data);
}
