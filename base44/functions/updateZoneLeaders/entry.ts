import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ZONE_DEG = 0.0045; // ~500m

function getZoneId(lat, lng) {
  return `${Math.floor(lat / ZONE_DEG)}_${Math.floor(lng / ZONE_DEG)}`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Get all user's discoveries with coordinates
  const discoveries = await base44.entities.PlantDiscovery.filter({ user_email: user.email });

  // Group by zone, count unique species
  const zoneMap = {};
  for (const d of discoveries) {
    if (!d.latitude || !d.longitude || !d.common_name) continue;
    const zid = getZoneId(d.latitude, d.longitude);
    if (!zoneMap[zid]) zoneMap[zid] = new Set();
    zoneMap[zid].add(d.common_name.toLowerCase().trim());
  }

  const results = [];

  for (const [zone_id, speciesSet] of Object.entries(zoneMap)) {
    const score = speciesSet.size;

    // Check existing leader for this zone
    const existing = await base44.asServiceRole.entities.ZoneLeader.filter({ zone_id });
    const currentLeader = existing[0] || null;

    const displayName = user.full_name || user.email.split('@')[0];

    if (!currentLeader) {
      // No leader — create one
      await base44.asServiceRole.entities.ZoneLeader.create({
        zone_id,
        user_email: user.email,
        display_name: displayName,
        species_count: score,
        last_updated: new Date().toISOString(),
      });
      results.push({ zone_id, action: 'created', score });
    } else if (currentLeader.user_email === user.email) {
      // User is already leader — update score
      await base44.asServiceRole.entities.ZoneLeader.update(currentLeader.id, {
        species_count: score,
        display_name: displayName,
        last_updated: new Date().toISOString(),
      });
      results.push({ zone_id, action: 'updated', score });
    } else if (score > currentLeader.species_count) {
      // User beats current leader — conquer zone
      await base44.asServiceRole.entities.ZoneLeader.update(currentLeader.id, {
        user_email: user.email,
        display_name: displayName,
        species_count: score,
        last_updated: new Date().toISOString(),
      });
      results.push({ zone_id, action: 'conquered', score, previous: currentLeader.display_name });
    } else {
      results.push({ zone_id, action: 'none', score, leader: currentLeader.display_name, leaderScore: currentLeader.species_count });
    }
  }

  return Response.json({
    zones_computed: Object.keys(zoneMap).length,
    results,
  });
});