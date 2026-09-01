import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getPlatform, resolveDownloadFromFeed } from '@/lib/apps-store';

/**
 * Public: latest Electron client release metadata.
 * Source of truth: Admin → Programmalar → Windows (apps.json feedUrl / downloadUrl).
 * Env / disk are fallback only.
 */
function updatesBaseFromApps(): { feedUrl?: string; downloadUrl?: string } {
  try {
    const p = getPlatform('windows');
    if (!p) return {};
    return { feedUrl: p.feedUrl || undefined, downloadUrl: p.downloadUrl || undefined };
  } catch {
    return {};
  }
}

function updatesBase(): string {
  const fromApps = updatesBaseFromApps().feedUrl;
  if (fromApps) {
    // feedUrl is full latest.yml URL → base is parent path
    try {
      const u = new URL(fromApps);
      const pathname = u.pathname.replace(/\/[^/]*$/, '') || '';
      return `${u.origin}${pathname}`.replace(/\/$/, '');
    } catch {
      return fromApps.replace(/\/latest\.yml$/i, '').replace(/\/$/, '');
    }
  }
  const env =
    process.env.NEXT_PUBLIC_UPDATES_URL ||
    process.env.UPDATES_URL ||
    process.env.CLIENT_UPDATES_URL ||
    '';
  if (env) return env.replace(/\/$/, '');
  return '';
}

function parseLatestYml(yml: string): {
  version?: string;
  path?: string;
  releaseDate?: string;
  releaseNotes?: string;
  size?: number;
} {
  const version = yml.match(/^version:\s*['"]?([^\s'"]+)/m)?.[1];
  const filePath =
    yml.match(/^path:\s*['"]?([^\s'"]+)/m)?.[1] ||
    yml.match(/^\s+-\s+url:\s*['"]?([^\s'"]+)/m)?.[1];
  const releaseDate = yml.match(/^releaseDate:\s*['"]?([^\s'"]+)/m)?.[1];
  const sizeRaw = yml.match(/^\s+size:\s*(\d+)/m)?.[1];
  let releaseNotes = '';
  const notesMatch = yml.match(/^releaseNotes:\s*\|\s*\n([\s\S]*?)(?=\n\S|\n*$)/m);
  if (notesMatch) {
    releaseNotes = notesMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s{2}/, ''))
      .join('\n')
      .trim();
  }
  return {
    version,
    path: filePath,
    releaseDate,
    releaseNotes,
    size: sizeRaw ? Number(sizeRaw) : undefined,
  };
}

export async function GET() {
  try {
    const apps = updatesBaseFromApps();

    // 1) Prefer Programmalar → Windows feedUrl
    if (apps.feedUrl) {
      try {
        const res = await fetch(apps.feedUrl, {
          cache: 'no-store',
          headers: { Accept: 'text/yaml, text/plain, */*' },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const yml = await res.text();
          const resolved = resolveDownloadFromFeed(apps.feedUrl, yml);
          const meta = parseLatestYml(yml);
          if (resolved?.downloadUrl) {
            return NextResponse.json({
              ok: true,
              version: resolved.version || meta.version || '—',
              fileName: resolved.fileName || meta.path || 'BI-Platform-Client-Setup.exe',
              downloadUrl: resolved.downloadUrl,
              releaseDate: meta.releaseDate,
              releaseNotes: meta.releaseNotes,
              size: meta.size,
              platform: 'windows',
              source: 'apps.json',
            });
          }
        }
      } catch {
        /* fall through */
      }
    }

    // 2) Static downloadUrl from Programmalar
    if (apps.downloadUrl) {
      const fileName = apps.downloadUrl.split('/').pop() || 'BI-Platform-Client-Setup.exe';
      return NextResponse.json({
        ok: true,
        version: '—',
        fileName,
        downloadUrl: apps.downloadUrl,
        platform: 'windows',
        source: 'apps.json',
      });
    }

    // 3) Env / disk fallbacks
    const base = updatesBase();
    let yml = '';
    let baseUrl = base;

    if (base) {
      const url = base.includes('latest.yml') ? base : `${base}/latest.yml`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (res.ok) yml = await res.text();
    }

    if (!yml) {
      const candidates = [
        '/var/www/updates/latest.yml',
        path.join(process.cwd(), 'public', 'updates', 'latest.yml'),
        path.join(process.cwd(), 'updates', 'latest.yml'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          yml = fs.readFileSync(p, 'utf8');
          baseUrl = baseUrl || '/updates';
          break;
        }
      }
    }

    if (!yml && !base) {
      try {
        const res = await fetch(
          `${process.env.NEXTAUTH_URL || process.env.BI_PUBLIC_URL || 'http://127.0.0.1:3000'}/updates/latest.yml`,
          { cache: 'no-store', signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          yml = await res.text();
          baseUrl = '/updates';
        }
      } catch {
        /* */
      }
    }

    if (!yml) {
      return NextResponse.json(
        {
          error: 'latest.yml tapylmady',
          hint: 'Admin → Programmalar → Windows → Feed URL (latest.yml) goýuň',
        },
        { status: 404 }
      );
    }

    const meta = parseLatestYml(yml);
    const fileName = meta.path || 'BI-Platform-Client-Setup.exe';
    const downloadUrl = `${(baseUrl || '/updates').replace(/\/$/, '')}/${fileName}`;

    return NextResponse.json({
      ok: true,
      version: meta.version || '—',
      fileName,
      downloadUrl,
      releaseDate: meta.releaseDate,
      releaseNotes: meta.releaseNotes,
      size: meta.size,
      platform: 'windows',
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
