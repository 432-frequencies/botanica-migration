-- Foundation migration for moving the app from email-based identity toward user_id.
-- This migration is additive and keeps legacy email policies alive for compatibility.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE plant_discoveries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE leaderboard
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE zone_leaders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS plant_discoveries_user_id_idx ON plant_discoveries(user_id);
CREATE INDEX IF NOT EXISTS leaderboard_user_id_idx ON leaderboard(user_id);
CREATE INDEX IF NOT EXISTS zone_leaders_user_id_idx ON zone_leaders(user_id);

UPDATE user_profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.user_id IS NULL
  AND lower(p.user_email) = lower(u.email);

UPDATE plant_discoveries d
SET user_id = u.id
FROM auth.users u
WHERE d.user_id IS NULL
  AND lower(d.user_email) = lower(u.email);

UPDATE leaderboard l
SET user_id = u.id
FROM auth.users u
WHERE l.user_id IS NULL
  AND lower(l.user_email) = lower(u.email);

UPDATE zone_leaders z
SET user_id = u.id
FROM auth.users u
WHERE z.user_id IS NULL
  AND lower(z.user_email) = lower(u.email);

DROP POLICY IF EXISTS "users can read own profile by user_id" ON user_profiles;
CREATE POLICY "users can read own profile by user_id"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert own profile by user_id" ON user_profiles;
CREATE POLICY "users can insert own profile by user_id"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own profile by user_id" ON user_profiles;
CREATE POLICY "users can update own profile by user_id"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can read own discoveries by user_id" ON plant_discoveries;
CREATE POLICY "users can read own discoveries by user_id"
  ON plant_discoveries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert own discoveries by user_id" ON plant_discoveries;
CREATE POLICY "users can insert own discoveries by user_id"
  ON plant_discoveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can upsert own leaderboard entry by user_id" ON leaderboard;
CREATE POLICY "users can upsert own leaderboard entry by user_id"
  ON leaderboard FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own leaderboard entry by user_id" ON leaderboard;
CREATE POLICY "users can update own leaderboard entry by user_id"
  ON leaderboard FOR UPDATE
  USING (auth.uid() = user_id);
