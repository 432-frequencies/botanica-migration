import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserFromRequest } from "./_adminAuth.js";
import { resolveDisplayName } from "../src/lib/displayName.js";
import { getCurrentLevel } from "../src/lib/leveling.js";
import { normalizeSpeciesCategory } from "../src/lib/species.js";

const columnSupportCache = new Map();
const CATEGORY_BUCKETS = ["plant", "tree", "bird", "insect", "arachnid", "rock", "fungus"];
const OBSERVATION_CONTEXTS = new Set(["wild", "domestic", "unknown"]);
const EDIBILITY_STATUSES = new Set(["edible", "toxic", "non_edible", "unknown"]);

function today() {
  return new Date().toISOString().split("T")[0];
}

function normalizeIdentityValue(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeObservationContext(value) {
  const normalized = String(value || "unknown").trim().toLowerCase();
  return OBSERVATION_CONTEXTS.has(normalized) ? normalized : "unknown";
}

function parseOptionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value > 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ["true", "yes", "oui", "vrai", "1"].includes(normalized);
}

function normalizeEdibilityStatus(value, { isEdible = false, isToxic = false } = {}) {
  const normalized = String(value || "").trim().toLowerCase();
  if (EDIBILITY_STATUSES.has(normalized)) return normalized;
  if (isToxic) return "toxic";
  if (isEdible) return "edible";
  return "unknown";
}

function omitObservationContext(payload) {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.observation_context;
  return fallbackPayload;
}

function omitUnsupportedSafetyColumns(payload, { supportsEdibilityStatus, supportsSafetyNotes }) {
  const fallbackPayload = { ...payload };
  if (!supportsEdibilityStatus) delete fallbackPayload.edibility_status;
  if (!supportsSafetyNotes) delete fallbackPayload.safety_notes;
  return fallbackPayload;
}

function buildDiscoveryIdentityKeys({ common_name, scientific_name, commonName, scientificName } = {}) {
  const common = normalizeIdentityValue(common_name || commonName);
  const scientific = normalizeIdentityValue(scientific_name || scientificName);
  const keys = [];
  if (scientific) keys.push(`s:${scientific}`);
  if (common) keys.push(`c:${common}`);
  return keys;
}

function discoveryMatchesIdentity(discovery, identityKeys) {
  if (!identityKeys?.size) return false;
  return buildDiscoveryIdentityKeys(discovery).some((key) => identityKeys.has(key));
}

function getDiscoveryDate(discovery) {
  return discovery?.discovered_date || discovery?.created_at?.split("T")[0] || null;
}

function getWindowStart(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().split("T")[0];
}

