-- Migration: 034_fix_pii_authenticated_role.sql
-- Fixes audit finding N7 (Medium): bug_reports RLS column-level restrictions
-- only applied to the 'anon' role (migration 026_fix_pii_exposure.sql).
-- The 'authenticated' Supabase role could read ip and admin_notes columns
-- directly via PostgREST using the existing USING(true) SELECT policy.

-- Revoke unrestricted SELECT from authenticated users
REVOKE SELECT ON bug_reports FROM authenticated;

-- Grant only the same safe columns as the anon role
GRANT SELECT (id, title, description, status, severity, created_at, updated_at)
  ON bug_reports TO authenticated;
