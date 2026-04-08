-- ============================================================
-- BOTANICA — Schéma Supabase complet
-- À coller dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ─────────────────────────────────────────
-- 1. USER_PROFILES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email                  TEXT NOT NULL UNIQUE,
  is_pro                      BOOLEAN NOT NULL DEFAULT false,
  total_points                INTEGER NOT NULL DEFAULT 0,
  total_plants                INTEGER NOT NULL DEFAULT 0,
  daily_identifications_count INTEGER NOT NULL DEFAULT 0,
  daily_reset_date            DATE,
  rank                        TEXT NOT NULL DEFAULT 'Débutant',
  onboarding_completed        BOOLEAN NOT NULL DEFAULT false,
  last_scan_date              TIMESTAMPTZ,
  last_scan_lat               DOUBLE PRECISION,
  last_scan_lng               DOUBLE PRECISION,
  display_name                TEXT,
  avatar_url                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.email() = user_email);

CREATE POLICY "users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 2. PLANT_DISCOVERIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plant_discoveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email        TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'plant'
                      CHECK (category IN ('plant','bird','rock','fungus','tree','insect')),
  is_cannabis       BOOLEAN NOT NULL DEFAULT false,
  strain_type       TEXT DEFAULT '',
  common_name       TEXT NOT NULL,
  scientific_name   TEXT,
  family            TEXT,
  photo_url         TEXT,
  thumbnail_url     TEXT,
  rarity            TEXT NOT NULL DEFAULT 'commune'
                      CHECK (rarity IN ('commune','peu_commune','rare','legendaire')),
  is_edible         BOOLEAN NOT NULL DEFAULT false,
  is_toxic          BOOLEAN NOT NULL DEFAULT false,
  biome             TEXT NOT NULL DEFAULT 'inconnu'
                      CHECK (biome IN ('foret','prairie','montagne','bord_eau','urban','cote','inconnu')),
  description       TEXT,
  edibility_details TEXT,
  medicinal_uses    TEXT,
  anecdote          TEXT,
  habitat           TEXT,
  ecological_role   TEXT,
  biodiversity_importance TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  location_name     TEXT,
  confidence        DOUBLE PRECISION,
  api_data          JSONB,
  points_earned     INTEGER NOT NULL DEFAULT 10,
  discovered_date   DATE,
  flag_suspicious   BOOLEAN NOT NULL DEFAULT false,
  anomalies         JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plant_discoveries_user_email_idx ON plant_discoveries(user_email);
CREATE INDEX IF NOT EXISTS plant_discoveries_created_at_idx ON plant_discoveries(created_at DESC);

ALTER TABLE plant_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own discoveries"
  ON plant_discoveries FOR SELECT
  USING (auth.email() = user_email);

CREATE POLICY "users can insert own discoveries"
  ON plant_discoveries FOR INSERT
  WITH CHECK (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 3. USER_TRUST_SCORES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_trust_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email          TEXT NOT NULL UNIQUE,
  trust_score         INTEGER NOT NULL DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100),
  violations          JSONB NOT NULL DEFAULT '{"speed_anomalies":0,"spam_incidents":0,"farming_attempts":0,"suspicious_patterns":0}'::jsonb,
  last_violation      TIMESTAMPTZ,
  blocked_until       TIMESTAMPTZ,
  surveillance_active BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_trust_scores ENABLE ROW LEVEL SECURITY;

-- Trust scores: lecture seule par le propriétaire (écriture réservée aux API routes avec service_role)
CREATE POLICY "users can read own trust score"
  ON user_trust_scores FOR SELECT
  USING (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 4. LEADERBOARD
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  city          TEXT,
  region        TEXT,
  country       TEXT,
  country_code  TEXT,
  total_plants  INTEGER NOT NULL DEFAULT 0,
  weekly_plants INTEGER NOT NULL DEFAULT 0,
  monthly_plants INTEGER NOT NULL DEFAULT 0,
  plant_count   INTEGER NOT NULL DEFAULT 0,
  tree_count    INTEGER NOT NULL DEFAULT 0,
  bird_count    INTEGER NOT NULL DEFAULT 0,
  insect_count  INTEGER NOT NULL DEFAULT 0,
  rock_count    INTEGER NOT NULL DEFAULT 0,
  fungus_count  INTEGER NOT NULL DEFAULT 0,
  edible_count  INTEGER NOT NULL DEFAULT 0,
  toxic_count   INTEGER NOT NULL DEFAULT 0,
  forest_count  INTEGER NOT NULL DEFAULT 0,
  total_points  INTEGER NOT NULL DEFAULT 0,
  rank          TEXT NOT NULL DEFAULT 'Scout',
  last_updated  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Lecture publique du leaderboard
CREATE POLICY "leaderboard is public"
  ON leaderboard FOR SELECT
  USING (true);

CREATE POLICY "users can upsert own leaderboard entry"
  ON leaderboard FOR INSERT
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "users can update own leaderboard entry"
  ON leaderboard FOR UPDATE
  USING (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 5. ZONE_LEADERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_leaders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id       TEXT NOT NULL,
  user_email    TEXT NOT NULL,
  display_name  TEXT,
  species_count INTEGER NOT NULL DEFAULT 0,
  last_updated  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_id)
);

ALTER TABLE zone_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zone_leaders is public"
  ON zone_leaders FOR SELECT
  USING (true);

-- ─────────────────────────────────────────
-- 6. SEASONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons are public"
  ON seasons FOR SELECT
  USING (true);

