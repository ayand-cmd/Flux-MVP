// lib/services/courier/sheetService.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class SheetService {
  private auth: OAuth2Client;
  private sheets;

  constructor(refreshToken: string) {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    this.auth.setCredentials({ refresh_token: refreshToken });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  // Helper: Safe Number Formatting
  private safeFormat(value: any, decimals = 2): string | number {
    if (value === undefined || value === null || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : Number(num.toFixed(decimals));
  }

  async ensureTabExists(spreadsheetId: string, title: string) {
    try {
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
      const exists = meta.data.sheets?.some(s => s.properties?.title === title);
      
      if (!exists) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title } } }]
          }
        });
      }
    } catch (error) {
      console.error(`Error ensuring tab exists: ${title}`, error);
      throw new Error(`Failed to create/access tab: ${title}`);
    }
  }

  async syncData(spreadsheetId: string, data: any[], mapping: any, config: any) {
    const tabName = mapping.raw_data_tab || 'Data';
    await this.ensureTabExists(spreadsheetId, tabName);

    if (data.length === 0) return;

    // 1. Prepare Headers (Dynamic based on Visuals)
    const headers = [
      'Date', 
      'Campaign Name', 
      'Ad Set Name', 
      'Ad Name', 
      'Spend', 
      'Impressions', 
      'Clicks', 
      'CTR', 
      'CPC', 
      'Results', 
      'Cost per Result'
    ];

    if (config?.enable_visuals) {
      headers.push('Creative Preview'); // Add header for image
      headers.push('Ad Headline');
    }

    // 2. Map Data to Rows (Using Safe Formatting)
    const rows = data.map(row => {
      const basicRow = [
        row.date_start || new Date().toISOString().split('T')[0],
        row.campaign_name,
        row.adset_name,
        row.ad_name,
        this.safeFormat(row.spend),
        this.safeFormat(row.impressions, 0),
        this.safeFormat(row.clicks, 0),
        this.safeFormat(row.ctr),
        this.safeFormat(row.cpc),
        this.safeFormat(row.actions?.[0]?.value || 0, 0), // Simplified actions logic
        this.safeFormat(row.cpp)
      ];

      // Add Visuals if enabled
      if (config?.enable_visuals) {
        // IMAGE FORMULA MAGIC 
        // We use =IMAGE("url", 4, 100, 100) -> Mode 4 = Custom Size (100x100)
        const imageFormula = row.ad_image 
          ? `=IMAGE("${row.ad_image}", 4, 100, 100)` 
          : 'No Image';
        
        basicRow.push(imageFormula);
        basicRow.push(row.ad_headline || '');
      }

      return basicRow;
    });

    // 3. Clear & Write
    // Note: We write RAW for formulas to work
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED', // CRITICAL for Formulas
      requestBody: {
        values: [headers, ...rows]
      }
    });

    // 4. Formatting Step: Resize Rows for Images
    if (config?.enable_visuals) {
      // We need the sheetId (number), not the title (string) to resize rows
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
      const sheetId = meta.data.sheets?.find(s => s.properties?.title === tabName)?.properties?.sheetId;

      if (sheetId !== undefined) {
         await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: 1, // Skip Header
                    endIndex: 1 + rows.length 
                  },
                  properties: {
                    pixelSize: 100 // Matches our image height
                  },
                  fields: 'pixelSize'
                }
              }
            ]
          }
        });
        console.log('🎨 COURIER: Resized rows to 100px for visuals.');
      }
    }
  }
}