// worker.ts
// IMPORTANT: Load .env.local BEFORE any imports that use process.env
// Use require() which executes immediately, before ES6 imports are hoisted
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Make sure .env.local exists and contains DATABASE_URL.');
  process.exit(1);
}

import { query } from './lib/db'; // Your existing DB connection
import { RealMetaFetcher } from './lib/services/sentinel/realMetaFetcher'; // Your fetcher
import { SheetService } from './lib/services/courier/sheetService'; // Your sheet writer

async function runSync() {
  console.log('💪 WORKER: Starting Sync Job...');

  try {
    // 1. Fetch all fluxes (This mimics your autosync route logic)
    // NOTE: Adjust the query if your schema is slightly different
    const fluxes = await query('SELECT * FROM fluxes'); 
    
    console.log(`💪 WORKER: Found ${fluxes.rows.length} fluxes to process.`);

    for (const flux of fluxes.rows) {
      console.log(`Processing Flux ID: ${flux.id} for User: ${flux.user_id}`);
      
      try {
        // --- COPY OF YOUR LOGIC FROM autosync/route.ts ---
        
        // 1. Setup Sentinel (Fetcher)
        // You'll need to fetch the tokens for this user first. 
        // I'm assuming you have a helper or join for this, but let's keep it raw for now.
        // FIX: Query by 'id', not 'email'
const userResult = await query('SELECT * FROM users WHERE id = $1', [flux.user_id]);
        const user = userResult.rows[0];
        
        if (!user) {
            console.error(`User ${flux.user_id} not found. Skipping.`);
            continue;
        }

        const sentinel = new RealMetaFetcher(user.fb_exchange_token, flux.ad_account_id);
        const courier = new SheetService(user.google_refresh_token);

        // 2. Extract (Get Data)
        const config = flux.config ? (typeof flux.config === 'string' ? JSON.parse(flux.config) : flux.config) : null;
        const destinationMapping = flux.destination_mapping 
          ? (typeof flux.destination_mapping === 'string' ? JSON.parse(flux.destination_mapping) : flux.destination_mapping)
          : { raw_data_tab: 'Sheet1', analysis_tab: 'Analysis' };
        const data = await sentinel.getInsights(config);
        
        // Debug: Check if data includes image field
        if (data.length > 0) {
            console.log("📸 DEBUG CHECK: Does the first row have an image?", data[0].ad_image);
        }
        
        // 3. Load (Write Data)
        await courier.syncData(flux.spreadsheet_id, data, destinationMapping, config);

        // 4. Update Timestamp
        await query('UPDATE fluxes SET last_synced_at = NOW() WHERE id = $1', [flux.id]);

        console.log(`✅ Success: Flux ${flux.id}`);
        
      } catch (fluxError) {
        console.error(`❌ Failed: Flux ${flux.id}`, fluxError);
        // Don't crash the whole worker just because one flux failed
      }
    }

    console.log('💪 WORKER: Job Complete.');
    process.exit(0); // Tell the computer we are done successfully

  } catch (error) {
    console.error('🔥 WORKER CRITICAL FAILURE:', error);
    process.exit(1); // Tell the computer we crashed
  }
}

// Execute
runSync();