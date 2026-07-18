-- Phase 4 Plan 1: Dashboard Gerencial — read-only aggregation layer.
--
-- Five `language sql stable` functions, one per dashboard metric
-- (DSH-01/DSH-02/DSH-03/DSH-05). NEW file only, never an edit to 0001/0002
-- (Pitfall 11 — once pushed, any further change is a NEW migration file).
--
-- No new tables, no mutations — CONTEXT.md's Phase Boundary: "não cria
-- tabelas novas, só agrega o que já existe (clientes, historico,
-- cliente_produtos)".
--
-- Source: .planning/phases/04-dashboard-gerencial/04-01-PLAN.md (Task 2)
--         .planning/phases/04-dashboard-gerencial/04-RESEARCH.md
--           (Architecture Patterns 1-3, Pitfalls 1/2/4)
--         .planning/phases/04-dashboard-gerencial/04-CONTEXT.md
--           (D-02/D-07/D-08/D-09/D-10)

-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER by omission — every function below deliberately has NO
-- "security definer" clause, mirroring 0002_clientes_and_funil.sql's
-- mover_card_funil precedent. Each function runs as the CALLING user, so
-- every internal SELECT against clientes/historico/cliente_produtos is
-- transparently scoped by the RLS policies already defined in 0001/0002 —
-- a Vendedor's call only ever aggregates their own clientes rows, a
-- Supervisor's call aggregates every vendedor's rows (D-07, DSH-06/DSH-07).
--
-- NEVER add "security definer" here: it would silently bypass RLS and
-- start returning every vendedor's data to every caller, defeating
-- D-07/DSH-06/DSH-07 with no error or warning
-- (04-RESEARCH.md Pitfall 4 / T-04-02). Proven by
-- tests/dashboard/rls-dashboard.test.ts, which fails loudly if this rule is
-- ever violated.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- 1. dashboard_clientes_por_etapa — DSH-01/DSH-08: a live snapshot of the
--    current pipeline, no date parameters (D-08 — NOT filtered by the
--    period picker).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_clientes_por_etapa()
returns table(etapa etapa_funil, total bigint)
language sql
stable
as $$
  select etapa, count(*) as total
  from clientes
  group by etapa;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. dashboard_ganhos_perdidos — DSH-02/D-02: period filters by the date of
--    the most recent status-change historico row, NOT clientes.criado_em
--    and NOT clientes.etapa_alterada_em (which only tracks etapa changes,
--    04-RESEARCH.md Pitfall 1). historico.descricao is always exactly
--    format('Status alterado para "%s"', new.status_acompanhamento::text),
--    written only by clientes_after_update_historico() (0002) — ILIKE
--    matching against this fixed format string is reliable since that
--    trigger is the only writer.
--
--    The `distinct on (cliente_id) ... order by criado_em desc` CTE takes
--    only the MOST RECENT status-change event per cliente in the period,
--    and the outer WHERE cross-checks it still matches clientes.
--    status_acompanhamento today — this is what prevents double-counting a
--    cliente that flipped status more than once
--    (e.g. perdido -> em_andamento -> ganho), per 04-RESEARCH.md Pitfall 2.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_ganhos_perdidos(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(status text, total bigint)
language sql
stable
as $$
  with ultimo_status_change as (
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
  )
  select u.status_evento as status, count(*) as total
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id  -- RLS on clientes applies here
  where u.criado_em >= p_inicio
    and u.criado_em <  p_fim
    and c.status_acompanhamento::text = u.status_evento  -- only count if still that status today
  group by u.status_evento;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. dashboard_desempenho_vendedor — DSH-03/D-10: the exact same
--    ganho/perdido-via-historico basis as dashboard_ganhos_perdidos, only
--    grouped by clientes.responsavel instead of summed. Because this
--    function is SECURITY INVOKER, a Vendedor's call is transparently
--    restricted by RLS to their own clientes rows BEFORE the
--    "group by responsavel" even runs — the function itself needs zero
--    is_supervisor() check to return exactly one row for a Vendedor caller
--    (D-07).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_desempenho_vendedor(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(
  responsavel uuid,
  responsavel_nome text,
  ganho bigint,
  perdido bigint
)
language sql
stable
as $$
  with ultimo_status_change as (
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
  )
  select
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    count(*) filter (where u.status_evento = 'ganho') as ganho,
    count(*) filter (where u.status_evento = 'perdido') as perdido
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id  -- RLS on clientes applies here
  left join profiles p on p.id = c.responsavel  -- open SELECT policy (0001)
  where u.criado_em >= p_inicio
    and u.criado_em <  p_fim
    and c.status_acompanhamento::text = u.status_evento
  group by c.responsavel, p.nome, p.sobrenome;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. dashboard_prospeccao_por_produto — DSH-05/D-09: filters by
--    clientes.criado_em (cadastro date), NOT the status-change date basis
--    used by ganhos/perdidos — a deliberately different date column for a
--    deliberately different question ("when was this prospect
--    registered"), per D-09.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_prospeccao_por_produto(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(
  produto_id uuid,
  produto_nome text,
  total bigint
)
language sql
stable
as $$
  select
    pc.id as produto_id,
    pc.nome as produto_nome,
    count(distinct c.id) as total
  from clientes c  -- RLS on clientes applies here
  join cliente_produtos cp on cp.cliente_id = c.id
  join produtos_consumidos pc on pc.id = cp.produto_id
  where c.criado_em >= p_inicio
    and c.criado_em <  p_fim
  group by pc.id, pc.nome;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. dashboard_prospeccao_por_categoria — DSH-05/D-09: same criado_em date
--    basis as dashboard_prospeccao_por_produto, grouped by categoria
--    instead of produto.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_prospeccao_por_categoria(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(
  categoria_id uuid,
  categoria_nome text,
  total bigint
)
language sql
stable
as $$
  select
    cat.id as categoria_id,
    cat.nome as categoria_nome,
    count(distinct c.id) as total
  from clientes c  -- RLS on clientes applies here
  join categorias cat on cat.id = c.categoria_id
  where c.criado_em >= p_inicio
    and c.criado_em <  p_fim
  group by cat.id, cat.nome;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Supporting indexes — keep the period scans in functions 2-5 cheap.
-- ─────────────────────────────────────────────────────────────────────────
create index idx_historico_tipo_criado on historico (tipo, criado_em);
create index idx_clientes_criado_em on clientes (criado_em);
