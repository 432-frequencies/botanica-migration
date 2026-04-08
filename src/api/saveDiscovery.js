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

    // Ensure common_name is never null/empty (DB constraint)
    const commonName = data.common_name?.trim() || 'Spécimen observé';

    // Vérifie si c'est une nouvelle espèce pour cet utilisateur
    const { count } = await supabase
      .from('plant_discoveries')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', userEmail)
      .eq('common_name', commonName);

    const isNewSpecies = count === 0;
    // Système XP amélioré : nouvelle espèce = 15 XP, duplicate = 8 XP
    const xpEarned = isNewSpecies ? 15 : 8;

    // Insère la découverte
    const insertPayload = {
      user_email: userEmail,
      category: data.category || 'plant',
      common_name: commonName,
      scientific_name: data.scientific_name?.trim() || null,
      family: data.family?.trim() || null,
      photo_url: data.photo_url || null,
      rarity: data.rarity || 'commune',
      is_edible: data.is_edible ?? false,
      is_toxic: data.is_toxic ?? false,
      confidence: data.confidence || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      description: data.description?.trim() || null,
      habitat: data.habitat?.trim() || null,
      ecological_role: data.ecological_role?.trim() || null,
      biodiversity_importance: data.biodiversity_importance?.trim() || null,
      edibility_details: data.edibility_details?.trim() || null,
      medicinal_uses: data.medicinal_uses?.trim() || null,
      anecdote: data.anecdote?.trim() || null,
      points_earned: xpEarned,
      discovered_date: today,
    };

    console.log('[saveDiscovery] Inserting discovery:', { userEmail, commonName, category: insertPayload.category });

    const { data: insertedDiscovery, error: insertError } = await supabase
      .from('plant_discoveries')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[saveDiscovery] Insert error:', insertError);
      return { error: insertError.message };
    }

    console.log('[saveDiscovery] Successfully inserted discovery:', insertedDiscovery?.id);

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
