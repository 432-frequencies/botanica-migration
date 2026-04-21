import { supabase } from '@/api/supabaseClient';

const IS_DEV = import.meta.env.DEV;
const MAX_UPLOAD_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload une image vers Supabase Storage (bucket: discoveries).
 * Retourne l'URL publique, ou "" si échec (fallback silencieux).
 */
export async function uploadPhoto(photoInput) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return "";
    }

    if (!user) {
      return "";
    }

    let blob = null;
    if (photoInput instanceof Blob) {
      blob = photoInput;
    } else if (typeof photoInput === "string" && photoInput) {
      blob = await fetch(photoInput).then(r => r.blob());
    }

    if (!blob) {
      return "";
    }

    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    let uploadData = null;
    let uploadError = null;
    let path = "";

    for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      path = `${user.id}/${Date.now()}-${attempt}.${ext}`;
      const response = await supabase.storage
        .from('discoveries')
        .upload(path, blob, {
          contentType: blob.type,
          upsert: false,
          cacheControl: '3600',
        });

      uploadData = response.data;
      uploadError = response.error;

      if (!uploadError) {
        break;
      }

      if (IS_DEV) {
        console.error('[uploadPhoto] upload failed:', uploadError.message, '| attempt:', attempt + 1);
      }

      if (attempt < MAX_UPLOAD_ATTEMPTS - 1) {
        await sleep(400 * (attempt + 1));
      }
    }

    if (uploadError) {
      return "";
    }

    const { data: urlData } = supabase.storage
      .from('discoveries')
      .getPublicUrl(path);

    if (!urlData || !urlData.publicUrl) {
      return "";
    }

    if (IS_DEV && uploadData?.path) {
      console.log('[uploadPhoto] upload success:', uploadData.path);
    }

    return urlData.publicUrl;
  } catch (err) {
    if (IS_DEV) {
      console.error('[uploadPhoto] unexpected error:', err?.message || err);
    }
    return "";
  }
}
