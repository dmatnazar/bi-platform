import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import {
  getSupportTicket,
  upsertSupportTicket,
  appendSupportMessage,
  markSupportRead,
} from '@/lib/db';
import type { SupportMessage, SupportTicketStatus } from '@/lib/types';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

function isAdminRole(role: string) {
  return role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'editor';
}

function canAccess(
  user: { id: string; role: string; companyId: string; isSuperAdmin?: boolean },
  ticket: { userId: string; companyId: string }
) {
  if (isSuperAdmin(user as any) || user.role === 'super_admin') return true;
  if (isAdminRole(user.role) && ticket.companyId === user.companyId) return true;
  if (ticket.userId === user.id) return true;
  return false;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const { id } = await ctx.params;
  const ticket = await getSupportTicket(id);
  if (!ticket) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });
  if (!canAccess(user, ticket)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const admin = isAdminRole(user.role) || isSuperAdmin(user);
  await markSupportRead(id, admin ? 'admin' : 'user');

  const fresh = await getSupportTicket(id);
  return NextResponse.json({ ticket: fresh, isAdmin: admin });
}

const messageSchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const { id } = await ctx.params;
  const ticket = await getSupportTicket(id);
  if (!ticket) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });
  if (!canAccess(user, ticket)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  if (ticket.status === 'closed') {
    return NextResponse.json({ error: 'Ticket ýapyk' }, { status: 400 });
  }

  const admin = isAdminRole(user.role) || isSuperAdmin(user);
  // User may only write on their own ticket; admin replies as staff
  if (!admin && ticket.userId !== user.id) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Hat boş' }, { status: 400 });
    }

    const now = new Date().toISOString();
    // Users write to admins; admin replies are staff replies
    const asStaff = admin;
    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      ticketId: id,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      isStaffReply: asStaff,
      body: parsed.data.body.trim(),
      createdAt: now,
    };

    const updated = await appendSupportMessage(id, msg, asStaff ? 'admin' : 'user');
    return NextResponse.json({ ticket: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Serwerde säwlik' }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedAdminId: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const admin = isAdminRole(user.role) || isSuperAdmin(user);
  if (!admin) return NextResponse.json({ error: 'Diňe admin' }, { status: 403 });

  const { id } = await ctx.params;
  const ticket = await getSupportTicket(id);
  if (!ticket) return NextResponse.json({ error: 'Tapyimady' }, { status: 404 });
  if (!canAccess(user, ticket)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nädogry' }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (parsed.data.status) ticket.status = parsed.data.status as SupportTicketStatus;
  if (parsed.data.assignedAdminId) ticket.assignedAdminId = parsed.data.assignedAdminId;
  ticket.updatedAt = now;
  await upsertSupportTicket(ticket);
  return NextResponse.json({ ticket });
}
