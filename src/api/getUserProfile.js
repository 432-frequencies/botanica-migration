import { supabase } from '@/api/supabaseClient';

const today = () => new Date().toISOString().split('T')[0];

/**
 * Récupère ou crée le profil de l'utilisateur connecté.
 * Retourne { profile, user, achievements: [], challenges: [] }
 */
export async function getUserProfile() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Unauthorized');

  const userEmail = authUser.email;
  const todayStr = today();

  // Cherche le profil existant
  let { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_email', userEmail)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

  if (!profile) {
    // Crée un profil minimal
    const { data: created, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        user_email: userEmail,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: todayStr,
        rank: 'Débutant',
        onboarding_completed: false,
      })
      .select()
      .single();
    if (createError) throw createError;
    profile = created;

    // Vérifier si un code ambassadeur est en attente
    const pendingCode = localStorage.getItem('pending_ambassador_code');

    if (pendingCode) {
      // Re-valider côté serveur (sécurité)
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('code')
        .eq('code', pendingCode)
        .eq('is_active', true)
        .single();

      if (ambassador) {
        await supabase
          .from('user_profiles')
          .update({
            referred_by_code: pendingCode,
            referred_at: new Date().toISOString()
          })
          .eq('user_email', userEmail);

        // Mettre à jour l'objet profile local
        profile.referred_by_code = pendingCode;
        profile.referred_at = new Date().toISOString();
      }

      // Nettoyer le localStorage
      localStorage.removeItem('pending_ambassador_code');
    }
  } else if (profile.daily_reset_date !== todayStr) {
    // Reset compteur journalier
    await supabase
      .from('user_profiles')
      .update({ daily_identifications_count: 0, daily_reset_date: todayStr })
      .eq('user_email', userEmail);
    profile.daily_identifications_count = 0;
    profile.daily_reset_date = todayStr;
  }

  // Récupérer les découvertes de l'utilisateur
  const { data: discoveries = [] } = await supabase
    .from('plant_discoveries')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });

  return {
    profile,
    user: {
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
    },
    discoveries: discoveries || [],
    achievements: [],
    challenges: [],
  };
}
