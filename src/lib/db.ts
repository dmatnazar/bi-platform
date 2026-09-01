/**
 * Simple JSON file store (no external DB required for bootstrap).
 * Data lives in ./data/bi-platform.json
 */
import path from 'node:path';
import fs from 'node:fs';
import type { DbSchema, Company, StaffMember, RegistrationRequest, Dashboard, SupportTicket, SupportMessage } from './types';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bi-platform.json');

const defaultData = (): DbSchema => ({
  companies: [],
  staff: [],
  registrations: [],
  dashboards: [],
  supportTickets: [],
  endpointCatalog: [],
  settings: {
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:4000',
    jwtSecret: process.env.JWT_SECRET || 'bi-platform-dev-secret-change-in-production-32chars',
    gatewayAdminSecret: process.env.GATEWAY_ADMIN_SECRET || process.env.ADMIN_SYNC_SECRET || '',
    catalogSyncIntervalSec: 0,
  },
});

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDb(): DbSchema {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const data = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DbSchema;
    if (!Array.isArray(parsed.supportTickets)) parsed.supportTickets = [];
    return parsed;
  } catch {
    const data = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }
}

function writeDb(data: DbSchema) {
  ensureDir();
  // Atomic write so restart / crash does not wipe dashboards
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

let seeded = false;

async function seedIfEmpty(data: DbSchema): Promise<DbSchema> {
  // No auto demo users / dashboards — data comes from VPS sync / real accounts
  if (!Array.isArray(data.supportTickets)) data.supportTickets = [];
  if (!Array.isArray(data.dashboards)) data.dashboards = [];
  if (!Array.isArray(data.staff)) data.staff = [];
  if (!Array.isArray(data.companies)) data.companies = [];
  return data;
}



/** Legacy no-op — demo users disabled */
export async function ensureDemoUsers(): Promise<void> {
  // intentionally empty
}

async function getData(): Promise<DbSchema> {
  let data = readDb();
  data = await seedIfEmpty(data);
  return data;
}

export async function listCompanies(): Promise<Company[]> {
  const data = await getData();
  return data.companies.filter((c) => c.isActive);
}

export async function getCompanyById(id: string): Promise<Company | undefined> {
  const data = await getData();
  return data.companies.find((c) => c.id === id);
}

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const data = await getData();
  return data.companies.find((c) => c.slug === slug);
}

export async function upsertCompany(company: Company): Promise<void> {
  const data = await getData();
  const idx = data.companies.findIndex((c) => c.id === company.id);
  if (idx >= 0) data.companies[idx] = company;
  else data.companies.push(company);
  writeDb(data);
}

export async function listStaff(companyId?: string): Promise<StaffMember[]> {
  const data = await getData();
  let list = data.staff;
  if (companyId) list = list.filter((s) => s.companyId === companyId);
  return list;
}

export async function getStaffByUsername(username: string): Promise<StaffMember | undefined> {
  const data = await getData();
  return data.staff.find((s) => s.username.toLowerCase() === username.toLowerCase());
}

export async function getStaffById(id: string): Promise<StaffMember | undefined> {
  const data = await getData();
  return data.staff.find((s) => s.id === id);
}

export async function upsertStaff(member: StaffMember): Promise<void> {
  const data = await getData();
  const idx = data.staff.findIndex((s) => s.id === member.id);
  if (idx >= 0) data.staff[idx] = member;
  else data.staff.push(member);
  writeDb(data);
}

export async function deleteStaff(id: string): Promise<void> {
  const data = await getData();
  data.staff = data.staff.filter((s) => s.id !== id);
  writeDb(data);
}

