-- Drop stale permissive UPDATE policy on bug_reports from migration 006.
--
-- PROBLEM:
--   Migration 006 created "Service can update bug reports" FOR UPDATE USING (true)
--   with NO `TO` clause — PostgreSQL treats this as applying to the PUBLIC pseudo-role
--   (all roles, including anon). Migration 016 added a proper admin-email-gated UPDATE
--   policy, but never dropped the old one. PostgreSQL OR's permissive policies, so the
--   old wide-open policy still grants UPDATE to everyone — including anon callers using
--   only NEXT_PUBLIC_SUPABASE_ANON_KEY.
--
--   An attacker could UPDATE any bug_reports row to change bounty_wallet (redirect
--   bounty payments), status, or admin_notes.
--
-- FIX:
--   Drop the stale policy. The admin-gated policy from 016 remains as the sole UPDATE
--   policy. Service_role bypasses RLS entirely, so backend routes are unaffected.

DROP POLICY IF EXISTS "Service can update bug reports" ON bug_reports;

-- Also drop the stale INSERT policy from 006 (no TO clause → PUBLIC).
-- Migration 015 already created "Anyone can submit bugs" TO anon, authenticated
-- which is the intentional public-insert policy with proper role scoping.
DROP POLICY IF EXISTS "Service can insert bug reports" ON bug_reports;
