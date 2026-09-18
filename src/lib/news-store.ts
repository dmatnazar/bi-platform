/**
 * Platform news / announcements for viewers & staff.
 * data/news.json + data/news-reads.json
 */
import fs from 'node:fs';
import path from 'node:path';

export type NewsMedia = {
  url: string;
  type: 'image' | 'video';
  /** Caption under media */
  caption?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  /** Cover / inline image paths or absolute URLs (legacy) */
  images: string[];
  /** Images + videos with optional captions */
  media?: NewsMedia[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  published: boolean;
  pinned?: boolean;
  /** Target firm slugs. Empty / missing = all firms (platform-wide, super only). */
  tenantSlugs?: string[];
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

export function listNews(opts?: {
  includeDrafts?: boolean;
  /** If set, only news targeting these slugs (or global with empty tenantSlugs for super). */
  tenantSlugs?: string[];
  /** Super admin sees everything including global. */
  isSuper?: boolean;
}): NewsItem[] {
  const items = readNews().items;
  let filtered = opts?.includeDrafts ? items : items.filter((n) => n.published);
  if (!opts?.isSuper && opts?.tenantSlugs) {
    const allowed = new Set(opts.tenantSlugs.map(String));
    filtered = filtered.filter((n) => {
      const targets = Array.isArray(n.tenantSlugs) ? n.tenantSlugs.map(String) : [];
      // Global news (no targets): only super sees; non-super skip
      if (!targets.length) return false;
      return targets.some((t) => allowed.has(t));
    });
  }
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
  media?: NewsMedia[];
  published?: boolean;
  pinned?: boolean;
  createdBy: string;
  tenantSlugs?: string[];
}): NewsItem {
  const f = readNews();
  const now = new Date().toISOString();
  const item: NewsItem = {
    id: uid(),
    title: String(input.title || '').trim(),
    body: String(input.body || ''),
    images: Array.isArray(input.images) ? input.images.filter(Boolean) : [],
    media: Array.isArray(input.media) ? input.media : [],
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    published: input.published !== false,
    pinned: !!input.pinned,
    tenantSlugs: Array.isArray(input.tenantSlugs)
      ? input.tenantSlugs.map(String).filter(Boolean)
      : [],
  };
  f.items.unshift(item);
  writeNews(f);
  return item;
}

/** Extract filename from /api/news/media/NAME */
export function mediaUrlToFilename(url: string): string | null {
  const m = String(url || '').match(/\/api\/news\/media\/([^/?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export function deleteNewsMediaFile(urlOrName: string): boolean {
  ensure();
  const name = mediaUrlToFilename(urlOrName) || path.basename(urlOrName);
  if (!name || name === '.' || name === '..') return false;
  const full = path.join(MEDIA_DIR, name);
  try {
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      return true;
    }
  } catch {
    /* */
  }
  return false;
}

function collectMediaUrls(item: NewsItem): string[] {
  const urls: string[] = [];
  if (Array.isArray(item.images)) urls.push(...item.images.filter(Boolean));
  if (Array.isArray(item.media)) {
    for (const m of item.media) if (m?.url) urls.push(m.url);
  }
  return [...new Set(urls)];
}


export function updateNews(
  id: string,
  patch: Partial<Pick<NewsItem, 'title' | 'body' | 'images' | 'media' | 'published' | 'pinned'>>
): NewsItem | null {
  const f = readNews();
  const i = f.items.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const cur = f.items[i];
  const next: NewsItem = {
    ...cur,
    title: patch.title !== undefined ? String(patch.title).trim() : cur.title,
    body: patch.body !== undefined ? String(patch.body) : cur.body,
    images: patch.images !== undefined ? patch.images.filter(Boolean) : cur.images,
    media: patch.media !== undefined ? patch.media : cur.media,
    published: patch.published !== undefined ? !!patch.published : cur.published,
    pinned: patch.pinned !== undefined ? !!patch.pinned : cur.pinned,
    updatedAt: new Date().toISOString(),
  };
  try {
    const before = new Set(collectMediaUrls(cur));
    const after = new Set(collectMediaUrls(next));
    for (const u of before) {
      if (!after.has(u)) deleteNewsMediaFile(u);
    }
  } catch {
    /* */
  }
  f.items[i] = next;
  writeNews(f);
  return f.items[i];
}

export function deleteNews(id: string): boolean {
  const f = readNews();
  const cur = f.items.find((n) => n.id === id);
  if (!cur) return false;
  // Pozulýan habaryň ähli media faýllaryny diskden öçür
  for (const u of collectMediaUrls(cur)) {
    deleteNewsMediaFile(u);
  }
  f.items = f.items.filter((n) => n.id !== id);
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

export type NewsMediaFileInfo = {
  name: string;
  url: string;
  size: number;
  mtime: string;
  type: 'image' | 'video' | 'other';
};

export function listNewsMediaFiles(): NewsMediaFileInfo[] {
  ensure();
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const out: NewsMediaFileInfo[] = [];
  for (const name of fs.readdirSync(MEDIA_DIR)) {
    if (name.startsWith('.')) continue;
    const full = path.join(MEDIA_DIR, name);
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      let type: 'image' | 'video' | 'other' = 'other';
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) type = 'image';
      else if (['.mp4', '.webm', '.ogg', '.mov', '.m4v'].includes(ext)) type = 'video';
      out.push({
        name,
        url: `/api/news/media/${encodeURIComponent(name)}`,
        size: st.size,
        mtime: st.mtime.toISOString(),
        type,
      });
    } catch {
      /* */
    }
  }
  out.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return out;
}

export function resolveMediaPath(name: string): string | null {
  ensure();
  const safe = path.basename(name);
  const full = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return full;
}
