-- ============================================================================
-- FIX COMPLET: ZoneExplorer RLS + Permissions
-- ============================================================================
-- Date: 2026-04-08
-- Raison: ZoneExplorer doit pouvoir afficher les découvertes de tous les
--         utilisateurs dans une zone géographique pour exploration collaborative
--
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce SQL
-- 3. Exécutez
-- ============================================================================

-- 1. Vérifier que reference_species a bien RLS publique
ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_species_public_read" ON reference_species;
CREATE POLICY "reference_species_public_read"
  ON reference_species FOR SELECT
  USING (true);

-- 2. Ajouter policy de lecture publique pour plant_discoveries
--    (sans supprimer la policy existante "users can read own discoveries")
DROP POLICY IF EXISTS "discoveries_public_zone_exploration" ON plant_discoveries;
CREATE POLICY "discoveries_public_zone_exploration"
  ON plant_discoveries FOR SELECT
  USING (true);

-- Note: Les deux policies sur plant_discoveries coexistent avec OR:
-- - "users can read own discoveries" (existante)
-- - "discoveries_public_zone_exploration" (nouvelle)
-- Résultat: tous les utilisateurs authentifiés peuvent voir toutes les découvertes

-- 3. Vérifier les permissions sur user_profiles (pour les noms d'utilisateurs)
-- La policy existante "users can read own profile" est trop restrictive
-- On ajoute une lecture publique des profils (user_email, pseudo, etc.)
DROP POLICY IF EXISTS "user_profiles_public_read" ON user_profiles;
CREATE POLICY "user_profiles_public_read"
  ON user_profiles FOR SELECT
  USING (true);

-- ============================================================================
-- RÉSULTAT ATTENDU:
-- - ZoneExplorer peut charger reference_species ✓
-- - ZoneExplorer peut charger plant_discoveries de tous les users ✓
-- - ZoneExplorer peut afficher les noms d'utilisateurs (via user_profiles) ✓
-- ============================================================================
