import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ gatewayUrl: s.gatewayUrl });
}
