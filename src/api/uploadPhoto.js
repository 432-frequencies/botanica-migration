import { supabase } from '@/api/supabaseClient';

/**
 * Upload une image vers Supabase Storage (bucket: discoveries).
 * Retourne l'URL publique, ou "" si échec (fallback silencieux).
 */
export async function uploadPhoto(dataUri) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";

    const blob = await fetch(dataUri).then(r => r.blob());
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('discoveries')
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (error) {
      console.error('[uploadPhoto] error:', error.message);
      return "";
    }

    const { data } = supabase.storage.from('discoveries').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[uploadPhoto] error:', err.message);
    return "";
  }
}
