-- Phase 29 Plan 2: Dashboard — os números históricos não podem mudar
-- porque um cliente foi encerrado depois de ganho, nem porque foi
-- reativado depois (critério 5 da fase / ENCR-03, ENCR-05).
--
-- Problema: toda função dashboard_* que conta "ganho" (dashboard_ganhos_
-- perdidos, dashboard_desempenho_vendedor, dashboard_tempo_ate_fechamento,
-- dashboard_comparativo_vendedor, dashboard_funil_detalhado — 0003/0009/
-- 0010/0011) confere se o cliente "continua com esse status HOJE"
-- comparando o último evento de status do histórico com
-- clientes.status_acompanhamento atual. Um cliente encerrado depois de
-- ganho deixa de estar "ganho hoje" e sumiria de ganhos, da taxa de
-- conversão e do ciclo médio; e a linha "Status alterado para \"ganho\""
-- que a reativação escreve no histórico seria lida como um ganho NOVO,
-- redatando o ganho original. Esta lacuna não estava na pesquisa da fase —
-- STATE.md já sinalizava o gap (Roadmap v1.7, conflitos_resolvidos 2 do
-- 29-01).
--
-- Regra nova, idêntica nas 5 funções:
--   1. Os eventos de status de um cliente são classificados a partir de
--      TODAS as linhas historico.tipo = 'status_acompanhamento' (ganho,
--      perdido, encerrado; o resto vira 'outro'), com o evento ANTERIOR
--      (lag() partition by cliente_id order by criado_em) calculado ANTES
--      de qualquer filtro para ganho/perdido — senão a linha de encerrado
--      já teria sido descartada e a reativação nunca seria reconhecida.
--   2. Uma linha de ganho cujo evento anterior é 'encerrado' é reativação,
--      não ganho novo: fica de fora do "último evento de fechamento" com
--      `status_anterior is distinct from 'encerrado'` — nunca a forma com
--      `not (... and status_anterior = 'encerrado')`, que descartaria
--      também o primeiro evento de um cliente (status_anterior nulo vira
--      nulo, não verdadeiro, e o ganho legítimo desapareceria).
--   3. A conferência "continua com esse status hoje" passa a aceitar
--      'encerrado' como "ainda ganho":
--      `(c.status_acompanhamento::text = <evento> or (<evento> = 'ganho'
--       and c.status_acompanhamento = 'encerrado'))`.
--
-- Precisa ser aplicada DEPOIS de 0035/0036 (plano 29-01) — compara com o
-- valor 'encerrado' do enum status_acompanhamento_enum, que só existe a
-- partir de 0035. As três migrations desta fase (0035, 0036, 0037) são
-- aprovadas e aplicadas juntas no plano 29-03.
--
-- As 5 funções continuam SECURITY INVOKER por omissão (nenhuma cláusula de
-- elevação de privilégio) — RLS de clientes/historico/profiles continua a
-- única fronteira de autorização, exatamente como em 0003/0009/0010/0011.
-- `create or replace function` troca só o corpo: mesma assinatura, mesmo
-- `returns table` — nenhuma sobrecarga nova no PostgREST, nenhuma tela do
-- Dashboard precisa mudar.
--
-- Este arquivo NÃO cria tabela, coluna, policy ou índice novo — só recria
-- 5 funções já existentes.
--
-- Source: .planning/phases/29-encerrar-cliente-ativo/29-02-PLAN.md (Tarefa 1)
--         .planning/phases/29-encerrar-cliente-ativo/29-01-PLAN.md
--           (conflitos_resolvidos 2)
--         supabase/migrations/0003_dashboard_aggregates.sql
--         supabase/migrations/0009_dashboard_funil_detalhado.sql
--         supabase/migrations/0010_fix_dashboard_funil_detalhado_avancou_pct.sql
--         supabase/migrations/0011_dashboard_comparativo_vendedor.sql

