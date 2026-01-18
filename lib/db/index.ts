import { Pool } from 'pg';

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Make sure .env.local file exists and contains DATABASE_URL.');
}

// Supabase requires SSL. This config ensures we connect securely.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This allows connection from your local machine to the cloud
  }
});

/**
 * Database Schema - users table (identity and tokens only):
 * - email (PRIMARY KEY) - User's Google email address
 * - google_refresh_token - Google OAuth refresh token
 * - fb_exchange_token - Facebook long-lived exchange token
 * - facebook_email - User's Facebook email address
 * 
 * Legacy columns (kept for safety, not used in new logic):
 * - spreadsheet_id - Google Sheets spreadsheet ID (moved to fluxes)
 * - ad_account_id - Facebook Ad Account ID (moved to fluxes)
 */

/**
 * Database Schema - fluxes table (multi-tenant SaaS):
 * - id - Primary key
 * - user_id - Foreign key to users table
 * - name - Flux name/identifier
 * - ad_account_id - Facebook Ad Account ID
 * - spreadsheet_id - Google Sheets spreadsheet ID
 * - template_type - Template type for the flux
 * - last_synced_at - Timestamp of last successful sync
 */
export interface Flux {
  id: string;
  user_id: string;
  name: string;
  ad_account_id: string;
  spreadsheet_id: string;
  template_type?: string | null;
  last_synced_at?: Date | null;
}

/**
 * Flux with joined user data for sync operations
 */
export interface FluxWithUserData extends Flux {
  email: string;
  fb_exchange_token: string;
  google_refresh_token: string;
  config?: any; // JSONB config object
  destination_mapping?: any; // JSONB destination mapping object
}

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};