-- Stores a conservative, explicit safety status without relying only on
-- ambiguous boolean defaults.
ALTER TABLE public.plant_discoveries
  ADD COLUMN IF NOT EXISTS edibility_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS safety_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plant_discoveries_edibility_status_check'
      AND conrelid = 'public.plant_discoveries'::regclass
  ) THEN
    ALTER TABLE public.plant_discoveries
      ADD CONSTRAINT plant_discoveries_edibility_status_check
      CHECK (edibility_status IN ('edible', 'toxic', 'non_edible', 'unknown'));
  END IF;
END $$;

UPDATE public.plant_discoveries
SET edibility_status = CASE
  WHEN is_toxic IS TRUE THEN 'toxic'
  WHEN is_edible IS TRUE THEN 'edible'
  ELSE 'unknown'
END
WHERE edibility_status IS NULL OR edibility_status = 'unknown';

UPDATE public.plant_discoveries
SET safety_notes = CASE
  WHEN category = 'arachnid' THEN 'Observe sans manipuler. En cas de morsure douloureuse, nettoie, applique du froid et demande un avis medical.'
  WHEN category = 'insect' THEN 'Observe sans manipuler si l''espece pique, mord ou irrite. En cas de reaction forte, demande un avis medical.'
  WHEN category = 'fungus' THEN 'Information indicative: ne jamais consommer un champignon sans verification experte locale.'
  ELSE 'Information indicative - ne pas consommer sans verification experte.'
END
WHERE safety_notes IS NULL
  AND category IN ('plant', 'tree', 'fungus', 'insect', 'arachnid')
  AND edibility_status IN ('edible', 'toxic', 'unknown');
