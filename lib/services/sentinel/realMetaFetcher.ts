import axios from 'axios';

export class RealMetaFetcher {
  constructor(private accessToken: string, private adAccountId: string) {}

  async getInsights() {
    // FIX: Ensure the ID starts with 'act_'
    const accountId = this.adAccountId.startsWith('act_') 
      ? this.adAccountId 
      : `act_${this.adAccountId}`;

    // 1. The URL uses the fixed ID
    const url = `https://graph.facebook.com/v21.0/${accountId}/insights`;
    
    // Debug log to help us trace in Vercel if needed
    console.log(`Fetching insights for: ${accountId}`);

    const params = {
      access_token: this.accessToken,
      level: 'campaign',
      date_preset: 'today',
      fields: 'campaign_name,spend,impressions,clicks,purchase_roas',
    };

    try {
      const { data } = await axios.get(url, { params });
      
      const cleanData = data.data.map((row: any) => {
        const spend = parseFloat(row.spend || '0');
        
        const roasEntry = row.purchase_roas ? row.purchase_roas.find((x: any) => x.action_type === 'omni_purchase') : null;
        const roas = roasEntry ? parseFloat(roasEntry.value).toFixed(2) : '0.00';

        return {
          campaign_name: row.campaign_name,
          spend_raw: spend.toFixed(2),
          spend_tax: (spend * 1.18).toFixed(2),
          impressions: row.impressions,
          clicks: row.clicks,
          roas: roas
        };
      });

      return cleanData;

    } catch (error: any) {
      // Improved Error Logging
      console.error('Meta API Error Details:', error.response?.data || error.message);
      
      // If the token is invalid, tell the user
      if (error.response?.data?.error?.code === 190) {
        throw new Error('Facebook Session Expired. Please reconnect Step 3.');
      }
      
      throw new Error('Failed to fetch ads. Check if the account is active.');
    }
  }
}