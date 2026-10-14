-- Pre-launch DB hardening, 2026-10-13. APPLIED 2026-10-14 as migration prelaunch_hardening_2026_10_13,
-- followed immediately by fix_availability_policy_recursion (see the end of this file): as written,
-- rule 3 made availabilities and trucks policies reference each other and every availability post failed.
-- From the 2026-10-13 review. Original definitions are in rls_backup_2026-10-13.sql.
-- Apply via Supabase SQL Editor (project ffbbujudebmtbuyssnsn) or the Supabase MCP apply_migration.
-- Left out on purpose (need founder decision): expiry window for availabilities with no end date,
-- premium-only admin alerts, phone visibility (M3).

begin;

-- 1. Trucks can only be inserted unverified (owners could self-verify a truck)
alter policy "insert trucks" on public.trucks with check (
  owner_id = (select auth.uid())
  and verification_status = 'unverified'
  and exists (select 1 from public.users where id = (select auth.uid())
              and role in ('truck_owner','broker')));

-- 3. Availabilities must reference the poster's own truck
alter policy "insert availabilities" on public.availabilities with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.users where id = (select auth.uid()) and role in ('truck_owner','broker'))
  and exists (select 1 from public.trucks t where t.id = truck_id and t.owner_id = (select auth.uid())));

