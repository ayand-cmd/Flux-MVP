import { NextRequest, NextResponse } from 'next/server';
import { SheetService } from '@/lib/services/courier/sheetService';
import { RealMetaFetcher } from '@/lib/services/sentinel/realMetaFetcher';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, spreadsheetId } = await request.json();

    if (!email || !spreadsheetId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    // 1. Get the REAL Credentials from Database
    const userResult = await query(
      'SELECT fb_exchange_token, ad_account_id FROM users WHERE email = $1', 
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { fb_exchange_token, ad_account_id } = userResult.rows[0];

    if (!fb_exchange_token || !ad_account_id) {
      return NextResponse.json({ error: 'Please connect Facebook and select an Ad Account first.' }, { status: 400 });
    }

    // 2. Initialize the Real Services
    const sentinel = new RealMetaFetcher(fb_exchange_token, ad_account_id);
    const courier = new SheetService(email); // Keep using Google Email for Sheet access

    // 3. FETCH: Get Real Data from Meta
    const adData = await sentinel.getInsights();

    // 4. WRITE: Push to Google Sheet
    if (adData.length === 0) {
      return NextResponse.json({ message: 'Sync complete, but no active ads found for today.' });
    }

    const result = await courier.syncDailyStats(spreadsheetId, adData);

    return NextResponse.json({ 
      message: result, 
      count: adData.length,
      preview: adData[0] 
    });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}