-- ─────────────────────────────────────────
-- 7. SEASON_HISTORY
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email          TEXT NOT NULL,
  season_id           TEXT NOT NULL,
  season_name         TEXT NOT NULL,
  start_date          DATE,
  end_date            DATE,
  unique_species      INTEGER NOT NULL DEFAULT 0,
  total_observations  INTEGER NOT NULL DEFAULT 0,
  zones_led           INTEGER NOT NULL DEFAULT 0,
  rank_label          TEXT,
  title_earned        TEXT,
  badge_earned        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE season_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own season history"
  ON season_history FOR SELECT
  USING (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 8. WEEKLY_CHALLENGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active       BOOLEAN NOT NULL DEFAULT false,
  title           TEXT,
  description     TEXT,
  challenge_type  TEXT,
  category        TEXT,
  target_count    INTEGER NOT NULL DEFAULT 1,
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_challenges are public"
  ON weekly_challenges FOR SELECT
  USING (true);

-- ─────────────────────────────────────────
-- 9. CHALLENGE_PROGRESS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    TEXT NOT NULL,
  challenge_id  UUID REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  current_count INTEGER NOT NULL DEFAULT 0,
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_email, challenge_id)
);

ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own challenge progress"
  ON challenge_progress FOR SELECT
  USING (auth.email() = user_email);

CREATE POLICY "users can upsert own challenge progress"
  ON challenge_progress FOR INSERT
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "users can update own challenge progress"
  ON challenge_progress FOR UPDATE
  USING (auth.email() = user_email);

-- ─────────────────────────────────────────
-- 10. AMBASSADORS (Système d'affiliation)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambassadors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  contact_email  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambassadors_code ON ambassadors(code) WHERE is_active = true;

ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ambassadors"
  ON ambassadors FOR SELECT TO authenticated
  USING (is_active = true);

-- ─────────────────────────────────────────
-- 11. AMBASSADOR_CONTRACTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambassador_contracts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id      UUID NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  valid_from         DATE NOT NULL,
  valid_until        DATE,
  rate_type          TEXT NOT NULL CHECK (rate_type IN ('percentage', 'fixed')),
  rate_value         NUMERIC(10,2) NOT NULL,
  grace_period_days  INTEGER NOT NULL DEFAULT 30,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_rate_value CHECK (rate_value > 0)
);

CREATE INDEX IF NOT EXISTS idx_contracts_ambassador_dates
  ON ambassador_contracts(ambassador_id, valid_from, valid_until);

ALTER TABLE ambassador_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contracts"
  ON ambassador_contracts FOR SELECT TO authenticated
  USING (true);

-- ─────────────────────────────────────────
-- 12. MODIFICATIONS USER_PROFILES (Affiliation)
-- ─────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT REFERENCES ambassadors(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by ON user_profiles(referred_by_code)
  WHERE referred_by_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_pro_status ON user_profiles(is_pro, pro_since)
  WHERE is_pro = true;

-- ─────────────────────────────────────────
-- 13. HELPER FUNCTION: Récupérer contrat actif
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_active_contract(
  p_ambassador_code TEXT,
  p_at_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  contract_id UUID,
  rate_type TEXT,
  rate_value NUMERIC,
  grace_period_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT ac.id, ac.rate_type, ac.rate_value, ac.grace_period_days
  FROM ambassador_contracts ac
  JOIN ambassadors a ON a.id = ac.ambassador_id
  WHERE a.code = p_ambassador_code
    AND a.is_active = true
    AND ac.valid_from <= p_at_date
    AND (ac.valid_until IS NULL OR ac.valid_until + ac.grace_period_days >= p_at_date)
  ORDER BY ac.valid_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────
-- 14. VIEW: Stats ambassadeurs
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW ambassador_stats AS
SELECT
  a.code,
  a.name,
  a.contact_email,
  a.is_active,

  -- Compteurs
  COUNT(DISTINCT up.user_email) FILTER (WHERE up.referred_by_code = a.code)
    as total_referrals,
  COUNT(DISTINCT up.user_email) FILTER (WHERE up.referred_by_code = a.code AND up.is_pro = false)
    as free_users,
  COUNT(DISTINCT up.user_email) FILTER (WHERE up.referred_by_code = a.code AND up.is_pro = true)
    as pro_users,

  -- Commission estimée (mois en cours)
  (
    SELECT
      CASE
        WHEN ac.rate_type = 'percentage' THEN
          COUNT(DISTINCT up2.user_email) * 5.00 * (ac.rate_value / 100)
        WHEN ac.rate_type = 'fixed' THEN
          COUNT(DISTINCT up2.user_email) * ac.rate_value
        ELSE 0
      END
    FROM user_profiles up2
    CROSS JOIN LATERAL get_active_contract(a.code, CURRENT_DATE) AS ac
    WHERE up2.referred_by_code = a.code
      AND up2.is_pro = true
      AND (up2.pro_until IS NULL OR up2.pro_until >= CURRENT_DATE)
  ) as estimated_monthly_commission,

  -- Contrat actuel (JSON)
  (
    SELECT json_build_object(
      'rate_type', ac.rate_type,
      'rate_value', ac.rate_value,
      'valid_from', ac.valid_from,
      'valid_until', ac.valid_until,
      'grace_period_days', ac.grace_period_days
    )
    FROM ambassador_contracts ac
    WHERE ac.ambassador_id = a.id
    ORDER BY ac.valid_from DESC
    LIMIT 1
  ) as current_contract

FROM ambassadors a
LEFT JOIN user_profiles up ON up.referred_by_code = a.code
GROUP BY a.id, a.code, a.name, a.contact_email, a.is_active;

-- ─────────────────────────────────────────
-- FIN DU SCRIPT
-- ─────────────────────────────────────────
