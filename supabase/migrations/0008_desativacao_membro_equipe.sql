-- Phase 10 Plan 1: profiles.ativo + is_supervisor() extension +
-- desativar_membro_equipe / reativar_membro_equipe RPCs.
--
-- Requirements delivered: EQP-01, EQP-02, EQP-03, EQP-04.
-- Locked decisions implemented: D-01 (a Supervisor can never deactivate
-- their own account) and D-02 (reactivation is possible and deliberately
-- low-friction).
--
-- NEW file, never an edit to 0001-0007 (Pitfall 11 — once pushed via
-- `supabase db push`, any further change is a NEW migration file).
--
-- Source: .planning/phases/10-desativa-o-de-membro-da-equipe/10-PATTERNS.md
--           (Pattern 1 — profiles.ativo + is_supervisor() extension +
--           SECURITY DEFINER RPC pair, exact SQL)
--         .planning/phases/10-desativa-o-de-membro-da-equipe/10-RESEARCH.md
--         supabase/migrations/0001_profiles_and_roles.sql (current
--           is_supervisor() body being replaced; profiles' deliberately
--           zero write-policy posture for regular users)
--         supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql
--           (the CTE/RLS same-snapshot bug this project already fixed once —
--           the reason the reassignment and deactivation UPDATEs below stay
--           as two separate top-level statements, never chained into one
--           data-modifying CTE)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.ativo — on/off switch for team members. `default true`
--    guarantees every existing member stays active after this push.
-- ─────────────────────────────────────────────────────────────────────────
alter table profiles add column ativo boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. is_supervisor() extension — now also requires ativo = true. This
--    single change cascades to EVERY existing RLS policy that already
--    calls is_supervisor(), with zero policy edits, because RLS
--    re-evaluates on every request. This is the primary EQP-03 enforcement:
--    a deactivated Supervisor loses Supervisor-only access on their very
--    next request, with no policy changes needed anywhere else.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'supervisor' and ativo = true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. desativar_membro_equipe — deactivates a team member, reassigning only
--    their em_andamento clientes to a substitute (EQP-01/EQP-04). This is
--    the SECOND documented SECURITY DEFINER exception in this codebase
--    (after is_supervisor() itself): profiles has zero write policies for
--    regular users by design (0001's own header comment), so a non-definer
--    RPC's internal UPDATE would affect zero rows regardless of caller.
--    Safety depends entirely on `if not is_supervisor()` being the literal
--    first statement of the function body.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function desativar_membro_equipe(
  p_profile_id uuid,
  p_novo_responsavel_id uuid
)
returns table(clientes_reatribuidos bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role user_role;
  v_reatribuidos bigint;
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem desativar membros da equipe';
  end if;

  -- D-01: a Supervisor can never deactivate their own account, even when
  -- other Supervisors remain active. Separate rule from the last-active-
  -- Supervisor guard below (that one is about never zeroing Supervisors;
  -- this one is about never self-locking-out mid-action).
  if p_profile_id = (select auth.uid()) then
    raise exception 'Não é possível desativar a própria conta';
  end if;

  select role into v_target_role from profiles where id = p_profile_id;
  if v_target_role is null then
    raise exception 'Membro não encontrado';
  end if;

  -- Defensive check required precisely because SECURITY DEFINER bypasses
  -- RLS, so the caller's own scoping cannot be trusted — the substitute
  -- must be independently verified as an active profile.
  if not exists (
    select 1 from profiles
    where id = p_novo_responsavel_id and ativo = true
  ) then
    raise exception 'Vendedor substituto inválido ou inativo';
  end if;

  -- EQP-02: never allow the system to end up with zero active Supervisors.
  -- The row-locking `perform` statement below is taken BEFORE the count(*)
  -- check — that ordering is the whole TOCTOU mitigation (T-10-02): a
  -- concurrent deactivation of another Supervisor cannot race past this
  -- point until the first transaction commits or rolls back.
  if v_target_role = 'supervisor' then
    perform 1 from profiles
    where role = 'supervisor' and ativo = true
    for update;

    if (
      select count(*) from profiles
      where role = 'supervisor' and ativo = true and id <> p_profile_id
    ) < 1 then
      raise exception 'Não é possível desativar o último Supervisor ativo';
    end if;
  end if;

  -- EQP-01/EQP-04 reassignment as its own top-level statement. Only
  -- em_andamento clientes move to the substitute; already-won/already-lost
  -- clientes stay credited to the deactivated member, preserving historical
  -- accuracy. Deliberately NOT chained into the same CTE as the next
  -- UPDATE — that would reintroduce the exact same-snapshot visibility
  -- defect this repository already had to fix in migration 0006. The
  -- `get diagnostics` line immediately below is the structural proof these
  -- stayed two separate statements.
  update clientes
  set responsavel = p_novo_responsavel_id
  where responsavel = p_profile_id
    and status_acompanhamento = 'em_andamento';
  get diagnostics v_reatribuidos = row_count;

  -- Deactivation as a separate top-level statement.
  update profiles set ativo = false where id = p_profile_id;

  return query select v_reatribuidos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. reativar_membro_equipe — D-02: reactivation is possible and
--    deliberately low-friction. No last-Supervisor guard and no self-guard
--    apply in this direction, because reactivating strictly adds capacity
--    back. Two separate RPCs (not one branching RPC with a boolean
--    parameter) because the guard logic genuinely differs between the two
--    directions.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function reativar_membro_equipe(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem reativar membros da equipe';
  end if;

  update profiles set ativo = true where id = p_profile_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Deliberately NOT done in this migration (see 10-PATTERNS.md / 10-CONTEXT.md):
--   - No UPDATE policy added on profiles — a Supervisor-scoped UPDATE
--     policy would open every column (including `role`) to direct client
--     writes.
--   - No is_ativo() helper, no edits to the Vendedor branch of the
--     clientes/tarefas/historico policies — the residual window in which a
--     deactivated Vendedor's still-valid token can still read their own
--     already-closed clientes was presented to the project owner and
--     explicitly accepted as-is (T-10-06). Out of scope for this phase.
-- ─────────────────────────────────────────────────────────────────────────
