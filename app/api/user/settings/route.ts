import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extractSheetId } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { email, spreadsheetId, adAccountId } = await request.json(); // <--- Now accepting adAccountId

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // Dynamic SQL: Update whatever is provided
    // This allows us to save just the Sheet ID OR just the Ad Account ID
    let sql = 'UPDATE users SET ';
    const params = [email];
    let paramIndex = 2; // $1 is email

    if (spreadsheetId) {
      // Extract the spreadsheet ID from URL if needed
      const extractedId = extractSheetId(spreadsheetId);
      sql += `spreadsheet_id = $${paramIndex}, `;
      params.push(extractedId);
      paramIndex++;
    }
    
    if (adAccountId) {
      sql += `ad_account_id = $${paramIndex}, `; // <--- Saving the Ad Account
      params.push(adAccountId);
      paramIndex++;
    }

    // Remove trailing comma and add WHERE clause
    sql = sql.slice(0, -2) + ` WHERE email = $1`;

    await query(sql, params);

    return NextResponse.json({ message: 'Settings saved!' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}