/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito (o CLI nunca o le).

  Desfaz a migration 0054 (quick 261009-npp): remove as 6 leituras do Dashboard
  que ganharam o parametro p_vendedor e recria as versoes anteriores (0003 e
  0037) exatamente como eram, numa transacao so. Nenhum dado e apagado: so
  leituras sao removidas e recriadas.

  Como aplicar (so se o dono decidir desfazer): colar o arquivo INTEIRO de uma
  vez no SQL Editor e, depois do Success, rodar a recarga do cache do PostgREST
  como passo separado.

  ORDEM: primeiro desfazer as mudancas de codigo desta quick task (os
  registros feat do git) e publicar; so DEPOIS colar este arquivo no SQL
  Editor. Na ordem inversa, "Todos os vendedores" continua funcionando, mas
  escolher um vendedor faz os quadros mostrarem erro ate o codigo ser
  desfeito.
*/

begin;

drop function if exists dashboard_clientes_por_etapa(uuid);
create or replace function dashboard_clientes_por_etapa()
returns table(etapa etapa_funil, total bigint)
language sql
stable
as $$
  select etapa, count(*) as total
  from clientes
  group by etapa;
$$;

drop function if exists dashboard_funil_detalhado(uuid);
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

drop function if exists dashboard_tempo_ate_fechamento(uuid);
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

drop function if exists dashboard_ganhos_perdidos(timestamptz, timestamptz, uuid);
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

drop function if exists dashboard_prospeccao_por_produto(timestamptz, timestamptz, uuid);
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
  from clientes c
  join cliente_produtos cp on cp.cliente_id = c.id
  join produtos_consumidos pc on pc.id = cp.produto_id
  where c.criado_em >= p_inicio
    and c.criado_em <  p_fim
  group by pc.id, pc.nome;
$$;

drop function if exists dashboard_prospeccao_por_categoria(timestamptz, timestamptz, uuid);
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
  from clientes c
  join categorias cat on cat.id = c.categoria_id
  where c.criado_em >= p_inicio
    and c.criado_em <  p_fim
  group by cat.id, cat.nome;
$$;

commit;
