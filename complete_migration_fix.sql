-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLÈTE - Ajoute TOUTES les colonnes manquantes à plant_discoveries
-- ═══════════════════════════════════════════════════════════════════════════════
-- Ce script est SAFE : utilise IF NOT EXISTS, n'écrase rien
-- Exécutez-le sur Supabase Dashboard > SQL Editor

-- ── Colonnes de base (identité) ────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ── Catégorie et classification ────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'plant';
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS common_name TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS scientific_name TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS family TEXT;

-- ── Photos ──────────────────────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ── Rareté et confiance ─────────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'commune';
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;

-- ── Flags alimentaires et toxicité ──────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS is_edible BOOLEAN DEFAULT false;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS is_toxic BOOLEAN DEFAULT false;

-- ── Cannabis (si applicable) ────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS is_cannabis BOOLEAN DEFAULT false;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS strain_type TEXT DEFAULT '';

-- ── Biome et localisation ───────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS biome TEXT DEFAULT 'inconnu';
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS location_name TEXT;

-- ── Descriptions et contenus ────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS habitat TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS anecdote TEXT;

-- ⭐ NOUVELLES COLONNES : RÔLE ÉCOLOGIQUE ET BIODIVERSITÉ ⭐
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS ecological_role TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS biodiversity_importance TEXT;

-- ── Détails avancés (Pro) ───────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS edibility_details TEXT;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS medicinal_uses TEXT;

-- ── Métadonnées et points ───────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 10;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS discovered_date DATE;

-- ── Flags de sécurité ───────────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS flag_suspicious BOOLEAN DEFAULT false;
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS anomalies JSONB;

-- ── Données brutes de l'API ─────────────────────────────────────────────────────
ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS api_data JSONB;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Afficher toutes les colonnes après migration
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND table_schema = 'public'
ORDER BY ordinal_position;
