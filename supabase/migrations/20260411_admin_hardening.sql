-- Critical hardening applied in app code on 2026-04-11:
-- - admin views now go through authenticated server routes
-- - admin checks are centralized server-side
--
-- This migration closes the broadest remaining data leak in the schema:
-- authenticated users should not be able to read all ambassador contracts.

DROP POLICY IF EXISTS "Anyone can view contracts" ON ambassador_contracts;

-- Contract reads now go through service-role admin APIs only.
-- If you later add JWT custom-claim RBAC, replace this with a dedicated admin policy.
