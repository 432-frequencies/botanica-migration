import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";

export async function syncPremiumStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(createApiUrl("/api/premium-status"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error || "Impossible de vérifier l'abonnement");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return {
    configured: Boolean(data?.configured),
    isPremium: Boolean(data?.is_premium),
    entitlementId: data?.entitlement_id || "premium",
    expirationDate: data?.expiration_date || null,
    purchaseDate: data?.purchase_date || null,
    productIdentifier: data?.product_identifier || null,
    willRenew: Boolean(data?.will_renew),
    managementURL: data?.management_url || null,
    source: data?.source || "server",
  };
}
