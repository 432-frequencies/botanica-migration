-- Route public leaderboard reads through /api/leaderboard to avoid exposing raw emails.

DROP POLICY IF EXISTS "leaderboard is public" ON leaderboard;
DROP POLICY IF EXISTS "users can read own leaderboard entry by user_id" ON leaderboard;

CREATE POLICY "users can read own leaderboard entry by user_id"
  ON leaderboard FOR SELECT
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR
    (
      user_id IS NULL
      AND lower(coalesce(auth.jwt() ->> 'email', '')) = lower(user_email)
    )
  );
