-- Phase 1 Plan 2: profiles table, role enum, RLS, is_supervisor(), handle_new_user trigger
--
-- Single migration file on purpose (Pitfall 1 — RLS enable + policy + trigger
-- must not be split across migrations). This is also the first migration ever
-- applied to this project (Pitfall 11 — once pushed via `supabase db push`,
-- any further change is a NEW migration file, never an edit to this one).
--
-- Source: .planning/phases/01-autentica-o-e-pap-is/01-PATTERNS.md
--         (Pattern 1 + Pattern 2, itself sourced from .planning/research/ARCHITECTURE.md)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Role enum
-- ─────────────────────────────────────────────────────────────────────────
create type user_role as enum ('supervisor', 'vendedor');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. profiles table
-- ─────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  sobrenome text not null,
  celular text not null,
  role user_role not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

-- SECURITY DEFINER so the internal lookup bypasses RLS on profiles itself,
-- avoiding recursive-policy evaluation (RESEARCH.md Pattern 1 / Pitfall).
-- auth.uid() is wrapped as (select auth.uid()) per Pitfall 4, so it is
-- evaluated once per statement instead of once per row.
create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'supervisor'
  );
$$;

-- Every authenticated user (Supervisor or Vendedor) can read the full team
-- list — needed for the "responsavel" dropdown and the "gerenciar equipe"
-- list built in later plans/phases. No sensitive secret lives in profiles.
create policy "usuarios autenticados veem todos os perfis"
on profiles for select
to authenticated
using (true);

-- Deliberately NO insert/update/delete policy for regular users.
-- profiles rows are only ever created by the handle_new_user trigger below
-- (SECURITY DEFINER, bypasses RLS). Editing an existing profile's role/data
-- is explicitly out of scope for this phase (D-07) — the absence of a write
-- policy is itself the Tampering control (T-01-04).

-- ─────────────────────────────────────────────────────────────────────────
-- 4. handle_new_user trigger — syncs invite/createUser metadata into profiles
-- ─────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, sobrenome, celular, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nome',
    new.raw_user_meta_data ->> 'sobrenome',
    new.raw_user_meta_data ->> 'celular',
    (new.raw_user_meta_data ->> 'role')::user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
