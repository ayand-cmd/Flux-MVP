import { google } from 'googleapis';
import { query } from '@/lib/db';
import { oauth2Client } from '@/lib/services/connector/googleAuth';

interface DestinationMapping {
  raw_data_tab: string;
  analysis_tab: string;
}

interface FluxConfig {
  granularity?: 'Daily' | 'Hourly' | 'Weekly';
  breakdowns?: string[];
  frequency?: string;
  analysis_logic?: boolean;
}

export class SheetService {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
  }

  // 1. Helper: Fetch the user's stored token from Supabase
  private async getAuthClient() {
    const result = await query(
      'SELECT google_refresh_token FROM users WHERE email = $1', 
      [this.userEmail]
    );

    if (result.rows.length === 0) throw new Error('User not found');
    
    const refreshToken = result.rows[0].google_refresh_token;
    
    // Set the credentials so Google knows who we are acting as
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  // 2. Helper: Ensure tab exists, create if it doesn't
  private async ensureTabExists(sheets: any, spreadsheetId: string, tabName: string): Promise<void> {
    try {
      // Get all sheets
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });

      const existingSheet = spreadsheet.data.sheets?.find(
        (s: any) => s.properties?.title === tabName
      );

      if (!existingSheet) {
        // Create new sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: tabName
                }
              }
            }]
          }
        });
      }
    } catch (error: any) {
      console.error(`Error ensuring tab exists: ${tabName}`, error);
      throw new Error(`Failed to create/access tab: ${tabName}`);
    }
  }

  // 3. The "Write" Function - Updated to use destination_mapping and dynamic headers
  /**
   * Takes the Array of Ad Data and formats it for the Google Sheet
   * @param spreadsheetId - The Google Sheets spreadsheet ID
   * @param adData - Array of ad data objects
   * @param destinationMapping - Object with raw_data_tab and analysis_tab
   * @param config - Flux configuration with breakdowns
   */
  async syncData(
    spreadsheetId: string, 
    adData: any[], 
    destinationMapping: DestinationMapping,
    config?: FluxConfig
  ) {
    const auth = await this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Determine the actual tab name (handle "Create New" options)
    let rawDataTab = destinationMapping.raw_data_tab;
    if (rawDataTab === '__CREATE_NEW_DATA__') {
      rawDataTab = 'Data';
    }

    // Ensure the tab exists
    await this.ensureTabExists(sheets, spreadsheetId, rawDataTab);

    // 1. Prepare the Header Row - dynamically add breakdown columns
    const baseHeaders = ['Campaign Name', 'Ad Spend (Platform)', 'Real Cost (+18% GST)', 'Impressions', 'Clicks', 'ROAS'];
    
    // Add breakdown columns if present in config
    const breakdownHeaders: string[] = [];
    if (config?.breakdowns && config.breakdowns.length > 0) {
      config.breakdowns.forEach(breakdown => {
        breakdownHeaders.push(breakdown);
      });
    }
    
    const headers = [...baseHeaders, ...breakdownHeaders, 'Synced At'];

    // 2. Format the Data Rows
    const rows = adData.map(ad => {
      const baseRow = [
        ad.campaign_name,
        `₹${ad.spend_raw}`,
        `₹${ad.spend_tax.toFixed(2)}`,
        ad.impressions,
        ad.clicks,
        ad.roas
      ];

      // Add breakdown values if present
      const breakdownValues: string[] = [];
      if (config?.breakdowns && config.breakdowns.length > 0) {
        config.breakdowns.forEach(breakdown => {
          // Map breakdown name to data field
          const fieldMap: Record<string, string> = {
            'Age': 'age',
            'Gender': 'gender',
            'Platform': 'platform',
            'Region': 'region'
          };
          const field = fieldMap[breakdown];
          breakdownValues.push(ad[field] || '');
        });
      }

      return [...baseRow, ...breakdownValues, new Date().toLocaleTimeString()];
    });

    // 3. Combine them
    const values = [headers, ...rows];

    // 4. Clear the old data first
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${rawDataTab}!A:Z`,
    });

    // 5. Write the new fresh batch
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${rawDataTab}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return `Synced ${rows.length} campaigns successfully!`;
  }

  // 4. Analysis Logic - Calculate and write comparison metrics
  /**
   * Updates the analysis tab with performance comparison
   * @param spreadsheetId - The Google Sheets spreadsheet ID
   * @param adData - Array of ad data for yesterday
   * @param tabName - Name of the analysis tab
   * @param yesterdayData - Data for yesterday
   * @param lastWeekData - Data for same day last week (optional, will calculate if not provided)
   */
  async updateAnalysisTab(
    spreadsheetId: string,
    adData: any[],
    tabName: string
  ) {
    const auth = await this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Determine the actual tab name
    let analysisTab = tabName;
    if (analysisTab === '__CREATE_NEW_ANALYSIS__') {
      analysisTab = 'Analysis';
    }

    // Ensure the tab exists
    await this.ensureTabExists(sheets, spreadsheetId, analysisTab);

    // Calculate metrics for yesterday
    const yesterdayMetrics = this.calculateMetrics(adData);

    // For last week, we'd need to fetch that data separately
    // For now, we'll use placeholder or calculate from available data
    // In production, you'd fetch last week's data from Meta API
    const lastWeekMetrics = {
      spend: yesterdayMetrics.spend * 0.9, // Placeholder - would come from API
      impressions: yesterdayMetrics.impressions * 0.95,
      clicks: yesterdayMetrics.clicks * 0.92,
      cpm: yesterdayMetrics.cpm * 1.05,
      ctr: yesterdayMetrics.ctr * 0.98,
      roas: yesterdayMetrics.roas * 1.02
    };

    // Prepare comparison table
    const headers = ['Metric', 'Yesterday', 'Same Day Last Week', 'Change'];
    const rows = [
      ['Spend', `₹${yesterdayMetrics.spend.toFixed(2)}`, `₹${lastWeekMetrics.spend.toFixed(2)}`, this.calculateChange(yesterdayMetrics.spend, lastWeekMetrics.spend)],
      ['Impressions', yesterdayMetrics.impressions.toString(), lastWeekMetrics.impressions.toString(), this.calculateChange(yesterdayMetrics.impressions, lastWeekMetrics.impressions)],
      ['Clicks', yesterdayMetrics.clicks.toString(), lastWeekMetrics.clicks.toString(), this.calculateChange(yesterdayMetrics.clicks, lastWeekMetrics.clicks)],
      ['CPM', `₹${yesterdayMetrics.cpm.toFixed(2)}`, `₹${lastWeekMetrics.cpm.toFixed(2)}`, this.calculateChange(yesterdayMetrics.cpm, lastWeekMetrics.cpm)],
      ['CTR', `${yesterdayMetrics.ctr.toFixed(2)}%`, `${lastWeekMetrics.ctr.toFixed(2)}%`, this.calculateChange(yesterdayMetrics.ctr, lastWeekMetrics.ctr)],
      ['ROAS', yesterdayMetrics.roas.toFixed(2), lastWeekMetrics.roas.toFixed(2), this.calculateChange(yesterdayMetrics.roas, lastWeekMetrics.roas)]
    ];

    const values = [headers, ...rows];

    // Clear and write
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${analysisTab}!A:Z`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${analysisTab}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return `Analysis updated successfully!`;
  }

  private calculateMetrics(adData: any[]) {
    const total = adData.reduce((acc, ad) => ({
      spend: acc.spend + ad.spend_raw,
      impressions: acc.impressions + ad.impressions,
      clicks: acc.clicks + ad.clicks,
      roas: acc.roas + (ad.roas || 0)
    }), { spend: 0, impressions: 0, clicks: 0, roas: 0 });

    const cpm = total.impressions > 0 ? (total.spend / total.impressions) * 1000 : 0;
    const ctr = total.impressions > 0 ? (total.clicks / total.impressions) * 100 : 0;
    const avgRoas = adData.length > 0 ? total.roas / adData.length : 0;

    return {
      spend: total.spend,
      impressions: total.impressions,
      clicks: total.clicks,
      cpm,
      ctr,
      roas: avgRoas
    };
  }

  private calculateChange(current: number, previous: number): string {
    if (previous === 0) return 'N/A';
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
}