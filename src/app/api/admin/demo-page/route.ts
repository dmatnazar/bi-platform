import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { canManageDemoPage } from '@/lib/rbac';
import { readDemoPageContent, writeDemoPageContent, type DemoPageContent } from '@/lib/demo-page-store';

export async function GET() {
  const user = await getSession();
  if (!user || !(isSuperAdmin(user) || canManageDemoPage(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  return NextResponse.json(readDemoPageContent());
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !(isSuperAdmin(user) || canManageDemoPage(user))) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as DemoPageContent;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Nädogry maglumat' }, { status: 400 });
    }
    const saved = writeDemoPageContent(body);
    return NextResponse.json(saved);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Saklanmady' }, { status: 500 });
  }
}
