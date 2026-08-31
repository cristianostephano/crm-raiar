-- Quick task 260831-mod: reversão da decisão original da Fase 25 (ATIVO-01,
-- confirmada no checkpoint humano do plano 25-03) — o campo de contato deixa
-- de ser obrigatório na importação de "Clientes Ativos". Motivo: o teste ao
-- vivo do dono do projeto com a planilha real da equipe (1909 linhas)
-- mostrou que a base ainda não tem contato/telefone coletado — os
-- vendedores vão preencher esse dado depois, individualmente, na ficha do
-- cliente. O campo de contato continua existindo na tabela `clientes` e
-- continua sendo GRAVADO quando a planilha traz um valor; só deixa de
-- BLOQUEAR a linha quando vem em branco.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ESCOPO ESTRITO desta migration: só o CORPO de
-- `cliente_ativo_pronto_para_ganho` muda. A ASSINATURA continua com os
-- MESMOS nove parâmetros (p_razao_social text, p_cnpj text, p_cep text,
-- p_rua text, p_numero text, p_cidade text, p_estado text, p_responsavel
-- uuid, p_contato text) e o mesmo `returns boolean`, porque
-- `importar_clientes_ativos_lote` (migration 0027, já aplicada em produção)
-- chama esta função com nove argumentos posicionais em DOIS pontos (a
-- cláusula de filtro da criação e a classificação do retorno) — mudar a
-- aridade quebraria as duas chamadas já gravadas. Por isso um simples
-- `create or replace function` com a mesma assinatura basta: não é
-- necessário o ritual de `drop function if exists` (esse ritual só existe
-- para trocar contagem/tipo de parâmetro, o que NÃO é o caso aqui).
--
-- Confirmado por grep no repositório: `cliente_ativo_pronto_para_ganho` só é
-- chamada dentro de `importar_clientes_ativos_lote` (mesmo arquivo 0027,
-- nos dois pontos citados acima) — nenhum outro caminho depende desta
-- condição de completude.
--
-- Isto NÃO afeta `mover_card_funil` (migrations 0018/0025, caminho normal de
-- movimentação de card do funil pelo kanban): aquela função nunca checou
-- contato — os guards de lá são CNPJ, frequência de visita e razão social/
-- endereço. A checagem de contato sempre viveu só nesta RPC de importação em
-- massa de "Clientes Ativos".
-- ─────────────────────────────────────────────────────────────────────────
create or replace function cliente_ativo_pronto_para_ganho(
  p_razao_social text,
  p_cnpj text,
  p_cep text,
  p_rua text,
  p_numero text,
  p_cidade text,
  p_estado text,
  p_responsavel uuid,
  p_contato text
)
returns boolean
language sql
immutable
as $$
  select
    nullif(btrim(p_razao_social), '') is not null
    and nullif(btrim(p_cnpj), '') is not null
    and nullif(btrim(p_cep), '') is not null
    and nullif(btrim(p_rua), '') is not null
    and nullif(btrim(p_numero), '') is not null
    and nullif(btrim(p_cidade), '') is not null
    and nullif(btrim(p_estado), '') is not null
    -- responsavel é uuid: sem btrim, sem estado "só espaços". `not null`
    -- desde a migration 0002 na tabela — se esta checagem faltar aqui, uma
    -- linha sem responsável escapa do filtro do objeto 2 da migration 0027 e
    -- a instrução de criação levanta violação de restrição, abortando o
    -- LOTE INTEIRO (a pior forma de quebrar ATIVO-03) — ver caso de teste
    -- `semresponsavel`.
    and p_responsavel is not null;
    -- O parâmetro de contato (o nono argumento) continua sendo recebido —
    -- aridade preservada — mas, a partir desta migration, não participa mais
    -- desta checagem de completude (quick task 260831-mod, reversão de
    -- ATIVO-01). Uma linha sem esse dado agora passa nesta condição e é
    -- gravada com a coluna correspondente nula na tabela `clientes` — ver
    -- caso de teste `contatoopcional` em
    -- tests/importacao/importar-ativos-lote.test.ts.
$$;
