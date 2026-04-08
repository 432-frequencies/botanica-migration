import { supabase } from '@/api/supabaseClient';

export async function identifyPlant({ imageBase64, isAdminTest = false }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const url = '/api/identify-plant';
  const bodyData = { imageBase64, isAdminTest };

  console.log('[identifyPlant] Making request:', {
    url,
    method: 'POST',
    imageLength: imageBase64?.length,
    imageStart: imageBase64?.substring(0, 30),
    hasSession: !!session,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(bodyData),
  });

  console.log('[identifyPlant] Response received:', {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
  });

  if (res.status === 429) return { error: 'LIMIT_REACHED' };

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Identification failed');

  return data;
}
