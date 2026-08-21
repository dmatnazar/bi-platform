import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  checkGatewayHealth,
  getUpdateFeedOnGateway,
  putUpdateFeedOnGateway,
} from '@/lib/gateway';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const res = await getUpdateFeedOnGateway();
  if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
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
  const res = await putUpdateFeedOnGateway(body || {});
  if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
  return NextResponse.json(res.data);
}
