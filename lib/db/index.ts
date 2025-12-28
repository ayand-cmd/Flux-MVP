import { Pool } from 'pg';

// Supabase requires SSL. This config ensures we connect securely.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This allows connection from your local machine to the cloud
  }
});

/**
 * Database Schema - users table must have these columns:
 * - email (PRIMARY KEY) - User's Google email address
 * - google_refresh_token - Google OAuth refresh token
 * - spreadsheet_id - Google Sheets spreadsheet ID
 * - fb_exchange_token - Facebook long-lived exchange token
 * - ad_account_id - Facebook Ad Account ID
 * - facebook_email - User's Facebook email address
 */
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};