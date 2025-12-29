import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extractSheetId } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, sheetUrl, template, adAccountId } = body;

    // Validation
    if (!email) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    if (!name || !sheetUrl || !template || !adAccountId) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, sheetUrl, template, adAccountId' 
      }, { status: 400 });
    }

    // Validate Google Sheets URL format
    const isValidSheetUrl = sheetUrl.includes('docs.google.com/spreadsheets') || 
                            sheetUrl.includes('/spreadsheets/d/');
    
    if (!isValidSheetUrl) {
      return NextResponse.json({ 
        error: 'Invalid Google Sheets URL format' 
      }, { status: 400 });
    }

    // Extract spreadsheet ID
    const spreadsheetId = extractSheetId(sheetUrl);

    if (!spreadsheetId) {
      return NextResponse.json({ 
        error: 'Could not extract spreadsheet ID from URL' 
      }, { status: 400 });
    }

    // Verify user exists and get their ID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // Verify user has Facebook token (required for sync)
    const tokenCheck = await query(
      'SELECT fb_exchange_token FROM users WHERE id = $1',
      [userId]
    );

    if (!tokenCheck.rows[0]?.fb_exchange_token) {
      return NextResponse.json({ 
        error: 'Facebook account not connected. Please connect Facebook first.' 
      }, { status: 400 });
    }

    // Insert new flux
    const insertSql = `
      INSERT INTO fluxes (user_id, name, spreadsheet_id, template_type, ad_account_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, spreadsheet_id, template_type, ad_account_id, created_at
    `;

    const result = await query(insertSql, [
      userId,
      name,
      spreadsheetId,
      template,
      adAccountId
    ]);

    return NextResponse.json({
      success: true,
      flux: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error creating flux:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

