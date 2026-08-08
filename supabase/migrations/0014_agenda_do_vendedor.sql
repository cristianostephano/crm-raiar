-- Phase 14 Plan 1: Agenda Unificada — camada de leitura da Fase 14.
--
-- Fase inteira de LEITURA PURA: nenhuma escrita, nenhuma tabela nova,
-- nenhuma policy nova, nenhuma alteracao de tabela existente, nenhuma
-- trigger criada ou recriada. Este arquivo cria exatamente UMA funcao
-- (agenda_do_vendedor) e exatamente UM indice (idx_tarefas_data_conclusao).
--
-- ─────────────────────────────────────────────────────────────────────────
-- agenda_do_vendedor() nasce SEM clausula de elevacao de privilegio, de
-- proposito, espelhando toda funcao dashboard_* do projeto
-- (0009/0010/0011) e mover_card_funil (0002/0013). Ela roda como o
-- CHAMADOR — SECURITY INVOKER por omissao — entao toda leitura interna de
-- tarefas/visitas/clientes fica automaticamente escopada pela RLS ja
-- existente nessas tres tabelas. Adicionar "security definer" aqui
-- passaria a devolver a agenda do time inteiro para qualquer vendedor: a
-- falha mais grave possivel nesta fase.
--
-- AGD-04 (vendedor ve so o proprio, supervisor ve o time) sai inteiramente
-- da RLS de clientes/tarefas/visitas — e por isso PROIBIDO escrever
-- qualquer filtro de dono ou checagem de papel dentro do corpo desta
-- funcao. Nenhuma chamada a is_supervisor() nem a auth.uid() aparece
-- abaixo, de proposito: um filtro manual ali criaria uma segunda
-- fronteira de autorizacao fora da RLS, exatamente o que o CLAUDE.md
-- proibe ("nenhuma logica de permissao feita a mao").
--
-- Este marco continua com EXATAMENTE tres excecoes de privilegio elevado
-- no projeto (is_supervisor(), desativar_membro_equipe/
-- reativar_membro_equipe, e cidades_com_clientes_por_estado — ver
-- STATE.md > Deferred Items). Esta migration nao adiciona uma quarta.
--
-- NOTA: profiles tem policy de SELECT aberta para qualquer autenticado
-- desde a migration 0001 (`using (true)`) — o LEFT JOIN com profiles
-- abaixo, usado so para montar o nome do vendedor (responsavel_nome), e
-- comportamento pre-existente, ja explorado por
-- dashboard_comparativo_vendedor() (0011) e lib/equipe/membros.ts, NAO um
-- vazamento novo. As LINHAS continuam restritas pela RLS de
-- clientes/tarefas/visitas; so o nome de quem ja e dono de uma linha
-- visivel aparece. Nao adicionar checagem de papel para "corrigir" isso.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Source: .planning/phases/14-agenda-unificada/14-01-PLAN.md (Task 1)
--         .planning/research/ARCHITECTURE.md (Pattern 2, Anti-Pattern 4)
--         .planning/research/PITFALLS.md (Pitfall 5)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Indice — sustenta a ordenacao do feed unificado por data (Pitfall 5).
--    O indice equivalente de visitas (idx_visitas_data_prevista) ja foi
--    criado pela migration 0013 e NAO e recriado aqui.
-- ─────────────────────────────────────────────────────────────────────────
create index idx_tarefas_data_conclusao on tarefas (data_conclusao);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. agenda_do_vendedor() — uniao das tarefas de prospeccao pendentes com
--    as visitas de pos-venda pendentes, cada linha carimbada com a
--    origem. Colunas de saida (nesta ordem, exatamente estas oito):
--    origem, item_id, cliente_id, razao_social, responsavel,
--    responsavel_nome, titulo, data.
--
--    Os dois filtros de "ainda pendente" (concluida = false e
--    data_conclusao is not null / data_realizada is null) ficam DENTRO de
--    cada metade, ANTES do union all — mantem o conjunto de trabalho
--    proporcional ao que esta em aberto, nao ao historico inteiro
--    (Pitfall 5).
--
--    t.data_conclusao is not null e DELIBERADO: uma tarefa sem data nao
--    teria em qual das tres secoes da tela cair (atrasado / hoje /
--    proximos dias), entao ela fica de fora do feed. Ponto levado ao dono
--    no checkpoint humano do Task 2.
--
--    Cast explicito ::text nos literais 'prospeccao'/'visita'/'Visita' —
--    sem ele o Postgres infere `unknown` e o union all pode recusar por
--    tipos incompativeis entre as duas metades.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function agenda_do_vendedor()
returns table (
  origem text,
  item_id uuid,
  cliente_id uuid,
  razao_social text,
  responsavel uuid,
  responsavel_nome text,
  titulo text,
  data date
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
    t.data_conclusao as data
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
  union all
  select
    'visita'::text as origem,
    v.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    'Visita'::text as titulo,
    v.data_prevista as data
  from visitas v
  join clientes c on c.id = v.cliente_id
  left join profiles p on p.id = c.responsavel
  where v.data_realizada is null
  -- Ordenacao decidida AQUI e em nenhum outro lugar: posicao 8 = data
  -- (mais antiga primeiro), posicao 4 = razao_social como desempate
  -- deterministico. Ordenar dentro de cada metade nao ordena o resultado
  -- combinado — por isso este order by fica no FIM da uniao, nunca dentro
  -- de um dos dois selects acima. Nem o leitor tipado (Fase 14 Plano 2)
  -- nem o componente de tela (Fase 14 Plano 3) devem reordenar o que
  -- recebem daqui.
  order by 8, 4;
$$;
-- No `security definer` — nao adicionar.
