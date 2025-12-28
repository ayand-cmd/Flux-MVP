import axios from 'axios';

export class RealMetaFetcher {
  constructor(private accessToken: string, private adAccountId: string) {}

  async getInsights() {
    // 1. The URL: We ask for Campaign Level data for "Today"
    const url = `https://graph.facebook.com/v21.0/${this.adAccountId}/insights`;
    
    // 2. The Fields: What numbers do we want?
    // 'actions' contains the purchase data needed for ROAS
    const params = {
      access_token: this.accessToken,
      level: 'campaign',
      date_preset: 'today',
      fields: 'campaign_name,spend,impressions,clicks,purchase_roas',
    };

    try {
      const { data } = await axios.get(url, { params });
      
      // 3. Transform the raw API data into our clean format
      const cleanData = data.data.map((row: any) => {
        const spend = parseFloat(row.spend || '0');
        
        // Extract ROAS (it comes in a weird nested format)
        const roasEntry = row.purchase_roas ? row.purchase_roas.find((x: any) => x.action_type === 'omni_purchase') : null;
        const roas = roasEntry ? parseFloat(roasEntry.value).toFixed(2) : '0.00';

        return {
          campaign_name: row.campaign_name,
          spend_raw: spend.toFixed(2),
          spend_tax: (spend * 1.18).toFixed(2), // 🇮🇳 The 18% GST Magic
          impressions: row.impressions,
          clicks: row.clicks,
          roas: roas
        };
      });

      return cleanData;

    } catch (error: any) {
      console.error('Meta API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch ads. Check if the account is active.');
    }
  }
}