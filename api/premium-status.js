import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserFromRequest } from "./_adminAuth.js";
import { refreshPremiumStatusForUser } from "./_premium.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthenticatedUserFromRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const premiumState = await refreshPremiumStatusForUser({
      adminClient,
      user: auth.user,
    });

    return res.status(200).json({
      configured: premiumState.configured,
      is_premium: premiumState.isPremium,
      entitlement_id: premiumState.entitlementId,
      expiration_date: premiumState.expirationDate || null,
      purchase_date: premiumState.purchaseDate || null,
      product_identifier: premiumState.productIdentifier || null,
      will_renew: Boolean(premiumState.willRenew),
      source: premiumState.source,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Impossible de vérifier l'abonnement pour le moment.",
      detail: error?.message || "unknown_error",
    });
  }
}
