import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  canManageConnections,
  canAccessTenant,
  isSuperAdmin,
  actorTenantSlugs,
} from '@/lib/auth';
import {
  checkGatewayHealth,
  upsertConnectionOnGateway,
  deleteConnectionOnGateway,
  fetchCatalog,
} from '@/lib/gateway';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageConnections(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  try {
    const cat = await fetchCatalog(true);
    let tenants = (cat as any).tenants || [];
    const devices = (cat as any).devices || [];

    // Admin / editor: diňe öz firmalary (tenantSlugs / companySlug)
    if (!isSuperAdmin(user)) {
      const mine = new Set(actorTenantSlugs(user));
      if (!mine.size) {
        return NextResponse.json({
          connections: [],
          tenants: [],
          devices: [],
          syncedAt: (cat as any).syncedAt,
        });
      }
      tenants = tenants.filter((t: any) => mine.has(String(t.slug || '').trim()));
    }

    const connections = tenants.flatMap((t: any) =>
      (t.connections || []).map((c: any) => ({
        ...c,
        tenantId: t.id,
        tenantSlug: t.slug,
        tenantName: t.name,
        devices: devices
          .filter(
            (d: any) =>
              d.tenantSlug === t.slug || (d.companySlugs || []).includes(t.slug)
          )
          .map((d: any) => ({
            id: d.id,
            name: d.name || d.hostname,
            status: d.status,
            hostname: d.hostname,
          })),
      }))
    );

    // Devices hem tenant scope bilen
    const scopedDevices = isSuperAdmin(user)
      ? devices
      : devices.filter(
          (d: any) =>
            actorTenantSlugs(user).includes(String(d.tenantSlug || '').trim()) ||
            (Array.isArray(d.companySlugs) &&
              d.companySlugs.some((s: string) =>
                actorTenantSlugs(user).includes(String(s || '').trim())
              ))
        );

    return NextResponse.json({
      connections,
      tenants,
      devices: scopedDevices,
      syncedAt: (cat as any).syncedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}

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
  // Admin/editor diňe öz firmasyna baglanyşyk goşup bilýär
  if (!canAccessTenant(user, tenantSlug)) {
    return NextResponse.json({ error: 'Bu firma üçin rugsat ýok' }, { status: 403 });
  }
  const res = await upsertConnectionOnGateway(body);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.message || res.data?.error || 'şowsuz' },
      { status: res.status === 409 ? 409 : 502 }
    );
  }
  return NextResponse.json(res.data);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageConnections(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json();
  const tenantSlug = String(body?.tenantSlug || '').trim();
  if (tenantSlug && !canAccessTenant(user, tenantSlug)) {
    return NextResponse.json({ error: 'Bu firma üçin rugsat ýok' }, { status: 403 });
  }
  const res = await deleteConnectionOnGateway(body);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.message || res.data?.error || 'şowsuz' },
      { status: res.status === 409 ? 409 : 502 }
    );
  }
  return NextResponse.json(res.data);
}
