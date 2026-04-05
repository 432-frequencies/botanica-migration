import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

function checkUnlockConditions(knowledge, latitude, longitude) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeason = getCurrentSeason();

  const type = knowledge.unlock_condition_type;

  if (type === 'time') {
    if (knowledge.unlock_time_start && knowledge.unlock_time_end) {
      const [sh, sm] = knowledge.unlock_time_start.split(':').map(Number);
      const [eh, em] = knowledge.unlock_time_end.split(':').map(Number);
      const now_mins = currentHour * 60 + currentMinutes;
      const start_mins = sh * 60 + (sm || 0);
      const end_mins = eh * 60 + (em || 0);
      if (start_mins > end_mins) {
        // Spans midnight
        if (now_mins < start_mins && now_mins > end_mins) return false;
      } else {
        if (now_mins < start_mins || now_mins > end_mins) return false;
      }
    }
    return true;
  }

  if (type === 'season') {
    if (knowledge.unlock_season && knowledge.unlock_season !== '' && knowledge.unlock_season !== currentSeason) return false;
    return true;
  }

  if (type === 'location') {
    if (latitude != null && longitude != null) {
      if (knowledge.unlock_latitude_min != null && latitude < knowledge.unlock_latitude_min) return false;
      if (knowledge.unlock_latitude_max != null && latitude > knowledge.unlock_latitude_max) return false;
    }
    return true;
  }

  // plant and achievement types — always considered "unlockable" from proximity perspective
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { latitude, longitude, radius_km = 50, category } = await req.json();

    const filter = { is_active: true };
    if (category) filter.category = category;

    const allKnowledge = await base44.entities.AncientKnowledge.filter(filter);

    const result = allKnowledge.map((k) => {
      // Calculate deterministic pseudo-location from ID for items without coordinates
      let distance_km = null;
      if (latitude != null && longitude != null) {
        // Use a pseudo-location based on hash of ID if no real lat/lng stored
        const hash = k.id ? k.id.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0) : 0;
        const pseudoLat = latitude + ((hash % 1000) - 500) / 10000;
        const pseudoLng = longitude + ((Math.floor(hash / 1000) % 1000) - 500) / 10000;
        distance_km = Math.round(haversineKm(latitude, longitude, pseudoLat, pseudoLng) * 10) / 10;
      }

      const conditions_met = checkUnlockConditions(k, latitude, longitude);

      return { ...k, distance_km, conditions_met };
    });

    // Filter by radius
    const nearby = result.filter((k) => k.distance_km == null || k.distance_km <= radius_km);

    // Sort by distance
    nearby.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));

    return Response.json({ knowledge: nearby, count: nearby.length });
  } catch (error) {
    console.error('getNearbyKnowledge error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});