alter policy "update availabilities" on public.availabilities with check (
  (owner_id = (select auth.uid())
     and exists (select 1 from public.trucks t where t.id = truck_id and t.owner_id = (select auth.uid())))
  or exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','moderator')));

-- 9a. Loads are always inserted open (so the 10-open cap applies)
alter policy "insert loads" on public.loads with check (
  posted_by = (select auth.uid())
  and status = 'open'
  and exists (select 1 from public.users where id = (select auth.uid()) and role in ('shipper','broker')));

-- 4. Submissions cannot carry review fields
alter policy "Users insert own submissions" on public.verification_submissions with check (
  submitted_by = (select auth.uid()) and status = 'submitted'
  and review_decision is null and reviewed_by is null and reviewed_at is null
  and rejection_reason is null and assigned_to is null and assigned_at is null
  and coalesce(chase_count, 0) = 0 and last_chased_at is null
  and ((entity_type = 'user' and entity_id = (select auth.uid()))
    or (entity_type = 'truck' and exists (select 1 from public.trucks
          where trucks.id = entity_id and trucks.owner_id = (select auth.uid())))));

-- 5. Documents must match their submission's entity and storage path (all 12 existing docs already do)
alter policy "Users insert own docs" on public.verification_documents with check (
  bucket = 'verification-docs'
  and exists (select 1 from public.verification_submissions vs
    where vs.id = submission_id and vs.submitted_by = (select auth.uid())
      and vs.entity_type = verification_documents.entity_type
      and vs.entity_id = verification_documents.entity_id
      and verification_documents.path like vs.entity_type || '/' || vs.entity_id || '/' || vs.id || '/%'));

-- 15 + 18. Portal tickets: related ids must be the caller's own; auth.uid() evaluated once
alter policy crm_tickets_own_insert on public.crm_tickets with check (
  raised_by = (select auth.uid()) and status = 'open' and assigned_to is null
  and resolution is null and resolved_at is null
  and priority in ('low','normal') and source = 'portal'
  and (related_user_id is null or related_user_id = (select auth.uid()))
  and (related_load_id is null or exists (select 1 from public.loads l
        where l.id = related_load_id and l.posted_by = (select auth.uid())))
  and (related_availability_id is null or exists (select 1 from public.availabilities a
        where a.id = related_availability_id and a.owner_id = (select auth.uid()))));
alter policy crm_tickets_own_select on public.crm_tickets using (raised_by = (select auth.uid()));

-- 2. unique_id is always server-generated for API users, and immutable on update
create or replace function public.trg_generate_load_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('LD'); return new;
end $$;
create or replace function public.trg_generate_truck_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('TRK'); return new;
end $$;
create or replace function public.trg_generate_availability_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('AVL'); return new;
end $$;
create or replace function public.trg_generate_ver_sub_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('VER'); return new;
end $$;
create or replace function public.trg_generate_ver_doc_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('DOC'); return new;
end $$;
create or replace function public.trg_generate_alert_unique_id() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.unique_id is not null and (select auth.uid()) is null then return new; end if;
  new.unique_id := public.generate_unique_id('ALT'); return new;
end $$;

create or replace function public.keep_unique_id() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is not null then new.unique_id := old.unique_id; end if;
  return new;
end $$;
revoke execute on function public.keep_unique_id() from public, anon, authenticated;
drop trigger if exists trg_keep_unique_id on public.loads;
drop trigger if exists trg_keep_unique_id on public.availabilities;
drop trigger if exists trg_keep_unique_id on public.trucks;
create trigger trg_keep_unique_id before update on public.loads          for each row execute function public.keep_unique_id();
create trigger trg_keep_unique_id before update on public.availabilities for each row execute function public.keep_unique_id();
create trigger trg_keep_unique_id before update on public.trucks         for each row execute function public.keep_unique_id();

-- 9b. Load status rules: closed/cancelled are final for API users; reopening respects the cap
create or replace function public.enforce_load_status_transition() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare n int;
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Cannot change status after closed';
  end if;
  if old.status in ('closed','cancelled') and (select auth.uid()) is not null
     and new is distinct from old then
    raise exception 'LOAD_FINAL: closed/cancelled loads cannot be changed' using errcode = '42501';
  end if;
  if new.status = 'open' and old.status <> 'open' then
    select count(*) into n from public.loads where posted_by = new.posted_by and status = 'open';
    if n >= 10 then raise exception 'Open load limit reached'; end if;
  end if;
  return new;
end $$;

-- 8 (partial) + 11. "Today" is the IST date everywhere; past matched loads close too
create or replace function public.auto_expire_listings() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.loads set status = 'closed', updated_at = now()
   where status in ('open','matched') and loading_date < (now() at time zone 'Asia/Kolkata')::date;
  update public.availabilities set status = 'closed', updated_at = now()
   where status = 'available' and available_till < (now() at time zone 'Asia/Kolkata')::date;
end $$;

create or replace function public.nearby_loads(p_location_id uuid, p_radius_km double precision default 100, p_headed_location_id uuid default null::uuid)
returns setof public.loads language sql stable set search_path = public, pg_temp as $$
  with me as (select latitude as lat, longitude as lng from public.locations where id = p_location_id),
       headed as (select latitude as lat, longitude as lng from public.locations where id = p_headed_location_id),
       r as (select least(coalesce(p_radius_km, 100), 500) as km, (now() at time zone 'Asia/Kolkata')::date as today)
  select l.*
  from public.loads l
  join public.locations o on o.id = l.origin_location_id
  left join public.locations d on d.id = l.destination_location_id
  cross join me cross join r
  left join headed h on true
  where public.km_between(me.lat, me.lng, o.latitude, o.longitude) <= r.km
  order by
    (l.status = 'open' and l.loading_date >= r.today) desc,
    coalesce(public.km_between(h.lat, h.lng, d.latitude, d.longitude) <= r.km, false) desc,
    public.km_between(me.lat, me.lng, o.latitude, o.longitude) asc,
    l.created_at desc,
    l.id
$$;

create or replace function public.nearby_availabilities(p_location_id uuid, p_radius_km double precision default 100, p_ref_load_id uuid default null::uuid)
returns setof public.availabilities language sql stable set search_path = public, pg_temp as $$
  with me as (select latitude as lat, longitude as lng from public.locations where id = p_location_id),
       rr as (select least(coalesce(p_radius_km, 100), 500) as km, (now() at time zone 'Asia/Kolkata')::date as today),
       ref as (
         select l.truck_category_required as cat, l.capacity_required as cap, l.loading_date as ld,
                d.latitude as dlat, d.longitude as dlng
         from public.loads l
         left join public.locations d on d.id = l.destination_location_id
         where l.id = p_ref_load_id)
  select a.*
  from public.availabilities a
  join public.locations o on o.id = a.origin_location_id
  left join public.locations d on d.id = a.destination_location_id
  left join public.trucks t on t.id = a.truck_id
  cross join me cross join rr
  left join ref r on true
  where public.km_between(me.lat, me.lng, o.latitude, o.longitude) <= rr.km
  order by
    (a.status = 'available' and (a.available_till is null or a.available_till >= rr.today)) desc,
    case
      when r.cat is null then 0
      when t.category is distinct from r.cat then 1
      when r.cap is not null and coalesce(t.capacity_tons, 0) < r.cap then 2
      when r.ld < a.available_from or (a.available_till is not null and r.ld > a.available_till) then 3
      else 0
    end asc,
    coalesce(public.km_between(r.dlat, r.dlng, d.latitude, d.longitude) <= rr.km, false) desc,
    public.km_between(me.lat, me.lng, o.latitude, o.longitude) asc,
    a.created_at desc,
    a.id
$$;

-- 13. Suggested pairs: IST date, never pair a broker's load with their own truck
create or replace function public.crm_suggested_pairs(p_radius_km double precision default 100, p_per_load integer default 3)
returns table(load_id uuid, availability_id uuid, truck_id uuid, distance_km double precision, fit text, on_way boolean)
language sql stable set search_path = public, pg_temp as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d),
  pairs as (
    select l.id as load_id, a.id as availability_id, a.truck_id,
           public.km_between(lo.latitude, lo.longitude, ao.latitude, ao.longitude) as distance_km,
           case
             when t.category is distinct from l.truck_category_required then 'type'
             when l.capacity_required is not null and coalesce(t.capacity_tons, 0) < l.capacity_required then 'size'
             when l.loading_date < a.available_from
               or (a.available_till is not null and l.loading_date > a.available_till) then 'dates'
             else 'good'
           end as fit,
           coalesce(public.km_between(ld.latitude, ld.longitude, ad.latitude, ad.longitude) <= p_radius_km, false) as on_way
    from public.loads l
    cross join today
    join public.locations lo on lo.id = l.origin_location_id
    left join public.locations ld on ld.id = l.destination_location_id
    join public.availabilities a
      on a.status = 'available' and (a.available_till is null or a.available_till >= today.d)
     and a.owner_id <> l.posted_by
    join public.locations ao on ao.id = a.origin_location_id
    left join public.locations ad on ad.id = a.destination_location_id
    left join public.trucks t on t.id = a.truck_id
    where l.status = 'open' and l.loading_date >= today.d
      and public.km_between(lo.latitude, lo.longitude, ao.latitude, ao.longitude) <= p_radius_km
  ),
  ranked as (
    select p.*, row_number() over (
      partition by p.load_id
      order by (p.fit = 'good') desc, p.on_way desc, p.distance_km asc, p.availability_id) as rn
    from pairs p
  )
  select load_id, availability_id, truck_id, distance_km, fit, on_way
  from ranked
  where rn <= greatest(p_per_load, 1)
  order by (fit = 'good') desc, on_way desc, distance_km asc, load_id, rn
