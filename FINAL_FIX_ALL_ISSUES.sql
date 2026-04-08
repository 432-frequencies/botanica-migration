-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔧 SOLUTION FINALE : CORRECTION COMPLÈTE DE TOUS LES PROBLÈMES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Exécutez ce script pour corriger TOUS les problèmes d'un coup
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. DIAGNOSTIC : Voir les contraintes actuelles ────────────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'plant_discoveries'::regclass
  AND conname LIKE '%rarity%';

-- ── 2. SUPPRIMER l'ancienne contrainte rarity si elle existe ──────────────────
ALTER TABLE plant_discoveries
DROP CONSTRAINT IF EXISTS plant_discoveries_rarity_check;

-- ── 3. CRÉER une nouvelle contrainte avec les bonnes valeurs françaises ───────
ALTER TABLE plant_discoveries
ADD CONSTRAINT plant_discoveries_rarity_check
CHECK (rarity IN ('commune', 'peu_commune', 'rare', 'legendaire'));

-- ── 4. MÊME CHOSE pour category (au cas où) ───────────────────────────────────
ALTER TABLE plant_discoveries
DROP CONSTRAINT IF EXISTS plant_discoveries_category_check;

ALTER TABLE plant_discoveries
ADD CONSTRAINT plant_discoveries_category_check
CHECK (category IN ('plant', 'bird', 'rock', 'fungus', 'tree', 'insect'));

-- ── 5. MÊME CHOSE pour biome (au cas où) ──────────────────────────────────────
ALTER TABLE plant_discoveries
DROP CONSTRAINT IF EXISTS plant_discoveries_biome_check;

ALTER TABLE plant_discoveries
ADD CONSTRAINT plant_discoveries_biome_check
CHECK (biome IN ('foret', 'prairie', 'montagne', 'bord_eau', 'urban', 'cote', 'inconnu'));

-- ── 6. S'ASSURER que common_name et scientific_name sont nullable ─────────────
ALTER TABLE plant_discoveries
ALTER COLUMN scientific_name DROP NOT NULL;

ALTER TABLE plant_discoveries
ALTER COLUMN common_name DROP NOT NULL;

-- ── 7. VÉRIFICATION FINALE : Voir toutes les contraintes ──────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'plant_discoveries'::regclass
ORDER BY conname;

-- ── 8. VÉRIFICATION : Voir les colonnes critiques ─────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND column_name IN (
    'user_id', 'user_email', 'common_name', 'scientific_name',
    'rarity', 'category', 'biome', 'points_earned',
    'ecological_role', 'biodiversity_importance'
  )
ORDER BY column_name;
