import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extractSheetId } from '@/lib/utils';
import { google } from 'googleapis';
import { oauth2Client } from '@/lib/services/connector/googleAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, sheetUrl } = body;

    if (!email || !sheetUrl) {
      return NextResponse.json({ 
        error: 'Email and sheetUrl are required' 
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

    // Get user's Google refresh token
    const userResult = await query(
      'SELECT google_refresh_token FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const refreshToken = userResult.rows[0].google_refresh_token;

    if (!refreshToken) {
      return NextResponse.json({ 
        error: 'Google account not connected. Please connect Google first.' 
      }, { status: 400 });
    }

    // Authenticate with Google
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Fetch spreadsheet metadata to get tab names
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });

    const tabNames = response.data.sheets?.map(sheet => ({
      title: sheet.properties?.title || 'Untitled',
      sheetId: sheet.properties?.sheetId
    })) || [];

    return NextResponse.json({
      spreadsheetId,
      tabs: tabNames
    });

  } catch (error: any) {
    console.error('Error fetching sheet metadata:', error);
    
    // Handle specific Google API errors
    if (error.code === 403) {
      return NextResponse.json({ 
        error: 'Permission denied. Please ensure the sheet is accessible and you have the correct permissions.' 
      }, { status: 403 });
    }
    
    if (error.code === 404) {
      return NextResponse.json({ 
        error: 'Sheet not found. Please check the URL.' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to fetch sheet metadata' 
    }, { status: 500 });
  }
}

