-- Tables manquantes détectées le 2026-04-06
-- À coller dans Supabase > SQL Editor > New query

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
CREATE POLICY "leaderboard is public" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "users can insert own leaderboard entry" ON leaderboard FOR INSERT WITH CHECK (auth.email() = user_email);
CREATE POLICY "users can update own leaderboard entry" ON leaderboard FOR UPDATE USING (auth.email() = user_email);

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
CREATE POLICY "weekly_challenges are public" ON weekly_challenges FOR SELECT USING (true);

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
CREATE POLICY "users can read own challenge progress" ON challenge_progress FOR SELECT USING (auth.email() = user_email);
CREATE POLICY "users can insert own challenge progress" ON challenge_progress FOR INSERT WITH CHECK (auth.email() = user_email);
CREATE POLICY "users can update own challenge progress" ON challenge_progress FOR UPDATE USING (auth.email() = user_email);
