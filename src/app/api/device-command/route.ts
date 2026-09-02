import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany, isSuperAdmin } from '@/lib/auth';
import { checkGatewayHealth, deviceCommandOnGateway } from '@/lib/gateway';
import { z } from 'zod';

const schema = z.object({
  deviceId: z.string().min(1),
  action: z.enum(['restart', 'check_update']),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || (!canManageCompany(user.role) && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'nädogry' }, { status: 400 });
  }
  const res = await deviceCommandOnGateway(parsed.data);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || res.data?.message || 'şowsuz', details: res.data },
      { status: 502 }
    );
  }
  return NextResponse.json(res.data);
}
