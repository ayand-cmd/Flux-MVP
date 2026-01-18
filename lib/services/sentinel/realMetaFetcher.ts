// lib/services/sentinel/realMetaFetcher.ts

export class RealMetaFetcher {
  private accessToken: string;
  private adAccountId: string;

  constructor(accessToken: string, adAccountId: string) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
  }

  // Helper to split a big array into smaller chunks
  private chunkArray(array: any[], size: number) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  async getInsights(config: any) {
    console.log(`🔍 SENTINEL: Fetching for Account ${this.adAccountId}`);
    
    // 1. Basic Fields
    const fields = [
      'campaign_name', 'adset_name', 'ad_name', 'spend', 'impressions',
      'clicks', 'cpc', 'ctr', 'cpp', 'cpm', 'actions', 'action_values', 'ad_id'
    ];

    // --- STEP A: Fetch Numeric Data ---
    // Note: We use 'date_preset' from config or default to 'yesterday'
    const insightsUrl = `https://graph.facebook.com/v19.0/act_${this.adAccountId}/insights`;
    const params = new URLSearchParams({
      access_token: this.accessToken,
      level: 'ad',
      date_preset: config?.date_range || 'yesterday',
      fields: fields.join(','),
      limit: '100'
    });

    const response = await fetch(`${insightsUrl}?${params.toString()}`);
    if (!response.ok) {
       const err = await response.json();
       // Throw specific error so we know it's the Insights step
       throw new Error(`Meta Insights Error: ${JSON.stringify(err)}`);
    }
    
    const json = await response.json();
    let data = json.data || [];
    
    // Safety check: If no data, return early to avoid crashes
    if (data.length === 0) return [];

    // --- STEP B: Fetch Creatives (The Visualizer) ---
    if (config?.enable_visuals) {
      console.log(`🎨 SENTINEL: Visuals enabled. Fetching thumbnails for ${data.length} ads...`);
      
      const adIds = data.map((row: any) => row.ad_id);
      
      // 1. Split IDs into chunks of 50 (Meta Limit)
      const batches = this.chunkArray(adIds, 50);
      let creativeMap: Record<string, any> = {};

      // 2. Process each batch
      for (const batch of batches) {
        try {
            const creativesUrl = `https://graph.facebook.com/v19.0/`;
            const creativeParams = new URLSearchParams({
                access_token: this.accessToken,
                ids: batch.join(','),
                fields: 'creative{thumbnail_url,image_url,title}' 
            });

            const batchRes = await fetch(`${creativesUrl}?${creativeParams.toString()}`);
            const batchJson = await batchRes.json();

            if (batchRes.ok) {
                // Merge this batch into our master map
                creativeMap = { ...creativeMap, ...batchJson };
            } else {
                console.warn('⚠️ SENTINEL: Warning - Failed to fetch a batch of visuals:', batchJson);
            }
        } catch (err) {
            console.error('⚠️ SENTINEL: Network error fetching visuals batch', err);
        }
      }
      
      // 3. Merge Image URLs back into the main Data array
      data = data.map((row: any) => {
        // Find the creative details in our map
        const adDetails = creativeMap[row.ad_id];
        const creative = adDetails?.creative || {};
        
        // Meta returns either thumbnail_url (video) or image_url (static)
        const finalImage = creative.thumbnail_url || creative.image_url || '';
        
        return {
          ...row,
          ad_image: finalImage,
          ad_headline: creative.title || '' 
        };
      });
      
      // DEBUG: Verify the first image found
      const firstImage = data.find((d: any) => d.ad_image)?.ad_image;
      if (firstImage) console.log('📸 DEBUG: Successfully retrieved an image URL:', firstImage);
    }

    return data;
  }
}