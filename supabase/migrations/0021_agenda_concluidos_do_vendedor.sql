-- Phase 21 Plan 1: leitura de itens JA CONCLUIDOS em um periodo (AGD-13).
--
-- Este arquivo cria exatamente UMA funcao nova e DOIS indices. Ele NAO
-- recria, NAO altera e NAO apaga agenda_do_vendedor() (Fase 14/15) — a
-- leitura de pendentes continua byte-a-byte como a Fase 20 a deixou (D-03).
-- As duas leituras sao conjuntos disjuntos: a leitura de pendentes so
-- devolve o que esta em aberto; a leitura nova so devolve o que ja foi
-- feito. Quem junta as duas e o navegador (Fase 21 Plano 2/4), nunca o
-- banco.
--
-- agenda_concluidos_do_vendedor() nasce SEM clausula de elevacao de
-- privilegio, exatamente como a leitura de pendentes e toda funcao
-- dashboard_*/mover_card_funil do projeto. Ela roda como o CHAMADOR —
-- SECURITY INVOKER por omissao — entao toda leitura interna de
-- tarefas/visitas/clientes fica automaticamente escopada pela RLS ja
-- existente nessas tres tabelas (D-05). E PROIBIDO escrever qualquer
-- filtro de dono ou checagem de papel dentro do corpo desta funcao: isso
-- criaria uma segunda fronteira de autorizacao fora da RLS, exatamente o
-- que o CLAUDE.md veda ("nenhuma logica de permissao feita a mao"). Nao
-- ha chamada a checagem de papel nem a identidade do usuario abaixo, de
-- proposito.
--
-- Este marco continua com EXATAMENTE quatro excecoes de privilegio
-- elevado no projeto (funcao que decide papel, as duas funcoes de
-- ativacao/desativacao de membro de equipe, e a funcao de cidades com
-- clientes por estado — ver STATE.md > Deferred Items). Esta migration
-- NAO adiciona uma quinta.
--
-- Por que os dois parametros de data sao OBRIGATORIOS (D-02): esta
-- funcao e chamada direto pelo navegador via PostgREST, um endpoint
-- publico. Sem a obrigatoriedade do intervalo, qualquer chamador poderia
-- pedir o historico multi-ano inteiro de um vendedor numa unica chamada,
-- o que estouraria o teto de egress do free tier do Supabase —
-- exatamente a restricao de desempenho que esta fase existe para evitar.
-- O teto de TAMANHO do intervalo (quantos dias no maximo) fica fora
-- desta funcao, imposto na acao de servidor que a chama (Fase 21 Planos
-- 2/4) — guarda de RECURSO, nao de autorizacao.
--
-- A data devolvida por cada linha e a data REAL em que o trabalho foi
-- concluido (D-04): o carimbo de conclusao de tarefas.concluida_em / a
-- data realizada de visitas.data_realizada, nunca a data prevista
-- original (tarefas.data_conclusao / visitas.data_prevista). O corte por
-- periodo tambem usa o carimbo de conclusao, nunca a data prevista.
--
-- Fuso: tanto a data projetada quanto o filtro usam o fuso de Sao Paulo,
-- explicito dos dois lados — mesma autoridade de fuso que a migration
-- 0015 ja fixa para calcular a proxima visita, e a mesma Pitfall 1 que
-- bucketDoItem (lib/agenda/itens.ts) documenta no navegador. O filtro
-- compara o carimbo com os LIMITES do intervalo convertidos em instante
-- (timestamptz), nunca convertendo cada linha para date antes de
-- comparar — so a primeira forma consegue usar o indice de faixa criado
-- abaixo, e e o indice que impede a leitura de varrer a tabela inteira.
--
-- As duas colunas de agendamento futuro (frequencia_visita,
-- proxima_data_sugerida) voltam sempre vazias nesta leitura, de
-- proposito: um registro historico nao pode carregar dado de agendamento
-- futuro.
--
-- Source: .planning/phases/21-calend-rio-o-que-j-foi-feito-em-datas-passadas/21-01-PLAN.md (Task 1)
--         supabase/migrations/0014_agenda_do_vendedor.sql (molde de postura)
--         supabase/migrations/0015_conclusao_com_resumo.sql secao 7 (fuso
--           de Sao Paulo, colunas vazias com cast explicito)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Indices — sustentam o corte por periodo como varredura de faixa no
--    indice, nao leitura da tabela inteira (D-02, criterio de sucesso 5
--    da fase). Tolerantes a pre-existencia.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists idx_tarefas_concluida_em on tarefas (concluida_em);
create index if not exists idx_visitas_data_realizada on visitas (data_realizada);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. agenda_concluidos_do_vendedor(p_inicio date, p_fim date) — uniao das
--    tarefas de prospeccao concluidas com as visitas de pos-venda
--    realizadas, cada linha carimbada com a origem. Mesmas dez colunas,
--    na mesma ordem, que a leitura de pendentes ja devolve hoje (contrato
--    de interface travado no plano) — e isso que permite ao navegador
--    reusar um unico mapeador de linha para as duas leituras.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function agenda_concluidos_do_vendedor(
  p_inicio date,
  p_fim date
)
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
    (t.concluida_em at time zone 'America/Sao_Paulo')::date as data,
    -- Colunas de agendamento futuro nao se aplicam a um registro
    -- historico — sempre vazias, cast explicito por tipo, mesmo molde da
    -- migration 0015 (sem o cast o union all abaixo recusa por tipos
    -- incompativeis entre as duas metades).
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = true
    and t.concluida_em is not null
    and t.concluida_em >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
    and t.concluida_em < ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo')
  union all
  select
    'visita'::text as origem,
    v.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    'Visita'::text as titulo,
    v.data_realizada as data,
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from visitas v
  join clientes c on c.id = v.cliente_id
  left join profiles p on p.id = c.responsavel
  where v.data_realizada is not null
    and v.data_realizada between p_inicio and p_fim
  -- Ordenacao decidida AQUI e em nenhum outro lugar, por posicao de
  -- coluna: 8 = data (mais antiga primeiro), 4 = razao_social como
  -- desempate deterministico — mesmas posicoes que 0014/0015 ja usam, ja
  -- que o conjunto de colunas e identico.
  order by 8, 4;
$$;
-- No `security definer` — nao adicionar.
