import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SheetService } from '@/lib/services/courier/sheetService';
import { RealMetaFetcher } from '@/lib/services/sentinel/realMetaFetcher';

// IMPORTANT: This prevents Vercel from caching the response
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Security Check
  // Ensure the CRON_SECRET matches what you set in Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Find all users ready for sync
    // We only want users who have completed all setup steps
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

    console.log(`🤖 Cron started. Found ${users.length} users.`);

    // 3. Loop through users
    for (const user of users) {
      try {
        // Initialize services
        const sentinel = new RealMetaFetcher(user.fb_exchange_token, user.ad_account_id);
        const courier = new SheetService(user.email);

        // Fetch Data
        const adData = await sentinel.getInsights();

        // Sync to Sheet
        if (adData.length > 0) {
          await courier.syncDailyStats(user.spreadsheet_id, adData);
          report.push({ user: user.email, status: 'Success', campaigns: adData.length });
        } else {
          report.push({ user: user.email, status: 'Skipped (No Active Ads)' });
        }

      } catch (error: any) {
        console.error(`❌ Failed for ${user.email}:`, error.message);
        report.push({ user: user.email, status: 'Failed', error: error.message });
      }
    }

    return NextResponse.json({ 
      message: 'Cron Job Complete', 
      timestamp: new Date().toISOString(),
      results: report 
    });

  } catch (error: any) {
    console.error('Cron Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}