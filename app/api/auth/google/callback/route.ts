import { NextRequest, NextResponse } from 'next/server';
import { oauth2Client } from '@/lib/services/connector/googleAuth';
import { query } from '@/lib/db';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: 'No code provided' }, { status: 400 });

  try {
    // 1. Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    // Debug: Log what tokens we received
    console.log('🔑 Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
    });

    // Ensure we have an access token
    if (!tokens.access_token) {
      throw new Error('No access token received from Google OAuth');
    }

    // 2. Get User Profile
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) throw new Error('Could not get email from Google');

    console.log(`👤 Processing login for: ${email}`); // <--- NEW LOG TO LOOK FOR

    // 3. UPSERT user into database (insert or update based on email)
    const sql = `
      INSERT INTO users (email, google_refresh_token)
      VALUES ($1, $2)
      ON CONFLICT (email) 
      DO UPDATE SET google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, users.google_refresh_token)
      RETURNING *;
    `;

    if (refreshToken) {
       await query(sql, [email, refreshToken]);
       console.log(`✅ DATABASE SUCCESS: Saved token for ${email}`); // <--- NEW LOG
    } else {
       // Even if no refresh token, ensure user exists in database
       await query(sql, [email, null]);
       console.log(`ℹ️ User ${email} logged in (Existing user, no new token).`);
    }

    // 4. Redirect to dashboard with email in query parameter
    const baseUrl = new URL(request.url);
    const redirectUrl = new URL('/', baseUrl.origin);
    redirectUrl.searchParams.set('email', email);
    return NextResponse.redirect(redirectUrl);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}