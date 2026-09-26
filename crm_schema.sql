-- ===========================================================================
-- LoadKaro CRM — ops desk schema
-- ===========================================================================
-- Adds the four things the ops team works out of, and nothing else:
--
--   crm_matches      an ops-brokered pairing of one load with one truck
--                    availability, tracked through the calls it takes to get
--                    both sides to agree.
--   crm_activities   the shared call/note log. Polymorphic on (entity_type,
--                    entity_id) so one timeline component serves matches,
--                    tickets, users, loads and KYC submissions.
--   crm_tickets      the support desk. Clients raise these from the web
--                    portal; staff also raise them on behalf of someone who
--                    phoned in (hence contact_phone without raised_by).
--   verification_submissions.assigned_to / assigned_at / chase_count
--                    turns the existing KYC table into a queue a named
--                    reviewer owns, with something to measure ageing against.
--
-- Deliberately NOT here: revenue, commission, deal value, subscription plans.
-- LoadKaro is free right now; adding money columns before there is a money
-- model produces fields nobody fills and reports nobody trusts.
--
-- Safe to run more than once — every statement is guarded.
--
-- Apply with:  psql "$DATABASE_URL" -f crm_schema.sql
--          or: paste into Supabase → SQL Editor → Run
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Shared: bump updated_at on write.
-- Named crm_* so it cannot collide with whatever the existing tables use.
-- ---------------------------------------------------------------------------
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 1. crm_activities — the call / note log
-- ---------------------------------------------------------------------------
create table if not exists public.crm_activities (
  id          uuid primary key default gen_random_uuid(),

  -- Polymorphic target. No FK: the row must outlive the load or availability
  -- it describes, because "we called this shipper and the load was fake" is
  -- exactly the history you want kept after the load is deleted.
  entity_type text not null check (entity_type in (
                'user', 'load', 'availability', 'truck',
                'match', 'ticket', 'verification')),
  entity_id   uuid not null,

  kind        text not null default 'note' check (kind in (
                'call', 'note', 'sms', 'whatsapp',
                'status_change', 'assignment')),

  -- Calls only. A note has no direction and no outcome.
  direction   text check (direction in ('inbound', 'outbound')),
  outcome     text check (outcome in (
                'connected', 'no_answer', 'wrong_number',
                'busy', 'switched_off', 'not_interested')),

  body        text,

  -- The staff member who logged it. Nullable so deleting a moderator does not
  -- delete the history of what they did.
  author_id   uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- The only read pattern: one entity's timeline, newest first.
create index if not exists crm_activities_entity_idx
  on public.crm_activities (entity_type, entity_id, created_at desc);

create index if not exists crm_activities_author_idx
  on public.crm_activities (author_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 2. crm_matches — the matching desk
-- ---------------------------------------------------------------------------
create table if not exists public.crm_matches (
  id              uuid primary key default gen_random_uuid(),

  -- Human-readable handle. Staff say "match 214" on the phone; nobody reads a
  -- uuid aloud. Rendered as MTC-00214 by the UI.
  ref_no          bigint generated always as identity,

  load_id         uuid not null references public.loads(id) on delete cascade,

  -- Nullable: a match can start as "this load needs a truck, I am working on
  -- it" before a specific availability is picked.
  availability_id uuid references public.availabilities(id) on delete set null,
  truck_id        uuid references public.trucks(id) on delete set null,

  -- Denormalised so the pipeline board renders without four joins, and so the
  -- record still says who the parties were after a listing is deleted.
  shipper_id      uuid references public.users(id) on delete set null,
  owner_id        uuid references public.users(id) on delete set null,

  stage           text not null default 'proposed' check (stage in (
                    'proposed',           -- desk paired them, nobody called yet
                    'shipper_contacted',
                    'owner_contacted',
                    'both_agreed',        -- verbal yes from both sides
                    'confirmed',          -- truck assigned, load closing
                    'completed',          -- trip happened
                    'fell_through')),

  shipper_contacted_at timestamptz,
  owner_contacted_at   timestamptz,

  -- What the two parties settled on, if they told us. LoadKaro does not set
  -- prices, so this is intelligence, not a quote.
  agreed_rate     numeric,

  fell_through_reason text,
  notes           text,

  created_by      uuid references public.users(id) on delete set null,
  assigned_to     uuid references public.users(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One desk should not pair the same load with the same truck twice. NULLs are
-- distinct in Postgres unique indexes, so this still allows several
-- "working on it, no truck yet" rows — which is wrong, so guard that
-- separately below.
create unique index if not exists crm_matches_load_avail_uniq
  on public.crm_matches (load_id, availability_id)
  where availability_id is not null;

-- At most one open unpaired match per load.
create unique index if not exists crm_matches_load_open_unpaired_uniq
  on public.crm_matches (load_id)
  where availability_id is null
    and stage not in ('completed', 'fell_through');

create index if not exists crm_matches_stage_idx
  on public.crm_matches (stage, updated_at desc);

create index if not exists crm_matches_assigned_idx
  on public.crm_matches (assigned_to, stage);

create index if not exists crm_matches_load_idx
  on public.crm_matches (load_id);

drop trigger if exists crm_matches_touch on public.crm_matches;
create trigger crm_matches_touch
  before update on public.crm_matches
  for each row execute function public.crm_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. crm_tickets — the support desk
-- ---------------------------------------------------------------------------
create table if not exists public.crm_tickets (
  id            uuid primary key default gen_random_uuid(),
  ref_no        bigint generated always as identity,  -- rendered TKT-00042

  -- Set when a signed-in client raises it from the portal. Null when a staff
  -- member logs a call from someone who is not (yet) a user — keep
  -- contact_phone for those.
  raised_by     uuid references public.users(id) on delete set null,
  contact_phone text,
  contact_name  text,

  subject       text not null,
  body          text,

  category      text not null default 'other' check (category in (
                  'bad_contact',       -- number dead / wrong person
                  'fake_listing',
                  'payment_dispute',
                  'verification',
                  'app_bug',
                  'feature_request',
                  'other')),

  priority      text not null default 'normal'
                  check (priority in ('low', 'normal', 'high', 'urgent')),

  -- Postgres sorts text alphabetically, which puts 'high' *after* 'normal'
  -- and 'low' — exactly backwards for a queue. The desk orders on this
  -- instead, so "most urgent first" is one index scan and not a client-side
  -- re-sort of a page that was already cut to 25 rows.
  priority_rank integer generated always as (
                  case priority
                    when 'urgent' then 0
                    when 'high'   then 1
                    when 'normal' then 2
                    else 3
                  end
                ) stored,

  status        text not null default 'open' check (status in (
                  'open',
                  'in_progress',
                  'waiting_on_client',
                  'resolved',
                  'closed')),

  assigned_to   uuid references public.users(id) on delete set null,

  related_load_id         uuid references public.loads(id) on delete set null,
  related_availability_id uuid references public.availabilities(id) on delete set null,
  related_user_id         uuid references public.users(id) on delete set null,

  source        text not null default 'portal' check (source in (
                  'portal', 'phone', 'whatsapp', 'app', 'email')),

  -- Client-visible. Internal working notes belong in crm_activities, which
  -- the client cannot read.
  resolution    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists crm_tickets_status_idx
  on public.crm_tickets (status, priority_rank, created_at);

create index if not exists crm_tickets_assigned_idx
  on public.crm_tickets (assigned_to, status);

create index if not exists crm_tickets_raised_by_idx
  on public.crm_tickets (raised_by, created_at desc);

drop trigger if exists crm_tickets_touch on public.crm_tickets;
create trigger crm_tickets_touch
  before update on public.crm_tickets
  for each row execute function public.crm_touch_updated_at();

-- Stamp resolved_at from the status change rather than trusting the caller to
-- send both, so "how long did this take" is always answerable.
create or replace function public.crm_tickets_stamp_resolved()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('resolved', 'closed')
     and (old.status is null or old.status not in ('resolved', 'closed')) then
    new.resolved_at = coalesce(new.resolved_at, now());
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_at = null;   -- reopened
  end if;
  return new;
end;
$$;

drop trigger if exists crm_tickets_resolved on public.crm_tickets;
create trigger crm_tickets_resolved
  before update on public.crm_tickets
  for each row execute function public.crm_tickets_stamp_resolved();


-- ---------------------------------------------------------------------------
-- 4. Turn verification_submissions into an owned queue
-- ---------------------------------------------------------------------------
-- The table already carries status / review_decision / reviewed_by /
-- reviewed_at / rejection_reason. What it lacks is an owner before the
-- decision (so two moderators do not review the same documents) and a record
-- of chasing a rejected user for a re-submission.
alter table public.verification_submissions
  add column if not exists assigned_to    uuid references public.users(id) on delete set null,
  add column if not exists assigned_at    timestamptz,
  add column if not exists chase_count    integer not null default 0,
  add column if not exists last_chased_at timestamptz;

create index if not exists verification_submissions_queue_idx
  on public.verification_submissions (status, created_at);

create index if not exists verification_submissions_assigned_idx
  on public.verification_submissions (assigned_to, status);


-- ===========================================================================
-- RLS
-- ===========================================================================
-- The CRM is staff-only and reached exclusively through the dashboard's
-- /api/crm/* routes, which use the service_role key and are guarded by
-- requireDashboardAccess() (role must be admin or moderator). service_role
-- bypasses RLS, so enabling RLS with no policy is the correct lockdown here:
-- it means the anon key — the one shipped inside the mobile app and the client
-- web portal — cannot touch these tables at all.
--
-- crm_tickets is the one exception, because clients raise their own.
-- ---------------------------------------------------------------------------

alter table public.crm_activities enable row level security;
alter table public.crm_matches    enable row level security;
alter table public.crm_tickets    enable row level security;

-- Re-running the file must not stack duplicate policies.
drop policy if exists crm_tickets_own_select on public.crm_tickets;
drop policy if exists crm_tickets_own_insert on public.crm_tickets;

-- A client sees their own tickets — subject, status and the resolution text —
-- and nothing of anyone else's.
create policy crm_tickets_own_select
  on public.crm_tickets
  for select
  to authenticated
  using (raised_by = auth.uid());

-- A client may open a ticket for themselves only, and may not open it
-- pre-triaged. Without pinning these, a caller could POST status='resolved'
-- with a priority of 'urgent' and an assignee of their choosing.
create policy crm_tickets_own_insert
  on public.crm_tickets
  for insert
  to authenticated
  with check (
    raised_by   = auth.uid()
    and status      = 'open'
    and assigned_to is null
    and resolution  is null
    and resolved_at is null
    and priority in ('low', 'normal')
    and source      = 'portal'
  );

-- No client UPDATE or DELETE policy on purpose: a client cannot close their
-- own ticket, edit the subject after the fact, or rewrite a resolution. If
-- they want to add something they reply, which the portal records as a new
-- ticket comment via the staff-side API.

commit;

-- ===========================================================================
-- Verification — run after applying
-- ===========================================================================
--   select table_name, count(*)
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name in ('crm_matches','crm_activities','crm_tickets')
--   group by table_name;
--   -- expect 3 rows
--
--   select tablename, policyname
--   from pg_policies
--   where schemaname = 'public' and tablename like 'crm_%';
--   -- expect exactly 2 rows, both on crm_tickets
--
--   select column_name from information_schema.columns
--   where table_name = 'verification_submissions'
--     and column_name in ('assigned_to','assigned_at','chase_count','last_chased_at');
--   -- expect 4 rows
-- ===========================================================================
