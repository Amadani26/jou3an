-- ===================================================================
-- Jou3an waitlist — run this once in the Supabase dashboard
-- (SQL Editor → New query → paste → Run).
--
-- Security model: the landing page is a static site holding only the
-- anon key, so the anon role gets INSERT and NOTHING else. The signup
-- count is exposed through a SECURITY DEFINER function, which means
-- anon can read the NUMBER without ever being able to read the ROWS.
-- ===================================================================

-- 1. Table ----------------------------------------------------------
create table if not exists public.waitlist_signups (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  created_at  timestamptz not null default now(),
  source      text        not null default 'landing'
);

-- Case-insensitive uniqueness: store lowercase (the client lowercases
-- too) so Foo@x.com and foo@x.com can't both get on the list.
create unique index if not exists waitlist_signups_email_lower_idx
  on public.waitlist_signups (lower(email));

-- 2. Row Level Security ---------------------------------------------
alter table public.waitlist_signups enable row level security;

-- Start from zero: strip any inherited table grants, then hand back
-- exactly one verb. No select / update / delete for anon, ever.
revoke all on table public.waitlist_signups from anon, authenticated;
grant insert on table public.waitlist_signups to anon;

drop policy if exists "anon can join the waitlist" on public.waitlist_signups;
create policy "anon can join the waitlist"
  on public.waitlist_signups
  for insert
  to anon
  with check (true);

-- No SELECT/UPDATE/DELETE policies are defined, so with RLS enabled
-- those are denied for anon even if a grant is ever restored.

-- 3. Public counter RPC ---------------------------------------------
-- SECURITY DEFINER: runs as the owner, so it can count rows the caller
-- cannot read. Returns the real count plus the 731 baseline.
create or replace function public.waitlist_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint + 731 from public.waitlist_signups;
$$;

revoke all on function public.waitlist_count() from public, anon, authenticated;
grant execute on function public.waitlist_count() to anon, authenticated;

-- 4. Sanity checks ---------------------------------------------------
-- select public.waitlist_count();                          -- => 731
-- insert into public.waitlist_signups (email) values ('a@b.com');
-- select public.waitlist_count();                          -- => 732
