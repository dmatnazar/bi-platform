import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  readSupportContacts,
  writeSupportContacts,
  type SupportContact,
} from '@/lib/support-contacts-store';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  return NextResponse.json(readSupportContacts());
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }
  const body = await req.json();
  const contacts = (body.contacts || []) as SupportContact[];
  if (!Array.isArray(contacts)) {
    return NextResponse.json({ error: 'contacts array gerek' }, { status: 400 });
  }
  const saved = writeSupportContacts({
    intro: body.intro,
    contacts,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json(saved);
}
