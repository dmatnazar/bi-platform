import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import {
  listSupportTickets,
  upsertSupportTicket,
} from '@/lib/db';
import type { SupportCategory, SupportTicket, SupportMessage } from '@/lib/types';
import { z } from 'zod';

function isAdminRole(role: string) {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const admin = isAdminRole(user.role) || isSuperAdmin(user);

  let tickets;
  if (admin) {
    tickets = await listSupportTickets({
      companyId: isSuperAdmin(user) ? undefined : user.companyId,
      status,
    });
  } else {
    tickets = await listSupportTickets({ userId: user.id, status });
  }

  // strip heavy? keep messages for list preview — only last message in list view
  const slim = tickets.map((t) => ({
    ...t,
    messages: t.messages.slice(-1),
    messageCount: t.messages.length,
  }));

  return NextResponse.json({ tickets: slim, isAdmin: admin });
}

const createSchema = z.object({
  subject: z.string().min(2).max(200),
  category: z.enum(['error', 'suggestion', 'question', 'feedback', 'other']),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  // Only non-staff OR anyone can open a ticket to admins
  // Admins can also open internal notes as tickets if needed — allowed

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ticketId = crypto.randomUUID();
    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      ticketId,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      isStaffReply: false,
      body: parsed.data.body.trim(),
      createdAt: now,
    };

    const ticket: SupportTicket = {
      id: ticketId,
      companyId: user.companyId,
      userId: user.id,
      userName: user.fullName,
      userUsername: user.username,
      subject: parsed.data.subject.trim(),
      category: parsed.data.category as SupportCategory,
      status: 'open',
      messages: [msg],
      lastMessageAt: now,
      unreadForUser: 0,
      unreadForAdmin: 1,
      createdAt: now,
      updatedAt: now,
    };

    await upsertSupportTicket(ticket);
    return NextResponse.json({ ticket });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}
