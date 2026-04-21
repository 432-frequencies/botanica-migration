import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Increment daily scan count for user
 * Automatically resets if last reset was > 24h ago
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('daily_scans_count, daily_scans_reset_at, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[increment-daily-scans] Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // Check if we need to reset (more than 24h since last reset)
    const lastReset = new Date(profile.daily_scans_reset_at);
    const now = new Date();
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

    let newCount;
    let resetAt;

    if (hoursSinceReset >= 24) {
      // Reset to 1 (current scan)
      newCount = 1;
      resetAt = now.toISOString();
    } else {
      // Increment
      newCount = (profile.daily_scans_count || 0) + 1;
      resetAt = profile.daily_scans_reset_at;
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        daily_scans_count: newCount,
        daily_scans_reset_at: resetAt
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[increment-daily-scans] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update scan count' });
    }

    return res.json({
      success: true,
      daily_scans_count: newCount,
      daily_scans_reset_at: resetAt,
      subscription_tier: profile.subscription_tier
    });

  } catch (error) {
    console.error('[increment-daily-scans] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
