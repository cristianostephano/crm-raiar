-- Phase 12 Plan 1: Comparativo por Vendedor — VEND-01 read-only aggregation.
--
-- Single `language sql stable` function, `dashboard_comparativo_vendedor()`,
-- returning one row per vendedor ATIVO with negócios iniciados de histórico
-- completo (D-01/D-02), ganho, perdido e ciclo médio em dias GANHO-ONLY
-- (D-04). NEW file only, never an edit to an already-applied migration
-- (CLAUDE.md: "Não deletar ou sobrescrever migrations já aplicadas").
--
-- Purely additive: one new function, no new table/column/index/policy, and
-- no change to any other dashboard_* RPC already in this codebase.
--
-- Source: .planning/phases/12-comparativo-por-vendedor/12-01-PLAN.md (Task 1)
--         .planning/phases/12-comparativo-por-vendedor/12-PATTERNS.md
--         .planning/phases/12-comparativo-por-vendedor/12-RESEARCH.md
--         .planning/phases/12-comparativo-por-vendedor/12-CONTEXT.md
--           (D-01/D-02/D-03/D-04)

-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER by omission — dashboard_comparativo_vendedor() below
-- deliberately has NO "security definer" clause, mirroring every other
-- dashboard_* function. It runs as the CALLING user, so every internal
-- SELECT against clientes/historico is transparently scoped by RLS.
--
-- NEVER add "security definer" here: it would silently bypass RLS and
-- start returning every vendedor's real numbers to every caller. Proven by
-- tests/dashboard/rls-dashboard.test.ts and
-- tests/dashboard/comparativo-vendedor.test.ts, which fail loudly if this
-- rule is ever violated.
--
-- NOTE: profiles has an OPEN, unconditional SELECT RLS policy for every
-- authenticated user (0001_profiles_and_roles.sql, `using (true)`) — the
-- vendedores_ativos CTE below is therefore never narrowed by the caller's
-- own role. This is pre-existing behavior (also relied on by
-- lib/equipe/membros.ts and dashboard_desempenho_vendedor()'s own `left
-- join profiles`), not a new leak introduced here. Do not add a role check.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function dashboard_comparativo_vendedor()
returns table(
  responsavel uuid,
  responsavel_nome text,
  negocios_iniciados bigint,
  ganho bigint,
  perdido bigint,
  ciclo_medio_dias numeric
)
language sql
stable
as $$
  with vendedores_ativos as (
    -- The ONLY CTE in this function allowed to mention "ativo" — who gets a
    -- LINE in this table is deliberately decoupled from which historical
    -- data counts (see agregados below, which never re-applies this
    -- filter).
    select
      p.id,
      trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as nome
    from profiles p
    where p.role = 'vendedor' and p.ativo = true
  ),
  ultimo_status_change as (
    -- Verbatim from 0003/0009 — do not modify this CTE's logic or the
    -- descricao text-comparison operator.
    select distinct on (h.cliente_id)
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
      and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
    order by h.cliente_id, h.criado_em desc
  ),
  fechamentos as (
    -- Confirms the deduplicated latest event still matches clientes' status
    -- today — a since-reverted event must not count as the current
    -- fechamento.
    select
      c.id as cliente_id,
      u.status_evento,
      c.criado_em,
      u.criado_em as fechado_em
    from clientes c
    join ultimo_status_change u on u.cliente_id = c.id
    where c.status_acompanhamento::text = u.status_evento
  ),
  agregados as (
    -- Single GROUP BY over ONE clientes row set — negocios_iniciados, ganho
    -- and perdido all derive from the same rows, which guarantees by
    -- construction that ganho + perdido never exceeds negocios_iniciados.
    select
      c.responsavel,
      -- D-01/D-02: "desde sempre" means NO date recorte at all. The base is
      -- the CURRENT clientes.responsavel assignment, not a reconstruction
      -- of past reassignments.
      count(*) as negocios_iniciados,
      count(*) filter (where f.status_evento = 'ganho') as ganho,
      count(*) filter (where f.status_evento = 'perdido') as perdido,
      -- D-04: ciclo médio é GANHO-ONLY — um perdido nunca entra nessa
      -- média. NULL é o resultado correto (não é bug) para um vendedor sem
      -- nenhum ganho; nunca envolver em coalesce para 0.
      round(
        (avg(extract(epoch from (f.fechado_em - f.criado_em)))
           filter (where f.status_evento = 'ganho') / 86400.0
        )::numeric,
        1
      ) as ciclo_medio_dias
    from clientes c
    left join fechamentos f on f.cliente_id = c.id
    -- Deliberately NO join to vendedores_ativos and NO papel/ativo filter
    -- here: os clientes/historico de um vendedor desativado continuam
    -- contando em toda outra agregação do sistema, e reaplicar o filtro
    -- aqui quebraria essa garantia.
    group by c.responsavel
  )
  select
    v.id as responsavel,
    v.nome as responsavel_nome,
    coalesce(a.negocios_iniciados, 0) as negocios_iniciados,
    coalesce(a.ganho, 0) as ganho,
    coalesce(a.perdido, 0) as perdido,
    a.ciclo_medio_dias
  from vendedores_ativos v
  left join agregados a on a.responsavel = v.id
  order by v.nome;
$$;
-- No `security definer` — do not add one.
