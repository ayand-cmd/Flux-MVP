import { Pool } from 'pg';

// Supabase requires SSL. This config ensures we connect securely.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This allows connection from your local machine to the cloud
  }
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};