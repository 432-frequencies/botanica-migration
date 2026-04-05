import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function getWikimediaPhoto(scientificName, commonName) {
  // Try Wikipedia API with scientific name first, then common name
  const queries = [scientificName, commonName].filter(Boolean);
  
  for (const query of queries) {
    try {
      // Search for the page
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: { 'User-Agent': 'NatureApp/1.0' } });
      if (res.ok) {
        const data = await res.json();
        const img = data.thumbnail?.source || data.originalimage?.source;
        if (img) {
          // Get higher resolution version
          const hiRes = img.replace(/\/\d+px-/, '/600px-');
          return hiRes;
        }
      }
    } catch (e) {
      console.error(`Wikipedia fetch error for ${query}:`, e.message);
    }
  }
  
  // Fallback: Wikimedia Commons search
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(scientificName)}&srnamespace=6&srlimit=1&format=json`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'NatureApp/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const hit = data.query?.search?.[0];
      if (hit) {
        const title = hit.title;
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`;
        const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': 'NatureApp/1.0' } });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          const pages = infoData.query?.pages || {};
          const page = Object.values(pages)[0];
          const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
          if (url) return url;
        }
      }
    }
  } catch (e) {
    console.error('Commons fallback error:', e.message);
  }
  
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { discovery_id } = body;

    // If specific discovery_id provided, fix just that one
    if (discovery_id) {
      const discoveries = await base44.asServiceRole.entities.PlantDiscovery.filter({ id: discovery_id });
      const d = discoveries[0];
      if (!d) return Response.json({ error: 'Not found' }, { status: 404 });
      
      const photoUrl = await getWikimediaPhoto(d.scientific_name, d.common_name);
      if (photoUrl) {
        await base44.asServiceRole.entities.PlantDiscovery.update(d.id, { photo_url: photoUrl, thumbnail_url: photoUrl });
        return Response.json({ success: true, photo_url: photoUrl });
      }
      return Response.json({ success: false, message: 'No photo found' });
    }

    // Fix all discoveries without photos (admin@01py.app sample data), batch mode
    const { offset = 0, batch_size = 15 } = body;
    const all1 = await base44.asServiceRole.entities.PlantDiscovery.filter({ user_email: 'admin@01py.app' });
    const all2 = await base44.asServiceRole.entities.PlantDiscovery.filter({ user_email: 'admin@w1ld.app' });
    const all = [...all1, ...all2];
    const withoutPhoto = all.filter(d => !d.photo_url);
    const batch = withoutPhoto.slice(offset, offset + batch_size);
    
    console.log(`Processing ${batch.length} specimens (offset ${offset}) — ${withoutPhoto.length} total without photo`);
    
    let updated = 0;
    let failed = 0;
    
    for (const d of batch) {
      const photoUrl = await getWikimediaPhoto(d.scientific_name, d.common_name);
      if (photoUrl) {
        await base44.asServiceRole.entities.PlantDiscovery.update(d.id, { photo_url: photoUrl, thumbnail_url: photoUrl });
        updated++;
        console.log(`✓ ${d.common_name}: ${photoUrl}`);
      } else {
        failed++;
        console.log(`✗ No photo for: ${d.common_name} (${d.scientific_name})`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    const remaining = withoutPhoto.length - offset - batch.length;
    return Response.json({ success: true, updated, failed, batch: batch.length, remaining, next_offset: offset + batch_size });

  } catch (error) {
    console.error('fetchSpeciesPhoto error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});