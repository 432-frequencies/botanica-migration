-- Migration: Add subscription tiers to profiles table
-- Run this in Supabase SQL editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS daily_scans_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_scans_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Add check constraint for valid tiers
ALTER TABLE profiles
ADD CONSTRAINT valid_subscription_tier
CHECK (subscription_tier IN ('free', 'pay_per_use', 'monthly_basic', 'monthly_pro', 'annual_basic', 'annual_pro'));

-- Add check constraint for valid status
ALTER TABLE profiles
ADD CONSTRAINT valid_subscription_status
CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive'));

-- Function to reset daily scans at midnight (called by cron job or trigger)
CREATE OR REPLACE FUNCTION reset_daily_scans()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET
    daily_scans_count = 0,
    daily_scans_reset_at = NOW()
  WHERE daily_scans_reset_at < NOW() - INTERVAL '1 day';
END;
$$;

-- Optional: Create a cron job to reset daily scans (requires pg_cron extension)
-- SELECT cron.schedule('reset-daily-scans', '0 0 * * *', 'SELECT reset_daily_scans()');

COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier: free, pay_per_use, monthly_basic, monthly_pro, annual_basic, annual_pro';
COMMENT ON COLUMN profiles.subscription_status IS 'Stripe subscription status: active, canceled, past_due, trialing, inactive';
COMMENT ON COLUMN profiles.daily_scans_count IS 'Number of scans today (resets at midnight)';
COMMENT ON COLUMN profiles.daily_scans_reset_at IS 'Last time daily_scans_count was reset';