function isMissingColumnError(error, columnName) {
  const message = error?.message || "";
  return message.includes(columnName) && (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function isCategoryConstraintError(error) {
  const message = error?.message || "";
  return /plant_discoveries_category_check|violates check constraint/i.test(message)
    || (/category/i.test(message) && /check/i.test(message));
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

    if (insertPayload.category === "arachnid" && isCategoryConstraintError(error)) {
      const { data: fallbackData, error: fallbackError } = await adminClient
        .from("plant_discoveries")
        .insert({ ...withUserId, category: "insect" })
        .select()
        .single();

      if (!fallbackError) return fallbackData;
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

async function fetchDiscoveriesByIdentity(
  adminClient,
  authUser,
  columns = "common_name, scientific_name, category, discovered_date, created_at, is_edible, is_toxic",
) {
  const supportsUserId = await tableHasColumn(adminClient, "plant_discoveries", "user_id");

  if (supportsUserId) {
    const { data, error } = await adminClient
      .from("plant_discoveries")
      .select(columns)
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    if (!error) {
      return data || [];
    }

    if (!isMissingColumnError(error, "user_id")) {
      throw error;
    }
  }

  const { data, error } = await adminClient
    .from("plant_discoveries")
    .select(columns)
    .eq("user_email", authUser.email)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function countDiscoveriesByIdentity(adminClient, authUser, { commonName, scientificName }) {
  const identityKeys = new Set(buildDiscoveryIdentityKeys({ commonName, scientificName }));
  if (!identityKeys.size) return 0;

  const discoveries = await fetchDiscoveriesByIdentity(adminClient, authUser, "common_name, scientific_name");
  return discoveries.filter((discovery) => discoveryMatchesIdentity(discovery, identityKeys)).length;
}

function computeLeaderboardSnapshot(discoveries = []) {
  const totalUniqueSpecies = new Set();
  const perCategory = Object.fromEntries(CATEGORY_BUCKETS.map((category) => [category, new Set()]));
  const edible = new Set();
  const toxic = new Set();
  const weekStart = getWindowStart(7);
  const monthStart = getWindowStart(30);

  let weeklyPlants = 0;
  let monthlyPlants = 0;

  for (const discovery of discoveries) {
    const identityKey = buildDiscoveryIdentityKeys(discovery)[0] || buildDiscoveryIdentityKeys(discovery)[1] || null;
    if (identityKey) {
      totalUniqueSpecies.add(identityKey);
    }

    const category = normalizeSpeciesCategory(discovery.category, discovery);
    if (identityKey && perCategory[category]) {
      perCategory[category].add(identityKey);
    }

    if (identityKey && discovery.is_edible) edible.add(identityKey);
    if (identityKey && discovery.is_toxic) toxic.add(identityKey);

    const dateKey = getDiscoveryDate(discovery);
    if (!dateKey) continue;
    if (dateKey >= weekStart) weeklyPlants += 1;
    if (dateKey >= monthStart) monthlyPlants += 1;
  }

  return {
    totalUniqueSpecies: totalUniqueSpecies.size,
    weeklyPlants,
    monthlyPlants,
    plantCount: perCategory.plant.size,
    treeCount: perCategory.tree.size,
    birdCount: perCategory.bird.size,
    insectCount: perCategory.insect.size,
    rockCount: perCategory.rock.size,
    fungusCount: perCategory.fungus.size,
    edibleCount: edible.size,
    toxicCount: toxic.size,
  };
}

async function insertDiscovery(adminClient, authUser, payload) {
  const supportsUserId = await tableHasColumn(adminClient, "plant_discoveries", "user_id");
  const supportsObservationContext = await tableHasColumn(adminClient, "plant_discoveries", "observation_context");
  const supportsEdibilityStatus = await tableHasColumn(adminClient, "plant_discoveries", "edibility_status");
  const supportsSafetyNotes = await tableHasColumn(adminClient, "plant_discoveries", "safety_notes");
  const withObservationContext = supportsObservationContext ? payload : omitObservationContext(payload);
  const insertPayload = omitUnsupportedSafetyColumns(withObservationContext, {
    supportsEdibilityStatus,
    supportsSafetyNotes,
  });

  if (supportsUserId) {
    const withUserId = { ...insertPayload, user_id: authUser.id };
    const { data, error } = await adminClient
      .from("plant_discoveries")
      .insert(withUserId)
      .select()
      .single();

    if (!error) {
      return data;
    }

    if (!isMissingColumnError(error, "user_id")) {
      throw error;
    }
  }

  const { data, error } = await adminClient
    .from("plant_discoveries")
    .insert(insertPayload)
    .select()
    .single();

  if (insertPayload.category === "arachnid" && isCategoryConstraintError(error)) {
    const { data: fallbackData, error: fallbackError } = await adminClient
      .from("plant_discoveries")
      .insert({ ...insertPayload, category: "insect" })
      .select()
      .single();

    if (!fallbackError) return fallbackData;
  }

  if (error) throw error;
  return data;
}

async function createProfile(adminClient, authUser, todayStr) {
  const supportsUserId = await tableHasColumn(adminClient, "user_profiles", "user_id");
  const basePayload = {
    user_email: authUser.email,
    display_name: resolveDisplayName({
      fullName: authUser.user_metadata?.full_name,
      email: authUser.email,
    }),
    total_points: 0,
    total_plants: 0,
    is_pro: false,
    daily_identifications_count: 0,
    daily_reset_date: todayStr,
    rank: "Débutant",
    onboarding_completed: false,
  };

  if (supportsUserId) {
    const { data, error } = await adminClient
      .from("user_profiles")
      .insert({ ...basePayload, user_id: authUser.id })
      .select()
      .single();

    if (!error) return data;
    if (!isMissingColumnError(error, "user_id") && !/duplicate key value/i.test(error.message || "")) {
      throw error;
    }
  }

  const { data, error } = await adminClient
    .from("user_profiles")
    .insert(basePayload)
    .select()
    .single();

  if (error && !/duplicate key value/i.test(error.message || "")) {
    throw error;
  }

  return data || maybeSingleByIdentity(adminClient, "user_profiles", authUser);
}

async function ensureProfile(adminClient, authUser, todayStr) {
  let profile = await maybeSingleByIdentity(
    adminClient,
    "user_profiles",
    authUser,
    "id, user_id, user_email, display_name, total_points, total_plants, daily_identifications_count, daily_reset_date, rank, onboarding_completed, is_pro"
  );

  if (!profile) {
    profile = await createProfile(adminClient, authUser, todayStr);
  }

  if (profile && !profile.user_id && await tableHasColumn(adminClient, "user_profiles", "user_id")) {
    await adminClient
      .from("user_profiles")
      .update({ user_id: authUser.id })
      .eq("user_email", authUser.email);
    profile.user_id = authUser.id;
  }

  return profile;
}

async function patchProfile(adminClient, authUser, patch) {
  const supportsUserId = await tableHasColumn(adminClient, "user_profiles", "user_id");

  if (supportsUserId) {
    const { error } = await adminClient
      .from("user_profiles")
      .update(patch)
      .eq("user_id", authUser.id);

    if (!error) return;
    if (!isMissingColumnError(error, "user_id")) throw error;
  }

  const { error } = await adminClient
    .from("user_profiles")
    .update(patch)
    .eq("user_email", authUser.email);

  if (error) throw error;
}

async function syncLeaderboard(adminClient, authUser, profile, totalPoints, snapshot) {
  const supportsUserId = await tableHasColumn(adminClient, "leaderboard", "user_id");
  const payload = {
    user_email: authUser.email,
    display_name: resolveDisplayName({
      displayName: profile?.display_name,
      fullName: authUser.user_metadata?.full_name,
      email: authUser.email,
    }),
    total_plants: snapshot.totalUniqueSpecies,
    weekly_plants: snapshot.weeklyPlants,
    monthly_plants: snapshot.monthlyPlants,
    plant_count: snapshot.plantCount,
    tree_count: snapshot.treeCount,
    bird_count: snapshot.birdCount,
    insect_count: snapshot.insectCount,
    rock_count: snapshot.rockCount,
    fungus_count: snapshot.fungusCount,
    edible_count: snapshot.edibleCount,
    toxic_count: snapshot.toxicCount,
    total_points: totalPoints,
    rank: profile?.rank || getCurrentLevel(totalPoints).label || "Débutant",
    last_updated: new Date().toISOString(),
  };

  if (supportsUserId) {
    const { error } = await adminClient
      .from("leaderboard")
      .upsert({ ...payload, user_id: authUser.id }, { onConflict: "user_email" });

    if (!error) return;
    if (!isMissingColumnError(error, "user_id")) throw error;
  }

  const { error } = await adminClient
    .from("leaderboard")
    .upsert(payload, { onConflict: "user_email" });

  if (error) throw error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthenticatedUserFromRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { user: authUser } = auth;
  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const commonName = body.common_name?.trim() || "Spécimen observé";
    const scientificName = body.scientific_name?.trim() || null;
    const normalizedCategory = normalizeSpeciesCategory(body.category, body);
    const requestedIsToxic = parseOptionalBoolean(body.is_toxic);
    const requestedIsEdible = parseOptionalBoolean(body.is_edible);
    const edibilityStatus = normalizeEdibilityStatus(body.edibility_status, {
      isEdible: requestedIsEdible,
      isToxic: requestedIsToxic,
    });
    const isToxic = requestedIsToxic || edibilityStatus === "toxic";
    const isEdible = !isToxic && (requestedIsEdible || edibilityStatus === "edible");
    const todayStr = today();

    const existingCount = await countDiscoveriesByIdentity(adminClient, authUser, {
      commonName,
      scientificName,
    });
    const isNewSpecies = existingCount === 0;
    const xpEarned = isNewSpecies ? 15 : 8;

    const insertPayload = {
      user_email: authUser.email,
      category: normalizedCategory,
      common_name: commonName,
      scientific_name: scientificName,
      family: body.family?.trim() || null,
      photo_url: body.photo_url || null,
      thumbnail_url: body.thumbnail_url || null,
      rarity: body.rarity || "commune",
      is_edible: isEdible,
      is_toxic: isToxic,
      edibility_status: edibilityStatus,
      safety_notes: body.safety_notes?.trim() || null,
      confidence: body.confidence || null,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      description: body.description?.trim() || null,
      habitat: body.habitat?.trim() || null,
      ecological_role: body.ecological_role?.trim() || null,
      biodiversity_importance: body.biodiversity_importance?.trim() || null,
      edibility_details: body.edibility_details?.trim() || null,
      medicinal_uses: body.medicinal_uses?.trim() || null,
      anecdote: body.anecdote?.trim() || null,
      points_earned: xpEarned,
      discovered_date: todayStr,
      observation_context: normalizeObservationContext(body.observation_context),
    };

    await insertDiscovery(adminClient, authUser, insertPayload);

    const profile = await ensureProfile(adminClient, authUser, todayStr);
    const discoveries = await fetchDiscoveriesByIdentity(adminClient, authUser);
    const snapshot = computeLeaderboardSnapshot(discoveries);
    const totalPoints = (profile?.total_points || 0) + xpEarned;

    await patchProfile(adminClient, authUser, {
      total_points: totalPoints,
      total_plants: snapshot.totalUniqueSpecies,
      last_scan_date: todayStr,
    });

    await syncLeaderboard(adminClient, authUser, profile, totalPoints, snapshot);

    return res.status(200).json({
      xp_earned: xpEarned,
      is_new_species: isNewSpecies,
      total_points: totalPoints,
      level: getCurrentLevel(totalPoints).level,
      new_achievements: [],
    });
  } catch (error) {
    console.error("[save-discovery] Failed to persist discovery:", error);
    return res.status(500).json({ error: "Impossible d'enregistrer l'observation pour le moment" });
  }
}
