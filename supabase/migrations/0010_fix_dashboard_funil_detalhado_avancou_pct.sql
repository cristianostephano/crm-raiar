-- Phase 11 fix: dashboard_funil_detalhado()'s "% Avançou" column could show
-- values above 100% (observed live: 200,0% / 100,0% on low-quantidade stages).
--
-- Root cause: this kanban allows dragging a card directly from one stage to
-- any other stage, skipping intermediate ones (components/clientes/KanbanBoard.tsx
-- has no guard against non-adjacent drops, confirmed during Phase 11's own
-- research as Assumption A4). historico only records the stage a card
-- actually LANDED in, never the ones it skipped over. The original
-- `avancados` CTE counted a cliente as "advanced past etapa X" purely from
-- `maior_etapa.etapa_max > X` (their single highest stage ever reached),
-- with no requirement that the cliente ever actually had a stage_events row
-- AT etapa X. A cliente who skipped straight past a low-traffic stage (e.g.
-- aguardando_contato -> em_cadastro_produto in one drag) was counted in that
-- skipped stage's "avancados" numerator while never appearing in its
-- "alcancados" (quantidade) denominator — inflating avancou_pct past 100%
-- whenever quantidade was small.
--
-- Fix: `avancados` must draw from the SAME `stage_events` rows as
-- `alcancados` (the denominator), filtered to `m.etapa_max > se.etapa`, so a
-- cliente can only count toward a stage's "avançou" numerator if they
-- actually entered that specific stage first. This makes avancados a true
-- subset of alcancados for every stage, by construction — avancou_pct can
-- never exceed 100% again, regardless of how many stages get skipped.
--
-- NEW file, never an edit to 0009 (Pitfall 11 — once pushed, any further
-- change is a NEW migration). Only `dashboard_funil_detalhado()` is
-- replaced; `dashboard_tempo_ate_fechamento()` is untouched (bug does not
-- affect it — it has no equivalent "advanced past" calculation).
--
-- Source: personal live-browser verification during Phase 11's 11-05
-- human-verify checkpoint, 2026-07-28.

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
    select c.id as cliente_id,
           'aguardando_contato'::etapa_funil as etapa,
           c.criado_em as entrada
    from clientes c
    union all
    select h.cliente_id,
           (substring(h.descricao from '"(.*)"'))::etapa_funil as etapa,
           h.criado_em as entrada
    from historico h
    where h.tipo = 'etapa'
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
    join clientes c on c.id = s.cliente_id
    where c.status_acompanhamento::text = s.status_evento
    order by s.cliente_id, s.criado_em desc
  ),
  duracoes as (
    select
      v.cliente_id, v.etapa, v.entrada,
      coalesce(v.proxima_entrada, f.criado_em, now()) as saida
    from stage_visits v
    left join ultimo_fechamento f
      on f.cliente_id = v.cliente_id and v.proxima_entrada is null
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
    select etapa, count(distinct cliente_id) as total
    from stage_events
    group by etapa
  ),
  avancados as (
    -- FIX: draw from stage_events (same rows as `alcancados`), not bare
    -- maior_etapa — a cliente only counts as "advanced past" a stage if
    -- they actually entered that stage (se.etapa), and their overall max
    -- reached stage is beyond it. Guarantees avancados <= alcancados.
    select se.etapa, count(distinct se.cliente_id) as total
    from stage_events se
    join maior_etapa m on m.cliente_id = se.cliente_id
    where m.etapa_max > se.etapa
    group by se.etapa
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
