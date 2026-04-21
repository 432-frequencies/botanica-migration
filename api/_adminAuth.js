import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "energynrj6@gmail.com").trim().toLowerCase();

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function isAdminUser(user) {
  return normalizeEmail(user?.email) === ADMIN_EMAIL;
}

export async function getAuthenticatedUserFromRequest(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return { error: { status: 401, message: "Unauthorized" } };
  }

  const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { error: { status: 401, message: "Unauthorized" } };
  }

  return { user };
}

export async function authenticateAdminRequest(req) {
  const auth = await getAuthenticatedUserFromRequest(req);
  if (auth.error) {
    return auth;
  }

  if (!isAdminUser(auth.user)) {
    return { error: { status: 403, message: "Forbidden" } };
  }

  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return { adminClient, user: auth.user };
}
