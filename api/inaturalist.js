import { createClient } from '@supabase/supabase-js';

// Rate limiting: 60 req/min, 10k/jour max
// iNaturalist API publique, pas de clé requise

const INATURALIST_API = 'https://api.inaturalist.org/v1';

// ─── Helper: auth middleware ──────────────────────────────────────────────────

async function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return { error: 'Unauthorized', status: 401 };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };

  return { user, supabase };
}

// ─── Endpoint: recherche taxon par nom ────────────────────────────────────────

async function searchTaxon(scientificName) {
  const res = await fetch(
    `${INATURALIST_API}/taxa?q=${encodeURIComponent(scientificName)}&per_page=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

// ─── Endpoint: photos réelles d'une espèce ────────────────────────────────────

async function getTaxonPhotos(taxonId, limit = 8) {
  const res = await fetch(
    `${INATURALIST_API}/observations?taxon_id=${taxonId}&quality_grade=research&has[]=photos&per_page=${limit}&order=desc&order_by=votes`
  );
  if (!res.ok) return [];

  const data = await res.json();
  return data.results.map(obs => ({
    photo_url: obs.photos[0]?.url?.replace('square', 'medium') || obs.photos[0]?.url,
    thumbnail_url: obs.photos[0]?.url,
    observer: obs.user?.login || 'Anonymous',
    observed_on: obs.observed_on,
    place_guess: obs.place_guess,
    license: obs.photos[0]?.license_code || 'all-rights-reserved',
    attribution: obs.photos[0]?.attribution,
  }));
}

// ─── Endpoint: observations récentes ──────────────────────────────────────────

async function getRecentObservations(lat, lng, radius = 50, limit = 10) {
  const res = await fetch(
    `${INATURALIST_API}/observations?lat=${lat}&lng=${lng}&radius=${radius}&quality_grade=research&has[]=photos&per_page=${limit}&order=desc&order_by=observed_on`
  );
  if (!res.ok) return [];

  const data = await res.json();
  return data.results.map(obs => ({
    taxon_name: obs.taxon?.name,
    common_name: obs.taxon?.preferred_common_name,
    photo_url: obs.photos[0]?.url?.replace('square', 'medium'),
    observer: obs.user?.login,
    observed_on: obs.observed_on,
    place_guess: obs.place_guess,
  }));
}

// ─── Endpoint: espèces fantômes (locales non observées) ───────────────────────

async function getGhostSpecies(lat, lng, observedSpeciesIds, radius = 10, limit = 15) {
  const res = await fetch(
    `${INATURALIST_API}/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}&quality_grade=research&has[]=photos&per_page=50&verifiable=true&geoprivacy=open`
  );
  if (!res.ok) return [];

  const data = await res.json();
  const observed = new Set(observedSpeciesIds.map(id => String(id).toLowerCase().trim()));

  // Filter: exclude already observed + obscured
  const ghosts = data.results
    .filter(sp => {
      const sci = String(sp.taxon?.name || '').toLowerCase().trim();
      const common = String(sp.taxon?.preferred_common_name || '').toLowerCase().trim();
      return !observed.has(sci) && !observed.has(common) && sp.taxon?.default_photo;
    })
    .slice(0, limit)
    .map(sp => ({
      scientific_name: sp.taxon.name,
      common_name: sp.taxon.preferred_common_name || sp.taxon.name,
      category: mapInatIconToCategory(sp.taxon.iconic_taxon_name),
      photo_url: sp.taxon.default_photo.medium_url || sp.taxon.default_photo.url,
      rank: sp.taxon.rank,
      count: sp.count,
      rarity: estimateRarity(sp.count),
      taxon_id: sp.taxon.id,
      is_ghost: true
    }));

  return ghosts;
}

// Helper: map iNaturalist iconic taxon to W1LD categories
function mapInatIconToCategory(iconicTaxon) {
  const mapping = {
    'Plantae': 'plant',
    'Aves': 'bird',
    'Fungi': 'fungus',
    'Insecta': 'insect',
    'Arachnida': 'arachnid',
    'Mammalia': 'mammal',
    'Reptilia': 'reptile',
    'Amphibia': 'amphibian',
    'Animalia': 'animal',
    'Mollusca': 'mollusc'
  };
  return mapping[iconicTaxon] || 'plant';
}

// Helper: estimate rarity from observation count
function estimateRarity(count) {
  if (count >= 100) return 'commune';
  if (count >= 20) return 'peu_commune';
  if (count >= 5) return 'rare';
  return 'legendaire';
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, scientificName, taxonId, lat, lng, radius, limit } = req.body;

  try {
    switch (action) {
      case 'search_taxon':
        if (!scientificName) return res.status(400).json({ error: 'scientificName required' });
        const taxon = await searchTaxon(scientificName);
        return res.json({ taxon });

      case 'get_photos':
        if (!taxonId) return res.status(400).json({ error: 'taxonId required' });
        const photos = await getTaxonPhotos(taxonId, limit || 8);
        return res.json({ photos });

      case 'get_nearby':
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
        const observations = await getRecentObservations(lat, lng, radius || 50, limit || 10);
        return res.json({ observations });

      case 'get_ghost_species':
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
        const { observedSpeciesIds } = req.body;
        const ghosts = await getGhostSpecies(lat, lng, observedSpeciesIds || [], radius || 10, limit || 15);
        return res.json({ ghosts });

      default:
        return res.status(400).json({ error: 'Invalid action. Use: search_taxon, get_photos, get_nearby, get_ghost_species' });
    }
  } catch (error) {
    console.error('[inaturalist] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
