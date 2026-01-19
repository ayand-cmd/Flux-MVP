-- Migration: Create Creative Analytics tables
-- Description: Creates dim_creatives and fact_creative_daily tables with RLS policies

-- Create dim_creatives table (The Library)
CREATE TABLE IF NOT EXISTS dim_creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    name TEXT,
    thumbnail_url TEXT,
    body_copy TEXT,
    headline TEXT,
    format TEXT,
    first_seen_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fact_creative_daily table (The Performance)
CREATE TABLE IF NOT EXISTS fact_creative_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creative_id UUID NOT NULL REFERENCES dim_creatives(id) ON DELETE CASCADE,
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
    UNIQUE(creative_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dim_creatives_platform_id ON dim_creatives(platform_id);
CREATE INDEX IF NOT EXISTS idx_dim_creatives_platform ON dim_creatives(platform);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_creative_id ON fact_creative_daily(creative_id);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_date ON fact_creative_daily(date);
CREATE INDEX IF NOT EXISTS idx_fact_creative_daily_creative_date ON fact_creative_daily(creative_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE dim_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_creative_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dim_creatives (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow read access to dim_creatives for authenticated users" ON dim_creatives;
CREATE POLICY "Allow read access to dim_creatives for authenticated users"
    ON dim_creatives
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policies for fact_creative_daily (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow read access to fact_creative_daily for authenticated users" ON fact_creative_daily;
CREATE POLICY "Allow read access to fact_creative_daily for authenticated users"
    ON fact_creative_daily
    FOR SELECT
    TO authenticated
    USING (true);

