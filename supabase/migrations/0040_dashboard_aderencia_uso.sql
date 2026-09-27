-- Phase 30 Plan 2: dashboard_aderencia_uso() — leitura agregada de
-- aderencia de uso por vendedor (ADER-01/ADER-02/ADER-03).
--
-- Finalidade: para cada vendedor ATIVO, calcula quantos dos ultimos 28 dias
-- corridos (ate hoje, fuso de Sao Paulo) foram efetivamente USADOS,
-- contando so os dias uteis (segunda a sexta, sem excluir feriados — D-06)
-- em que o vendedor estava de fato ativo no time. So leitura: nenhuma
-- tabela/coluna/policy nova, e a funcao de comparativo por vendedor de
-- 12 negocios (migration 0011) permanece intocada — esta e uma funcao
-- SEPARADA, unida ao resultado dela na camada de consulta (plano 30-05),
-- nunca no banco.
--
-- Regra do dia usado (D-02/D-03, uniao — nao intersecao): um dia conta
-- como usado se o vendedor tiver QUALQUER UM destes sinais naquele dia —
-- uma linha em acessos_diarios (login/abertura do sistema OU cadastro/
-- edicao de cliente, migration 0038, plano 30-01) OU uma linha de
-- historico de autoria dele dos tipos etapa, status_acompanhamento,
-- tarefa_concluida ou visita_concluida (os unicos 4 tipos que os gatilhos
-- deste projeto escrevem hoje — mover etapa, trocar status incluindo
-- reabrir/encerrar/reativar das Fases 28/29, e concluir tarefa/visita).
-- Os dois sinais sao UNIDOS (nao a variante que mantem duplicatas) para
-- nunca contar o mesmo dia duas vezes (D-03).
--
-- Regra dos dias uteis (D-06): "ultimos 28 dias" e uma janela de
-- CALENDARIO corrida terminando hoje — dentro dela, so segunda a sexta
-- entram no denominador (extract(isodow from ...) < 6, 1=segunda...
-- 7=domingo). 28 dias corridos tem SEMPRE exatamente 20 dias uteis,
-- independente de em que dia da semana a janela comeca ou termina.
--
-- Proporcao por admissao/desativacao (D-07): um vendedor admitido no meio
-- da janela (profiles.created_at) so tem os dias uteis a partir da
-- admissao contados — nem no numerador, nem no denominador. Da mesma
-- forma, a lacuna entre a ultima desativacao (profiles.desativado_em) e a
-- ultima reativacao (profiles.reativado_em, migration 0039, plano 30-01)
-- sai dos dois. Limitacao aceita (Pitfall 3 da pesquisa, confirmada no
-- planejamento): com DOIS ciclos de desativacao/reativacao dentro da MESMA
-- janela de 28 dias, so a lacuna mais recente e descontada — um carimbo
-- nao-cumulativo nao representa mais de um ciclo. Nao criar tabela de
-- historico de ativacao para isso.
--
-- Aviso de coleta (D-09): coletando_desde vem preenchido (e o percentual
-- deve ser escondido na tela) em dois casos — a medicao comecou ha menos
-- de 28 dias (a tabela acessos_diarios ainda nao tem historico completo,
-- medido pelo dia mais antigo gravado nela, para o projeto inteiro) OU o
-- vendedor nao tem nenhum dia util ativo na janela (denominador zero —
-- admitido no futuro, ou so lacuna de desativacao cobrindo tudo). Nos dois
-- casos o mesmo aviso e mostrado; nulo quando o percentual pode ser
-- mostrado com confianca.
--
-- Autorizacao (D-08): so o Supervisor ve alguma linha. profiles tem
-- leitura aberta a todo autenticado (migration 0001) — sem um filtro
-- explicito aqui, um Vendedor receberia uma linha por colega. Por isso
-- esta funcao e uma excecao deliberada a convencao geral de nao checar
-- papel dentro de uma funcao dashboard_*: o filtro (select is_supervisor())
-- abaixo e necessario porque profiles nao tem RLS de leitura restrita,
-- diferente de acessos_diarios (que ja e Supervisor-only por RLS). Um
-- Vendedor ou chamador anonimo chamando esta funcao recebe ZERO linhas,
-- sem erro.
--
-- Esta funcao roda como quem chama — SECURITY INVOKER por omissao, mesma
-- convencao de todo dashboard_*/mover_card_funil deste projeto. Nenhuma
-- clausula de elevacao de privilegio e adicionada, nem sera no futuro.
--
-- Aplicar SOMENTE depois de 0038 (acessos_diarios, registrar_acesso_diario)
-- e de 0039 (profiles.desativado_em/reativado_em) — ordem obrigatoria
-- 0038 -> 0039 -> 0040, decidida no checkpoint do plano 30-03.
--
-- A funcao de comparativo por vendedor (migration 0011) NAO e alterada
-- nesta migration nem em nenhuma outra deste plano.
--
-- Source: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-02-PLAN.md
--           (Tarefa 1)
--         .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-01-PLAN.md
--           (bloco interfaces, conflitos_resolvidos)
--         .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-RESEARCH.md
--           (Pattern 3, Pitfall 1/2/3)
--         supabase/migrations/0011_dashboard_comparativo_vendedor.sql
--           (molde de cabecalho e do filtro de vendedor ativo)
--         supabase/migrations/0021_agenda_concluidos_do_vendedor.sql
--           (corte por periodo comparando limites convertidos em instante)

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
    -- Janela de 28 dias corridos terminando hoje, fuso de Sao Paulo
    -- calculado dentro do Postgres (Pitfall 1) — nunca aceito do
    -- navegador nem calculado em JavaScript.
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      (now() at time zone 'America/Sao_Paulo')::date - 27 as inicio_janela
  ),
  medicao as (
    -- A medicao comeca no primeiro dia gravado em acessos_diarios no
    -- projeto inteiro (nao escopado por vendedor) — antes disso nao existe
    -- historico nenhum para ninguem (D-09, correcao 12 do 30-01). Sem
    -- nenhuma linha ainda, cai no fallback de hoje.
    select coalesce((select min(a.dia) from acessos_diarios a), pm.hoje) as inicio_medicao
    from parametros pm
  ),
  vendedores as (
    -- Mesmo filtro de vendedor ativo usado pelo comparativo por vendedor
    -- (Pitfall 5 da pesquisa) — os dois conjuntos de ids precisam ser
    -- identicos. (select is_supervisor()) e a excecao deliberada explicada
    -- no cabecalho: sem ela, um Vendedor receberia a linha de cada colega.
    -- Toda data derivada de instante passa pelo fuso de Sao Paulo antes de
    -- virar date (correcao 6 do 30-01).
    select
      p.id,
      (p.created_at at time zone 'America/Sao_Paulo')::date as admissao,
      (p.desativado_em at time zone 'America/Sao_Paulo')::date as desativado,
      (p.reativado_em at time zone 'America/Sao_Paulo')::date as reativado
    from profiles p
    where p.role = 'vendedor' and p.ativo = true and (select is_supervisor())
  ),
  calendario_util as (
    -- Calendario de dias uteis da janela inteira, aritmetica de data pura
    -- (sem depender do fuso da sessao). isodow: 1=segunda ... 7=domingo;
    -- "< 6" mantem so segunda a sexta (D-06).
    select (pm.inicio_janela + g.n) as dia
    from parametros pm, generate_series(0, 27) as g(n)
    where extract(isodow from (pm.inicio_janela + g.n)) < 6
  ),
  dias_ativos as (
    -- Cada vendedor cruzado com cada dia util da janela em que ele estava
    -- de fato no time: nunca antes da admissao (D-07), e nunca dentro da
    -- lacuna entre a ultima desativacao e a ultima reativacao. Com
    -- desativado nulo e reativado preenchido (reativado sem carimbo de
    -- desativacao correspondente), tudo antes da reativacao sai — mesmo
    -- raciocinio conservador documentado na migration 0039.
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
    -- Uniao (dedupe do mesmo vendedor no mesmo dia — D-03) dos dois sinais
    -- de uso: (a) acessos_diarios, ja carimbado no fuso de Sao Paulo pela
    -- propria registrar_acesso_diario(); (b) historico dos 4 tipos que os
    -- gatilhos deste projeto escrevem hoje, com autor nao nulo (Pitfall 2
    -- — nunca remover este filtro) e corte por INSTANTE (nunca convertendo
    -- cada linha para date antes de comparar — mesma disciplina da
    -- migration 0021).
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
    -- Por construcao o numerador so conta dias uteis ATIVOS (join com
    -- dias_ativos, nunca com o calendario inteiro) — nunca passa do
    -- denominador (correcao 5 do 30-01: fim de semana nao penaliza nem
    -- ajuda, e o percentual nunca excede 100%).
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
    -- D-09 travado: os dois casos usam o mesmo aviso na tela. O percentual
    -- NUNCA e multiplicado de novo na interface — ja vem de 0 a 100,
    -- diferente da taxa de conversao (que vem como razao crua).
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

-- Nenhuma clausula de elevacao de privilegio nesta funcao — nunca
-- adicionar. A RLS de acessos_diarios/historico/clientes e o filtro
-- (select is_supervisor()) acima sao a UNICA fronteira de autorizacao.
