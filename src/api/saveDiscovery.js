import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";

export async function saveDiscovery(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { error: "Unauthorized" };
  }

  const response = await fetch(createApiUrl("/api/save-discovery"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { error: data?.error || "Impossible d'enregistrer l'observation" };
  }

  return data;
}
