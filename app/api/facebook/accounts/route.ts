import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  console.log("🔍 API /accounts hit. Looking for:", email);

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  try {
    // 1. Get the Token
    const result = await query('SELECT fb_exchange_token FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      console.error("❌ User not found in DB");
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const accessToken = result.rows[0].fb_exchange_token;
    
    if (!accessToken) {
      console.error("❌ Token column is empty");
      return NextResponse.json({ error: 'Facebook token is missing. Please reconnect.' }, { status: 404 });
    }

    console.log("✅ Token found! Fetching from Meta...");

    // 2. Fetch from Facebook
    const url = `https://graph.facebook.com/v21.0/me/adaccounts`;
    const { data } = await axios.get(url, {
      params: {
        access_token: accessToken,
        fields: 'name,account_id,currency,account_status',
      },
    });

    console.log("✅ Meta responded with:", data.data?.length, "accounts");
    return NextResponse.json({ accounts: data.data });

  } catch (error: any) {
    console.error('❌ Fetch Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch ad accounts' }, { status: 500 });
  }
}