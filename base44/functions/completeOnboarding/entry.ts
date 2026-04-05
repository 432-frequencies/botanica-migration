import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[completeOnboarding] 401 — auth.me() returned null (possible mobile session issue)');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[completeOnboarding] user authenticated:', user.email);

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];

    if (profile) {
      await base44.asServiceRole.entities.UserProfile.update(profile.id, { onboarding_completed: true });
    } else {
      await base44.asServiceRole.entities.UserProfile.create({
        user_email: user.email,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: new Date().toISOString().split('T')[0],
        rank: 'Scout',
        onboarding_completed: true
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});