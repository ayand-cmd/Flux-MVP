import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // Use request URL origin (works in both dev and production)
  // This ensures we redirect to the same domain that made the request
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    // Redirect to dashboard using the request origin (not hardcoded localhost)
    return NextResponse.redirect(`${origin}${next}`);
  } else {
    console.error('❌ Supabase Auth Error:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}