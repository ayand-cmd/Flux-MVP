import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    // Check if user exists and has Facebook token
    const result = await query(
      'SELECT id, email, fb_exchange_token FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = result.rows[0];
    const hasFacebookToken = !!user.fb_exchange_token;

    return NextResponse.json({
      authenticated: true,
      hasFacebookToken,
      userId: user.id,
      email: user.email
    });

  } catch (error: any) {
    console.error('Error checking auth:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

