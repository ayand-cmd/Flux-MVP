import { NextRequest, NextResponse } from 'next/server';
import { getMetaLoginUrl } from '@/lib/services/connector/metaAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  try {
    const loginUrl = getMetaLoginUrl(email);
    return NextResponse.redirect(loginUrl);
  } catch (error: any) {
    console.error('❌ Facebook login URL generation error:', error);
    return NextResponse.json({ error: 'Failed to generate Facebook login URL' }, { status: 500 });
  }
}

