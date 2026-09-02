import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  checkGatewayHealth,
  updateEndpointOnGateway,
  createEndpointOnGateway,
  deleteEndpointOnGateway,
  invalidateCatalogCache,
} from '@/lib/gateway';
import { z } from 'zod';

const schema = z.object({
  id: z.string().optional(),
  tenantSlug: z.string(),
  name: z.string().min(1).optional(),
  pathTemplate: z.string().min(1).optional(),
  method: z.string().min(1).optional(),
  dbKey: z.string().optional(),
  sqlQuery: z.string().optional(),
  paramsSchema: z.any().optional(),
  responseSchema: z.any().optional(),
  cacheTtlSec: z.number().optional(),
  authRequired: z.boolean().optional(),
  connectionId: z.string().optional(),
  databaseName: z.string().optional(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: 'nädogry', details: parsed.error.flatten() }, { status: 400 });
  }

  // Create when no id (or explicit create flag)
  if (!parsed.data.id || body.create === true) {
    if (!parsed.data.name || !parsed.data.pathTemplate || !parsed.data.method) {
      return NextResponse.json({ error: 'name, pathTemplate, method gerek' }, { status: 400 });
    }
    const res = await createEndpointOnGateway(parsed.data as any);
    if (!res.ok) {
      const status = res.data?.error === 'duplicate' ? 409 : 502;
      return NextResponse.json(
        { error: res.data?.message || res.data?.error || 'şowsuz', details: res.data },
        { status }
      );
    }
    invalidateCatalogCache();
    return NextResponse.json({ ok: true, endpoint: res.data?.endpoint });
  }

  const res = await updateEndpointOnGateway(parsed.data as any);
  if (!res.ok) {
    const status = res.data?.error === 'duplicate' ? 409 : 502;
    return NextResponse.json(
      { error: res.data?.message || res.data?.error || 'şowsuz', details: res.data },
      { status }
    );
  }
  invalidateCatalogCache();
  return NextResponse.json({ ok: true, endpoint: res.data?.endpoint });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.id && !(body.tenantSlug && body.method && body.pathTemplate)) {
    return NextResponse.json({ error: 'id ýa-da tenantSlug+method+pathTemplate gerek' }, { status: 400 });
  }
  const res = await deleteEndpointOnGateway({
    id: body.id,
    tenantSlug: body.tenantSlug,
    method: body.method,
    pathTemplate: body.pathTemplate,
  });
  if (!res.ok) {
    const status = res.data?.error === 'has_dependencies' ? 409 : 502;
    return NextResponse.json(
      { error: res.data?.message || res.data?.error || 'şowsuz', details: res.data },
      { status }
    );
  }
  invalidateCatalogCache();
  return NextResponse.json({ ok: true, deleted: true, id: res.data?.id });
}
