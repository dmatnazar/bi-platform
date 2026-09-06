/**
 * Platform news / announcements for viewers & staff.
 * data/news.json + data/news-reads.json
 */
import fs from 'node:fs';
import path from 'node:path';

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  /** Cover / inline image paths or absolute URLs */
  images: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  published: boolean;
  pinned?: boolean;
};

type NewsFile = { items: NewsItem[]; updatedAt: string };
type ReadsFile = { reads: Record<string, string[]> };

const DATA = path.join(process.cwd(), 'data');
const NEWS_FILE = path.join(DATA, 'news.json');
const READS_FILE = path.join(DATA, 'news-reads.json');
const MEDIA_DIR = path.join(DATA, 'news-media');

function uid() {
  return `news-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensure() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify({ items: [], updatedAt: new Date().toISOString() }, null, 2));
  }
  if (!fs.existsSync(READS_FILE)) {
    fs.writeFileSync(READS_FILE, JSON.stringify({ reads: {} }, null, 2));
  }
}

function readNews(): NewsFile {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')) as NewsFile;
    if (!Array.isArray(raw.items)) raw.items = [];
    return raw;
  } catch {
    return { items: [], updatedAt: new Date().toISOString() };
  }
}

function writeNews(f: NewsFile) {
  ensure();
  f.updatedAt = new Date().toISOString();
  fs.writeFileSync(NEWS_FILE, JSON.stringify(f, null, 2), 'utf8');
}

function readReads(): ReadsFile {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(READS_FILE, 'utf8')) as ReadsFile;
    if (!raw.reads || typeof raw.reads !== 'object') raw.reads = {};
    return raw;
  } catch {
    return { reads: {} };
  }
}

function writeReads(f: ReadsFile) {
  ensure();
  fs.writeFileSync(READS_FILE, JSON.stringify(f, null, 2), 'utf8');
}

export function listNews(opts?: { includeDrafts?: boolean }): NewsItem[] {
  const items = readNews().items;
  const filtered = opts?.includeDrafts ? items : items.filter((n) => n.published);
  return filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function getNews(id: string): NewsItem | undefined {
  return readNews().items.find((n) => n.id === id);
}

export function createNews(input: {
  title: string;
  body: string;
  images?: string[];
  published?: boolean;
  pinned?: boolean;
  createdBy: string;
}): NewsItem {
  const f = readNews();
  const now = new Date().toISOString();
  const item: NewsItem = {
    id: uid(),
    title: String(input.title || '').trim(),
    body: String(input.body || ''),
    images: Array.isArray(input.images) ? input.images.filter(Boolean) : [],
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    published: input.published !== false,
    pinned: !!input.pinned,
  };
  f.items.unshift(item);
  writeNews(f);
  return item;
}

export function updateNews(
  id: string,
  patch: Partial<Pick<NewsItem, 'title' | 'body' | 'images' | 'published' | 'pinned'>>
): NewsItem | null {
  const f = readNews();
  const i = f.items.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const cur = f.items[i];
  f.items[i] = {
    ...cur,
    title: patch.title !== undefined ? String(patch.title).trim() : cur.title,
    body: patch.body !== undefined ? String(patch.body) : cur.body,
    images: patch.images !== undefined ? patch.images.filter(Boolean) : cur.images,
    published: patch.published !== undefined ? !!patch.published : cur.published,
    pinned: patch.pinned !== undefined ? !!patch.pinned : cur.pinned,
    updatedAt: new Date().toISOString(),
  };
  writeNews(f);
  return f.items[i];
}

export function deleteNews(id: string): boolean {
  const f = readNews();
  const next = f.items.filter((n) => n.id !== id);
  if (next.length === f.items.length) return false;
  f.items = next;
  writeNews(f);
  return true;
}

export function getReadIds(username: string): string[] {
  const key = username.toLowerCase();
  return readReads().reads[key] || [];
}

export function markRead(username: string, newsId: string): void {
  const f = readReads();
  const key = username.toLowerCase();
  const set = new Set(f.reads[key] || []);
  set.add(newsId);
  f.reads[key] = [...set];
  writeReads(f);
}

export function markAllRead(username: string, ids: string[]): void {
  const f = readReads();
  const key = username.toLowerCase();
  const set = new Set(f.reads[key] || []);
  for (const id of ids) set.add(id);
  f.reads[key] = [...set];
  writeReads(f);
}

export function unreadCount(username: string): number {
  const published = listNews({ includeDrafts: false });
  const read = new Set(getReadIds(username));
  return published.filter((n) => !read.has(n.id)).length;
}

export function saveNewsMedia(filename: string, buffer: Buffer): string {
  ensure();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const name = `${Date.now().toString(36)}-${safe}`;
  fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  return `/api/news/media/${encodeURIComponent(name)}`;
}

export function resolveMediaPath(name: string): string | null {
  ensure();
  const safe = path.basename(name);
  const full = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return full;
}
