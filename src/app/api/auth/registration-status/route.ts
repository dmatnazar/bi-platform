import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationStatus } from '@/lib/gateway';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const res = await getRegistrationStatus(id);
  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'not found' }, { status: res.status || 404 });
  }
  return NextResponse.json(res.data);
}
