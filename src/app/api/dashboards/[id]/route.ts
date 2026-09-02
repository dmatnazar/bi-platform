import { NextRequest, NextResponse } from 'next/server';
import { getDashboard, upsertDashboard, deleteDashboard } from '@/lib/db';
import { getSession, canEditDashboard, isSuperAdmin } from '@/lib/auth';
import type { DashboardWidget, GlobalFilterDef } from '@/lib/types';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const { id } = await ctx.params;
  const dash = await getDashboard(id);
  if (!dash) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });

  if (!isSuperAdmin(user) && dash.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  return NextResponse.json({ dashboard: dash });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  widgets: z.array(z.any()).optional(),
  globalFilters: z.array(z.any()).optional(),
  sharedWith: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  /** Super-admin: move dashboard to another company */
  companyId: z.string().optional(),
});

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user || !canEditDashboard(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const dash = await getDashboard(id);
  if (!dash) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });

  if (!isSuperAdmin(user) && dash.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const nextCompanyId =
      isSuperAdmin(user) && parsed.data.companyId
        ? parsed.data.companyId
        : dash.companyId;

    const updated = {
      ...dash,
      ...parsed.data,
      companyId: nextCompanyId,
      widgets: (parsed.data.widgets as DashboardWidget[]) ?? dash.widgets,
      globalFilters:
        (parsed.data.globalFilters as GlobalFilterDef[] | undefined) ??
        dash.globalFilters ??
        [],
      updatedAt: new Date().toISOString(),
    };

    await upsertDashboard(updated);
    return NextResponse.json({ dashboard: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user || !canEditDashboard(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const dash = await getDashboard(id);
  if (!dash) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });

  if (!isSuperAdmin(user) && dash.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  await deleteDashboard(id);
  return NextResponse.json({ ok: true });
}
