-- Quick task 260806-h8a: cidades_com_clientes_por_estado(p_uf) — RPC que
-- alimenta SOMENTE o filtro de Cidade da tela de Clientes
-- (components/clientes/FiltersPopover.tsx), devolvendo apenas as cidades
-- que já têm pelo menos um cliente cadastrado naquele Estado.
--
-- NEW file, never an edit a 0001-0011 (Pitfall 11 — once pushed via
-- `supabase db push`, qualquer mudança futura é uma NOVA migration).
--
-- Source: .planning/quick/260806-h8a-corrigir-o-filtro-de-cidade-na-tela-de-c/260806-h8a-PLAN.md
--         supabase/migrations/0007_cidades_e_estado_valido.sql (molde de
--           assinatura: cidades_por_estado(p_uf text) returns table(nome text))
--         supabase/migrations/0008_desativacao_membro_equipe.sql (os dois
--           precedentes de SECURITY DEFINER deste projeto: is_supervisor()
--           e desativar_membro_equipe, ambos com set search_path = public
--           e justificativa em comentário de cabeçalho)
--
-- ─────────────────────────────────────────────────────────────────────────
-- Por que esta função existe (D-02) e por que ela é SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────
--
-- O QUE A FUNÇÃO FAZ: devolve, para um Estado escolhido no filtro, a lista
-- de nomes de cidade DISTINTOS que já têm pelo menos um cliente cadastrado
-- naquele Estado. Ela NÃO é usada pelo formulário de cadastro/edição de
-- cliente (esse continua usando cidades_por_estado, a lista completa do
-- IBGE, de propósito — D-01: é assim que se cadastra um cliente numa
-- cidade nova pela primeira vez).
--
-- A TENSÃO: a RLS da tabela `clientes` restringe o SELECT de um Vendedor
-- às linhas onde `responsavel` é ele mesmo. Uma função SECURITY INVOKER
-- (a convenção padrão deste projeto, declarada em 0003 e 0007) roda com as
-- permissões de quem chama — então, para um Vendedor, um
-- `select distinct cidade from clientes` devolveria só as cidades DELE.
-- Isso violaria D-02, que pede que a lista de cidades do filtro seja do
-- sistema inteiro (todo vendedor vê cidades de clientes de qualquer
-- vendedor), sem mudar a visibilidade da listagem/kanban de clientes em si.
--
-- A RESOLUÇÃO: SECURITY DEFINER, escopada ao mínimo absoluto — a função
-- devolve APENAS nomes de cidade em texto, distintos. Nenhum `id`, nenhuma
-- razão social, nenhum contato, nenhum telefone, nenhuma contagem, nenhuma
-- atribuição a vendedor. Não é possível usar esta função para enumerar,
-- ler ou inferir qualquer linha de cliente: o resultado é uma lista de
-- topônimos. É a TERCEIRA exceção de SECURITY DEFINER documentada deste
-- código-base, depois de is_supervisor() e do par
-- desativar_membro_equipe/reativar_membro_equipe (ambas em 0008), seguindo
-- exatamente o mesmo formato: `security definer` + `set search_path =
-- public` + justificativa em comentário de cabeçalho.
--
-- POR QUE É DEFENSÁVEL: a ordem de decisão da skill supabase-conventions é
-- RLS → RPC → Edge Function, e RLS continua sendo a fronteira de
-- autorização real do sistema. Esta função não contorna a RLS da listagem
-- de clientes — a listagem/kanban continua RLS-scoped e não é tocada por
-- esta migration. É uma exceção pontual e documentada.
--
-- DIVULGAÇÃO DE INFORMAÇÃO ACEITA CONSCIENTEMENTE: um Vendedor passa a
-- saber em quais cidades a empresa tem clientes. Isso é agregado e
-- não-identificante, e foi explicitamente pedido pelo dono em D-02.
--
-- ALTERNATIVAS DESCARTADAS:
--   - SECURITY INVOKER puro → devolve lista incompleta para Vendedor,
--     viola D-02.
--   - Nova policy de SELECT em `clientes` liberando todas as linhas para
--     todo mundo → abriria de fato a leitura de dados de clientes de
--     outros vendedores; muito pior que a definer escopada.
--   - Tabela materializada de "cidades com clientes" mantida por trigger →
--     mais peças móveis, mais migrations, mesmo resultado; desnecessário
--     no volume de dados do MVP.
--
-- NENHUMA policy nova, NENHUM alter table, NENHUMA alteração em RLS nesta
-- migration — só a criação da função abaixo.
create or replace function cidades_com_clientes_por_estado(p_uf text)
returns table(nome text)
language sql
stable
security definer
set search_path = public
as $$
  -- `order by 1` (posição ordinal), NÃO `order by nome` — em função com
  -- `returns table`, o nome da coluna de saída é um parâmetro OUT e
  -- referenciá-lo no ORDER BY pode gerar ambiguidade (este projeto já
  -- levou um SQLSTATE 42702 por esse tipo de sombreamento, ver migration
  -- 0005 e a decisão registrada na STATE.md).
  --
  -- Valor bruto de `cidade`, sem normalizar caixa nem acento: o
  -- comparador do filtro (clienteAtendeFiltros) já compara cidade por
  -- igualdade exata case-insensitive, então o valor bruto sempre encontra
  -- as linhas correspondentes. Variações de caixa em linhas legadas
  -- (importação da Fase 7) podem aparecer como opções próximas — aceito de
  -- propósito em vez de mesclar.
  select distinct c.cidade as nome
  from clientes c
  where c.estado = p_uf
    and c.cidade is not null
    and btrim(c.cidade) <> ''
  order by 1;
$$;
