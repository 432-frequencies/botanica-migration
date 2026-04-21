import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";

export async function deleteAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  let response;
  try {
    response = await fetch(createApiUrl("/api/delete-account"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    throw new Error("Impossible de contacter le serveur de suppression");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Unauthorized");
    }
    throw new Error(data?.error || "Account deletion failed");
  }

  return data;
}
