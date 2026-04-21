import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserFromRequest } from "./_adminAuth.js";
import { resolveDisplayName } from "../src/lib/displayName.js";

const columnSupportCache = new Map();
const LEADERBOARD_COLUMNS = [
  "id",
  "user_email",
  "display_name",
  "rank",
  "total_plants",
  "weekly_plants",
  "monthly_plants",
  "total_points",
  "plant_count",
  "tree_count",
  "bird_count",
  "insect_count",
  "rock_count",
  "fungus_count",
  "edible_count",
  "toxic_count",
  "country",
  "country_code",
  "region",
  "city",
  "last_updated",
].join(", ");

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function isMissingColumnError(error, columnName) {
  const message = error?.message || "";
  return message.includes(columnName) && (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

async function tableHasColumn(adminClient, table, column) {
  const cacheKey = `${table}:${column}`;
  if (columnSupportCache.has(cacheKey)) {
    return columnSupportCache.get(cacheKey);
  }

  const { error } = await adminClient.from(table).select(column).limit(1);
  const supported = !error || !isMissingColumnError(error, column);
  columnSupportCache.set(cacheKey, supported);
  return supported;
}

function buildIdentityKey({ user_id, userId, user_email, userEmail } = {}, { preferUserId = true } = {}) {
  const id = user_id || userId;
  if (preferUserId && id) return `uid:${id}`;

  const email = normalizeEmail(user_email || userEmail);
  if (!email) return null;

  const digest = crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);
  return `legacy:${digest}`;
}

function sanitizeLeaderboardEntry(entry, options = {}) {
  if (!entry) return null;

  return {
    id: entry.id || null,
    identity_key: buildIdentityKey(entry, options),
    display_name: entry.display_name || "Observateur W1LD",
    rank: entry.rank || "Explorateur",
    total_plants: entry.total_plants || 0,
    weekly_plants: entry.weekly_plants || 0,
    monthly_plants: entry.monthly_plants || 0,
    total_points: entry.total_points || 0,
    plant_count: entry.plant_count || 0,
    tree_count: entry.tree_count || 0,
    bird_count: entry.bird_count || 0,
    insect_count: entry.insect_count || 0,
    rock_count: entry.rock_count || 0,
    fungus_count: entry.fungus_count || 0,
    edible_count: entry.edible_count || 0,
    toxic_count: entry.toxic_count || 0,
    country: entry.country || "",
    country_code: entry.country_code || "",
    region: entry.region || "",
    city: entry.city || "",
    last_updated: entry.last_updated || null,
  };
}

function buildFallbackEntry(user, profile, options = {}) {
  if (!user) return null;

  return sanitizeLeaderboardEntry({
    user_id: user.id,
    user_email: user.email,
    display_name: resolveDisplayName({
      displayName: profile?.display_name,
      fullName: user.user_metadata?.full_name,
      email: user.email,
    }),
    rank: profile?.rank || "Explorateur",
    total_plants: profile?.total_plants || 0,
    weekly_plants: 0,
    monthly_plants: 0,
    total_points: profile?.total_points || profile?.xp || 0,
    plant_count: profile?.total_plants || 0,
  }, options);
}

function toWarning(stage, error) {
  return {
    stage,
    code: error?.code || null,
    message: error?.message || "Erreur Supabase inconnue",
  };
}

async function maybeSingleByIdentity(adminClient, table, authUser, columns = "*") {
  const supportsUserId = await tableHasColumn(adminClient, table, "user_id");

  if (supportsUserId) {
    const { data, error } = await adminClient
      .from(table)
      .select(columns)
      .eq("user_id", authUser.id)
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data;
    }

    if (!isMissingColumnError(error, "user_id")) {
      throw error;
    }
  }

  const { data, error } = await adminClient
    .from(table)
    .select(columns)
    .eq("user_email", authUser.email)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchAcceptedFriendEmails(adminClient, authUser) {
  const [received, sent] = await Promise.all([
    adminClient
      .from("friend_requests")
      .select("sender_email")
      .eq("receiver_email", authUser.email)
      .eq("status", "accepted"),
    adminClient
      .from("friend_requests")
      .select("receiver_email")
      .eq("sender_email", authUser.email)
      .eq("status", "accepted"),
  ]);

  if (received.error) throw received.error;
  if (sent.error) throw sent.error;

  return Array.from(new Set([
    ...(received.data || []).map((row) => normalizeEmail(row.sender_email)),
    ...(sent.data || []).map((row) => normalizeEmail(row.receiver_email)),
  ].filter(Boolean)));
}

async function fetchProfilesByEmails(adminClient, emails) {
  if (!emails.length) return [];

  const { data, error } = await adminClient
    .from("user_profiles")
    .select("user_id, user_email")
    .in("user_email", emails);

  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthenticatedUserFromRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { user } = auth;
  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const warnings = [];
    const leaderboardSupportsUserId = false;
    const identityOptions = { preferUserId: leaderboardSupportsUserId };
    const [leaderboardRes, profileRes, friendEmailsRes] = await Promise.allSettled([
      adminClient
        .from("leaderboard")
        .select(LEADERBOARD_COLUMNS)
        .order("total_plants", { ascending: false })
        .limit(200),
      maybeSingleByIdentity(
        adminClient,
        "user_profiles",
        user,
        "user_id, user_email, display_name, total_points, total_plants, rank, xp",
      ),
      fetchAcceptedFriendEmails(adminClient, user),
    ]);

    let leaderboardRows = [];
    if (leaderboardRes.status === "fulfilled") {
      if (leaderboardRes.value.error) {
        warnings.push(toWarning("leaderboard", leaderboardRes.value.error));
        console.error("[leaderboard] Supabase leaderboard query failed:", leaderboardRes.value.error);
      } else {
        leaderboardRows = leaderboardRes.value.data || [];
      }
    } else {
      warnings.push(toWarning("leaderboard", leaderboardRes.reason));
      console.error("[leaderboard] Leaderboard query crashed:", leaderboardRes.reason);
    }

    let profile = null;
    if (profileRes.status === "fulfilled") {
      profile = profileRes.value || null;
    } else {
      warnings.push(toWarning("profile", profileRes.reason));
      console.error("[leaderboard] Profile query failed:", profileRes.reason);
    }

    let friendEmails = [];
    if (friendEmailsRes.status === "fulfilled") {
      friendEmails = friendEmailsRes.value || [];
    } else {
      warnings.push(toWarning("friends", friendEmailsRes.reason));
      console.error("[leaderboard] Friends query failed:", friendEmailsRes.reason);
    }

    let friendProfiles = [];
    try {
      friendProfiles = await fetchProfilesByEmails(adminClient, friendEmails);
    } catch (error) {
      warnings.push(toWarning("friend_profiles", error));
      console.error("[leaderboard] Friend profile query failed:", error);
    }

    const entries = leaderboardRows
      .map((entry) => sanitizeLeaderboardEntry(entry, identityOptions))
      .filter((entry) => Boolean(entry?.identity_key));
    const myIdentityKey = buildIdentityKey({ userId: user.id, userEmail: user.email }, identityOptions);
    const friendIdentityKeys = Array.from(new Set([
      ...friendEmails.map((email) => buildIdentityKey({ userEmail: email }, identityOptions)),
      ...friendProfiles.map((profileRow) => buildIdentityKey(profileRow, identityOptions)),
    ].filter(Boolean)));
    const meEntry = entries.find((entry) => entry.identity_key === myIdentityKey) || buildFallbackEntry(user, profile, identityOptions);

    return res.status(200).json({
      entries: meEntry && !entries.some((entry) => entry.identity_key === meEntry.identity_key)
        ? [meEntry, ...entries]
        : entries,
      me: {
        identity_key: myIdentityKey,
        entry: meEntry,
        friend_identity_keys: friendIdentityKeys,
      },
      warnings,
    });
  } catch (error) {
    console.error("[leaderboard] Unexpected failure:", error);
    return res.status(200).json({
      entries: [buildFallbackEntry(user, null, { preferUserId: false })].filter(Boolean),
      me: {
        identity_key: buildIdentityKey({ userEmail: user.email }, { preferUserId: false }),
        entry: buildFallbackEntry(user, null, { preferUserId: false }),
        friend_identity_keys: [],
      },
      warnings: [toWarning("unexpected", error)],
    });
  }
}
