import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extractSheetId } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      name, 
      sheetUrl, 
      adAccountId,
      config,
      destination_mapping
    } = body;

    // Validation
    if (!email) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    if (!name || !sheetUrl || !adAccountId) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, sheetUrl, adAccountId' 
      }, { status: 400 });
    }

    // Validate config
    if (!config || !config.granularity || !config.frequency) {
      return NextResponse.json({ 
        error: 'Missing required config: granularity, frequency' 
      }, { status: 400 });
    }

    // Validate destination_mapping
    if (!destination_mapping || !destination_mapping.raw_data_tab) {
      return NextResponse.json({ 
        error: 'Missing required destination_mapping: raw_data_tab' 
      }, { status: 400 });
    }

    // If analysis_logic is enabled, analysis_tab is required
    if (config.analysis_logic) {
      if (!destination_mapping.analysis_tab) {
        return NextResponse.json({ 
          error: 'Missing required destination_mapping: analysis_tab (required when AI Analysis is enabled)' 
        }, { status: 400 });
      }

      // Validate that raw_data_tab and analysis_tab are different
      if (destination_mapping.raw_data_tab === destination_mapping.analysis_tab) {
        return NextResponse.json({ 
          error: 'Raw Data and Analysis tabs must be different' 
        }, { status: 400 });
      }
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

    // Get PostgreSQL user ID (integer) from users table by email
    // The fluxes table uses integer user_id referencing users.id, not Supabase auth UUID
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
      'SELECT fb_exchange_token FROM users WHERE email = $1',
      [email]
    );

    if (!tokenCheck.rows[0]?.fb_exchange_token) {
      return NextResponse.json({ 
        error: 'Facebook account not connected. Please connect Facebook first.' 
      }, { status: 400 });
    }

    // Prepare config object (granularity, breakdowns, frequency, analysis_logic)
    const configObject = {
      granularity: config.granularity,
      breakdowns: config.breakdowns || [],
      frequency: config.frequency,
      analysis_logic: config.analysis_logic || false
    };

    // Prepare destination_mapping object
    // Only include analysis_tab if analysis_logic is enabled
    const destinationMappingObject = {
      raw_data_tab: destination_mapping.raw_data_tab,
      ...(config.analysis_logic && { analysis_tab: destination_mapping.analysis_tab })
    };

    // Prepare destination_mapping JSONB
    // Only include analysis_tab if analysis_logic is enabled
    const destinationMappingJson = JSON.stringify({
      raw_data_tab: destination_mapping.raw_data_tab,
      ...(config.analysis_logic && { analysis_tab: destination_mapping.analysis_tab })
    });

    // Insert new flux using PostgreSQL (fluxes table uses integer user_id)
    const insertSql = `
      INSERT INTO fluxes (
        user_id, 
        name, 
        spreadsheet_id, 
        ad_account_id,
        config,
        destination_mapping
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      RETURNING id, name, spreadsheet_id, ad_account_id, config, destination_mapping, created_at
    `;

    const result = await query(insertSql, [
      userId,
      name,
      spreadsheetId,
      adAccountId,
      JSON.stringify(configObject),
      destinationMappingJson
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

