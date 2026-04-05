import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CONSTELLATION_ACHIEVEMENTS = [
  { id: 'star_gazer', title: 'Star Gazer', description: 'Unlocked 5 constellations', icon: '✦', threshold: 5, points: 75 },
  { id: 'astronomer', title: 'Astronomer', description: 'Unlocked 15 constellations', icon: '🔭', threshold: 15, points: 150 },
  { id: 'celestial_sage', title: 'Celestial Sage', description: 'Unlocked 30 constellations', icon: '🌌', threshold: 30, points: 300 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type = 'constellation', knowledge_id, latitude, longitude } = await req.json();

    if (!knowledge_id) return Response.json({ error: 'knowledge_id required' }, { status: 400 });

    // Check if already unlocked
    const existing = await base44.entities.UserKnowledgeProgress.filter({
      user_email: user.email,
      knowledge_id,
    });
    if (existing.length > 0) {
      return Response.json({ success: true, already_unlocked: true, points_awarded: 0, new_achievements: [] });
    }

    let points_awarded = 0;
    let item_title = '';

    if (type === 'constellation') {
      const items = await base44.entities.Constellation.filter({ id: knowledge_id });
      const constellation = items[0];
      if (!constellation) return Response.json({ error: 'Constellation not found' }, { status: 404 });
      points_awarded = constellation.points_awarded || 30;
      item_title = constellation.name_french || constellation.name_latin;
    } else {
      const items = await base44.entities.AncientKnowledge.filter({ id: knowledge_id });
      const knowledge = items[0];
      if (!knowledge) return Response.json({ error: 'Knowledge not found' }, { status: 404 });
      points_awarded = knowledge.points_awarded || 20;
      item_title = knowledge.title;
    }

    // Create UserKnowledgeProgress entry
    await base44.entities.UserKnowledgeProgress.create({
      user_email: user.email,
      knowledge_id,
      discovered_at: new Date().toISOString(),
      location_lat: latitude,
      location_lng: longitude,
      discovery_context: type,
    });

    // Update user points
    const profileList = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profileList[0];
    let new_achievements = [];

    if (profile) {
      const newTotal = (profile.total_points || 0) + points_awarded;
      await base44.asServiceRole.entities.UserProfile.update(profile.id, { total_points: newTotal });

      if (type === 'constellation') {
        // Count all constellation discoveries
        const allDiscoveries = await base44.entities.UserKnowledgeProgress.filter({ user_email: user.email });
        const constellationCount = allDiscoveries.filter(d => d.discovery_context === 'constellation').length;

        const existingAchievements = await base44.asServiceRole.entities.Achievement.filter({ user_email: user.email });
        const existingIds = new Set(existingAchievements.map(a => a.achievement_id));

        for (const ach of CONSTELLATION_ACHIEVEMENTS) {
          if (existingIds.has(ach.id)) continue;
          if (constellationCount >= ach.threshold) {
            await base44.asServiceRole.entities.Achievement.create({
              user_email: user.email,
              achievement_id: ach.id,
              title: ach.title,
              description: ach.description,
              icon: ach.icon,
              points_bonus: ach.points,
              unlocked_at: new Date().toISOString(),
            });
            new_achievements.push(ach);
            await base44.asServiceRole.entities.UserProfile.update(profile.id, {
              total_points: newTotal + ach.points,
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      already_unlocked: false,
      points_awarded,
      item_title,
      type,
      new_achievements,
    });
  } catch (error) {
    console.error('unlockKnowledge error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});