import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const KNOWLEDGE_ACHIEVEMENTS = [
  { id: 'knowledge_seeker', title: 'Knowledge Seeker', description: 'Discovered 10 pieces of ancient wisdom', icon: '📜', threshold: 10, points: 50 },
  { id: 'ancient_scholar', title: 'Ancient Scholar', description: 'Discovered 25 pieces of ancient wisdom', icon: '🏛️', threshold: 25, points: 100 },
  { id: 'sage', title: 'Sage', description: 'Discovered 50 pieces of ancient wisdom', icon: '🧙', threshold: 50, points: 200 },
  { id: 'star_gazer', title: 'Star Gazer', description: 'Discovered 5 celestial constellations', icon: '✦', threshold: 5, points: 75, category: 'constellation' },
];

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

function verifyUnlockConditions(knowledge, latitude, longitude) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeason = getCurrentSeason();
  const type = knowledge.unlock_condition_type;

  if (!type) return true;

  if (type === 'time') {
    if (knowledge.unlock_time_start && knowledge.unlock_time_end) {
      const [sh, sm] = knowledge.unlock_time_start.split(':').map(Number);
      const [eh, em] = knowledge.unlock_time_end.split(':').map(Number);
      const now_mins = currentHour * 60 + currentMinutes;
      const start_mins = sh * 60 + (sm || 0);
      const end_mins = eh * 60 + (em || 0);
      if (start_mins > end_mins) {
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
    if (knowledge.unlock_latitude_min != null && latitude < knowledge.unlock_latitude_min) return false;
    if (knowledge.unlock_latitude_max != null && latitude > knowledge.unlock_latitude_max) return false;
    return true;
  }

  // plant / achievement — skip condition check (handled separately in app)
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { knowledge_id, latitude, longitude } = await req.json();

    // Check if already discovered
    const existing = await base44.entities.UserKnowledgeProgress.filter({
      user_email: user.email,
      knowledge_id,
    });
    if (existing.length > 0) {
      return Response.json({ error: 'Already discovered' }, { status: 400 });
    }

    // Get knowledge
    const knowledgeList = await base44.entities.AncientKnowledge.filter({ id: knowledge_id });
    const knowledge = knowledgeList[0];
    if (!knowledge) return Response.json({ error: 'Knowledge not found' }, { status: 404 });

    // Verify unlock conditions
    const conditionsMet = verifyUnlockConditions(knowledge, latitude, longitude);
    if (!conditionsMet) {
      return Response.json({ error: 'Conditions not met', conditions: knowledge.unlock_condition_type }, { status: 403 });
    }

    // Create discovery entry
    await base44.entities.UserKnowledgeProgress.create({
      user_email: user.email,
      knowledge_id,
      discovered_at: new Date().toISOString(),
      location_lat: latitude,
      location_lng: longitude,
      discovery_context: knowledge.category,
    });

    // Update user points
    const profileList = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profileList[0];
    const points_awarded = knowledge.points_awarded || 20;
    let new_achievements = [];

    if (profile) {
      const newTotal = (profile.total_points || 0) + points_awarded;
      await base44.asServiceRole.entities.UserProfile.update(profile.id, { total_points: newTotal });

      // Get all user's knowledge discoveries to check achievements
      const allDiscoveries = await base44.entities.UserKnowledgeProgress.filter({ user_email: user.email });
      const totalCount = allDiscoveries.length;
      const constellationCount = allDiscoveries.filter(d => d.discovery_context === 'constellation').length;

      // Check existing achievements
      const existingAchievements = await base44.asServiceRole.entities.Achievement.filter({ user_email: user.email });
      const existingIds = new Set(existingAchievements.map(a => a.achievement_id));

      for (const ach of KNOWLEDGE_ACHIEVEMENTS) {
        if (existingIds.has(ach.id)) continue;
        const count = ach.category === 'constellation' ? constellationCount : totalCount;
        if (count >= ach.threshold) {
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
          // Add bonus points
          await base44.asServiceRole.entities.UserProfile.update(profile.id, {
            total_points: newTotal + ach.points,
          });
        }
      }
    }

    return Response.json({
      success: true,
      points_awarded,
      knowledge_title: knowledge.title,
      new_achievements,
    });
  } catch (error) {
    console.error('discoverKnowledge error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});