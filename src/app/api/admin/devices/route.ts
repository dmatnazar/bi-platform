import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canManageCompany } from '@/lib/auth';
import {
  listDevicesOnGateway,
  approveDeviceOnGateway,
  updateDeviceStatusOnGateway,
  deleteDeviceOnGateway,
  checkGatewayHealth,
  fetchCatalog,
} from '@/lib/gateway';
import { getSettings } from '@/lib/db';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const settings = await getSettings();
  const gatewayUrl = (process.env.GATEWAY_URL || settings.gatewayUrl || 'http://localhost:4000').replace(/\/$/, '');
  const online = await checkGatewayHealth();

  if (!online) {
    return NextResponse.json(
      {
        error: 'VPS Gateway bagly däl (Offline)',
        debug: {
          gatewayUrl,
          hint: 'BI Platform sazlamalary /admin/settings sahypasyndan VPS Gateway URL we Admin Secret-i barlaň. Electron we BI Platform üçin aýry sazlamalar gerek.',
        },
      },
      { status: 503 }
    );
  }

  try {
    const res = await listDevicesOnGateway();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Enjamlary alyp bolmady',
          detail: res.data,
          debug: {
            gatewayUrl,
            hint: 'Admin Sync Secret nädogry bolmagy mümkin. /admin/settings sahypasynda barlaň.',
          },
        },
        { status: res.status || 500 }
      );
    }

    let devices: any[] = res.data?.devices || [];
    if (!isSuperAdmin(user) && user.companySlug) {
      devices = devices.filter(
        (d) =>
          d.tenantSlug === user.companySlug ||
          d.companySlugs?.includes(user.companySlug) ||
          !d.tenantSlug
      );
    }

    // Get company options for dropdown
    const catalog = await fetchCatalog(true);
    const companies = (catalog.tenants || []).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      isActive: t.isActive,
    }));

    return NextResponse.json({ devices, companies, count: devices.length, debug: { gatewayUrl } });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Serwer ýalňyşlygy',
        detail: err?.message || String(err),
        debug: { gatewayUrl },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const settings = await getSettings();
  const gatewayUrl = (process.env.GATEWAY_URL || settings.gatewayUrl || 'http://localhost:4000').replace(/\/$/, '');
  const online = await checkGatewayHealth();

  if (!online) {
    return NextResponse.json(
      { error: 'VPS Gateway bagly däl (Offline)', debug: { gatewayUrl } },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { action, deviceId, tenantSlug, tenantSlugs, name, status } = body;

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId gerek' }, { status: 400 });
  }

  const resolvedTenantSlugs: string[] = Array.isArray(tenantSlugs)
    ? tenantSlugs
    : tenantSlug
      ? [tenantSlug]
      : [];

  try {
    if (action === 'approve') {
      if (resolvedTenantSlugs.length === 0) {
        return NextResponse.json({ error: 'Kärhana saýlaň (tenantSlug / tenantSlugs gerek)' }, { status: 400 });
      }
      const res = await approveDeviceOnGateway(deviceId, resolvedTenantSlugs, name);
      if (!res.ok) {
        return NextResponse.json({ error: 'Tassyklap bolmady', detail: res.data }, { status: res.status || 500 });
      }
      return NextResponse.json({ ok: true, device: res.data?.device });
    }

    if (action === 'update-status') {
      if (!status || !['pending', 'approved', 'blocked'].includes(status)) {
        return NextResponse.json({ error: 'Nädogry status' }, { status: 400 });
      }
      const res = await updateDeviceStatusOnGateway(deviceId, status, tenantSlug, name);
      if (!res.ok) {
        return NextResponse.json({ error: 'Statusy täzeläp bolmady', detail: res.data }, { status: res.status || 500 });
      }
      return NextResponse.json({ ok: true, status });
    }

    if (action === 'delete') {
      const res = await deleteDeviceOnGateway(deviceId);
      if (!res.ok) {
        return NextResponse.json({ error: 'Enjamy pozup bolmady', detail: res.data }, { status: res.status || 500 });
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: 'Näbelli hereket (action)' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Ýalňyşlyk ýüze çykdy', detail: err?.message || String(err), debug: { gatewayUrl } },
      { status: 500 }
    );
  }
}
