import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageStaff, isSuperAdmin } from '@/lib/auth';
import { listRegistrations, resolveRegistration } from '@/lib/gateway';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageStaff(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const params: { tenantSlug?: string; status?: string } = {};
  if (status) params.status = status;
  if (!isSuperAdmin(user) && user.companySlug) {
    params.tenantSlug = user.companySlug;
  }

  const res = await listRegistrations(params);
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Gateway-den alyp bolmady', detail: res.data || null, registrations: [] },
      { status: 502 }
    );
  }
  const regs = Array.isArray(res.data?.registrations)
    ? res.data.registrations
    : Array.isArray(res.data)
      ? res.data
      : [];
  return NextResponse.json({ registrations: regs });
}

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
  role: z.enum(['admin', 'editor', 'manager', 'viewer']).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageStaff(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const res = await resolveRegistration({
      ...parsed.data,
      reviewedBy: user.username,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || 'Resolve failed' },
        { status: res.status || 502 }
      );
    }
    return NextResponse.json({ ok: true, status: res.data.status });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}
