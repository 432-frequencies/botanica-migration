-- Fix pour permettre l'import des espèces de référence
-- À exécuter dans Supabase SQL Editor AVANT l'import

-- Option 1: Désactiver temporairement le RLS (recommandé pour l'import)
ALTER TABLE reference_species DISABLE ROW LEVEL SECURITY;

-- Après l'import, réactiver le RLS:
-- ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;

-- OU

-- Option 2: Modifier la policy pour permettre les inserts avec service key
-- (Cette option nécessite d'utiliser la service key dans le script)
DROP POLICY IF EXISTS "Admin seulement pour modifications" ON reference_species;
CREATE POLICY "Service role peut tout faire"
ON reference_species FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Après l'import, tu peux recréer la policy restrictive:
/*
DROP POLICY IF EXISTS "Service role peut tout faire" ON reference_species;
CREATE POLICY "Admin seulement pour modifications"
ON reference_species FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
*/
