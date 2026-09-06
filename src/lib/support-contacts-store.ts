/**
 * Technical support contacts shown on login modal.
 * Stored in data/support-contacts.json
 */
import fs from 'node:fs';
import path from 'node:path';

export type SupportContact = {
  id: string;
  fullName: string;
  role?: string;
  phone?: string;
  telegram?: string;
  whatsapp?: string;
  imo?: string;
  gmail?: string;
  note?: string;
  order: number;
  active: boolean;
};

export type SupportContactsFile = {
  contacts: SupportContact[];
  updatedAt: string;
  intro?: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'support-contacts.json');

function uid() {
  return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultFile(): SupportContactsFile {
  return {
    intro: 'Tehniki meseleler boýunça biziň bilen habarlaşyň.',
    contacts: [],
    updatedAt: new Date().toISOString(),
  };
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaultFile(), null, 2), 'utf8');
  }
}

export function readSupportContacts(): SupportContactsFile {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as SupportContactsFile;
    if (!Array.isArray(raw.contacts)) raw.contacts = [];
    return raw;
  } catch {
    const d = defaultFile();
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2), 'utf8');
    return d;
  }
}

export function writeSupportContacts(data: SupportContactsFile): SupportContactsFile {
  ensure();
  const next: SupportContactsFile = {
    intro: String(data.intro || '').trim() || defaultFile().intro,
    contacts: (data.contacts || []).map((c, i) => ({
      id: String(c.id || uid()),
      fullName: String(c.fullName || '').trim(),
      role: c.role ? String(c.role).trim() : '',
      phone: c.phone ? String(c.phone).trim() : '',
      telegram: c.telegram ? String(c.telegram).trim().replace(/^@/, '') : '',
      whatsapp: c.whatsapp ? String(c.whatsapp).trim() : '',
      imo: c.imo ? String(c.imo).trim() : '',
      gmail: c.gmail ? String(c.gmail).trim() : '',
      note: c.note ? String(c.note).trim() : '',
      order: typeof c.order === 'number' ? c.order : i,
      active: c.active !== false,
    })),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function publicSupportContacts(): SupportContactsFile {
  const all = readSupportContacts();
  return {
    intro: all.intro,
    updatedAt: all.updatedAt,
    contacts: all.contacts
      .filter((c) => c.active && c.fullName)
      .sort((a, b) => a.order - b.order),
  };
}
