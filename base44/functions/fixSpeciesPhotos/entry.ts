import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fetch a relevant photo from Wikipedia for a species
async function getWikipediaPhoto(scientificName, commonName, category) {
  const queries = [scientificName, commonName].filter(Boolean);
  
  for (const query of queries) {
    try {
      // Try Wikipedia REST API first (best quality)
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res = await fetch(wikiUrl, { headers: { 'User-Agent': 'NatureGameApp/1.0' } });
      if (res.ok) {
        const data = await res.json();
        if (data.originalimage?.source) return data.originalimage.source;
        if (data.thumbnail?.source) return data.thumbnail.source;
      }
    } catch (_) {}

    try {
      // Try French Wikipedia
      const frUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res2 = await fetch(frUrl, { headers: { 'User-Agent': 'NatureGameApp/1.0' } });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.originalimage?.source) return data2.originalimage.source;
        if (data2.thumbnail?.source) return data2.thumbnail.source;
      }
    } catch (_) {}
  }

  // Fallback: Wikimedia Commons search
  try {
    const searchQuery = scientificName || commonName;
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=6&format=json&srlimit=1&origin=*`;
    const res3 = await fetch(commonsUrl);
    if (res3.ok) {
      const data3 = await res3.json();
      const title = data3.query?.search?.[0]?.title;
      if (title) {
        const imgUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
        const res4 = await fetch(imgUrl);
        if (res4.ok) {
          const data4 = await res4.json();
          const pages = data4.query?.pages || {};
          for (const page of Object.values(pages)) {
            const url = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
            if (url) return url;
          }
        }
      }
    }
  } catch (_) {}

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.email !== 'energynrj6@gmail.com')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { batchSize = 20, offset = 0, overwrite = false } = await req.json().catch(() => ({}));

    // Get all discoveries
    const all = await base44.asServiceRole.entities.PlantDiscovery.list('-created_date', 500);
    
    // Filter: either no photo or overwrite=true
    const toProcess = all
      .filter(d => overwrite || !d.photo_url)
      .slice(offset, offset + batchSize);

    const results = [];

    for (const disc of toProcess) {
      const photo = await getWikipediaPhoto(disc.scientific_name, disc.common_name, disc.category);
      
      if (photo) {
        await base44.asServiceRole.entities.PlantDiscovery.update(disc.id, {
          photo_url: photo,
          thumbnail_url: photo,
        });
        results.push({ id: disc.id, name: disc.common_name, latin: disc.scientific_name, status: 'updated', photo_url: photo });
      } else {
        results.push({ id: disc.id, name: disc.common_name, latin: disc.scientific_name, status: 'no_photo_found' });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const failed = results.filter(r => r.status === 'no_photo_found').length;
    const remaining = all.filter(d => overwrite || !d.photo_url).length - offset - batchSize;

    return Response.json({
      success: true,
      processed: results.length,
      updated,
      failed,
      remaining: Math.max(0, remaining),
      nextOffset: offset + batchSize,
      results
    });
  } catch (error) {
    console.error('fixSpeciesPhotos error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});