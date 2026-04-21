import { supabase } from '@/api/supabaseClient';
import { createApiUrl } from "@/lib/app-config";
import { getStoredLanguage } from "@/lib/i18n";

const IS_DEV = import.meta.env.DEV;

export async function identifyPlant({ imageBase64, isAdminTest = false }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const url = createApiUrl('/api/identify-plant');
  const bodyData = { imageBase64, isAdminTest, language: getStoredLanguage() };

  if (IS_DEV) {
    console.log('[identifyPlant] Making request:', {
      url,
      method: 'POST',
      imageLength: imageBase64?.length,
      hasSession: !!session,
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(bodyData),
  });

  if (IS_DEV) {
    console.log('[identifyPlant] Response received:', {
      status: res.status,
      statusText: res.statusText,
    });
  }

  const rawBody = await res.text();
  const bodyPreview = rawBody?.slice(0, 280) || '';
  if (IS_DEV) {
    console.log('[identifyPlant] Response body preview:', bodyPreview);
  }

  let data = null;
  if (rawBody?.trim()) {
    try {
      data = JSON.parse(rawBody);
    } catch (parseError) {
      const err = new Error('Réponse serveur invalide');
      err.status = res.status;
      err.rawBody = bodyPreview;
      err.cause = parseError;
      throw err;
    }
  }

  if (res.status === 429) return { error: 'LIMIT_REACHED' };

  if (!res.ok) {
    const err = new Error(data?.error || 'Identification failed');
    err.status = res.status;
    err.payload = data;
    err.rawBody = bodyPreview;
    throw err;
  }

  if (!data || typeof data !== 'object') {
    const err = new Error('Réponse vide du serveur');
    err.status = res.status;
    err.rawBody = bodyPreview;
    throw err;
  }

  return data;
}
