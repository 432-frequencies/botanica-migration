import { createClient } from "@supabase/supabase-js";

const IDENTITY_CLEANUP_STEPS = [
  { table: "plant_discoveries", emailColumn: "user_email" },
  { table: "user_profiles", emailColumn: "user_email" },
  { table: "user_knowledge_progress", emailColumn: "user_email" },
  { table: "season_history", emailColumn: "user_email" },
  { table: "zone_leaders", emailColumn: "user_email" },
  { table: "user_trust_scores", emailColumn: "user_email" },
  { table: "leaderboard", emailColumn: "user_email" },
  { table: "challenge_progress", emailColumn: "user_email" },
];

const EMAIL_ONLY_CLEANUP_STEPS = [
  ["friend_requests", "sender_email"],
  ["friend_requests", "receiver_email"],
];

const columnSupportCache = new Map();

function isMissingColumnError(error, columnName) {
  const message = error?.message || "";
  return message.includes(columnName) && (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function isMissingRelationError(error) {
  const message = error?.message || "";
  return error?.code === "42P01" || /relation .* does not exist/i.test(message);
}

function isMissingBucketError(error) {
  const message = error?.message || "";
  return /bucket.*not found/i.test(message);
}

async function tableHasColumn(adminClient, table, column) {
  const cacheKey = `${table}:${column}`;
  if (columnSupportCache.has(cacheKey)) {
    return columnSupportCache.get(cacheKey);
  }

  const { error } = await adminClient.from(table).select(column).limit(1);
  const supported = !error || (!isMissingColumnError(error, column) && !isMissingRelationError(error));
  if (error && !supported && !isMissingRelationError(error)) {
    columnSupportCache.set(cacheKey, false);
    return false;
  }
  if (error && isMissingRelationError(error)) {
    columnSupportCache.set(cacheKey, false);
    return false;
  }
  columnSupportCache.set(cacheKey, supported);
  return supported;
}

async function deleteByColumn(adminClient, table, column, value) {
  if (!value) return;
  const { error } = await adminClient.from(table).delete().eq(column, value);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`${table}.${column}: ${error.message}`);
  }
}

async function deleteLegacyRowsByEmail(adminClient, table, emailColumn, userEmail) {
  if (!emailColumn || !userEmail) return;

  const hasEmailColumn = await tableHasColumn(adminClient, table, emailColumn);
  if (!hasEmailColumn) return;

  const hasUserId = await tableHasColumn(adminClient, table, "user_id");
  if (!hasUserId) {
    await deleteByColumn(adminClient, table, emailColumn, userEmail);
    return;
  }

  const { error } = await adminClient
    .from(table)
    .delete()
    .eq(emailColumn, userEmail)
    .is("user_id", null);

  if (error && !isMissingRelationError(error)) {
    throw new Error(`${table}.${emailColumn}: ${error.message}`);
  }
}

async function deleteRowsByIdentity(adminClient, step, user) {
  const hasUserId = await tableHasColumn(adminClient, step.table, "user_id");
  if (hasUserId) {
    await deleteByColumn(adminClient, step.table, "user_id", user.id);
  }

  if (step.emailColumn) {
    await deleteLegacyRowsByEmail(adminClient, step.table, step.emailColumn, user.email);
  }
}

async function deleteStoredPhotos(adminClient, userId) {
  const { data, error } = await adminClient.storage.from("discoveries").list(userId, { limit: 1000 });
  if (error) {
    if (isMissingBucketError(error)) return;
    throw new Error(`discoveries.list: ${error.message}`);
  }

  if (!data?.length) {
    return;
  }

  const paths = data
    .filter((item) => item?.name)
    .map((item) => `${userId}/${item.name}`);

  if (!paths.length) {
    return;
  }

  const { error: removeError } = await adminClient.storage.from("discoveries").remove(paths);
  if (removeError) {
    throw new Error(`discoveries.remove: ${removeError.message}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    for (const step of IDENTITY_CLEANUP_STEPS) {
      await deleteRowsByIdentity(adminClient, step, user);
    }
    for (const [table, column] of EMAIL_ONLY_CLEANUP_STEPS) {
      await deleteByColumn(adminClient, table, column, user.email);
    }
    await deleteStoredPhotos(adminClient, user.id);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[delete-account] Fatal error:", error);
    return res.status(500).json({ error: "Unable to delete account right now" });
  }
}
