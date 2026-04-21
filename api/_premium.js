import { resolveDisplayName } from "../src/lib/displayName.js";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";
const REVENUECAT_ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || "premium";

function isMissingColumnError(error, columnName) {
  const message = error?.message || "";
  return message.includes(columnName) && /does not exist|schema cache/i.test(message);
}

function normalizeRevenueCatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function hasRevenueCatServerConfig() {
  return Boolean(process.env.REVENUECAT_SECRET_API_KEY);
}

export function extractPremiumStateFromRevenueCatSubscriber(subscriber) {
  const entitlement =
    subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_ID] ||
    subscriber?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID] ||
    null;

  const expiresDate =
    normalizeRevenueCatDate(entitlement?.expires_date || entitlement?.expirationDate) || null;
  const purchaseDate =
    normalizeRevenueCatDate(entitlement?.purchase_date || entitlement?.purchaseDate) || null;
  const unsubscribeDetectedAt =
    normalizeRevenueCatDate(entitlement?.unsubscribe_detected_at || entitlement?.unsubscribeDetectedAt) || null;

  const isActive = Boolean(entitlement) && (!expiresDate || new Date(expiresDate).getTime() > Date.now());

  return {
    configured: true,
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    isPremium: isActive,
    expirationDate: expiresDate,
    purchaseDate,
    willRenew: isActive ? !unsubscribeDetectedAt : false,
    productIdentifier:
      entitlement?.product_identifier ||
      entitlement?.productIdentifier ||
      null,
    source: "revenuecat",
  };
}

export async function fetchRevenueCatSubscriber(appUserId) {
  if (!hasRevenueCatServerConfig() || !appUserId) {
    return null;
  }

  const response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`RevenueCat subscriber fetch failed (${response.status}): ${body || "unknown error"}`);
  }

  const payload = await response.json();
  return payload?.subscriber || null;
}

async function upsertUserProfilePremium(adminClient, user, premiumState) {
  const { data: existingRows, error: selectError } = await adminClient
    .from("user_profiles")
    .select("user_email")
    .eq("user_email", user.email)
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  if (existingRows?.length) {
    const patch = {
      user_id: user.id,
      is_pro: premiumState.isPremium,
      pro_since: premiumState.purchaseDate,
      pro_until: premiumState.expirationDate,
    };
    const removableColumns = ["user_id", "pro_since", "pro_until"];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error } = await adminClient
        .from("user_profiles")
        .update(patch)
        .eq("user_email", user.email);

      if (!error) {
        return;
      }

      const removable = removableColumns.find((column) => column in patch && isMissingColumnError(error, column));
      if (removable) {
        delete patch[removable];
        continue;
      }

      throw error;
    }
  }

  const insertPayload = {
    user_email: user.email,
    user_id: user.id,
    display_name: resolveDisplayName({
      fullName: user.user_metadata?.full_name,
      email: user.email,
    }),
    is_pro: premiumState.isPremium,
    pro_since: premiumState.purchaseDate,
    pro_until: premiumState.expirationDate,
  };
  const removableColumns = ["user_id", "pro_since", "pro_until"];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await adminClient
      .from("user_profiles")
      .insert(insertPayload);

    if (!error) {
      return;
    }

    const removable = removableColumns.find((column) => column in insertPayload && isMissingColumnError(error, column));
    if (removable) {
      delete insertPayload[removable];
      continue;
    }

    throw error;
  }
}

export async function refreshPremiumStatusForUser({ adminClient, user, fallbackProfile = null }) {
  if (!user?.id || !user?.email) {
    return {
      configured: false,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
      isPremium: false,
      source: "none",
    };
  }

  if (!hasRevenueCatServerConfig()) {
    return {
      configured: false,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
      isPremium: Boolean(fallbackProfile?.is_pro),
      expirationDate: fallbackProfile?.pro_until || null,
      purchaseDate: fallbackProfile?.pro_since || null,
      productIdentifier: null,
      willRenew: false,
      source: "profile",
    };
  }

  const subscriber = await fetchRevenueCatSubscriber(user.id);
  const premiumState = extractPremiumStateFromRevenueCatSubscriber(subscriber);

  if (adminClient) {
    await upsertUserProfilePremium(adminClient, user, premiumState);
  }

  return premiumState;
}
