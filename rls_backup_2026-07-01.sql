-- ============================================================
-- RLS POLICY + OBJECT BACKUP — LoadKaro / mobile App
-- Captured: 2026-07-01  (BEFORE the safe-launch QA migration: C1 + C2 + C3)
-- Scope: public schema, all policies (verbatim from pg_policies at capture time)
-- ============================================================
-- HOW TO RESTORE THE PRE-MIGRATION STATE:
--   1. Run the "ROLLBACK OF NEW OBJECTS" block at the bottom (drops what the
--      migration added).
--   2. For any policy the migration replaced, DROP the current one and re-run
--      its CREATE POLICY statement from the "BASELINE POLICIES" section below.
-- Note: auth.uid() appears verbatim here. The C2 step rewrites these to
--   (select auth.uid()) — semantically identical, per-query eval. To fully revert
--   C2, restore the baseline statements below.
-- ============================================================


-- ============================================================
-- BASELINE POLICIES (state as of 2026-07-01, pre-migration)
-- ============================================================

CREATE POLICY "delete admin alerts" ON public.admin_alerts AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum)))));

CREATE POLICY "insert admin alerts" ON public.admin_alerts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum]))))));

CREATE POLICY "view admin alerts" ON public.admin_alerts AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum]))))));

CREATE POLICY "update admin alerts" ON public.admin_alerts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum]))))));

CREATE POLICY "Service role manages audit_log" ON public.audit_log AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "delete availabilities" ON public.availabilities AS PERMISSIVE FOR DELETE TO public
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))))));

CREATE POLICY "insert availabilities" ON public.availabilities AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((owner_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'truck_owner'::user_role_enum))))));

CREATE POLICY "view availabilities" ON public.availabilities AS PERMISSIVE FOR SELECT TO authenticated
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['shipper'::user_role_enum, 'broker'::user_role_enum, 'admin'::user_role_enum, 'moderator'::user_role_enum])))))));

CREATE POLICY "update availabilities" ON public.availabilities AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))))))
  WITH CHECK (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))))));

CREATE POLICY "Service role manages id_sequences" ON public.id_sequences AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "delete loads" ON public.loads AS PERMISSIVE FOR DELETE TO public
  USING (((posted_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))))));

CREATE POLICY "insert loads" ON public.loads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((posted_by = auth.uid()) AND (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'shipper'::user_role_enum))))));

CREATE POLICY "view loads" ON public.loads AS PERMISSIVE FOR SELECT TO public
  USING (((posted_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['truck_owner'::user_role_enum, 'broker'::user_role_enum, 'admin'::user_role_enum, 'moderator'::user_role_enum])))))));

CREATE POLICY "update loads" ON public.loads AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((posted_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))))))
  WITH CHECK (((posted_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))))));

CREATE POLICY "read locations" ON public.locations AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "read truck variants" ON public.truck_variants AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "delete trucks" ON public.trucks AS PERMISSIVE FOR DELETE TO public
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))))));

CREATE POLICY "insert trucks" ON public.trucks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((owner_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'truck_owner'::user_role_enum))))));

CREATE POLICY "view trucks" ON public.trucks AS PERMISSIVE FOR SELECT TO authenticated
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum]))))) OR ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['shipper'::user_role_enum, 'broker'::user_role_enum]))))) AND (EXISTS ( SELECT 1 FROM availabilities a WHERE ((a.truck_id = trucks.id) AND (a.status = 'available'::truck_availability_status_enum)))))));

CREATE POLICY "update trucks" ON public.trucks AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((owner_id = auth.uid()) AND (verification_status = 'unverified'::truck_verification_status_enum)) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))))))
  WITH CHECK ((((owner_id = auth.uid()) AND (verification_status = 'unverified'::truck_verification_status_enum)) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))))));

CREATE POLICY "insert own user" ON public.users AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = id) AND (role = ANY (ARRAY['shipper'::user_role_enum, 'truck_owner'::user_role_enum, 'broker'::user_role_enum]))));

CREATE POLICY "select own user" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = id));

-- >>> THIS IS THE POLICY C1 REMOVES (full-table phone exposure). Re-create to fully revert C1. <<<
CREATE POLICY "view users" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "update own user" ON public.users AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK (((auth.uid() = id) AND (NOT (role IS DISTINCT FROM ( SELECT users_1.role FROM users users_1 WHERE (users_1.id = auth.uid()))))));

CREATE POLICY "Users insert own docs" ON public.verification_documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM verification_submissions vs WHERE ((vs.id = verification_documents.submission_id) AND (vs.submitted_by = auth.uid())))));

CREATE POLICY "Users read own docs" ON public.verification_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM verification_submissions vs WHERE ((vs.id = verification_documents.submission_id) AND (vs.submitted_by = auth.uid())))));

CREATE POLICY "Users insert own submissions" ON public.verification_submissions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((submitted_by = auth.uid()) AND (((entity_type = 'user'::text) AND (entity_id = auth.uid())) OR ((entity_type = 'truck'::text) AND (EXISTS ( SELECT 1 FROM trucks WHERE ((trucks.id = verification_submissions.entity_id) AND (trucks.owner_id = auth.uid()))))))));

CREATE POLICY "Users read own submissions" ON public.verification_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((submitted_by = auth.uid()) OR ((entity_type = 'truck'::text) AND (EXISTS ( SELECT 1 FROM trucks WHERE ((trucks.id = verification_submissions.entity_id) AND (trucks.owner_id = auth.uid())))))));


-- ============================================================
-- ROLLBACK OF NEW OBJECTS added by the 2026-07-01 migration
-- ============================================================
-- C1:
--   DROP POLICY IF EXISTS "view public listing contacts" ON public.users;
--   DROP FUNCTION IF EXISTS public.user_has_public_listing(uuid);
--   -- then re-create "view users" from the baseline above to fully revert.
--
-- C3 (indexes / policy / settings added):
--   DROP INDEX IF EXISTS public.idx_availabilities_feed;
--   DROP INDEX IF EXISTS public.idx_loads_feed;
--   DROP POLICY IF EXISTS "read location_states" ON public.location_states;
--   -- search_path / security_invoker changes: see migration for the exact objects.
-- ============================================================
