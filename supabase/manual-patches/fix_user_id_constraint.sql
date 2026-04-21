-- Correction du problème user_id NOT NULL
-- Le code utilise user_email comme identifiant, donc user_id doit être nullable

-- Option 1 : Rendre user_id nullable (RECOMMANDÉ)
ALTER TABLE plant_discoveries
ALTER COLUMN user_id DROP NOT NULL;

-- Vérifier que la modification a été appliquée
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'plant_discoveries'
  AND column_name IN ('user_id', 'user_email');
