import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany, canAccessTenant } from '@/lib/auth';
import { checkGatewayHealth, listDatabasesOnGateway } from '@/lib/gateway';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json();
  if (!body?.tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug gerek' }, { status: 400 });
  }
  const tenantSlug = String(body.tenantSlug).trim();
  // Admin/editor diňe öz firmasynyň DB sanawyny görüp bilýär
  if (!canAccessTenant(user, tenantSlug)) {
    return NextResponse.json({ error: 'Bu firma üçin rugsat ýok' }, { status: 403 });
  }
  const res = await listDatabasesOnGateway({
    tenantSlug,
    host: body.host ? String(body.host) : undefined,
    port: body.port != null ? Number(body.port) : undefined,
    username: body.username ? String(body.username) : undefined,
    password: body.password != null ? String(body.password) : undefined,
    encrypt: body.encrypt,
    trustServerCertificate: body.trustServerCertificate,
    dbKey: body.dbKey ? String(body.dbKey) : undefined,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || res.data?.message || 'DB sanawy alynmady', detail: res.data },
      { status: 502 }
    );
  }
  return NextResponse.json(res.data);
}