$$;

-- 16. Pin pg_temp on remaining SECURITY DEFINER functions
alter function public.user_has_public_listing(uuid) set search_path = public, pg_temp;
alter function public.user_self_update_ok(uuid, public.user_role_enum, public.subscription_type_enum, text, text, public.user_verification_status_enum) set search_path = public, pg_temp;
alter function public.generate_unique_id(text) set search_path = public, pg_temp;
alter function public.luhn_check_digit(integer, integer, integer) set search_path = public, pg_temp;
alter function public.create_admin_alert_for_premium() set search_path = public, pg_temp;
alter function public.trg_generate_user_unique_id() set search_path = public, pg_temp;
alter function public.trg_generate_audit_unique_id() set search_path = public, pg_temp;

-- 7. Grants: no TRUNCATE/TRIGGER/REFERENCES for API roles; anon never writes
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon;

-- 18. Missing FK indexes
create index if not exists idx_admin_alerts_handled_by on public.admin_alerts(handled_by);
create index if not exists idx_crm_matches_availability_id on public.crm_matches(availability_id);
create index if not exists idx_crm_matches_created_by on public.crm_matches(created_by);
create index if not exists idx_crm_matches_owner_id on public.crm_matches(owner_id);
create index if not exists idx_crm_matches_shipper_id on public.crm_matches(shipper_id);
create index if not exists idx_crm_matches_truck_id on public.crm_matches(truck_id);
create index if not exists idx_crm_tickets_related_availability_id on public.crm_tickets(related_availability_id);
create index if not exists idx_crm_tickets_related_load_id on public.crm_tickets(related_load_id);
create index if not exists idx_crm_tickets_related_user_id on public.crm_tickets(related_user_id);
create index if not exists idx_ver_sub_reviewed_by on public.verification_submissions(reviewed_by);
create index if not exists idx_ver_sub_submitted_by on public.verification_submissions(submitted_by);

commit;

-- ---------------------------------------------------------------------------
-- APPLIED 2026-10-14 right after the above, as migration fix_availability_policy_recursion.
-- Rule 3 above read public.trucks inside the availabilities policies while the
-- trucks SELECT policy reads public.availabilities -> "infinite recursion
-- detected in policy". A SECURITY DEFINER helper breaks the cycle.
create or replace function public.caller_owns_truck(p_truck_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.trucks t where t.id = p_truck_id and t.owner_id = (select auth.uid()));
$$;
revoke execute on function public.caller_owns_truck(uuid) from public, anon;
grant execute on function public.caller_owns_truck(uuid) to authenticated;
alter policy "insert availabilities" on public.availabilities with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.users where id = (select auth.uid()) and role in ('truck_owner','broker'))
  and public.caller_owns_truck(truck_id));
alter policy "update availabilities" on public.availabilities with check (
  (owner_id = (select auth.uid()) and public.caller_owns_truck(truck_id))
  or exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','moderator')));
