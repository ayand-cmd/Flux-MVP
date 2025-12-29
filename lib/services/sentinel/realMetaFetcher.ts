import axios from 'axios';

interface FluxConfig {
  granularity?: 'Daily' | 'Hourly' | 'Weekly';
  breakdowns?: string[];
  frequency?: string;
  analysis_logic?: boolean;
}

export class RealMetaFetcher {
  constructor(private accessToken: string, private adAccountId: string) {}

  async getInsights(config?: FluxConfig) {
    // 1. FIX: Ensure the ID starts with 'act_'
    const accountId = this.adAccountId.startsWith('act_') 
      ? this.adAccountId 
      : `act_${this.adAccountId}`;

    const url = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    // Base params
    const params: any = {
      access_token: this.accessToken,
      level: 'campaign',
      fields: 'campaign_name,spend,impressions,clicks,purchase_roas',
    };

    // Handle granularity
    if (config?.granularity === 'Hourly') {
      // For hourly, use time_increment=1 and date_preset or specific date range
      params.time_increment = 1;
      params.date_preset = 'today';
    } else if (config?.granularity === 'Weekly') {
      // For weekly, use date range for last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      params.time_range = JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0]
      });
    } else {
      // Default: Daily
      params.date_preset = 'today';
    }

    // Handle breakdowns
    if (config?.breakdowns && config.breakdowns.length > 0) {
      // Map UI breakdown names to Meta API breakdown values
      const breakdownMap: Record<string, string> = {
        'Age': 'age',
        'Gender': 'gender',
        'Platform': 'publisher_platform',
        'Region': 'region'
      };

      const metaBreakdowns = config.breakdowns
        .map(b => breakdownMap[b])
        .filter(Boolean); // Remove any undefined values

      if (metaBreakdowns.length > 0) {
        // Meta API supports multiple breakdowns, but we'll use the first valid one
        // Multiple breakdowns require specific combinations - using first for safety
        params.breakdowns = metaBreakdowns[0];
      }
    }

    try {
      console.log(`Fetching insights for: ${accountId}`, { config, params });
      const { data } = await axios.get(url, { params });
      
      // Handle breakdown data structure (breakdowns create nested data)
      let rows = data.data || [];
      
      // If breakdowns are used, the data structure is different
      // Each campaign may have multiple rows (one per breakdown value)
      // We'll flatten and aggregate if needed
      if (config?.breakdowns && config.breakdowns.length > 0) {
        // For now, we'll take the first row per campaign or aggregate
        // In a production system, you might want to handle this more sophisticatedly
        rows = rows.slice(0, 100); // Limit to prevent too much data
      }
      
      const cleanData = rows.map((row: any) => {
        const spend = parseFloat(row.spend || '0');
        
        // ROAS Logic
        const roasEntry = row.purchase_roas ? row.purchase_roas.find((x: any) => x.action_type === 'omni_purchase') : null;
        const roasVal = roasEntry ? row.purchase_roas[0].value : '0';

        const baseData: any = {
          campaign_name: row.campaign_name,
          spend_raw: parseFloat(spend.toFixed(2)), 
          spend_tax: parseFloat((spend * 1.18).toFixed(2)), 
          impressions: parseInt(row.impressions || '0'),
          clicks: parseInt(row.clicks || '0'),
          roas: parseFloat(parseFloat(roasVal).toFixed(2))
        };

        // Add breakdown columns if present
        if (config?.breakdowns) {
          if (row.age) baseData.age = row.age;
          if (row.gender) baseData.gender = row.gender;
          if (row.publisher_platform) baseData.platform = row.publisher_platform;
          if (row.region) baseData.region = row.region;
        }

        return baseData;
      });

      return cleanData;

    } catch (error: any) {
      console.error('Meta API Error Details:', error.response?.data || error.message);
      
      // Handle invalid breakdown combinations gracefully
      if (error.response?.data?.error?.code === 100 && 
          error.response?.data?.error?.message?.includes('breakdown')) {
        console.warn('Invalid breakdown combination, retrying without breakdowns');
        // Retry without breakdowns
        const retryParams = { ...params };
        delete retryParams.breakdowns;
        try {
          const { data } = await axios.get(url, { params: retryParams });
          return this.processData(data.data || []);
        } catch (retryError: any) {
          throw new Error('Failed to fetch ads with breakdowns. Please check your configuration.');
        }
      }
      
      if (error.response?.data?.error?.code === 190) {
        throw new Error('Facebook Session Expired. Please reconnect Step 3.');
      }
      
      throw new Error('Failed to fetch ads. Check if the account is active.');
    }
  }

  private processData(rows: any[]) {
    return rows.map((row: any) => {
      const spend = parseFloat(row.spend || '0');
      const roasEntry = row.purchase_roas ? row.purchase_roas.find((x: any) => x.action_type === 'omni_purchase') : null;
      const roasVal = roasEntry ? row.purchase_roas[0].value : '0';

      return {
        campaign_name: row.campaign_name,
        spend_raw: parseFloat(spend.toFixed(2)), 
        spend_tax: parseFloat((spend * 1.18).toFixed(2)), 
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        roas: parseFloat(parseFloat(roasVal).toFixed(2))
      };
    });
  }
}