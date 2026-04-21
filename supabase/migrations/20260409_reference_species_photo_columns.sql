ALTER TABLE reference_species
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE reference_species
ADD COLUMN IF NOT EXISTS photo_attribution TEXT;

ALTER TABLE reference_species
ADD COLUMN IF NOT EXISTS photo_source TEXT;

UPDATE reference_species
SET
  photo_url = description,
  photo_source = COALESCE(photo_source, 'legacy_description')
WHERE photo_url IS NULL
  AND description ~ '^https?://';

CREATE INDEX IF NOT EXISTS idx_reference_species_photo_url
ON reference_species (photo_url)
WHERE photo_url IS NOT NULL;
