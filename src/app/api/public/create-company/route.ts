import { NextRequest, NextResponse } from 'next/server';
import {
  checkGatewayHealth,
  updateTenantOnGateway,
  assignTariffOnGateway,
  fetchCatalog,
} from '@/lib/gateway';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tariffId: z.string().optional(),
});

/**
 * Public registration helper: create a new company on VPS when user cannot find theirs.
 * Uses server-side admin signature (never exposed to client).
 */
export async function POST(req: NextRequest) {
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline — soňrak synanyşyň' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ady we dogry slug gerek (mysal: acme-llc)' }, { status: 400 });
  }

  const { name, slug, tariffId } = parsed.data;

  // Duplicate check
  try {
    const cat = await fetchCatalog(true);
    if (cat.tenants.some((t) => t.slug === slug)) {
      return NextResponse.json({ error: 'Bu slug eýýäm bar — başga slug ýazyň' }, { status: 409 });
    }
  } catch {
    /* continue */
  }

  // tenant-update upserts when missing
  const res = await updateTenantOnGateway({
    slug,
    name,
    isActive: true,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || res.data?.message || 'Firma döredip bolmady' },
      { status: 502 }
    );
  }

  // Assign tariff (default free if not specified)
  let assignedTariffId = tariffId;
  if (!assignedTariffId) {
    assignedTariffId = 'tariff_free';
  }
  try {
    await assignTariffOnGateway({
      tenantSlug: slug,
      tariffId: assignedTariffId,
      grantIncludedCredits: true,
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    company: {
      id: res.data?.tenant?.id || slug,
      slug,
      name,
    },
  });
}
