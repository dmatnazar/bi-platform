import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  checkGatewayHealth,
  getDeviceSettingsOnGateway,
  upsertDeviceSettingsOnGateway,
} from '@/lib/gateway';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId') || undefined;
  const tenantSlug = searchParams.get('tenantSlug') ?? undefined;
  const res = await getDeviceSettingsOnGateway({ deviceId, tenantSlug });
  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json();
  if (!body?.deviceId || !body?.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ error: 'deviceId we settings gerek' }, { status: 400 });
  }
  const res = await upsertDeviceSettingsOnGateway({
    deviceId: String(body.deviceId),
    tenantSlug: body.tenantSlug != null ? String(body.tenantSlug) : '',
    settings: body.settings,
    updatedBy: user.username || user.id || 'bi',
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
