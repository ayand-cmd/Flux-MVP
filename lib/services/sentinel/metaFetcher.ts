// This is our "Stunt Double" for Facebook
export class MetaFetcher {
  
    // We don't need real tokens yet, so we just accept them to keep the interface the same
    constructor(private accessToken: string) {}
  
    /**
     * Generates fake data that LOOKS like real Facebook Insights
     */
    async getMockInsights() {
      // 1. Define some fake campaigns
      const campaigns = [
        { name: '🇮🇳 Diwali Sale - Top Funnel', budget: 5000 },
        { name: 'Retargeting - Cart Abandoners', budget: 2000 },
        { name: 'Brand Awareness - Reels', budget: 1500 }
      ];
  
      // 2. Generate random daily stats for them
      const insights = campaigns.map(camp => {
        // Random spend between 40% and 110% of budget
        const spend = Math.floor(camp.budget * (0.4 + Math.random() * 0.7)); 
        const impressions = Math.floor(spend * (20 + Math.random() * 10)); // ~50 CPM
        const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.02)); // ~1-2% CTR
        
        // THE INDIAN CONTEXT: Apply 18% GST
        const taxAmount = spend * 0.18;
        const totalCost = spend + taxAmount;
  
        return {
          campaign_name: camp.name,
          spend_raw: spend,           // What FB shows
          spend_tax: totalCost,       // What leaves the bank (Real Cost)
          impressions: impressions,
          clicks: clicks,
          roas: (1.5 + Math.random() * 3).toFixed(2) // Random ROAS between 1.5 and 4.5
        };
      });
  
      return insights;
    }
  }