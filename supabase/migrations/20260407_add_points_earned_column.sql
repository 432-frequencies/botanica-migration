-- Ajouter la colonne manquante points_earned à plant_discoveries
-- Cette colonne stocke les points XP gagnés pour chaque découverte

ALTER TABLE plant_discoveries
ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 10;

-- Vérifier que la colonne a bien été ajoutée
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND column_name = 'points_earned';
