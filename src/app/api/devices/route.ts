import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canManageCompany } from '@/lib/auth';
import {
  listDevicesOnGateway,
  approveDeviceOnGateway,
  updateDeviceStatusOnGateway,
  deleteDeviceOnGateway,
  fetchCatalog,
} from '@/lib/gateway';

function canManageDevices(user: Awaited<ReturnType<typeof getSession>>) {
  if (!user) return false;
  return isSuperAdmin(user) || canManageCompany(user.role);
}

/** GET — list devices from VPS Gateway */
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

  // Optionally attach tenant list for approve UI
  let tenants: { slug: string; name: string }[] = [];
  try {
    const catalog = await fetchCatalog(false);
    tenants = (catalog.tenants || []).map((t) => ({ slug: t.slug, name: t.name }));
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    devices: res.data?.devices || [],
    tenants,
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
    const status = body.status as 'pending' | 'approved' | 'blocked';
    if (!status) {
      return NextResponse.json({ error: 'status gerek' }, { status: 400 });
    }
    const tenantSlugs: string[] = Array.isArray(body.tenantSlugs)
      ? body.tenantSlugs.filter(Boolean)
      : body.tenantSlug
        ? [body.tenantSlug]
        : [];
    const res = await updateDeviceStatusOnGateway(id, {
      status,
      tenantSlugs: tenantSlugs.length ? tenantSlugs : undefined,
      tenantSlug: body.tenantSlug,
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
