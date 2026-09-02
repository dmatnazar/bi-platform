import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

/** Public (no auth) — login/register need animation flags */
export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    gatewayUrl: s.gatewayUrl,
    authAnimations: s.authAnimations !== false,
    appAnimations: s.appAnimations !== false,
  });
}
