import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canHandleSupport, actorTenantSlugs } from '@/lib/auth';
import {
  listSupportTickets,
  upsertSupportTicket,
  getSupportTicket,
  listCompanies,
  getCompanyById,
  getCompanyBySlug,
} from '@/lib/db';
import type { SupportCategory, SupportTicket, SupportMessage } from '@/lib/types';
import { z } from 'zod';

function isSupportStaff(user: any) {
  return canHandleSupport(user) || isSuperAdmin(user);
}

/** Firma umumy chat id (durnukly) */
function groupChatId(companyId: string) {
  return `group-${companyId}`;
}

async function ensureGroupChat(
  companyId: string,
  companySlug?: string,
  companyName?: string
): Promise<SupportTicket> {
  const id = groupChatId(companyId);
  const existing = await getSupportTicket(id);
  if (existing) {
    // update name/slug if missing
    if ((!existing.companyName && companyName) || (!existing.companySlug && companySlug)) {
      const updated = {
        ...existing,
        companySlug: existing.companySlug || companySlug,
        companyName: existing.companyName || companyName,
      };
      await upsertSupportTicket(updated);
      return updated;
    }
    return existing;
  }
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id,
    companyId,
    companySlug,
    companyName,
    isGroupChat: true,
    userId: 'system',
    userName: 'Sistema',
    userUsername: 'system',
    subject: `${companyName || companySlug || companyId} — Umumy chat`,
    category: 'other',
    status: 'open',
    messages: [],
    lastMessageAt: now,
    unreadForUser: 0,
    unreadForAdmin: 0,
    createdAt: now,
    updatedAt: now,
  };
  await upsertSupportTicket(ticket);
  return ticket;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const companyFilter = req.nextUrl.searchParams.get('companyId') || undefined;
  const admin = isSupportStaff(user);

  // User firms (tenant slugs + primary company)
  const mySlugs = actorTenantSlugs(user);
  const companies = await listCompanies();
  const mySlugsSet = new Set(mySlugs);
  const myCompanies = companies.filter((c) => {
    const id = String(c.id || '');
    const slug = String(c.slug || '');
    return (
      id === user.companyId ||
      slug === user.companySlug ||
      mySlugsSet.has(slug) ||
      (Array.isArray(user.tenantSlugs) && user.tenantSlugs.includes(slug))
    );
  });

  // Ensure group chats for user firms
  const groups: SupportTicket[] = [];
  for (const c of myCompanies) {
    const g = await ensureGroupChat(String(c.id), c.slug, c.name);
    groups.push(g);
  }
  // Admin / super: ensure groups for all or company scope
  if (admin) {
    const scope = isSuperAdmin(user) ? companies : myCompanies;
    for (const c of scope) {
      const g = await ensureGroupChat(String(c.id), c.slug, c.name);
      if (!groups.find((x) => x.id === g.id)) groups.push(g);
    }
  }

  let tickets;
  if (admin) {
    tickets = await listSupportTickets({
      companyId: companyFilter || (isSuperAdmin(user) ? undefined : user.companyId),
      status,
    });
  } else {
    tickets = await listSupportTickets({ userId: user.id, status });
    // also include group chats for my firms
    tickets = [
      ...groups.filter((g) => !status || g.status === status),
      ...tickets.filter((t) => !t.isGroupChat),
    ];
  }

  if (admin) {
    // include groups in list
    const gids = new Set(tickets.filter((t) => t.isGroupChat).map((t) => t.id));
    for (const g of groups) {
      if (!gids.has(g.id)) {
        if (!companyFilter || g.companyId === companyFilter) tickets.push(g);
      }
    }
  }

  if (companyFilter) {
    tickets = tickets.filter((t) => t.companyId === companyFilter);
  }

  tickets = tickets.sort((a, b) => {
    // groups first for users
    if (a.isGroupChat && !b.isGroupChat) return -1;
    if (!a.isGroupChat && b.isGroupChat) return 1;
    return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
  });

  const slim = tickets.map((t) => ({
    ...t,
    messages: (t.messages || []).slice(-1),
    messageCount: (t.messages || []).length,
  }));

  const firmList = (admin ? (isSuperAdmin(user) ? companies : myCompanies) : myCompanies).map(
    (c: any) => ({
      id: String(c.id),
      slug: String(c.slug || ''),
      name: String(c.name || c.slug || c.id),
    })
  );

  return NextResponse.json({
    tickets: slim,
    isAdmin: admin,
    companies: firmList,
  });
}

const createSchema = z.object({
  subject: z.string().min(2).max(200),
  category: z.enum(['error', 'suggestion', 'question', 'feedback', 'other']),
  body: z.string().min(1).max(5000),
  companyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
    }

    const mySlugs = new Set(actorTenantSlugs(user));
    let companyId = parsed.data.companyId || user.companyId;
    let company =
      (await getCompanyById(String(companyId))) ||
      (parsed.data.companyId ? await getCompanyBySlug(String(parsed.data.companyId)) : undefined);
    if (company) companyId = String(company.id);
    // Validate user can open ticket for this firm
    if (!isSuperAdmin(user) && !isSupportStaff(user)) {
      const ok =
        String(companyId) === String(user.companyId) ||
        (company && mySlugs.has(String(company.slug))) ||
        (Array.isArray(user.tenantSlugs) && company && user.tenantSlugs.includes(company.slug));
      if (!ok) {
        return NextResponse.json({ error: 'Bu firma üçin rugsat ýok' }, { status: 403 });
      }
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
      deliveredAt: now,
    };

    const ticket: SupportTicket = {
      id: ticketId,
      companyId: String(companyId),
      companySlug: company?.slug,
      companyName: company?.name,
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
