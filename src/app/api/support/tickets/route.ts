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
import { fetchCatalog } from '@/lib/gateway';
import type { SupportCategory, SupportTicket, SupportMessage } from '@/lib/types';
import { z } from 'zod';

function isSupportStaff(user: any) {
  return canHandleSupport(user) || isSuperAdmin(user);
}

/** Bir firma bir gezek (slug / id) */
function dedupeCompanies(list: any[]): any[] {
  const map = new Map<string, any>();
  for (const c of list || []) {
    const slug = String(c.slug || '').toLowerCase().trim();
    const id = String(c.id || '').trim();
    const key = slug || id;
    if (!key) continue;
    if (!map.has(key)) map.set(key, c);
  }
  return [...map.values()];
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

  // Firmalar — dashboard bilen birmeňzeş: gateway catalog tenants
  const mySlugs = actorTenantSlugs(user);
  const mySlugsSet = new Set(mySlugs);
  let catalogFirms: { id: string; slug: string; name: string }[] = [];
  try {
    const catalog = await fetchCatalog(false);
    const tenants = catalog.tenants || [];
    if (isSuperAdmin(user) || user.role === 'admin' || user.role === 'super_admin') {
      catalogFirms = tenants.map((t: any) => ({
        id: String(t.id || t.slug),
        slug: String(t.slug || ''),
        name: String(t.name || t.slug || t.id),
      }));
    } else {
      catalogFirms = tenants
        .filter((t: any) => {
          const slug = String(t.slug || '');
          return (
            mySlugsSet.has(slug) ||
            slug === user.companySlug ||
            String(t.id) === String(user.companyId)
          );
        })
        .map((t: any) => ({
          id: String(t.id || t.slug),
          slug: String(t.slug || ''),
          name: String(t.name || t.slug || t.id),
        }));
    }
  } catch {
    // fallback: DB companies
    const dbCompanies = dedupeCompanies(await listCompanies());
    catalogFirms = dbCompanies
      .filter((c: any) => {
        if (isSuperAdmin(user) || user.role === 'admin') return true;
        const id = String(c.id || '');
        const slug = String(c.slug || '');
        return (
          id === user.companyId ||
          slug === user.companySlug ||
          mySlugsSet.has(slug)
        );
      })
      .map((c: any) => ({
        id: String(c.id),
        slug: String(c.slug || ''),
        name: String(c.name || c.slug || c.id),
      }));
  }

  const firmSource = dedupeCompanies(catalogFirms);
  const allowedIds = new Set(firmSource.map((c) => String(c.id)));
  const allowedSlugs = new Set(
    firmSource.map((c) => String(c.slug || '').toLowerCase()).filter(Boolean)
  );

  function inFirmScope(t: SupportTicket): boolean {
    const cid = String(t.companyId || '');
    const cslug = String(t.companySlug || '').toLowerCase();
    return allowedIds.has(cid) || (cslug ? allowedSlugs.has(cslug) : false);
  }

  // Umumy chat — diňe scope-daky firmalar
  const groups: SupportTicket[] = [];
  for (const c of firmSource) {
    const g = await ensureGroupChat(String(c.id), c.slug, c.name);
    if (!groups.find((x) => x.id === g.id || x.companyId === g.companyId)) {
      groups.push(g);
    }
  }

  let tickets: SupportTicket[];
  if (admin) {
    // Ähli ticketler (ýa-da saýlanan firma), soň scope bilen süz
    tickets = await listSupportTickets({
      companyId: companyFilter || undefined,
      status,
    });
    if (!companyFilter) {
      tickets = tickets.filter((t) => inFirmScope(t));
    }
  } else {
    tickets = await listSupportTickets({ userId: user.id, status });
  }

  // Viewer/editor (non-admin): trashed hiç wagt görünmesin
  if (!admin) {
    tickets = tickets.filter((t) => t.status !== 'trashed');
  }

  // Köne / goşmaça umumy chat-lary aýyr (diňe group-{companyId} galdyr)
  const canonicalGroupIds = new Set(groups.map((g) => g.id));
  tickets = tickets.filter((t) => {
    if (!t.isGroupChat) return true;
    return canonicalGroupIds.has(t.id);
  });

  // Her firma üçin bir umumy chat
  const haveGroup = new Set(tickets.filter((t) => t.isGroupChat).map((t) => t.companyId));
  for (const g of groups) {
    if (companyFilter && g.companyId !== companyFilter && g.companySlug !== companyFilter) {
      continue;
    }
    if (!haveGroup.has(g.companyId)) {
      tickets.push(g);
      haveGroup.add(g.companyId);
    }
  }

  if (companyFilter) {
    tickets = tickets.filter(
      (t) =>
        t.companyId === companyFilter ||
        t.companySlug === companyFilter ||
        String(t.companyId) === String(companyFilter)
    );
  }

  // User: bagly firmalaryň umumy chat-y + öz ticketleri
  if (!admin) {
    tickets = tickets.filter((t) => t.isGroupChat || t.userId === user.id);
  }

  // Soňky ýazylan chat iň ýokarda
  tickets = tickets.sort((a, b) =>
    (b.lastMessageAt || b.updatedAt || '').localeCompare(a.lastMessageAt || a.updatedAt || '')
  );

  const slim = tickets.map((t) => ({
    ...t,
    messages: (t.messages || []).slice(-1),
    messageCount: (t.messages || []).length,
  }));

  // Firm list: diňe catalog scope; boş (ticket ýok) firmalary gizle — diňe umumy chat bar bolsa hem görkez
  // (umumy chat hemişe bar, şonuň üçin ähli scope firmalar galýar — bu dashboard bilen gabat gelýär)
  const firmList = firmSource.map((c) => ({
    id: String(c.id),
    slug: String(c.slug || ''),
    name: String(c.name || c.slug || c.id),
  }));

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
