import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, spreadsheetId } = await request.json();

    if (!email || !spreadsheetId) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Save the ID to the user's row
    const sql = `
      UPDATE users 
      SET spreadsheet_id = $1 
      WHERE email = $2
    `;
    
    await query(sql, [spreadsheetId, email]);

    return NextResponse.json({ message: 'Settings saved!' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}