-- Backup taken 2026-10-13 before migration prelaunch_hardening_2026_10_13.
-- Original definitions of every policy/function the migration changes.
-- Restore by running the relevant statements below.

alter policy "insert trucks" on public.trucks with check (
  (owner_id = (select auth.uid())) and exists (select 1 from users where users.id = (select auth.uid())
   and users.role = any (array['truck_owner'::user_role_enum, 'broker'::user_role_enum])));

alter policy "insert availabilities" on public.availabilities with check (
  (owner_id = (select auth.uid())) and exists (select 1 from users where users.id = (select auth.uid())
   and users.role = any (array['truck_owner'::user_role_enum, 'broker'::user_role_enum])));

alter policy "update availabilities" on public.availabilities
  using ((owner_id = (select auth.uid())) or exists (select 1 from users where users.id = (select auth.uid())
   and users.role = any (array['admin'::user_role_enum, 'moderator'::user_role_enum])))
  with check ((owner_id = (select auth.uid())) or exists (select 1 from users where users.id = (select auth.uid())
   and users.role = any (array['admin'::user_role_enum, 'moderator'::user_role_enum])));

alter policy "insert loads" on public.loads with check (
  (posted_by = (select auth.uid())) and exists (select 1 from users where users.id = (select auth.uid())
   and users.role = any (array['shipper'::user_role_enum, 'broker'::user_role_enum])));

alter policy "Users insert own submissions" on public.verification_submissions with check (
  (submitted_by = (select auth.uid())) and (((entity_type = 'user') and (entity_id = (select auth.uid())))
   or ((entity_type = 'truck') and exists (select 1 from trucks where trucks.id = verification_submissions.entity_id
   and trucks.owner_id = (select auth.uid())))));

alter policy "Users insert own docs" on public.verification_documents with check (
  exists (select 1 from verification_submissions vs where vs.id = verification_documents.submission_id
   and vs.submitted_by = (select auth.uid())));

alter policy crm_tickets_own_insert on public.crm_tickets with check (
  (raised_by = auth.uid()) and (status = 'open') and (assigned_to is null) and (resolution is null)
  and (resolved_at is null) and (priority = any (array['low','normal'])) and (source = 'portal'));
alter policy crm_tickets_own_select on public.crm_tickets using (raised_by = auth.uid());

-- trg_generate_{load,truck,availability,ver_sub,ver_doc,alert}_unique_id all had the form:
--   BEGIN IF NEW.unique_id IS NOT NULL THEN RETURN NEW; END IF;
--   NEW.unique_id := public.generate_unique_id('<LD|TRK|AVL|VER|DOC|ALT>'); RETURN NEW; END;
--   (SECURITY DEFINER, search_path public)

CREATE OR REPLACE FUNCTION public.enforce_load_status_transition() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status = 'closed' AND NEW.status <> 'closed' THEN
    RAISE EXCEPTION 'Cannot change status after closed';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.auto_expire_listings() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.loads SET status = 'closed', updated_at = now() WHERE status = 'open' AND loading_date < CURRENT_DATE;
  UPDATE public.availabilities SET status = 'closed', updated_at = now() WHERE status = 'available' AND available_till < CURRENT_DATE;
END; $function$;

-- nearby_loads / nearby_availabilities / crm_suggested_pairs: identical to matching_v1.sql
-- (used current_date, no radius cap, no self-pair exclusion).
