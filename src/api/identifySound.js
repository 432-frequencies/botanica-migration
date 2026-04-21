import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";
import { getStoredLanguage } from "@/lib/i18n";

const IS_DEV = import.meta.env.DEV;

export async function identifySound({
  audioBase64,
  mimeType,
  durationSeconds,
  soundType,
  frequencyAnalysis,
  environmentalContext
} = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Unauthorized");

  const response = await fetch(createApiUrl("/api/identify-plant"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      mode: "sound",
      audioBase64,
      mimeType,
      durationSeconds,
      soundType,
      language: getStoredLanguage(),
      // New enriched data
      frequencyAnalysis,
      environmentalContext,
    }),
  });

  const rawBody = await response.text();
  let data = null;

  if (rawBody?.trim()) {
    try {
      data = JSON.parse(rawBody);
    } catch (error) {
      const err = new Error("Réponse audio invalide");
      err.status = response.status;
      err.rawBody = rawBody.slice(0, 280);
      err.cause = error;
      throw err;
    }
  }

  if (IS_DEV) {
    console.log("[identifySound] response", {
      status: response.status,
      category: data?.category,
      commonName: data?.common_name,
    });
  }

  if (response.status === 429) return { error: "LIMIT_REACHED" };

  if (!response.ok) {
    const err = new Error(data?.error || "Identification audio impossible");
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}
