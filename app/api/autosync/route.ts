import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SheetService } from '@/lib/services/courier/sheetService';
import { RealMetaFetcher } from '@/lib/services/sentinel/realMetaFetcher';

// Force dynamic prevents caching issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch Users
    const sql = `
      SELECT email, fb_exchange_token, ad_account_id, spreadsheet_id 
      FROM users 
      WHERE fb_exchange_token IS NOT NULL 
      AND ad_account_id IS NOT NULL 
      AND spreadsheet_id IS NOT NULL
    `;
    
    const result = await query(sql);
    const users = result.rows;
    const report = [];

    // 3. Sync Loop
    for (const user of users) {
      try {
        const sentinel = new RealMetaFetcher(user.fb_exchange_token, user.ad_account_id);
        const courier = new SheetService(user.email);
        
        const adData = await sentinel.getInsights();
        
        if (adData.length > 0) {
          await courier.syncDailyStats(user.spreadsheet_id, adData);
          report.push({ user: user.email, status: 'Success', count: adData.length });
        } else {
          report.push({ user: user.email, status: 'Skipped (No Ads)' });
        }
      } catch (err: any) {
        console.error(`Sync error for ${user.email}:`, err.message);
        report.push({ user: user.email, status: 'Failed', error: err.message });
      }
    }

    return NextResponse.json({ message: 'Cron Job Complete', results: report });

  } catch (error: any) {
    console.error('Master Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}