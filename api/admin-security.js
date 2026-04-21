import { authenticateAdminRequest } from "./_adminAuth.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

async function listTrustScores(adminClient) {
  const { data, error } = await adminClient
    .from("user_trust_scores")
    .select("*")
    .order("trust_score", { ascending: true })
    .limit(100);

  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticateAdminRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { adminClient } = auth;

  try {
    if (req.method === "GET") {
      return res.status(200).json({ trustScores: await listTrustScores(adminClient) });
    }

    const body = parseBody(req);
    if (!body.trustId) {
      return res.status(400).json({ error: "Utilisateur ciblé manquant" });
    }

    if (body.action === "block-user") {
      const { error } = await adminClient
        .from("user_trust_scores")
        .update({
          trust_score: 0,
          blocked_until: new Date(Date.now() + 86400000).toISOString(),
        })
        .eq("id", body.trustId);

      if (error) throw error;
      return res.status(200).json({ trustScores: await listTrustScores(adminClient) });
    }

    if (body.action === "reset-score") {
      const { error } = await adminClient
        .from("user_trust_scores")
        .update({
          trust_score: 100,
          violations: {
            speed_anomalies: 0,
            spam_incidents: 0,
            farming_attempts: 0,
            suspicious_patterns: 0,
          },
          surveillance_active: false,
          blocked_until: null,
        })
        .eq("id", body.trustId);

      if (error) throw error;
      return res.status(200).json({ trustScores: await listTrustScores(adminClient) });
    }

    return res.status(400).json({ error: "Action admin inconnue" });
  } catch (error) {
    console.error("[admin-security] Failed to handle request:", error);
    return res.status(500).json({ error: "Impossible de piloter la sécurité pour le moment" });
  }
}
