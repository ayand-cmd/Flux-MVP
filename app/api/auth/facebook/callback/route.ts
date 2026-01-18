import { NextRequest, NextResponse } from 'next/server';
import { exchangeMetaCodeForToken, getMetaUserDetails } from '@/lib/services/connector/metaAuth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('❌ Facebook OAuth error:', error);
    return NextResponse.redirect(new URL('/flux/new?error=oauth_denied', request.url));
  }

  if (!code || !state) {
    console.error('❌ Missing code or state parameter');
    return NextResponse.redirect(new URL('/flux/new?error=missing_params', request.url));
  }

  try {
    // Decode the email from the state parameter
    const email = Buffer.from(state, 'base64').toString('utf-8');

    if (!email) {
      console.error('❌ Failed to decode email from state');
      return NextResponse.redirect(new URL('/flux/new?error=invalid_state', request.url));
    }

    // Exchange the code for a long-lived token
    const longLivedToken = await exchangeMetaCodeForToken(code);

    // Get Facebook user details (including email) to store
    const fbUserDetails = await getMetaUserDetails(longLivedToken);
    const facebookEmail = fbUserDetails.email || null;

    // Upsert the token into the database
    // This ensures the row exists even if it was missing, and updates if it does exist
    await query(
      `INSERT INTO users (email, fb_exchange_token, facebook_email)
       VALUES ($3, $1, $2)
       ON CONFLICT (email) 
       DO UPDATE SET fb_exchange_token = $1, facebook_email = $2`,
      [longLivedToken, facebookEmail, email]
    );

    console.log(`✅ Successfully stored Facebook token for user: ${email}`);

    // Redirect back to the flux/new page (will be on step 2 where they can select accounts)
    return NextResponse.redirect(new URL('/flux/new?fb_connected=true', request.url));

  } catch (error: any) {
    console.error('❌ Facebook callback error:', error.message || error);
    return NextResponse.redirect(new URL('/flux/new?error=callback_failed', request.url));
  }
}

