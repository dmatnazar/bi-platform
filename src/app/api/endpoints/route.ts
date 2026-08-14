import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import { checkGatewayHealth, updateEndpointOnGateway } from '@/lib/gateway';
import { z } from 'zod';

const schema = z.object({
  id: z.string(),
  tenantSlug: z.string(),
  name: z.string().min(1),
  pathTemplate: z.string().min(1),
  method: z.string().min(1),
  dbKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'nädogry' }, { status: 400 });

  const res = await updateEndpointOnGateway(parsed.data);
  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, endpoint: res.data?.endpoint });
}
