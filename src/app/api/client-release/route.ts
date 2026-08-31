import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Public: latest Electron client release metadata for login download UI.
 * Prefer live HTTP feed; fall back to reading latest.yml if mounted on disk.
 */
function updatesBase(): string {
  const env =
    process.env.NEXT_PUBLIC_UPDATES_URL ||
    process.env.UPDATES_URL ||
    process.env.CLIENT_UPDATES_URL ||
    '';
  if (env) return env.replace(/\/$/, '');
  // Same-origin nginx: /updates
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
    const base = updatesBase();
    let yml = '';
    let baseUrl = base;

    if (base) {
      const url = `${base}/latest.yml`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (res.ok) yml = await res.text();
    }

    // Disk fallback (nginx root or local public)
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
      // Relative same-origin
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
          hint: 'NEXT_PUBLIC_UPDATES_URL=https://your-host/updates ýa-da /var/www/updates',
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
