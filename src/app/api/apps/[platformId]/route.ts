import { NextRequest, NextResponse } from 'next/server';
import { getPlatform } from '@/lib/apps-store';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ platformId: string }> }
) {
  const { platformId } = await ctx.params;
  const p = getPlatform(platformId);
  if (!p) return NextResponse.json({ error: 'Tapylmady' }, { status: 404 });
  return NextResponse.json({
    platform: {
      id: p.id,
      name: p.name,
      status: p.status,
      docs: (p.docs || []).slice().sort((a, b) => a.order - b.order),
      hasDownload: Boolean(p.feedUrl || p.downloadUrl),
    },
  });
}
