-- ============================================================================
-- Broker write access — REQUIRED for the broker "does both" UI to work.
--
-- Why: the three INSERT policies below currently hard-code a single role, so a
-- broker can BROWSE loads/trucks/availabilities but every attempt to POST one
-- fails with "new row violates row-level security policy". That is true of the
-- old broker dashboard too (it has shown "Upload Loads" / "Add Trucks" buttons
-- since commit 15ade3c) — the buttons were never usable.
--
--   insert loads          WITH CHECK ... users.role = 'shipper'
--   insert trucks         WITH CHECK ... users.role = 'truck_owner'
--   insert availabilities WITH CHECK ... users.role = 'truck_owner'
--
-- This script widens each one to include 'broker'. Ownership is unchanged:
-- a broker can still only insert rows they themselves own
-- (posted_by / owner_id = auth.uid()).
--
-- Run this in the Supabase SQL editor BEFORE shipping the broker build.
-- Take a policy backup first, the same way rls_backup_2026-07-01.sql was made.
--
-- Verify afterwards with the checks at the bottom of this file.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- loads: brokers post loads on behalf of their shipper parties
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert loads" ON public.loads;

CREATE POLICY "insert loads"
  ON public.loads
  FOR INSERT
  TO public
  WITH CHECK (
    posted_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND users.role IN ('shipper', 'broker')
    )
  );

-- ---------------------------------------------------------------------------
-- trucks: brokers register the trucks they manage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert trucks" ON public.trucks;

CREATE POLICY "insert trucks"
  ON public.trucks
  FOR INSERT
  TO public
  WITH CHECK (
    owner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND users.role IN ('truck_owner', 'broker')
    )
  );

-- ---------------------------------------------------------------------------
-- availabilities: brokers list those trucks as available
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert availabilities" ON public.availabilities;

CREATE POLICY "insert availabilities"
  ON public.availabilities
  FOR INSERT
  TO public
  WITH CHECK (
    owner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND users.role IN ('truck_owner', 'broker')
    )
  );

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

-- 1. The three policies should now list 'broker' in their WITH CHECK.
SELECT tablename, policyname, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('insert loads', 'insert trucks', 'insert availabilities')
ORDER BY tablename;

-- 2. Live check with a real broker account (replace the UUID).
--    Expected: all three succeed, and inserting with someone else's
--    posted_by/owner_id still fails.
--
-- SET role = 'authenticated';
-- SET request.jwt.claims = '{"sub":"<broker_uuid>"}';
--
-- INSERT INTO loads (posted_by, origin_location_id, destination_location_id,
--                    loading_date, truck_category_required, capacity_required,
--                    payment_type)
-- VALUES ('<broker_uuid>', '<loc1>', '<loc2>', CURRENT_DATE + 1, 'open', 10, 'advance');
-- -- ^ should SUCCEED (was: RLS violation)
--
-- INSERT INTO loads (posted_by, ...) VALUES ('<some_other_uuid>', ...);
-- -- ^ should still FAIL (ownership check unchanged)
--
-- RESET role;

-- 3. NOTE: DOCS_SUPABASE_DATABASE.md still documents the old behaviour —
--    §"Role-Permission Matrix" (loads/trucks/availabilities insert = No for
--    broker) and the RLS test snippet "-- 3. Broker should NOT insert loads".
--    Update both once this is applied.
