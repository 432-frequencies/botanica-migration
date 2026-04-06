import { supabase } from '@/api/supabaseClient';

export async function identifyPlant({ imageBase64, isAdminTest = false }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const res = await fetch('/api/identify-plant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageBase64, isAdminTest }),
  });

  if (res.status === 429) return { error: 'LIMIT_REACHED' };

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Identification failed');

  return data;
}
