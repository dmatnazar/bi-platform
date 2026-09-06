import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  isSuperAdmin,
  canManageDevices as canDev,
  canApproveDevices,
  actorTenantSlugs,
  canAccessAnyTenant,
  clampTenantSlugs,
  filterByTenantScope,
} from '@/lib/auth';
import {
  listDevicesOnGateway,
  approveDeviceOnGateway,
  updateDeviceStatusOnGateway,
  deleteDeviceOnGateway,
  fetchCatalog,
} from '@/lib/gateway';

function canManageDevices(user: Awaited<ReturnType<typeof getSession>>) {
  if (!user) return false;
  return canDev(user);
}

/** GET — list devices from VPS Gateway (scoped) */
export async function GET() {
  const user = await getSession();
  if (!user || !canManageDevices(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const res = await listDevicesOnGateway();
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || 'Devices alynmady', detail: res.data },
      { status: res.status || 502 }
    );
  }

  let devices = res.data?.devices || [];
  if (!isSuperAdmin(user)) {
    const mine = new Set(actorTenantSlugs(user));
    devices = devices.filter((d: any) => {
      const slugs = [
        d.tenantSlug,
        ...(Array.isArray(d.tenantSlugs) ? d.tenantSlugs : []),
      ]
        .map((s: any) => String(s || '').trim())
        .filter(Boolean);
      // pending without tenants: only super sees for approve
      if (!slugs.length) return false;
      return slugs.some((s: string) => mine.has(s));
    });
  }

  let tenants: { slug: string; name: string }[] = [];
  try {
    const catalog = await fetchCatalog(false);
    tenants = (catalog.tenants || []).map((t) => ({ slug: t.slug, name: t.name }));
    if (!isSuperAdmin(user)) {
      const mine = new Set(actorTenantSlugs(user));
      tenants = tenants.filter((t) => mine.has(t.slug));
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    devices,
    tenants,
    canApprove: canApproveDevices(user),
  });
}

/** POST — approve / update status / delete */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageDevices(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').toLowerCase();
  const id = String(body.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Device id gerek' }, { status: 400 });
  }

  if (action === 'approve') {
    if (!canApproveDevices(user)) {
      return NextResponse.json(
        { error: 'Enjam tassyklamak diňe super admin üçin' },
        { status: 403 }
      );
    }
    const tenantSlugs: string[] = Array.isArray(body.tenantSlugs)
      ? body.tenantSlugs.filter(Boolean)
      : body.tenantSlug
        ? [body.tenantSlug]
        : [];
    if (tenantSlugs.length === 0) {
      return NextResponse.json({ error: 'Iň az bir firma (tenantSlug) saýlaň' }, { status: 400 });
    }
    const res = await approveDeviceOnGateway(id, {
      tenantSlugs,
      name: body.name,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || res.data?.message || 'Approve şowsuz', detail: res.data },
        { status: res.status || 502 }
      );
    }
    return NextResponse.json({ ok: true, device: res.data?.device || res.data });
  }

  if (action === 'status') {
    let tenantSlugs: string[] = Array.isArray(body.tenantSlugs)
      ? body.tenantSlugs.filter(Boolean)
      : body.tenantSlug
        ? [body.tenantSlug]
        : [];
    tenantSlugs = clampTenantSlugs(user, tenantSlugs);
    if (body.tenantSlugs?.length && tenantSlugs.length === 0) {
      return NextResponse.json({ error: 'Saýlanan firmalar size degişli däl' }, { status: 403 });
    }
    const status = body.status as 'pending' | 'approved' | 'blocked';
    if (!status) {
      return NextResponse.json({ error: 'status gerek' }, { status: 400 });
    }
    const res = await updateDeviceStatusOnGateway(id, {
      status,
      tenantSlugs: tenantSlugs.length ? tenantSlugs : undefined,
      tenantSlug: tenantSlugs[0] || body.tenantSlug,
      name: body.name,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || 'Status üýtgedip bolmady', detail: res.data },
        { status: res.status || 502 }
      );
    }
    return NextResponse.json({ ok: true, device: res.data?.device || res.data });
  }

  if (action === 'delete') {
    const res = await deleteDeviceOnGateway(id);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || 'Pozup bolmady', detail: res.data },
        { status: res.status || 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Näbelli action' }, { status: 400 });
}
