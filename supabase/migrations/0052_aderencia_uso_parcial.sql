/*
  Quick task 261008-mrf - decisao do dono de 2026-10-08.
  Aderencia de uso PARCIAL enquanto a medicao tem menos de 28 dias.

  O que muda: dashboard_aderencia_uso() continua devolvendo uma linha por
  vendedor ativo, mas, enquanto a medicao (primeiro dia gravado em
  acessos_diarios, para o projeto inteiro) tem menos de 28 dias, o
  calendario de dias uteis comeca no INICIO DA MEDICAO. Dia anterior ao
  inicio da medicao nunca entra no denominador nem no numerador. As regras
  de admissao, desativacao e reativacao sao as mesmas da 0040 (o calendario
  de cada vendedor comeca no maior entre o inicio da medicao, a admissao e
  a reativacao).

  O numerador nao muda: dias uteis ativos com uso, vindo de acessos_diarios
  mais o historico dos 4 tipos (etapa, status_acompanhamento,
  tarefa_concluida e visita_concluida, com autor nao nulo).

  Quando a janela de 28 dias fica cheia (por volta de 25/10/2026), o
  resultado e IDENTICO ao da 0040: o corte novo do calendario nunca remove
  dia nenhum e o aviso de coleta cai nos mesmos casos da 0040. O corpo desta
  migration e o corpo da 0040 com exatamente tres trocas (calendario cortado
  no inicio da medicao, primeiro dia contado no agregado e a regra do
  coletando_desde); um teste estrutural confere essa igualdade.

  Mesma assinatura e mesmas cinco colunas da 0040: troca so o corpo, sem
  remover a funcao antes.

  Semantica das colunas:
    dias_uteis, dias_usados e aderencia_pct - durante a coleta sao PARCIAIS
      (so dias uteis desde o inicio da medicao ou da entrada/reativacao do
      vendedor); com a janela cheia sao iguais aos da 0040.
    coletando_desde - continua preenchido durante TODA a coleta, como na
      0040. Com denominador maior que zero passa a ser o PRIMEIRO dia util
      contado daquele vendedor (para quase todos e o mesmo dia de inicio da
      medicao; para quem entrou ou foi reativado depois, a data dele). Com
      denominador zero e exatamente o valor da 0040. Com a janela cheia e
      igual ao da 0040 (nulo, ou entrada/reativacao quando o denominador e
      zero).

  O que a tela atual faz com estes valores: a regra dela e "coletando_desde
  preenchido = mostrar so o aviso de coleta". Como o coletando_desde
  continua preenchido, ela segue mostrando so o aviso em todas as linhas,
  nada quebra e nenhum percentual aparece. Por isso esta migration e
  aplicada ANTES de publicar a tela nova: a tela nova contra a conta antiga
  mostraria como parcial o percentual dividido pelos 20 dias uteis inteiros.

  A funcao continua rodando com as permissoes de quem chama, sem elevacao
  de privilegio, sem grant e sem revoke. O filtro de Supervisor nao muda:
  Vendedor e visitante sem login recebem zero linhas, como na 0040.

  Nenhum dado novo e coletado: so muda a conta feita com o que ja e
  registrado (LGPD). A aderencia e uma medida de uso por pessoa; nada muda
  em quem ve, no que e guardado nem por quanto tempo.

  Volta atras: supabase/rollbacks/0052_volta_aderencia_uso.sql, que NAO e
  aplicado automaticamente. Ordem obrigatoria: primeiro a tela, depois o
  banco.
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
    from parametros pm, medicao md, generate_series(0, 27) as g(n)
    where extract(isodow from (pm.inicio_janela + g.n)) < 6
      and (pm.inicio_janela + g.n) >= md.inicio_medicao
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
      count(ev.dia)::integer as dias_usados,
      min(da.dia) as primeiro_dia
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
      when coalesce(ag.dias_uteis, 0) = 0 and md.inicio_medicao > pm.inicio_janela then md.inicio_medicao
      when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado)
      when md.inicio_medicao > pm.inicio_janela then ag.primeiro_dia
      else null
    end as coletando_desde
  from vendedores v
  left join agregado ag on ag.responsavel = v.id
  cross join parametros pm
  cross join medicao md
$$;
