-- ============================================================
-- RLS POLICY BACKUP — LoadKaro / mobile App
-- Captured: 2026-05-25
-- Scope: public schema, all tables
-- ============================================================
-- HOW TO RESTORE:
--   1. Drop the current policies you want to revert (DROP POLICY "<name>" ON public.<table>;)
--   2. Re-run the CREATE POLICY statements below
-- ============================================================


-- ────────────────────────────────────────────
-- TABLE: public.admin_alerts
-- ────────────────────────────────────────────

CREATE POLICY "delete admin alerts" ON public.admin_alerts
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING ((EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))
  )));

CREATE POLICY "insert admin alerts" ON public.admin_alerts
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (true);
  -- ⚠️  KNOWN ISSUE: WITH CHECK (true) — anyone can insert. Fix before prod.

CREATE POLICY "update admin alerts" ON public.admin_alerts
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))
  )));

CREATE POLICY "view admin alerts" ON public.admin_alerts
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))
  )));


-- ────────────────────────────────────────────
-- TABLE: public.audit_log
-- ────────────────────────────────────────────

CREATE POLICY "Service role manages audit_log" ON public.audit_log
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────
-- TABLE: public.availabilities
-- ────────────────────────────────────────────

CREATE POLICY "delete availabilities" ON public.availabilities
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (((owner_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))
  ))));

CREATE POLICY "insert availabilities" ON public.availabilities
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((owner_id = auth.uid()) AND (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'truck_owner'::user_role_enum))
  ))));

CREATE POLICY "update availabilities" ON public.availabilities
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (((owner_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))
  ))));

CREATE POLICY "view availabilities" ON public.availabilities
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (((owner_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'broker'::user_role_enum, 'moderator'::user_role_enum, 'shipper'::user_role_enum])))
  )) OR (status = 'available'::truck_availability_status_enum)));


-- ────────────────────────────────────────────
-- TABLE: public.id_sequences
-- ────────────────────────────────────────────

CREATE POLICY "Service role manages id_sequences" ON public.id_sequences
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────
-- TABLE: public.loads
-- ────────────────────────────────────────────

CREATE POLICY "broker/admin view loads" ON public.loads
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'broker'::user_role_enum, 'moderator'::user_role_enum])))
  )));

CREATE POLICY "delete loads" ON public.loads
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (((posted_by = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))
  ))));

CREATE POLICY "insert loads" ON public.loads
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((posted_by = auth.uid()) AND (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'shipper'::user_role_enum))
  ))));

CREATE POLICY "update loads" ON public.loads
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (((posted_by = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'moderator'::user_role_enum])))
  ))));

CREATE POLICY "view loads" ON public.loads
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (((posted_by = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['truck_owner'::user_role_enum, 'broker'::user_role_enum, 'admin'::user_role_enum, 'moderator'::user_role_enum])))
  ))));


-- ────────────────────────────────────────────
-- TABLE: public.locations
-- ────────────────────────────────────────────

CREATE POLICY "read locations" ON public.locations
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (true);


-- ────────────────────────────────────────────
-- TABLE: public.truck_variants
-- ────────────────────────────────────────────

CREATE POLICY "read truck variants" ON public.truck_variants
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (true);


-- ────────────────────────────────────────────
-- TABLE: public.trucks
-- ────────────────────────────────────────────

CREATE POLICY "delete trucks" ON public.trucks
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (((owner_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))
  ))));

CREATE POLICY "insert trucks" ON public.trucks
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((owner_id = auth.uid()) AND (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'truck_owner'::user_role_enum))
  ))));

CREATE POLICY "update trucks" ON public.trucks
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((((owner_id = auth.uid()) AND (verification_status = 'unverified'::truck_verification_status_enum)) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role_enum))
  ))));

CREATE POLICY "view trucks" ON public.trucks
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (((owner_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role_enum, 'broker'::user_role_enum, 'moderator'::user_role_enum])))
  )) OR true));
  -- ⚠️  KNOWN ISSUE: trailing OR true makes all trucks publicly readable


-- ────────────────────────────────────────────
-- TABLE: public.users
-- ────────────────────────────────────────────

CREATE POLICY "insert own user" ON public.users
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "select own user" ON public.users
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "update own user" ON public.users
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "view users" ON public.users
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (true);
  -- ⚠️  KNOWN ISSUE: USING (true) exposes all user records to everyone


-- ────────────────────────────────────────────
-- TABLE: public.verification_documents
-- ────────────────────────────────────────────

CREATE POLICY "Users insert own docs" ON public.verification_documents
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (
    SELECT 1 FROM verification_submissions vs
    WHERE ((vs.id = verification_documents.submission_id) AND (vs.submitted_by = auth.uid()))
  )));

CREATE POLICY "Users read own docs" ON public.verification_documents
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS (
    SELECT 1 FROM verification_submissions vs
    WHERE ((vs.id = verification_documents.submission_id) AND (vs.submitted_by = auth.uid()))
  )));


-- ────────────────────────────────────────────
-- TABLE: public.verification_submissions
-- ────────────────────────────────────────────

CREATE POLICY "Users insert own submissions" ON public.verification_submissions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((submitted_by = auth.uid()) AND (
    ((entity_type = 'user'::text) AND (entity_id = auth.uid()))
    OR
    ((entity_type = 'truck'::text) AND (EXISTS (
      SELECT 1 FROM trucks
      WHERE ((trucks.id = verification_submissions.entity_id) AND (trucks.owner_id = auth.uid()))
    )))
  )));

CREATE POLICY "Users read own submissions" ON public.verification_submissions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((submitted_by = auth.uid()) OR (
    (entity_type = 'truck'::text) AND (EXISTS (
      SELECT 1 FROM trucks
      WHERE ((trucks.id = verification_submissions.entity_id) AND (trucks.owner_id = auth.uid()))
    ))
  )));


-- ============================================================
-- END OF BACKUP — 28 policies across 11 tables
-- ============================================================
