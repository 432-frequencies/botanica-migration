import { getAuthenticatedUserFromRequest, isAdminUser } from "./_adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthenticatedUserFromRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({
      authenticated: false,
      isAdmin: false,
      error: auth.error.message,
    });
  }

  return res.status(200).json({
    authenticated: true,
    isAdmin: isAdminUser(auth.user),
    email: auth.user.email || "",
  });
}
