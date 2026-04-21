-- Permet la validation des codes influenceur depuis l'écran d'inscription
-- pour les visiteurs non connectés (rôle anon).

DROP POLICY IF EXISTS "Anyone can view active ambassadors" ON ambassadors;

CREATE POLICY "Anyone can view active ambassadors"
  ON ambassadors FOR SELECT TO anon, authenticated
  USING (is_active = true);

