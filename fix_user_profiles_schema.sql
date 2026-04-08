-- ============================================================
-- BOTANICA — Schéma complet user_profiles
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Colonnes core (stats + XP)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_plants INTEGER DEFAULT 0;

-- Colonnes daily limits
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_identifications_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;

-- Colonnes progression
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'Débutant';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Colonnes scan tracking
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_scan_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_scan_lat DOUBLE PRECISION;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_scan_lng DOUBLE PRECISION;

-- Colonnes profile
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Colonnes premium
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;

-- Vérifier le schéma final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;
