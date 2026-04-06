import { supabase } from '@/api/supabaseClient';

export async function searchTaxon(scientificName) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const res = await fetch('/api/inaturalist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'search_taxon', scientificName }),
  });

  if (!res.ok) throw new Error('Failed to search taxon');
  return await res.json();
}

export async function getTaxonPhotos(taxonId, limit = 8) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const res = await fetch('/api/inaturalist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'get_photos', taxonId, limit }),
  });

  if (!res.ok) throw new Error('Failed to get photos');
  return await res.json();
}

export async function getNearbyObservations(lat, lng, radius = 50, limit = 10) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const res = await fetch('/api/inaturalist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'get_nearby', lat, lng, radius, limit }),
  });

  if (!res.ok) throw new Error('Failed to get observations');
  return await res.json();
}
