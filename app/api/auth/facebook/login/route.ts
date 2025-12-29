import { NextRequest, NextResponse } from 'next/server';
import { getMetaLoginUrl } from '@/lib/services/connector/metaAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Get the user's email from the URL query params
  // Example: /api/auth/facebook/login?email=ayand.slg@gmail.com
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');

  // 2. Safety Check: If we don't know who is logging in, stop.
  if (!email) {
    return NextResponse.json({ error: 'User email is required to link accounts.' }, { status: 400 });
  }

  // 3. Generate the Facebook URL with the email embedded in the 'state'
  const url = getMetaLoginUrl(email);
  
  // 4. Send the user to Facebook
  return NextResponse.redirect(url);
}