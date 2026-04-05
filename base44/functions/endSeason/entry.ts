import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Titles based on seasonal unique species count
const SEASON_TITLES = [
  { min: 50, title: "Gardien du vivant saisonnier", badge: "🏆" },
  { min: 30, title: "Expert des saisons",            badge: "🌿" },
  { min: 15, title: "Naturaliste actif",             badge: "🔭" },
  { min: 5,  title: "Explorateur saisonnier",        badge: "🌱" },
];

function getTitle(uniqueCount) {
  for (const t of SEASON_TITLES) {
    if (uniqueCount >= t.min) return t;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { season_id } = await req.json();
    if (!season_id) return Response.json({ error: 'season_id required' }, { status: 400 });

    // Get season
    const seasons = await base44.asServiceRole.entities.Season.filter({ id: season_id });
    if (seasons.length === 0) return Response.json({ error: 'Season not found' }, { status: 404 });
    const season = seasons[0];

    // Close season
    await base44.asServiceRole.entities.Season.update(season.id, { is_active: false });

    // Get all users who have discoveries during this season
    const allDiscoveries = await base44.asServiceRole.entities.PlantDiscovery.list('-created_date', 5000);
    const seasonDiscoveries = allDiscoveries.filter(d =>
      d.discovered_date && d.discovered_date >= season.start_date && d.discovered_date <= season.end_date
    );

    // Group by user
    const byUser = {};
    for (const d of seasonDiscoveries) {
      if (!byUser[d.user_email]) byUser[d.user_email] = [];
      byUser[d.user_email].push(d);
    }

    // Count zone leads per user
    const allZones = await base44.asServiceRole.entities.ZoneLeader.list();
    const zonesByUser = {};
    for (const z of allZones) {
      zonesByUser[z.user_email] = (zonesByUser[z.user_email] || 0) + 1;
    }

    // Create SeasonHistory for each user
    const results = [];
    for (const [email, discs] of Object.entries(byUser)) {
      const uniqueSpecies = new Set(discs.map(d => (d.common_name || '').toLowerCase())).size;
      const t = getTitle(uniqueSpecies);

      // Check if history already exists
      const existing = await base44.asServiceRole.entities.SeasonHistory.filter({
        user_email: email, season_id: season.id
      });
      if (existing.length > 0) continue;

      await base44.asServiceRole.entities.SeasonHistory.create({
        user_email: email,
        season_id: season.id,
        season_name: season.name,
        start_date: season.start_date,
        end_date: season.end_date,
        unique_species: uniqueSpecies,
        total_observations: discs.length,
        zones_led: zonesByUser[email] || 0,
        rank_label: t?.title || 'Participant',
        title_earned: t?.title || null,
        badge_earned: t?.badge || null,
      });

      results.push({ email, uniqueSpecies, title: t?.title });
    }

    return Response.json({ success: true, season: season.name, processed: results.length, results });

  } catch (error) {
    console.error('endSeason error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});