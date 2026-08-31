import { NextRequest, NextResponse } from 'next/server';
import { getPlatform, resolveDownloadFromFeed } from '@/lib/apps-store';

/**
 * Resolves latest installer from platform.feedUrl (latest.yml)
 * and redirects the browser to the .exe / package.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ platformId: string }> }
) {
  const { platformId } = await ctx.params;
  const p = getPlatform(platformId);
  if (!p) return NextResponse.json({ error: 'Platform tapylmady' }, { status: 404 });
  if (p.status !== 'available') {
    return NextResponse.json({ error: 'Bu platforma heniz elýeterli däl' }, { status: 404 });
  }

  if (p.feedUrl) {
    try {
      const res = await fetch(p.feedUrl, {
        cache: 'no-store',
        headers: { Accept: 'text/yaml, text/plain, */*' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const text = await res.text();
        const resolved = resolveDownloadFromFeed(p.feedUrl, text);
        if (resolved?.downloadUrl) {
          return NextResponse.redirect(resolved.downloadUrl, 302);
        }
      }
    } catch {
      /* fall through to static downloadUrl */
    }
  }

  if (p.downloadUrl) {
    return NextResponse.redirect(p.downloadUrl, 302);
  }

  return NextResponse.json(
    {
      error:
        'Ýükleme baglanyşygy sazlanmady. Admin → Programmalar → Windows → feed URL (latest.yml) goýuň.',
    },
    { status: 503 }
  );
}
