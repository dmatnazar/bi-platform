import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

/** Public (no auth) — login/register need animation flags */
export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    gatewayUrl: s.gatewayUrl,
    authAnimations: s.authAnimations !== false,
    appAnimations: s.appAnimations !== false,
    modalAnimations: s.modalAnimations !== false,
    /** Login «Hasaba al» link — default on */
    registrationEnabled: s.registrationEnabled !== false,
    catalogSyncIntervalSec: Math.max(0, Number(s.catalogSyncIntervalSec) || 0),
  });
}
