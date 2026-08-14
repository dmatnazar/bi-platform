import { NextRequest, NextResponse } from 'next/server';
import { listDashboardsVisibleTo, upsertDashboard, getSettings } from '@/lib/db';
import { getSession, canEditDashboard, isSuperAdmin } from '@/lib/auth';
import type { Dashboard, DashboardWidget } from '@/lib/types';
import { z } from 'zod';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  }

  const dashboards = await listDashboardsVisibleTo(user);
  return NextResponse.json({ dashboards });
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  widgets: z.array(z.any()).optional(),
  globalFilters: z.array(z.any()).optional(),
  companyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canEditDashboard(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const companyId =
      isSuperAdmin(user) && parsed.data.companyId
        ? parsed.data.companyId
        : user.companyId;

    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: crypto.randomUUID(),
      companyId,
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: user.id,
      sharedWith: [],
      widgets: (parsed.data.widgets as DashboardWidget[]) || [],
      globalFilters: (parsed.data.globalFilters as Dashboard['globalFilters']) || [],
      version: 1,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };

    await upsertDashboard(dashboard);
    return NextResponse.json({ dashboard });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}
