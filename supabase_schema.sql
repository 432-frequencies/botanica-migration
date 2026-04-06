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
  behavior          TEXT,
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
-- FIN DU SCRIPT
-- ─────────────────────────────────────────