export async function listRegistrations(status?: string): Promise<RegistrationRequest[]> {
  const data = await getData();
  let list = data.registrations;
  if (status) list = list.filter((r) => r.status === status);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRegistration(id: string): Promise<RegistrationRequest | undefined> {
  const data = await getData();
  return data.registrations.find((r) => r.id === id);
}

export async function addRegistration(req: RegistrationRequest): Promise<void> {
  const data = await getData();
  data.registrations.push(req);
  writeDb(data);
}

export async function updateRegistration(
  id: string,
  patch: Partial<RegistrationRequest>
): Promise<void> {
  const data = await getData();
  const idx = data.registrations.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('Registration not found');
  data.registrations[idx] = { ...data.registrations[idx], ...patch };
  writeDb(data);
}

export async function listDashboards(companyId?: string, ownerId?: string): Promise<Dashboard[]> {
  const data = await getData();
  let list = data.dashboards || [];
  if (companyId) list = list.filter((d) => d.companyId === companyId);
  if (ownerId) list = list.filter((d) => d.ownerId === ownerId || (d.sharedWith || []).includes(ownerId));
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Bosses (admin+) see all company dashboards; viewers only assigned / owned / public */
export async function listDashboardsVisibleTo(user: {
  id: string;
  companyId: string;
  role: string;
  isSuperAdmin?: boolean;
}): Promise<Dashboard[]> {
  const data = await getData();
  let list = data.dashboards || [];
  const isBoss =
    user.isSuperAdmin ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'editor';
  if (user.isSuperAdmin || user.role === 'super_admin') {
    // all
  } else {
    list = list.filter((d) => d.companyId === user.companyId);
  }
  if (!isBoss) {
    list = list.filter(
      (d) =>
        d.isPublic ||
        d.ownerId === user.id ||
        (d.sharedWith || []).includes(user.id)
    );
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function userCanViewDashboard(
  user: { id: string; companyId: string; role: string; isSuperAdmin?: boolean },
  d: Dashboard
): boolean {
  if (user.isSuperAdmin || user.role === 'super_admin') return true;
  if (d.companyId !== user.companyId) return false;
  if (user.role === 'admin' || user.role === 'editor') return true;
  return d.isPublic || d.ownerId === user.id || (d.sharedWith || []).includes(user.id);
}

export async function getDashboard(id: string): Promise<Dashboard | undefined> {
  const data = await getData();
  return data.dashboards.find((d) => d.id === id);
}

export async function upsertDashboard(dash: Dashboard): Promise<void> {
  const data = await getData();
  const idx = data.dashboards.findIndex((d) => d.id === dash.id);
  if (idx >= 0) data.dashboards[idx] = dash;
  else data.dashboards.push(dash);
  writeDb(data);
}

export async function deleteDashboard(id: string): Promise<void> {
  const data = await getData();
  data.dashboards = data.dashboards.filter((d) => d.id !== id);
  writeDb(data);
}

export async function getSettings() {
  const data = await getData();
  const s = data.settings || defaultData().settings;
  // Prefer stored JSON (UI Settings) over process.env so Save is not overwritten
  // by stale .env.local / startup env. Env is only the bootstrap fallback.
  return {
    ...s,
    gatewayUrl: (s.gatewayUrl && String(s.gatewayUrl).trim()) || process.env.GATEWAY_URL || 'http://localhost:4000',
    jwtSecret: process.env.JWT_SECRET || s.jwtSecret,
    gatewayAdminSecret:
      (s.gatewayAdminSecret && String(s.gatewayAdminSecret).trim()) ||
      process.env.GATEWAY_ADMIN_SECRET ||
      process.env.ADMIN_SYNC_SECRET ||
      '',
  };
}

export async function updateSettings(patch: Partial<DbSchema['settings']>) {
  const data = await getData();
  data.settings = { ...data.settings, ...patch };
  writeDb(data);
}

export async function listSupportTickets(opts?: {
  companyId?: string;
  userId?: string;
  status?: string;
}): Promise<SupportTicket[]> {
  const data = await getData();
  let list = data.supportTickets || [];
  if (opts?.companyId) list = list.filter((t) => t.companyId === opts.companyId);
  if (opts?.userId) list = list.filter((t) => t.userId === opts.userId);
  if (opts?.status) list = list.filter((t) => t.status === opts.status);
  return list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function getSupportTicket(id: string): Promise<SupportTicket | undefined> {
  const data = await getData();
  return (data.supportTickets || []).find((t) => t.id === id);
}

export async function upsertSupportTicket(ticket: SupportTicket): Promise<void> {
  const data = await getData();
  if (!data.supportTickets) data.supportTickets = [];
  const idx = data.supportTickets.findIndex((t) => t.id === ticket.id);
  if (idx >= 0) data.supportTickets[idx] = ticket;
  else data.supportTickets.push(ticket);
  writeDb(data);
}

export async function deleteSupportTicket(id: string): Promise<SupportTicket | null> {
  const data = await getData();
  if (!data.supportTickets) return null;
  const idx = data.supportTickets.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const [removed] = data.supportTickets.splice(idx, 1);
  writeDb(data);
  return removed;
}

export async function appendSupportMessage(
  ticketId: string,
  message: SupportMessage,
  side: 'user' | 'admin'
): Promise<SupportTicket | null> {
  const data = await getData();
  if (!data.supportTickets) data.supportTickets = [];
  const idx = data.supportTickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  const t = data.supportTickets[idx];
  t.messages.push(message);
  t.lastMessageAt = message.createdAt;
  t.updatedAt = message.createdAt;
  if (side === 'user') {
    t.unreadForAdmin = (t.unreadForAdmin || 0) + 1;
    if (t.status === 'resolved' || t.status === 'closed') t.status = 'open';
  } else {
    t.unreadForUser = (t.unreadForUser || 0) + 1;
    if (t.status === 'open') t.status = 'in_progress';
  }
  data.supportTickets[idx] = t;
  writeDb(data);
  return t;
}

export async function markSupportRead(ticketId: string, side: 'user' | 'admin'): Promise<void> {
  const data = await getData();
  const idx = (data.supportTickets || []).findIndex((t) => t.id === ticketId);
  if (idx < 0) return;
  if (side === 'user') data.supportTickets[idx].unreadForUser = 0;
  else data.supportTickets[idx].unreadForAdmin = 0;
  writeDb(data);
}

export async function countUnreadSupport(opts: {
  isAdmin: boolean;
  userId?: string;
  companyId?: string;
  isSuperAdmin?: boolean;
}): Promise<number> {
  const data = await getData();
  let list = data.supportTickets || [];
  if (opts.isAdmin) {
    if (!opts.isSuperAdmin && opts.companyId) {
      list = list.filter((t) => t.companyId === opts.companyId);
    }
    return list.reduce((s, t) => s + (t.unreadForAdmin || 0), 0);
  }
  list = list.filter((t) => t.userId === opts.userId);
  return list.reduce((s, t) => s + (t.unreadForUser || 0), 0);
}


// ── Password reset tokens ────────────────────────────────────

export async function createPasswordResetToken(input: {
  token: string;
  username: string;
  staffId: string;
  email: string;
  expiresAt: string;
}): Promise<void> {
  const data = await getData();
  if (!data.passwordResetTokens) data.passwordResetTokens = [];
  // Invalidate previous unused tokens for same user
  data.passwordResetTokens = data.passwordResetTokens.filter(
    (t) => t.username.toLowerCase() !== input.username.toLowerCase() || t.usedAt
  );
  data.passwordResetTokens.push({
    ...input,
    createdAt: new Date().toISOString(),
  });
  // prune expired
  const now = Date.now();
  data.passwordResetTokens = data.passwordResetTokens.filter(
    (t) => t.usedAt || Date.parse(t.expiresAt) > now - 86400000
  );
  writeDb(data);
}

export async function getPasswordResetToken(token: string) {
  const data = await getData();
  return (data.passwordResetTokens || []).find((t) => t.token === token);
}

export async function markPasswordResetUsed(token: string): Promise<void> {
  const data = await getData();
  if (!data.passwordResetTokens) return;
  const idx = data.passwordResetTokens.findIndex((t) => t.token === token);
  if (idx < 0) return;
  data.passwordResetTokens[idx].usedAt = new Date().toISOString();
  writeDb(data);
}

export async function getStaffByEmail(email: string) {
  const data = await getData();
  const e = email.toLowerCase().trim();
  return data.staff.find((s) => (s.email || '').toLowerCase() === e && s.active);
}
