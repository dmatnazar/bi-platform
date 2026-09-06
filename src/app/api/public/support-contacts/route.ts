import { NextResponse } from 'next/server';
import { publicSupportContacts } from '@/lib/support-contacts-store';

/** Public — login page tech support modal */
export async function GET() {
  return NextResponse.json(publicSupportContacts());
}
