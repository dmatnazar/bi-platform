/**
 * Client applications catalog (Windows / iOS / Android / Linux)
 * + install documentation editable from admin "Programmalar".
 */
import fs from 'node:fs';
import path from 'node:path';

export type AppDoc = {
  id: string;
  title: string;
  body: string;
  order: number;
  updatedAt: string;
};

export type AppPlatform = {
  id: string;
  name: string;
  status: 'available' | 'coming_soon';
  /** electron-builder latest.yml absolute URL, e.g. http://vps/updates/latest.yml */
  feedUrl?: string;
  /** Optional hard-coded .exe URL (if feed fails) */
  downloadUrl?: string;
  order: number;
  docs: AppDoc[];
};

export type AppsCatalog = {
  platforms: AppPlatform[];
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultCatalog(): AppsCatalog {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    platforms: [
      {
        id: 'windows',
        name: 'Windows',
        status: 'available',
        feedUrl: '',
        downloadUrl: '',
        order: 0,
        docs: [
          {
            id: uid('doc'),
            title: 'Gurnama (gysga)',
            order: 0,
            updatedAt: now,
            body: [
              '1. «Ýükle» düwmesine basyň — soňky wersiýa awtomatiki saýlanýar.',
              '2. Ýüklenen .exe faýly açyň (Setup).',
              '3. Gurşaw soraglarynda «Next / Install» basyň.',
              '4. Gurnama gutarandan soň programma tray-da (ekranyň aşagynda) görünýär.',
              '5. BI Platform login bilen birmeňzeş ulanyjy ady / parol bilen giriň.',
              '',
              'Bellik: diňe Windows 10/11 (64-bit) goldanylýar. Antivirus sorasa «Allow» ediň.',
            ].join('\n'),
          },
          {
            id: uid('doc'),
            title: 'Näme üçin gerek?',
            order: 1,
            updatedAt: now,
            body: [
              '• Işgärleri we enjamlary offline synk etmek',
              '• Tray bildirişleri we awto-täzelenme',
              '• Internet ýok wagty-da işläp, soň VPS bilen deňleşdirmek',
            ].join('\n'),
          },
        ],
      },
      {
        id: 'ios',
        name: 'iOS',
        status: 'coming_soon',
        order: 1,
        docs: [],
      },
      {
        id: 'android',
        name: 'Android',
        status: 'coming_soon',
        order: 2,
        docs: [],
      },
      {
        id: 'linux',
        name: 'Linux',
        status: 'coming_soon',
        order: 3,
        docs: [],
      },
    ],
  };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readAppsCatalog(): AppsCatalog {
  ensureDir();
  if (!fs.existsSync(APPS_FILE)) {
    const d = defaultCatalog();
    fs.writeFileSync(APPS_FILE, JSON.stringify(d, null, 2), 'utf8');
    return d;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8')) as AppsCatalog;
    if (!Array.isArray(parsed.platforms)) return defaultCatalog();
    return parsed;
  } catch {
    return defaultCatalog();
  }
}

export function writeAppsCatalog(data: AppsCatalog) {
  ensureDir();
  data.updatedAt = new Date().toISOString();
  const tmp = APPS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, APPS_FILE);
}

export function getPlatform(id: string): AppPlatform | undefined {
  return readAppsCatalog().platforms.find((p) => p.id === id);
}

export function upsertPlatform(platform: AppPlatform) {
  const cat = readAppsCatalog();
  const i = cat.platforms.findIndex((p) => p.id === platform.id);
  if (i >= 0) cat.platforms[i] = platform;
  else cat.platforms.push(platform);
  writeAppsCatalog(cat);
  return platform;
}

export function saveDoc(platformId: string, doc: Partial<AppDoc> & { title: string; body: string }) {
  const cat = readAppsCatalog();
  const p = cat.platforms.find((x) => x.id === platformId);
  if (!p) throw new Error('Platform tapylmady');
  const now = new Date().toISOString();
  if (doc.id) {
    const di = p.docs.findIndex((d) => d.id === doc.id);
    if (di < 0) throw new Error('Dokument tapylmady');
    p.docs[di] = {
      ...p.docs[di],
      title: doc.title,
      body: doc.body,
      order: doc.order ?? p.docs[di].order,
      updatedAt: now,
    };
  } else {
    p.docs.push({
      id: uid('doc'),
      title: doc.title,
      body: doc.body,
      order: doc.order ?? p.docs.length,
      updatedAt: now,
    });
  }
  p.docs.sort((a, b) => a.order - b.order);
  writeAppsCatalog(cat);
  return p;
}

export function deleteDoc(platformId: string, docId: string) {
  const cat = readAppsCatalog();
  const p = cat.platforms.find((x) => x.id === platformId);
  if (!p) throw new Error('Platform tapylmady');
  p.docs = p.docs.filter((d) => d.id !== docId);
  writeAppsCatalog(cat);
  return p;
}

/** Parse electron-builder latest.yml minimally */
export function parseLatestYml(text: string): { version?: string; path?: string; fileUrl?: string } {
  const version = text.match(/^\s*version:\s*['"]?([^\s'"]+)/m)?.[1];
  const pathMatch = text.match(/^\s*path:\s*['"]?([^\s'"]+)/m)?.[1];
  const urlMatch = text.match(/^\s*-\s*url:\s*['"]?([^\s'"]+)/m)?.[1];
  return { version, path: pathMatch, fileUrl: urlMatch || pathMatch };
}

export function resolveDownloadFromFeed(
  feedUrl: string,
  ymlText: string
): { version?: string; downloadUrl: string } | null {
  const parsed = parseLatestYml(ymlText);
  const fileName = parsed.fileUrl || parsed.path;
  if (!fileName) return null;
  if (/^https?:\/\//i.test(fileName)) {
    return { version: parsed.version, downloadUrl: fileName };
  }
  const base = feedUrl.replace(/\/?latest\.yml$/i, '').replace(/\/$/, '');
  return { version: parsed.version, downloadUrl: `${base}/${fileName.replace(/^\//, '')}` };
}
