-- Script de diagnostic pour vérifier la structure actuelle de plant_discoveries
-- Exécutez ce script pour voir quelles colonnes existent actuellement

-- 1. Vérifier si la table existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'plant_discoveries'
) AS table_exists;

-- 2. Lister TOUTES les colonnes existantes dans la table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Compter le nombre de colonnes
SELECT COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND table_schema = 'public';
