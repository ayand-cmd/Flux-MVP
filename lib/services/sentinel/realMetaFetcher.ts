import axios from 'axios';

export class RealMetaFetcher {
  constructor(private accessToken: string, private adAccountId: string) {}

  async getInsights() {
    // 1. FIX: Ensure the ID starts with 'act_'
    const accountId = this.adAccountId.startsWith('act_') 
      ? this.adAccountId 
      : `act_${this.adAccountId}`;

    const url = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    const params = {
      access_token: this.accessToken,
      level: 'campaign',
      date_preset: 'today',
      fields: 'campaign_name,spend,impressions,clicks,purchase_roas',
    };

    try {
      console.log(`Fetching insights for: ${accountId}`);
      const { data } = await axios.get(url, { params });
      
      const cleanData = data.data.map((row: any) => {
        const spend = parseFloat(row.spend || '0');
        
        // ROAS Logic
        const roasEntry = row.purchase_roas ? row.purchase_roas.find((x: any) => x.action_type === 'omni_purchase') : null;
        const roasVal = roasEntry ? row.purchase_roas[0].value : '0';

        return {
          campaign_name: row.campaign_name,
          
          // 2. FIX: Convert Strings to Numbers using parseFloat()
          // This prevents "toFixed is not a function" errors
          spend_raw: parseFloat(spend.toFixed(2)), 
          spend_tax: parseFloat((spend * 1.18).toFixed(2)), 
          impressions: parseInt(row.impressions || '0'),
          clicks: parseInt(row.clicks || '0'),
          roas: parseFloat(parseFloat(roasVal).toFixed(2))
        };
      });

      return cleanData;

    } catch (error: any) {
      console.error('Meta API Error Details:', error.response?.data || error.message);
      
      if (error.response?.data?.error?.code === 190) {
        throw new Error('Facebook Session Expired. Please reconnect Step 3.');
      }
      
      throw new Error('Failed to fetch ads. Check if the account is active.');
    }
  }
}