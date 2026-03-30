-- Migration: Restrict ideas UPDATE to service_role (parity with job_applications in 044).
--
-- Problem (Prompt 81 / GH follow-up):
--   Migration 019 defines "Service can update ideas" as
--     FOR UPDATE USING (true)
--   with no TO clause — PostgreSQL applies that to PUBLIC, so any role that holds
--   UPDATE on public.ideas could pass RLS. PostgREST + a permissive table GRANT
--   would allow mass updates from the anon/authenticated key.
--
-- Fix:
--   Same pattern as 044 "Service can update applications" — recreate policy with
--   TO service_role only. Backend routes use getServiceClient() (service_role),
--   which bypasses RLS; this closes the policy surface for other roles.

DROP POLICY IF EXISTS "Service can update ideas" ON ideas;

CREATE POLICY "Service can update ideas"
  ON ideas FOR UPDATE
  TO service_role
  USING (true);
