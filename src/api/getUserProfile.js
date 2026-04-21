import { supabase } from '@/api/supabaseClient';
import { resolveDisplayName } from '@/lib/displayName';
import { normalizeSpeciesRecord } from '@/lib/species';

const today = () => new Date().toISOString().split('T')[0];
const PROFILE_CACHE_TTL_MS = 30_000;
const DISCOVERY_CACHE_TTL_MS = 30_000;
const profileCache = new Map();
const discoveryCache = new Map();

export function invalidateUserDataCache(userEmail = null) {
  if (!userEmail) {
    profileCache.clear();
    discoveryCache.clear();
    return;
  }

  profileCache.delete(userEmail);
  discoveryCache.delete(userEmail);
}

function readCache(cache, key, ttlMs) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(cache, key, value) {
  cache.set(key, { value, ts: Date.now() });
  return value;
}

async function fetchProfileByEmail(userEmail, { forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = readCache(profileCache, userEmail, PROFILE_CACHE_TTL_MS);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_email', userEmail)
    .limit(1);

  if (error) throw error;
  return writeCache(profileCache, userEmail, data?.[0] || null);
}

async function createProfile(authUser, todayStr) {
  const basePayload = {
    user_email: authUser.email,
    user_id: authUser.id,
    display_name: resolveDisplayName({ fullName: authUser.user_metadata?.full_name, email: authUser.email }),
    is_pro: false,
    total_points: 0,
    total_plants: 0,
    daily_identifications_count: 0,
    daily_reset_date: todayStr,
    rank: 'Débutant',
    onboarding_completed: false,
  };

  let { data: created, error: createError } = await supabase
    .from('user_profiles')
    .insert(basePayload)
    .select()
    .single();

  if (createError && /column .*user_id.* does not exist/i.test(createError.message || "")) {
    const { user_id, ...fallbackPayload } = basePayload;
    ({ data: created, error: createError } = await supabase
      .from('user_profiles')
      .insert(fallbackPayload)
      .select()
      .single());
  }

  if (createError && /duplicate key value/i.test(createError.message || "")) {
    return fetchProfileByEmail(authUser.email, { forceFresh: true });
  }

  if (createError) throw createError;
  return writeCache(profileCache, authUser.email, created);
}

async function fetchDiscoveriesByEmail(userEmail, { forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = readCache(discoveryCache, userEmail, DISCOVERY_CACHE_TTL_MS);
    if (cached) return cached;
  }

  const { data: discoveries = [], error } = await supabase
    .from('plant_discoveries')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return writeCache(discoveryCache, userEmail, (discoveries || []).map(normalizeSpeciesRecord));
}

export async function getUserDiscoveries(userEmailOverride = null, options = {}) {
  let userEmail = userEmailOverride;

  if (!userEmail) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) throw new Error('Unauthorized');
    userEmail = authUser.email;
  }

  return fetchDiscoveriesByEmail(userEmail, options);
}

/**
 * Récupère ou crée le profil de l'utilisateur connecté.
 * Retourne { profile, user, achievements: [], challenges: [] }
 */
export async function getUserProfile(options = {}) {
  const { includeDiscoveries = false, forceFresh = false } = options;
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Unauthorized');

  const userEmail = authUser.email;
  const todayStr = today();

  // Cherche le profil existant
  let profile = await fetchProfileByEmail(userEmail, { forceFresh });

  const pendingCode = (() => {
    try {
      return localStorage.getItem('pending_ambassador_code')?.trim()?.toUpperCase() || null;
    } catch {
      return null;
    }
  })();

  const canAttachPendingCode = pendingCode && (
    !profile || (
      !profile.referred_by_code &&
      (profile.total_points || 0) === 0 &&
      (profile.total_plants || 0) === 0 &&
      (profile.daily_identifications_count || 0) === 0 &&
      profile.onboarding_completed !== true
    )
  );

  if (!profile) {
    profile = await createProfile(authUser, todayStr);
  } else if (!profile.user_id) {
    try {
      await supabase
        .from('user_profiles')
        .update({ user_id: authUser.id })
        .eq('user_email', userEmail);
    } catch {}
    profile.user_id = authUser.id;
    writeCache(profileCache, userEmail, profile);
  } else if (profile.daily_reset_date !== todayStr) {
    // Reset compteur journalier
    await supabase
      .from('user_profiles')
      .update({ daily_identifications_count: 0, daily_reset_date: todayStr })
      .eq('user_email', userEmail);
    profile.daily_identifications_count = 0;
    profile.daily_reset_date = todayStr;
    writeCache(profileCache, userEmail, profile);
  }

  if (canAttachPendingCode) {
    try {
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('code')
        .eq('code', pendingCode)
        .eq('is_active', true)
        .maybeSingle();

      if (ambassador) {
        const referredAt = new Date().toISOString();

        await supabase
          .from('user_profiles')
          .update({
            referred_by_code: pendingCode,
            referred_at: referredAt,
          })
          .eq('user_email', userEmail)
          .is('referred_by_code', null);

        profile.referred_by_code = pendingCode;
        profile.referred_at = referredAt;
        writeCache(profileCache, userEmail, profile);
      }
    } finally {
      try { localStorage.removeItem('pending_ambassador_code'); } catch {}
    }
  }

  const normalizedDiscoveries = includeDiscoveries
    ? await fetchDiscoveriesByEmail(userEmail, { forceFresh })
    : [];

  // Fetch subscription data from profiles table (new schema)
  let subscriptionData = null;
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status, daily_scans_count, daily_scans_reset_at')
      .eq('id', authUser.id)
      .maybeSingle();

    subscriptionData = profileData;
  } catch (err) {
    console.warn('[getUserProfile] Failed to fetch subscription data:', err);
  }

  // Merge subscription data into profile
  const enrichedProfile = {
    ...profile,
    subscription_tier: subscriptionData?.subscription_tier || 'free',
    subscription_status: subscriptionData?.subscription_status || 'active',
    daily_scans_count: subscriptionData?.daily_scans_count || 0,
    daily_scans_reset_at: subscriptionData?.daily_scans_reset_at || new Date().toISOString()
  };

  return {
    profile: enrichedProfile,
    user: {
      email: authUser.email,
      full_name: resolveDisplayName({
        displayName: profile?.display_name,
        fullName: authUser.user_metadata?.full_name,
        email: authUser.email,
      }),
    },
    discoveries: normalizedDiscoveries,
    achievements: [],
    challenges: [],
  };
}
