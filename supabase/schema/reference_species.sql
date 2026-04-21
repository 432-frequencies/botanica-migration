-- Table pour les espèces de référence (base de données fixe)
-- Ces espèces sont toujours visibles sur la carte territoriale

CREATE TABLE IF NOT EXISTS reference_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  category TEXT NOT NULL DEFAULT 'plant',
  rarity TEXT DEFAULT 'commune',
  photo_url TEXT,
  photo_attribution TEXT,
  photo_source TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index géographique pour requêtes spatiales rapides
CREATE INDEX IF NOT EXISTS idx_reference_species_location
ON reference_species (latitude, longitude);

-- Index par catégorie
CREATE INDEX IF NOT EXISTS idx_reference_species_category
ON reference_species (category);

-- Index par rareté
CREATE INDEX IF NOT EXISTS idx_reference_species_rarity
ON reference_species (rarity);

-- Row Level Security (RLS) : Lecture publique
ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des espèces de référence" ON reference_species;
CREATE POLICY "Lecture publique des espèces de référence"
ON reference_species FOR SELECT
TO PUBLIC
USING (true);

-- Seuls les admins peuvent insérer/modifier
DROP POLICY IF EXISTS "Admin seulement pour modifications" ON reference_species;
CREATE POLICY "Admin seulement pour modifications"
ON reference_species FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

COMMENT ON TABLE reference_species IS 'Espèces de référence (base de données fixe) affichées sur la carte territoriale';