-- ─────────────────────────────────────────────────────────────────────────
-- 1. dashboard_ganhos_perdidos — mesma assinatura de 0003.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_ganhos_perdidos(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(status text, total bigint)
language sql
stable
as $$
  with eventos_status as (
    select
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
        when h.descricao ilike '%"encerrado"%' then 'encerrado'
        else 'outro'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
  ),
  eventos_com_anterior as (
    select
      cliente_id,
      criado_em,
      status_evento,
      lag(status_evento) over (partition by cliente_id order by criado_em) as status_anterior
    from eventos_status
  ),
  ultimo_status_change as (
    select distinct on (cliente_id)
      cliente_id,
      criado_em,
      status_evento
    from eventos_com_anterior
    where status_evento in ('ganho', 'perdido')
      and (status_evento <> 'ganho' or status_anterior is distinct from 'encerrado')
    order by cliente_id, criado_em desc
  )
  select u.status_evento as status, count(*) as total
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id
  where u.criado_em >= p_inicio
    and u.criado_em <  p_fim
    and (c.status_acompanhamento::text = u.status_evento
         or (u.status_evento = 'ganho' and c.status_acompanhamento = 'encerrado'))
  group by u.status_evento;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. dashboard_desempenho_vendedor — mesma assinatura de 0003.
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
  with eventos_status as (
    select
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
        when h.descricao ilike '%"encerrado"%' then 'encerrado'
        else 'outro'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
  ),
  eventos_com_anterior as (
    select
      cliente_id,
      criado_em,
      status_evento,
      lag(status_evento) over (partition by cliente_id order by criado_em) as status_anterior
    from eventos_status
  ),
  ultimo_status_change as (
    select distinct on (cliente_id)
      cliente_id,
      criado_em,
      status_evento
    from eventos_com_anterior
    where status_evento in ('ganho', 'perdido')
      and (status_evento <> 'ganho' or status_anterior is distinct from 'encerrado')
    order by cliente_id, criado_em desc
  )
  select
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    count(*) filter (where u.status_evento = 'ganho') as ganho,
    count(*) filter (where u.status_evento = 'perdido') as perdido
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id
  left join profiles p on p.id = c.responsavel
  where u.criado_em >= p_inicio
    and u.criado_em <  p_fim
    and (c.status_acompanhamento::text = u.status_evento
         or (u.status_evento = 'ganho' and c.status_acompanhamento = 'encerrado'))
  group by c.responsavel, p.nome, p.sobrenome;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. dashboard_tempo_ate_fechamento — mesma assinatura de 0009.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dashboard_tempo_ate_fechamento()
returns table(status text, media_dias numeric)
language sql
stable
as $$
  with eventos_status as (
    select
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
        when h.descricao ilike '%"encerrado"%' then 'encerrado'
        else 'outro'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
  ),
  eventos_com_anterior as (
    select
      cliente_id,
      criado_em,
      status_evento,
      lag(status_evento) over (partition by cliente_id order by criado_em) as status_anterior
    from eventos_status
  ),
  ultimo_status_change as (
    select distinct on (cliente_id)
      cliente_id,
      criado_em,
      status_evento
    from eventos_com_anterior
    where status_evento in ('ganho', 'perdido')
      and (status_evento <> 'ganho' or status_anterior is distinct from 'encerrado')
    order by cliente_id, criado_em desc
  )
  select
    u.status_evento as status,
    round((avg(extract(epoch from (u.criado_em - c.criado_em))) / 86400.0)::numeric, 1) as media_dias
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id
  where (c.status_acompanhamento::text = u.status_evento
         or (u.status_evento = 'ganho' and c.status_acompanhamento = 'encerrado'))
  group by u.status_evento;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. dashboard_comparativo_vendedor — mesma assinatura de 0011.
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
  eventos_status as (
    select
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
        when h.descricao ilike '%"encerrado"%' then 'encerrado'
        else 'outro'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
  ),
  eventos_com_anterior as (
    select
      cliente_id,
      criado_em,
      status_evento,
      lag(status_evento) over (partition by cliente_id order by criado_em) as status_anterior
    from eventos_status
  ),
  ultimo_status_change as (
    -- Estendida DE PROPÓSITO na Fase 29 (critério 5 / ENCR-05): classifica
    -- também 'encerrado' e calcula o evento anterior por cliente ANTES do
    -- filtro ganho/perdido, para reconhecer a reativação (encerrado ->
    -- ganho) e não contá-la como um ganho novo. Deixou de ser verbatim de
    -- 0003/0009 de propósito — não reverter para a forma antiga.
    select distinct on (cliente_id)
      cliente_id,
      criado_em,
      status_evento
    from eventos_com_anterior
    where status_evento in ('ganho', 'perdido')
      and (status_evento <> 'ganho' or status_anterior is distinct from 'encerrado')
    order by cliente_id, criado_em desc
  ),
  fechamentos as (
    -- Confirms the deduplicated latest event still matches clientes' status
    -- today — a since-reverted event must not count as the current
    -- fechamento. Fase 29: 'encerrado' também conta como "ainda ganho".
    select
      c.id as cliente_id,
      u.status_evento,
      c.criado_em,
      u.criado_em as fechado_em
    from clientes c
    join ultimo_status_change u on u.cliente_id = c.id
    where (c.status_acompanhamento::text = u.status_evento
           or (u.status_evento = 'ganho' and c.status_acompanhamento = 'encerrado'))
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

-- ─────────────────────────────────────────────────────────────────────────
-- 5. dashboard_funil_detalhado — mesma assinatura de 0010 (versão vigente,
--    NÃO a de 0009). Mantém a correção de "% Avançou" da 0010
--    (avancados vindo de stage_events, filtro m.etapa_max > se.etapa) —
--    esta migration NÃO reverte aquele fix.
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
  status_events_todos as (
    -- Fase 29: TODAS as linhas de status (não só ganho/perdido), com o
    -- evento anterior calculado ANTES do filtro, para reconhecer a
    -- reativação (encerrado -> ganho) igual às outras 4 funções desta
    -- migration.
    select
      h.cliente_id,
      substring(h.descricao from '"(.*)"') as status_evento,
      h.criado_em,
      lag(substring(h.descricao from '"(.*)"')) over (partition by h.cliente_id order by h.criado_em) as status_anterior
    from historico h
    where h.tipo = 'status_acompanhamento'
  ),
  status_events as (
    select cliente_id, status_evento, criado_em
    from status_events_todos
    where status_evento in ('ganho', 'perdido')
      and (status_evento <> 'ganho' or status_anterior is distinct from 'encerrado')
  ),
  ultimo_fechamento as (
    select distinct on (s.cliente_id)
      s.cliente_id, s.status_evento, s.criado_em
    from status_events s
    join clientes c on c.id = s.cliente_id
    where (c.status_acompanhamento::text = s.status_evento
           or (s.status_evento = 'ganho' and c.status_acompanhamento = 'encerrado'))
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
    -- Correção da 0010 preservada: draw from stage_events (same rows as
    -- `alcancados`), not bare maior_etapa — a cliente only counts as
    -- "advanced past" a stage if they actually entered that stage
    -- (se.etapa), and their overall max reached stage is beyond it.
    -- Guarantees avancados <= alcancados.
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

-- Nenhuma das 5 funções acima pode ganhar a cláusula de elevação de
-- privilégio (security definer) — continuam rodando como o chamador, RLS
-- de clientes/historico/profiles como única fronteira, exatamente como
-- 0003/0009/0010/0011.
