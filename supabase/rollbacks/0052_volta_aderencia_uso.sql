/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0052 (quick 261008-mrf). Restaura a conta da 0040:
  durante a coleta o denominador volta a ser os 20 dias uteis da janela
  inteira (inclusive dias anteriores ao inicio da medicao) e a coluna
  coletando_desde volta a ser o aviso de coleta.

  Nenhum dado e apagado: a 0052 nao guarda nada, so muda a conta.

  ORDEM OBRIGATORIA: primeiro reverter o commit feat da tela desta quick task
  (rotulo "parcial" e tooltip) e publicar; so DEPOIS colar este arquivo no
  SQL Editor do Supabase. Na ordem inversa, a tela nova mostraria o numero
  antigo e injusto marcado como "(parcial)". Depois de 25/10/2026 (janela de
  28 dias cheia) a ordem deixa de importar: as duas contas dao o mesmo
  numero.

  Aplicar SO se o dono decidir desfazer a mudanca.
*/

create or replace function dashboard_aderencia_uso()
returns table (
  responsavel uuid,
  dias_usados integer,
  dias_uteis integer,
  aderencia_pct numeric,
  coletando_desde date
)
language sql
stable
as $$
  with parametros as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      (now() at time zone 'America/Sao_Paulo')::date - 27 as inicio_janela
  ),
  medicao as (
    select coalesce((select min(a.dia) from acessos_diarios a), pm.hoje) as inicio_medicao
    from parametros pm
  ),
  vendedores as (
    select
      p.id,
      (p.created_at at time zone 'America/Sao_Paulo')::date as admissao,
      (p.desativado_em at time zone 'America/Sao_Paulo')::date as desativado,
      (p.reativado_em at time zone 'America/Sao_Paulo')::date as reativado
    from profiles p
    where p.role = 'vendedor' and p.ativo = true and (select is_supervisor())
  ),
  calendario_util as (
    select (pm.inicio_janela + g.n) as dia
    from parametros pm, generate_series(0, 27) as g(n)
    where extract(isodow from (pm.inicio_janela + g.n)) < 6
  ),
  dias_ativos as (
    select v.id as responsavel, cu.dia
    from vendedores v
    join calendario_util cu on cu.dia >= v.admissao
    where not (
      v.reativado is not null
      and cu.dia < v.reativado
      and (v.desativado is null or cu.dia >= v.desativado)
    )
  ),
  eventos as (
    select a.usuario_id, a.dia
    from acessos_diarios a, parametros pm
    where a.dia between pm.inicio_janela and pm.hoje
    union
    select
      h.autor_id as usuario_id,
      (h.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from historico h, parametros pm
    where h.tipo in ('etapa', 'status_acompanhamento', 'tarefa_concluida', 'visita_concluida')
      and h.autor_id is not null
      and h.criado_em >= (pm.inicio_janela::timestamp at time zone 'America/Sao_Paulo')
      and h.criado_em < ((pm.hoje + 1)::timestamp at time zone 'America/Sao_Paulo')
  ),
  agregado as (
    select
      da.responsavel,
      count(*)::integer as dias_uteis,
      count(ev.dia)::integer as dias_usados
    from dias_ativos da
    left join eventos ev on ev.usuario_id = da.responsavel and ev.dia = da.dia
    group by da.responsavel
  )
  select
    v.id as responsavel,
    coalesce(ag.dias_usados, 0) as dias_usados,
    coalesce(ag.dias_uteis, 0) as dias_uteis,
    case
      when coalesce(ag.dias_uteis, 0) = 0 then null
      else round(coalesce(ag.dias_usados, 0)::numeric / ag.dias_uteis * 100, 1)
    end as aderencia_pct,
    case
      when md.inicio_medicao > pm.inicio_janela then md.inicio_medicao
      when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado)
      else null
    end as coletando_desde
  from vendedores v
  left join agregado ag on ag.responsavel = v.id
  cross join parametros pm
  cross join medicao md
$$;
