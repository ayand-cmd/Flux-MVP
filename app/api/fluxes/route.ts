import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user email from query parameter
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    // First, verify user exists and get their ID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // Fetch all fluxes for this user
    const sql = `
      SELECT 
        id,
        name,
        last_synced_at,
        sheet_name
      FROM fluxes
      WHERE user_id = $1
      ORDER BY last_synced_at DESC NULLS LAST, name ASC
    `;

    const result = await query(sql, [userId]);
    
    const fluxes = result.rows.map((flux: any) => ({
      id: flux.id,
      name: flux.name,
      last_synced_at: flux.last_synced_at,
      sheet_name: flux.sheet_name || 'No Sheet'
    }));

    return NextResponse.json({ fluxes });

  } catch (error: any) {
    console.error('Error fetching fluxes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

