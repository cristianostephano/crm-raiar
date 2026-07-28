-- Phase 11 Plan 1: Funil de Conversão Detalhado — reconstructs "how long did
-- each cliente spend in each funnel stage" from historico (an append-only
-- audit log that only records CHANGES, never durations), plus the average
-- days until ganho/perdido.
--
-- Two `language sql stable` functions (FNL-01, FNL-02). NEW file only, never
-- an edit to an already-applied migration (CLAUDE.md: "Não deletar ou
-- sobrescrever migrations já aplicadas").
--
-- No new tables, no mutations — this phase is additive SQL only, over data
-- that already exists (clientes, historico).
--
-- Source: .planning/phases/11-funil-de-convers-o-detalhado/11-01-PLAN.md (Task 1)
--         .planning/phases/11-funil-de-convers-o-detalhado/11-RESEARCH.md
--           (Architecture Patterns 1-3, Anti-Patterns, Pitfalls 1-6)
--         .planning/phases/11-funil-de-convers-o-detalhado/11-PATTERNS.md
--         .planning/phases/11-funil-de-convers-o-detalhado/11-CONTEXT.md
--           (D-01/D-02/D-03)

-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER by omission — every function below deliberately has NO
-- "security definer" clause, mirroring 0003_dashboard_aggregates.sql's
-- established convention exactly. Each function runs as the CALLING user,
-- so every internal SELECT against clientes/historico is transparently
-- scoped by the RLS policies already defined in 0001/0002 — a Vendedor's
-- call only ever aggregates their own clientes rows, a Supervisor's call
-- aggregates every vendedor's rows. This is the ENTIRE mechanism that
-- delivers FNL-03 — zero new permission code.
--
-- NEVER add "security definer" here: it would silently bypass RLS and
-- start returning every vendedor's data to every caller, defeating FNL-03
-- with no error or warning. Proven by tests/dashboard/rls-dashboard.test.ts
-- (extended by this phase) and tests/dashboard/funil-detalhado.test.ts,
-- which fail loudly if this rule is ever violated.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- 1. dashboard_funil_detalhado — FNL-01 (+ D-02 "% avançou" + D-03 "gargalo").
--    No arguments (period filter is explicitly out of scope for this
--    milestone, per PROJECT.md Out of Scope).
--
--    Central technique: reconstruct per-cliente "stage visits" (entrada,
--    saida) from historico, since historico only ever records a stage
--    CHANGE, never a duration.
--
--      stage_events   — every (cliente_id, etapa, entrada) timestamp a
--                       cliente ever entered a stage. Includes a SYNTHETIC
--                       first-entry row from clientes.criado_em (every
--                       cliente is born in aguardando_contato via the
--                       column default and the historico trigger only
--                       fires on UPDATE, never INSERT — Pitfall 1: without
--                       this synthetic row, the first stage is invisible).
--      stage_visits   — adds proxima_entrada = LEAD(entrada) per cliente,
--                       ordered by entrada. NULL proxima_entrada means
--                       "this is the cliente's current/last visit".
--      status_events / ultimo_fechamento — the same dedup-latest-event
--                       pattern already proven by dashboard_ganhos_perdidos
--                       (0003), identifying the ganho/perdido closing event
--                       (if any) per cliente.
--      duracoes       — saida = COALESCE(proxima_entrada, evento de
--                       fechamento, now()). now() is the LAST resort, only
--                       for a visit that is both open (proxima_entrada is
--                       null) AND has no closing event yet — i.e. a cliente
--                       still em_andamento and genuinely stuck (Pitfall 2:
--                       a client already closed must stop accruing dwell
--                       time at the closing event, never keep growing
--                       toward now()).
--
--    quantidade = "already entered this stage at least once" (alcancados),
--    NOT the live per-stage snapshot dashboard_clientes_por_etapa already
--    shows — deliberately the SAME denominator as avancou_pct/perdidos_pct
--    (Pitfall 5), so avancou_pct + perdidos_pct + "still there" sums to
--    ~100% per row, a funnel-shaped table rather than a duplicate of the
--    existing live snapshot.
--
--    gargalo threshold (1.5x the average of the OTHER 6 stages' tempo_medio_
--    dias) is a deliberately adjustable literal — Claude's Discretion per
--    CONTEXT.md D-03, trivially tunable once the owner sees real data.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_funil_detalhado()
returns table (
  etapa etapa_funil,
  quantidade bigint,
  avancou_count bigint,
  avancou_pct numeric,
  perdidos_count bigint,
  perdidos_pct numeric,
  tempo_medio_dias numeric,
  gargalo boolean
)
language sql
stable
as $$
  with stage_events as (
    -- Synthetic first-entry row (Pitfall 1) — historico's UPDATE-only
    -- trigger never records the birth-into-stage-1 moment.
    select c.id as cliente_id,
           'aguardando_contato'::etapa_funil as etapa,
           c.criado_em as entrada
    from clientes c                    -- RLS already scopes this to the caller
    union all
    select h.cliente_id,
           (substring(h.descricao from '"(.*)"'))::etapa_funil as etapa,
           h.criado_em as entrada
    from historico h                   -- RLS (parent-cliente gate) already
    where h.tipo = 'etapa'              -- scopes this too — no extra join needed
  ),
  stage_visits as (
    select cliente_id, etapa, entrada,
           lead(entrada) over (partition by cliente_id order by entrada) as proxima_entrada
    from stage_events
  ),
  status_events as (
    select h.cliente_id,
           substring(h.descricao from '"(.*)"') as status_evento,
           h.criado_em
    from historico h
    where h.tipo = 'status_acompanhamento'
      and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
  ),
  ultimo_fechamento as (
    select distinct on (s.cliente_id)
      s.cliente_id, s.status_evento, s.criado_em
    from status_events s
    join clientes c on c.id = s.cliente_id     -- needed for c.status_acompanhamento
    where c.status_acompanhamento::text = s.status_evento
    order by s.cliente_id, s.criado_em desc
  ),
  duracoes as (
    select
      v.cliente_id, v.etapa, v.entrada,
      -- now() is the LAST resort: only reached when there is no next visit
      -- AND no closing event yet (a cliente still em_andamento and stuck).
      coalesce(v.proxima_entrada, f.criado_em, now()) as saida
    from stage_visits v
    left join ultimo_fechamento f
      on f.cliente_id = v.cliente_id and v.proxima_entrada is null
      -- the `and v.proxima_entrada is null` guard means f is only consulted
      -- for each cliente's LAST (still-open) visit — earlier visits always
      -- use their real proxima_entrada, never the closing event (Pitfall 2).
  ),
  maior_etapa as (
    select cliente_id, max(etapa) as etapa_max
    from stage_events
    group by cliente_id
  ),
  etapas_base as (
    select unnest(enum_range(null::etapa_funil)) as etapa
  ),
  alcancados as (
    -- "quantidade" basis: ever entered this stage at least once. See
    -- header comment / Pitfall 5 — deliberately the SAME denominator used
    -- by avancou_pct and perdidos_pct below, not a live snapshot.
    select etapa, count(distinct cliente_id) as total
    from stage_events
    group by etapa
  ),
  avancados as (
    select eb.etapa, count(*) as total
    from etapas_base eb
    join maior_etapa m on m.etapa_max > eb.etapa
    group by eb.etapa
  ),
  perdidos_por_etapa as (
    select d.etapa, count(*) as total
    from duracoes d
    join ultimo_fechamento f
      on f.cliente_id = d.cliente_id
     and f.status_evento = 'perdido'
     and f.criado_em >= d.entrada
     and f.criado_em <= d.saida
    group by d.etapa
  ),
  tempo_medio as (
    select etapa,
           round((avg(extract(epoch from (saida - entrada))) / 86400.0)::numeric, 1) as dias
    from duracoes
    group by etapa
  ),
  resumo as (
    select
      eb.etapa,
      coalesce(al.total, 0) as quantidade,
      coalesce(av.total, 0) as avancou_count,
      case when coalesce(al.total, 0) = 0 then null
           else round(100.0 * coalesce(av.total, 0) / al.total, 1) end as avancou_pct,
      coalesce(pp.total, 0) as perdidos_count,
      case when coalesce(al.total, 0) = 0 then null
           else round(100.0 * coalesce(pp.total, 0) / al.total, 1) end as perdidos_pct,
      tm.dias as tempo_medio_dias
    from etapas_base eb
    left join alcancados al on al.etapa = eb.etapa
    left join avancados av on av.etapa = eb.etapa
    left join perdidos_por_etapa pp on pp.etapa = eb.etapa
    left join tempo_medio tm on tm.etapa = eb.etapa
  ),
  media_outras as (
    select r1.etapa,
           (select avg(r2.tempo_medio_dias) from resumo r2
             where r2.etapa <> r1.etapa and r2.tempo_medio_dias is not null) as media
    from resumo r1
  )
  select
    r.etapa, r.quantidade, r.avancou_count, r.avancou_pct,
    r.perdidos_count, r.perdidos_pct, r.tempo_medio_dias,
    -- D-03: gargalo is a RELATIVE comparison to the other 6 stages, never a
    -- fixed day count. 1.5x multiplier is a deliberately adjustable literal
    -- (Claude's Discretion, CONTEXT.md) — easy to retune once the owner
    -- sees the table with real data.
    coalesce(
      r.tempo_medio_dias is not null
      and mo.media is not null and mo.media > 0
      and r.tempo_medio_dias > mo.media * 1.5,
      false
    ) as gargalo
  from resumo r
  join media_outras mo on mo.etapa = r.etapa
  order by r.etapa;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. dashboard_tempo_ate_fechamento — FNL-02: average days from
--    clientes.criado_em to the ganho/perdido closing event, separated by
--    status. No arguments (same rationale as above).
--
--    Reuses the exact "latest status-change event per cliente" dedup CTE
--    already proven by dashboard_ganhos_perdidos (0003), swapping count(*)
--    for avg(day-diff). The `join clientes c` here is genuinely needed
--    (c.criado_em for the day-diff, c.status_acompanhamento for the dedup
--    cross-check) — unlike the stage_events-only CTEs above, which are
--    already RLS-scoped through historico's own parent-cliente gate with
--    zero join.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_tempo_ate_fechamento()
returns table(status text, media_dias numeric)
language sql
stable
as $$
  with ultimo_status_change as (
    select distinct on (h.cliente_id)
      h.cliente_id, h.criado_em,
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
    u.status_evento as status,
    round((avg(extract(epoch from (u.criado_em - c.criado_em))) / 86400.0)::numeric, 1) as media_dias
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id  -- needs c.criado_em, also RLS-scoped
  where c.status_acompanhamento::text = u.status_evento
  group by u.status_evento;
$$;

-- No new index needed: idx_historico_tipo_criado and idx_clientes_criado_em
-- (both created in 0003_dashboard_aggregates.sql) already cover the access
-- paths these two queries use.
