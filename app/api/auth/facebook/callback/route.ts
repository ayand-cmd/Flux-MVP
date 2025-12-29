import { NextRequest, NextResponse } from 'next/server';
import { exchangeMetaCodeForToken, getMetaUserDetails } from '@/lib/services/connector/metaAuth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // <--- This holds the Google Email (encoded)
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.json({ error: 'Login failed or cancelled by user' }, { status: 400 });
  }

  if (!state) {
    return NextResponse.json({ error: 'Security state missing. Please try clicking the "Connect" button again.' }, { status: 400 });
  }

  try {
    // 1. Get the Long-Lived Token
    const longLivedToken = await exchangeMetaCodeForToken(code);
    
    // 2. Find out the Facebook Email
    const userDetails = await getMetaUserDetails(longLivedToken);
    const facebookEmail = userDetails.email;

    // 3. Decode the "Google Email" from the state parameter
    // We encoded this in the Login Step to remember who the user was
    const originalEmail = Buffer.from(state, 'base64').toString('ascii');

    // 4. Update the EXISTING user
    // We use 'originalEmail' (Google) to find the row
    // We save 'longLivedToken' and 'facebookEmail' into that row
    const sql = `
      UPDATE users 
      SET fb_exchange_token = $1, facebook_email = $2
      WHERE email = $3
    `;
    
    await query(sql, [longLivedToken, facebookEmail, originalEmail]);

    // NEW CODE: Redirect back to the dashboard
    // We attach the email so the frontend knows who is logged in
    const dashboardUrl = new URL('/', request.url);
    dashboardUrl.searchParams.set('email', originalEmail);
    
    return NextResponse.redirect(dashboardUrl);

  } catch (error: any) {
    console.error('Meta Auth Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to connect Facebook' }, { status: 500 });
  }
}