import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Only fetch what's needed for the home screen
    const [profiles, rawActiveChallenges] = await Promise.all([
      base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email }),
      base44.asServiceRole.entities.WeeklyChallenge.filter({ is_active: true }),
    ]);
    const activeChallenges = rawActiveChallenges || [];

    let profile = profiles[0];

    if (!profile) {
      profile = await base44.asServiceRole.entities.UserProfile.create({
        user_email: user.email,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: today,
        rank: 'Débutant',
        onboarding_completed: false
      });
    } else if (profile.daily_reset_date !== today) {
      profile.daily_identifications_count = 0;
      base44.asServiceRole.entities.UserProfile.update(profile.id, {
        daily_identifications_count: 0,
        daily_reset_date: today
      });
    }

    // Fetch challenge progress only if there are active challenges
    let challengesWithProgress = [];
    if (activeChallenges.length > 0) {
      const challengeProgresses = await base44.asServiceRole.entities.ChallengeProgress.filter({ user_email: user.email });
      challengesWithProgress = activeChallenges.map(c => {
        const prog = challengeProgresses.find(p => p.challenge_id === c.id);
        return { ...c, current_count: prog?.current_count || 0, is_completed: prog?.is_completed || false };
      });
    }

    return Response.json({
      profile,
      achievements: [],
      challenges: challengesWithProgress,
      user: { email: user.email, full_name: user.full_name }
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("getUserProfile error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});