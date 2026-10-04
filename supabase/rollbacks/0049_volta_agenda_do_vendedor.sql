/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0049 (Fase 33, AGD-16). Recoloca o corpo original
  da 0036, com as duas metades: prospeccao e visitas.

  Aplicar SO se o dono decidir manter a Agenda atual com as visitas
  automaticas, colando este conteudo no SQL Editor do Supabase.

  Consequencia: as visitas acumuladas durante o piloto reaparecem de uma
  vez na Agenda, muitas delas atrasadas (D-34 - nada foi apagado).

  A parte da tela volta revertendo o commit da AgendaList do plano 33-03.
*/

create or replace function agenda_do_vendedor()
returns table (
  origem text,
  item_id uuid,
  cliente_id uuid,
  razao_social text,
  responsavel uuid,
  responsavel_nome text,
  titulo text,
  data date,
  frequencia_visita frequencia_visita_enum,
  proxima_data_sugerida date
)
language sql
stable
as $$
  select
    'prospeccao'::text as origem,
    t.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    tt.nome as titulo,
    t.data_conclusao as data,
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
    and c.status_acompanhamento <> 'encerrado'
  union all
  select
    'visita'::text as origem,
    v.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    'Visita'::text as titulo,
    v.data_prevista as data,
    c.frequencia_visita,
    proxima_data_visita(
      (now() at time zone 'America/Sao_Paulo')::date,
      c.frequencia_visita,
      c.dia_semana_visita,
      c.semana_do_mes_visita
    ) as proxima_data_sugerida
  from visitas v
  join clientes c on c.id = v.cliente_id
  left join profiles p on p.id = c.responsavel
  where v.data_realizada is null
    and c.status_acompanhamento <> 'encerrado'
  order by 8, 4;
$$;
