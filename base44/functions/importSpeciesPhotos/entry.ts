import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Parse simple CSV
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    return obj;
  });
}

// Search Wikimedia Commons for a species photo
async function fetchWikimediaPhoto(latinName, commonName) {
  const query = latinName || commonName;
  const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl);
  if (res.ok) {
    const data = await res.json();
    if (data.thumbnail?.source) return data.thumbnail.source;
    if (data.originalimage?.source) return data.originalimage.source;
  }

  // Fallback: Wikimedia Commons search
  const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=600&origin=*`;
  const res2 = await fetch(commonsUrl);
  if (res2.ok) {
    const data2 = await res2.json();
    const pages = data2.query?.pages || {};
    for (const page of Object.values(pages)) {
      if (page.thumbnail?.source) return page.thumbnail.source;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { csvContent, dryRun = false } = await req.json();
    if (!csvContent) return Response.json({ error: 'csvContent required' }, { status: 400 });

    const rows = parseCSV(csvContent);
    const results = [];

    for (const row of rows) {
      const latinName = row['Nom_Latin'];
      const commonName = row['Nom_Commun'];

      if (!latinName && !commonName) {
        results.push({ name: 'unknown', status: 'skipped', reason: 'no name' });
        continue;
      }

      // Find matching discovery(ies) in DB
      let discoveries = [];
      if (latinName) {
        discoveries = await base44.asServiceRole.entities.PlantDiscovery.filter({ scientific_name: latinName });
      }
      if (discoveries.length === 0 && commonName) {
        discoveries = await base44.asServiceRole.entities.PlantDiscovery.filter({ common_name: commonName });
      }

      if (discoveries.length === 0) {
        results.push({ name: commonName, latin: latinName, status: 'not_found' });
        continue;
      }

      // Fetch photo from Wikipedia
      const photoUrl = await fetchWikimediaPhoto(latinName, commonName);

      if (!photoUrl) {
        results.push({ name: commonName, latin: latinName, status: 'no_photo_found' });
        continue;
      }

      if (!dryRun) {
        for (const disc of discoveries) {
          if (!disc.photo_url) {
            await base44.asServiceRole.entities.PlantDiscovery.update(disc.id, {
              photo_url: photoUrl,
              thumbnail_url: photoUrl,
            });
          }
        }
      }

      results.push({
        name: commonName,
        latin: latinName,
        status: dryRun ? 'dry_run_ok' : 'updated',
        photo_url: photoUrl,
        count: discoveries.length,
      });
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const noPhoto = results.filter(r => r.status === 'no_photo_found').length;

    return Response.json({ success: true, total: rows.length, updated, notFound, noPhoto, results });
  } catch (error) {
    console.error('importSpeciesPhotos error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});