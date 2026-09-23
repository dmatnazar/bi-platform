import { NextResponse } from 'next/server';
import { readDemoPageContent } from '@/lib/demo-page-store';

/** Public read — demo / info page content */
export async function GET() {
  try {
    const content = readDemoPageContent();
    // Only active partners / banners / capabilities for public
    return NextResponse.json({
      ...content,
      partners: (content.partners || []).filter((p) => p.active).sort((a, b) => a.order - b.order),
      banners: (content.banners || []).filter((b) => b.active).sort((a, b) => a.order - b.order),
      capabilities: (content.capabilities || [])
        .filter((c) => c.active)
        .sort((a, b) => a.order - b.order),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load demo content' }, { status: 500 });
  }
}
