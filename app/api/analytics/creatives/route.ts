import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Check if user is logged in (Supabase Auth)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get the user's integer ID from the users table
    // The users table uses integer id, not Supabase auth UUID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [user.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // 3. Get date range from query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to last 7 days if not provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam 
      ? new Date(startDateParam) 
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Format dates as YYYY-MM-DD for PostgreSQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 4. Build SQL query
    // Join dim_creatives with fact_creative_daily
    // Group by creative_id (all dim_creatives fields)
    // Sum metrics and calculate ROAS
    // Filter by user_id to ensure data isolation
    const sql = `
      SELECT 
        dc.id,
        dc.platform_id,
        dc.platform,
        dc.name,
        dc.thumbnail_url,
        dc.body_copy,
        dc.headline,
        dc.format,
        dc.first_seen_date,
        dc.created_at,
        dc.updated_at,
        SUM(fcd.spend)::NUMERIC(15, 2) as total_spend,
        SUM(fcd.impressions)::INTEGER as total_impressions,
        SUM(fcd.clicks)::INTEGER as total_clicks,
        SUM(fcd.revenue)::NUMERIC(15, 2) as total_revenue,
        CASE 
          WHEN SUM(fcd.spend) > 0 THEN 
            (SUM(fcd.revenue) / SUM(fcd.spend))::NUMERIC(15, 4)
          ELSE NULL
        END as roas
      FROM dim_creatives dc
      INNER JOIN fact_creative_daily fcd ON dc.id = fcd.creative_id
      WHERE fcd.user_id = $1
        AND fcd.date >= $2 
        AND fcd.date <= $3
      GROUP BY 
        dc.id,
        dc.platform_id,
        dc.platform,
        dc.name,
        dc.thumbnail_url,
        dc.body_copy,
        dc.headline,
        dc.format,
        dc.first_seen_date,
        dc.created_at,
        dc.updated_at
      ORDER BY total_spend DESC
    `;

    const result = await query(sql, [userId, startDateStr, endDateStr]);

    // 5. Format results
    const data = result.rows.map((row: any) => ({
      id: row.id,
      platform_id: row.platform_id,
      platform: row.platform,
      name: row.name,
      thumbnail_url: row.thumbnail_url,
      body_copy: row.body_copy,
      headline: row.headline,
      format: row.format,
      first_seen_date: row.first_seen_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      total_spend: parseFloat(row.total_spend || 0),
      total_impressions: parseInt(row.total_impressions || 0),
      total_clicks: parseInt(row.total_clicks || 0),
      roas: row.roas ? parseFloat(row.roas) : null,
    }));

    return NextResponse.json({ data });

  } catch (error: any) {
    console.error('Error in analytics/creatives route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

