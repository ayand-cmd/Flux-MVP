import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // 🔍 DEBUGGING BLOCK (Remove after fixing)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("--- DEBUG ENVIRONMENT ---");
  console.log("URL Exists:", !!supabaseUrl);
  console.log("Key Exists:", !!supabaseKey);
  console.log("Key Length:", supabaseKey?.length);
  console.log("Key Starts With:", supabaseKey?.substring(0, 5));
  console.log("-------------------------");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    return NextResponse.redirect(`${origin}${next}`);
  } else {
    console.error('❌ Supabase Auth Error:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}