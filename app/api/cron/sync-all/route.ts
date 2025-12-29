import { NextRequest, NextResponse } from 'next/server';
import { RealMetaFetcher } from '@/lib/services/sentinel/realMetaFetcher';
import { SheetService } from '@/lib/services/courier/sheetService';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  // Security: Check Authorization header
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Database: Query users with all required fields
  let users;
  try {
    const result = await query(
      `SELECT email, fb_exchange_token, ad_account_id, spreadsheet_id 
       FROM users 
       WHERE email IS NOT NULL 
         AND fb_exchange_token IS NOT NULL 
         AND ad_account_id IS NOT NULL 
         AND spreadsheet_id IS NOT NULL`
    );
    users = result.rows;
  } catch (error: any) {
    console.error('Database query error:', error);
    return NextResponse.json(
      { error: 'Failed to query users', details: error.message },
      { status: 500 }
    );
  }

  const totalUsers = users.length;
  const results: Array<{ email: string; status: 'success' | 'failed'; error?: string; campaigns_synced?: number }> = [];
  let successCount = 0;
  let failedCount = 0;

  // Loop & Sync: Iterate through users
  for (const user of users) {
    const { email, fb_exchange_token, ad_account_id, spreadsheet_id } = user;
    
    try {
      // Initialize services
      const fetcher = new RealMetaFetcher(fb_exchange_token, ad_account_id);
      const courier = new SheetService(email);

      // Get insights data
      const data = await fetcher.getInsights();

      // Sync to spreadsheet if data exists
      if (data && data.length > 0) {
        await courier.syncDailyStats(spreadsheet_id, data);
        results.push({
          email,
          status: 'success',
          campaigns_synced: data.length
        });
        successCount++;
      } else {
        // No data to sync, but still considered successful
        results.push({
          email,
          status: 'success',
          campaigns_synced: 0
        });
        successCount++;
      }
    } catch (error: any) {
      // Error handling: log but continue
      console.error(`Sync failed for user ${email}:`, error);
      results.push({
        email,
        status: 'failed',
        error: error.message || 'Unknown error'
      });
      failedCount++;
    }
  }

  // Response: Return summary report
  return NextResponse.json({
    total_users: totalUsers,
    success: successCount,
    failed: failedCount,
    details: results
  });
}

