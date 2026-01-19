-- Migration: Add user_id to fact_creative_daily
-- Description: Adds user_id column to ensure data isolation between users (fixes data leak)

-- Drop the existing fact_creative_daily table (we're in dev, so this is safe)
DROP TABLE IF EXISTS fact_creative_daily;

-- Recreate fact_creative_daily with user_id column
CREATE TABLE fact_creative_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creative_id UUID NOT NULL REFERENCES dim_creatives(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    adset_id TEXT,
    adset_name TEXT,
    campaign_id TEXT,
    campaign_name TEXT,
    date DATE NOT NULL,
    spend NUMERIC(15, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    link_clicks INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue NUMERIC(15, 2) DEFAULT 0,
    currency TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ad_id, date, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_creative_id ON fact_creative_daily(creative_id);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_user_id ON fact_creative_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_ad_id ON fact_creative_daily(ad_id);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_date ON fact_creative_daily(date);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_ad_date ON fact_creative_daily(ad_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_campaign_id ON fact_creative_daily(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_user_date ON fact_creative_daily(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE fact_creative_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fact_creative_daily (users can only see their own data)
DROP POLICY IF EXISTS "Allow read access to fact_creative_daily for authenticated users" ON fact_creative_daily;
CREATE POLICY "Allow read access to fact_creative_daily for authenticated users"
    ON fact_creative_daily
    FOR SELECT
    TO authenticated
    USING (
        user_id IN (
            SELECT id FROM users 
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

