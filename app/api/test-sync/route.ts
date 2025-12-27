import { NextRequest, NextResponse } from 'next/server';
import { SheetService } from '@/lib/services/courier/sheetService';
import { MetaFetcher } from '@/lib/services/sentinel/metaFetcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, spreadsheetId } = body;

    if (!email || !spreadsheetId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    // 1. Initialize Services
    const courier = new SheetService(email);
    // In the future, we will pass a real Meta Token here. For now, "MOCK_MODE" is fine.
    const sentinel = new MetaFetcher('MOCK_MODE'); 

    // 2. FETCH: Get the data (Sentinel)
    const adData = await sentinel.getMockInsights();

    // 3. WRITE: Push to Sheets (Courier)
    const result = await courier.syncDailyStats(spreadsheetId, adData);

    return NextResponse.json({ 
      message: result, 
      data_preview: adData // Show us what was generated in the JSON response too
    });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}