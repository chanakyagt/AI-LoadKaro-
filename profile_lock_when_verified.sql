-- ============================================================================
-- Lock a user's profile once they are verified.
--
-- Requirement: after verification a user must not be able to change anything
-- on their profile, and this must hold in the BACKEND, not only in the app.
-- Otherwise someone gets verified against one identity and then edits the name
-- or phone to a different one, and the verified badge becomes meaningless — a
-- shipper calls "Verified: Ramesh" and reaches somebody else entirely.
--
-- Current state (why this is needed):
--   Policy `update own user`  USING (auth.uid() = id)  — with no verification
--   condition, so a verified user can freely UPDATE their own row today. The
--   app only ever writes `name`, but the API is open to anything.
--
-- Why a TRIGGER and not just RLS:
--   Tightening the policy to `USING (auth.uid() = id AND verification_status
--   <> 'verified')` would make the UPDATE match zero rows. PostgREST reports
--   that as SUCCESS with 0 rows changed — the app would say "Profile updated"
--   while nothing happened. A trigger raises a real error the app can show.
--
-- Who is exempt:
--   * the admin dashboard, which uses the service_role key and therefore has
--     no JWT — `auth.uid()` is NULL. Admins must still be able to correct a
--     name, or move someone back to `rejected`.
--   * admin / moderator accounts acting with their own JWT.
--
-- Run in the Supabase SQL editor. Verification queries at the bottom.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.lock_verified_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := (select auth.uid());
  caller_role text;
BEGIN
  -- service_role (admin dashboard, migrations, cron): no JWT, never blocked.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only a verified row is locked. Unverified, pending and rejected users
  -- must still be able to fix their details and re-submit.
  IF OLD.verification_status <> 'verified' THEN
    RETURN NEW;
  END IF;

  -- Staff acting with their own login keep the ability to correct records.
  SELECT role::text INTO caller_role FROM public.users WHERE id = caller;
  IF caller_role IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;

  -- Compare whole rows minus the bookkeeping column, so a column added later
  -- is protected automatically rather than silently slipping through.
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION
      'PROFILE_LOCKED: this profile is verified and can no longer be edited. Contact support to request a change.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lock_verified_user_profile() FROM anon;

DROP TRIGGER IF EXISTS users_lock_when_verified ON public.users;

CREATE TRIGGER users_lock_when_verified
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_verified_user_profile();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

-- 1. The trigger exists and fires before every row update.
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass
  AND NOT tgisinternal;

-- 2. A verified user editing their own name should FAIL.
--    Replace the UUID with a real verified account.
--
-- SET role = 'authenticated';
-- SET request.jwt.claims = '{"sub":"<verified_user_uuid>"}';
-- UPDATE public.users SET name = 'Changed Name' WHERE id = '<verified_user_uuid>';
-- -- ^ expected: ERROR  PROFILE_LOCKED: this profile is verified ...
-- RESET role;

-- 3. An unverified user editing their own name should still SUCCEED.
--
-- SET role = 'authenticated';
-- SET request.jwt.claims = '{"sub":"<unverified_user_uuid>"}';
-- UPDATE public.users SET name = 'New Name' WHERE id = '<unverified_user_uuid>';
-- -- ^ expected: UPDATE 1
-- RESET role;

-- 4. The admin dashboard (service_role, no JWT) must still be able to edit a
--    verified user. Run this as the service role — expected: UPDATE 1.
--
-- UPDATE public.users SET name = name WHERE verification_status = 'verified' LIMIT 1;

-- NOTE: `DOCS_SUPABASE_DATABASE.md` §6.1 documents `update own user` as an
-- unconditional `auth.uid() = id`. That policy is unchanged and still correct;
-- add a line there noting this trigger narrows it for verified rows.
