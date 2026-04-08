-- Migration pour ajouter les colonnes manquantes à plant_discoveries
-- Ce script ajoute toutes les colonnes qui manquent pour supporter la nouvelle structure

-- 1. Ajouter les colonnes de contenu (description, habitat, anecdote)
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS habitat TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS anecdote TEXT;

-- 1b. Ajouter les nouvelles colonnes pour le rôle écologique et l'importance biodiversité
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS ecological_role TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS biodiversity_importance TEXT;

-- 2. Ajouter les colonnes de détails (edibility_details, medicinal_uses)
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS edibility_details TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS medicinal_uses TEXT;

-- 3. Ajouter les colonnes de métadonnées (biome, location_name, confidence)
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS biome TEXT NOT NULL DEFAULT 'inconnu'
  CHECK (biome IN ('foret','prairie','montagne','bord_eau','urban','cote','inconnu'));
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;

-- 4. Ajouter les colonnes de flags et anomalies
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS flag_suspicious BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS anomalies JSONB;

-- 5. Ajouter les colonnes pour le cannabis (si vous voulez supporter cette catégorie)
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS is_cannabis BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS strain_type TEXT DEFAULT '';

-- 6. Ajouter la colonne api_data pour stocker les données brutes de l'API
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS api_data JSONB;

-- 7. Vérifier les colonnes existantes (pour validation)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
ORDER BY ordinal_position;
