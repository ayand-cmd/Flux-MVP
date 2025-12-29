import { NextResponse } from 'next/server';
import { getGoogleLoginUrl } from '@/lib/services/connector/googleAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = getGoogleLoginUrl();
  return NextResponse.redirect(url);
}