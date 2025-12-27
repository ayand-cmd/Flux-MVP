import { google } from 'googleapis';
import { query } from '@/lib/db';
import { oauth2Client } from '@/lib/services/connector/googleAuth';

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

  // 2. The "Write" Function
 /**
   * Takes the Array of Ad Data and formats it for the Google Sheet
   */
 async syncDailyStats(spreadsheetId: string, adData: any[]) {
    const auth = await this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Prepare the Header Row
    const headers = ['Campaign Name', 'Ad Spend (Platform)', 'Real Cost (+18% GST)', 'Impressions', 'Clicks', 'ROAS', 'Synced At'];

    // 2. Format the Data Rows
    // We map over the mock data to turn it into an array of strings
    const rows = adData.map(ad => [
      ad.campaign_name,
      `₹${ad.spend_raw}`,
      `₹${ad.spend_tax.toFixed(2)}`, // The Calculated GST Field
      ad.impressions,
      ad.clicks,
      ad.roas,
      new Date().toLocaleTimeString() // Timestamp
    ]);

    // 3. Combine them
    const values = [headers, ...rows];

    // 4. Clear the old data first (so we don't have leftover rows)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1!A:Z', // Wipe the whole sheet
    });

    // 5. Write the new fresh batch
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return `Synced ${rows.length} campaigns successfully!`;
  }
}