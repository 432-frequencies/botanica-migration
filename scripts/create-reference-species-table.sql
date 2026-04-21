-- Table de référence des espèces W1LD
-- Utilisée comme base de données pour les "Ghost Species"

CREATE TABLE IF NOT EXISTS reference_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Taxonomie
  scientific_name TEXT NOT NULL UNIQUE,
  common_name TEXT NOT NULL,
  family TEXT,
  category TEXT NOT NULL DEFAULT 'plant',

  -- Caractéristiques
  rarity TEXT DEFAULT 'commune',
  confidence INTEGER DEFAULT 95,

  -- Descriptions
  habitat TEXT,
  description TEXT,
  behavior TEXT,
  anecdote TEXT,

  -- Localisation
  latitude FLOAT,
  longitude FLOAT,
  location_name TEXT,
  biome TEXT DEFAULT 'inconnu',

  -- Médias
  photo_url TEXT,
  thumbnail_url TEXT,

  -- Propriétés alimentaires
  is_edible BOOLEAN DEFAULT false,
  is_toxic BOOLEAN DEFAULT false,
  edibility_details TEXT,
  medicinal_uses TEXT,

  -- Métadonnées
  source TEXT DEFAULT 'reference_database',
  is_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Contraintes
  CONSTRAINT valid_category CHECK (category IN ('plant', 'bird', 'fungus', 'tree', 'insect', 'arachnid', 'rock', 'mammal', 'amphibian', 'reptile')),
  CONSTRAINT valid_rarity CHECK (rarity IN ('commune', 'peu_commune', 'rare', 'legendaire'))
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_reference_species_category ON reference_species(category);
CREATE INDEX IF NOT EXISTS idx_reference_species_rarity ON reference_species(rarity);
CREATE INDEX IF NOT EXISTS idx_reference_species_scientific ON reference_species(scientific_name);
CREATE INDEX IF NOT EXISTS idx_reference_species_location ON reference_species(latitude, longitude);

-- Index géospatial pour recherches par proximité (optionnel - nécessite PostGIS)
-- CREATE INDEX IF NOT EXISTS idx_reference_species_geog ON reference_species USING GIST (geography(ST_MakePoint(longitude, latitude)));

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reference_species_updated_at BEFORE UPDATE
    ON reference_species FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vue pour statistiques
CREATE OR REPLACE VIEW reference_species_stats AS
SELECT
  category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE rarity = 'legendaire') as legendaires,
  COUNT(*) FILTER (WHERE rarity = 'rare') as rares,
  COUNT(*) FILTER (WHERE rarity = 'peu_commune') as peu_communes,
  COUNT(*) FILTER (WHERE rarity = 'commune') as communes
FROM reference_species
GROUP BY category;

-- RLS (Row Level Security) - Lecture publique, écriture admin uniquement
ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read reference species"
  ON reference_species FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert reference species"
  ON reference_species FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' LIKE '%@w1ld.app');

CREATE POLICY "Only admins can update reference species"
  ON reference_species FOR UPDATE
  USING (auth.jwt() ->> 'email' LIKE '%@w1ld.app');

-- Grant accès
GRANT SELECT ON reference_species TO anon, authenticated;
GRANT ALL ON reference_species TO service_role;
GRANT SELECT ON reference_species_stats TO anon, authenticated;

COMMENT ON TABLE reference_species IS 'Base de données de référence des espèces W1LD pour le système Ghost Species';
COMMENT ON COLUMN reference_species.source IS 'Source de la donnée : reference_database, import_csv, user_contribution';
COMMENT ON COLUMN reference_species.is_verified IS 'Espèce vérifiée par l\'équipe W1LD';
