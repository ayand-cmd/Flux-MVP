import { NextRequest, NextResponse } from 'next/server';
import { query, FluxWithUserData } from '@/lib/db';
import { SheetService } from '@/lib/services/courier/sheetService';
import { RealMetaFetcher } from '@/lib/services/sentinel/realMetaFetcher';

// Force dynamic prevents caching issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch Active Fluxes with User Data
    // JOIN with users table to get tokens needed for sync operations
    const sql = `
      SELECT 
        f.id,
        f.user_id,
        f.name,
        f.ad_account_id,
        f.spreadsheet_id,
        f.template_type,
        f.last_synced_at,
        u.email,
        u.fb_exchange_token,
        u.google_refresh_token
      FROM fluxes f
      INNER JOIN users u ON f.user_id = u.id
      WHERE u.fb_exchange_token IS NOT NULL 
        AND u.google_refresh_token IS NOT NULL
        AND f.ad_account_id IS NOT NULL 
        AND f.spreadsheet_id IS NOT NULL
      ORDER BY f.id
    `;
    
    const result = await query(sql);
    const fluxes: FluxWithUserData[] = result.rows;
    const report = [];

    // 3. Sync Loop - Iterate through each Flux
    for (const flux of fluxes) {
      try {
        const sentinel = new RealMetaFetcher(flux.fb_exchange_token, flux.ad_account_id);
        const courier = new SheetService(flux.email);
        
        const adData = await sentinel.getInsights();
        
        if (adData.length > 0) {
          await courier.syncDailyStats(flux.spreadsheet_id, adData);
          
          // Update last_synced_at on successful sync
          await query(
            'UPDATE fluxes SET last_synced_at = NOW() WHERE id = $1',
            [flux.id]
          );
          
          report.push({ 
            flux_id: flux.id,
            flux_name: flux.name,
            user: flux.email, 
            status: 'Success', 
            count: adData.length 
          });
        } else {
          report.push({ 
            flux_id: flux.id,
            flux_name: flux.name,
            user: flux.email, 
            status: 'Skipped (No Ads)' 
          });
        }
      } catch (err: any) {
        console.error(`Sync error for Flux ${flux.id} (${flux.name}):`, err.message);
        report.push({ 
          flux_id: flux.id,
          flux_name: flux.name,
          user: flux.email, 
          status: 'Failed', 
          error: err.message 
        });
      }
    }

    return NextResponse.json({ 
      message: 'Cron Job Complete', 
      results: report,
      total_fluxes: fluxes.length
    });

  } catch (error: any) {
    console.error('Master Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}