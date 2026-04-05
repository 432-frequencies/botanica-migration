import { supabase } from '@/api/supabaseClient';

/**
 * MVP saveDiscovery — insère une découverte et met à jour le profil.
 * Ne fait jamais crasher l'app : toute erreur retourne un fallback.
 * Retourne { xp_earned, level, is_new_species, new_achievements }
 */
export async function saveDiscovery(data) {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { error: 'Unauthorized' };

    const userEmail = authUser.email;
    const today = new Date().toISOString().split('T')[0];

    // Vérifie si c'est une nouvelle espèce pour cet utilisateur
    const { count } = await supabase
      .from('plant_discoveries')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', userEmail)
      .eq('common_name', data.common_name || '');

    const isNewSpecies = count === 0;
    const xpEarned = isNewSpecies ? 10 : 5;

    // Insère la découverte
    const { error: insertError } = await supabase.from('plant_discoveries').insert({
      user_email: userEmail,
      category: data.category || 'plant',
      common_name: data.common_name || null,
      scientific_name: data.scientific_name || null,
      photo_url: data.photo_url || null,
      points_earned: xpEarned,
      discovered_date: today,
    });

    if (insertError) return { error: insertError.message };

    // Met à jour le profil (best-effort)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, total_points, total_plants')
      .eq('user_email', userEmail)
      .single();

    let newTotal = xpEarned;
    if (profile) {
      newTotal = (profile.total_points || 0) + xpEarned;
      await supabase.from('user_profiles').update({
        total_points: newTotal,
        total_plants: (profile.total_plants || 0) + (isNewSpecies ? 1 : 0),
        last_scan_date: today,
      }).eq('user_email', userEmail);
    }

    return {
      xp_earned: xpEarned,
      is_new_species: isNewSpecies,
      total_points: newTotal,
      level: Math.floor(newTotal / 100) + 1,
      new_achievements: [],
    };
  } catch (err) {
    console.error('[saveDiscovery] error:', err.message);
    return { xp_earned: 10, is_new_species: false, level: 1, new_achievements: [] };
  }
}
