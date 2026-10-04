-- ===========================================================================
-- Coordinate matching v1 — APPLIED to project ffbbujudebmtbuyssnsn on
-- 2026-10-04 as migration `matching_v1_functions` (record copy; safe to re-run).
-- Spec: docs/MATCHING_SPEC.md. City centre to city centre, straight-line km,
-- 100 km default radius. No PostGIS needed at this size.
--
-- Data step (not in this file): locations.latitude/longitude were filled for
-- 2,029 of 2,171 cities from the GeoNames India dump (CC BY 4.0) the same day;
-- unresolved cities are listed in docs/geo_unresolved_cities.csv.
-- ===========================================================================

create or replace function public.km_between(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 2 * 6371 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
  end
$$;

-- GPS -> nearest city. Takes the phone's position, stores nothing, returns
-- only the city. Nothing beyond 150 km counts (outside our coverage).
create or replace function public.nearest_location(p_lat double precision, p_lng double precision)
returns table (id uuid, city text, state text, distance_km double precision)
language sql stable
set search_path = public, pg_temp
as $$
  select l.id, l.city, l.state, public.km_between(p_lat, p_lng, l.latitude, l.longitude)
  from public.locations l
  where p_lat between -90 and 90 and p_lng between -180 and 180
    and l.latitude is not null
    and l.latitude between p_lat - 1.5 and p_lat + 1.5
    and l.longitude between p_lng - 1.6 and p_lng + 1.6
    and public.km_between(p_lat, p_lng, l.latitude, l.longitude) <= 150
  order by 4 asc
  limit 1
$$;

-- Loads whose pickup city is within p_radius_km of the user's city.
-- Order: live first; then "on your way" (drop near p_headed_location_id);
-- then nearest. Returns loads rows so PostgREST can embed relations, and runs
-- as the caller so the existing loads RLS still applies.
create or replace function public.nearby_loads(
  p_location_id uuid,
  p_radius_km double precision default 100,
  p_headed_location_id uuid default null)
returns setof public.loads
language sql stable
set search_path = public, pg_temp
as $$
  with me as (select latitude as lat, longitude as lng from public.locations where id = p_location_id),
       headed as (select latitude as lat, longitude as lng from public.locations where id = p_headed_location_id)
  select l.*
  from public.loads l
  join public.locations o on o.id = l.origin_location_id
  left join public.locations d on d.id = l.destination_location_id
  cross join me
  left join headed h on true
  where public.km_between(me.lat, me.lng, o.latitude, o.longitude) <= p_radius_km
  order by
    (l.status = 'open' and l.loading_date >= current_date) desc,
    coalesce(public.km_between(h.lat, h.lng, d.latitude, d.longitude) <= p_radius_km, false) desc,
    public.km_between(me.lat, me.lng, o.latitude, o.longitude) asc,
    l.created_at desc,
    l.id
$$;

-- Truck availabilities starting within p_radius_km of the user's city.
-- With p_ref_load_id (the shipper's latest open load) good fits sort first:
-- type, then size, then dates (docs/MATCHING_SPEC.md "Fit rules").
create or replace function public.nearby_availabilities(
  p_location_id uuid,
  p_radius_km double precision default 100,
  p_ref_load_id uuid default null)
returns setof public.availabilities
language sql stable
set search_path = public, pg_temp
as $$
  with me as (select latitude as lat, longitude as lng from public.locations where id = p_location_id),
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
  cross join me
  left join ref r on true
  where public.km_between(me.lat, me.lng, o.latitude, o.longitude) <= p_radius_km
  order by
    (a.status = 'available' and (a.available_till is null or a.available_till >= current_date)) desc,
    case
      when r.cat is null then 0
      when t.category is distinct from r.cat then 1
      when r.cap is not null and coalesce(t.capacity_tons, 0) < r.cap then 2
      when r.ld < a.available_from or (a.available_till is not null and r.ld > a.available_till) then 3
      else 0
    end asc,
    coalesce(public.km_between(r.dlat, r.dlng, d.latitude, d.longitude) <= p_radius_km, false) desc,
    public.km_between(me.lat, me.lng, o.latitude, o.longitude) asc,
    a.created_at desc,
    a.id
$$;

-- Ops desk: every open, future load paired with its closest live trucks
-- within the radius (top p_per_load each), with the fit verdict. Cross-user
-- data, so service_role only (the dashboard's /api/crm routes).
create or replace function public.crm_suggested_pairs(
  p_radius_km double precision default 100,
  p_per_load integer default 3)
returns table (
  load_id uuid, availability_id uuid, truck_id uuid,
  distance_km double precision, fit text, on_way boolean)
language sql stable
set search_path = public, pg_temp
as $$
  with pairs as (
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
    join public.locations lo on lo.id = l.origin_location_id
    left join public.locations ld on ld.id = l.destination_location_id
    join public.availabilities a
      on a.status = 'available' and (a.available_till is null or a.available_till >= current_date)
    join public.locations ao on ao.id = a.origin_location_id
    left join public.locations ad on ad.id = a.destination_location_id
    left join public.trucks t on t.id = a.truck_id
    where l.status = 'open' and l.loading_date >= current_date
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

revoke execute on function public.crm_suggested_pairs(double precision, integer) from public, anon, authenticated;
grant execute on function public.crm_suggested_pairs(double precision, integer) to service_role;

revoke execute on function public.nearest_location(double precision, double precision) from public, anon;
revoke execute on function public.nearby_loads(uuid, double precision, uuid) from public, anon;
revoke execute on function public.nearby_availabilities(uuid, double precision, uuid) from public, anon;
grant execute on function public.nearest_location(double precision, double precision) to authenticated;
grant execute on function public.nearby_loads(uuid, double precision, uuid) to authenticated;
grant execute on function public.nearby_availabilities(uuid, double precision, uuid) to authenticated;

create index if not exists idx_locations_lat_lng on public.locations (latitude, longitude);
