-- Quick task 260819-m8q: as 5 colunas de endereço de `clientes` (cep, rua,
-- numero, cidade, estado) deixam de exigir valor obrigatório (D-01/D-02).
--
-- Motivo: a importação em massa de clientes precisa aceitar planilhas com
-- endereço incompleto (o time precisa importar a base existente mesmo sem
-- endereço completo), e a ficha de edição de um cliente já cadastrado
-- precisa acompanhar esse afrouxamento (D-06) para não travar o salvamento
-- de um cliente importado sem endereço quando só outro campo é corrigido.
-- O cadastro manual (tela "Novo cliente") continua exigindo os 5 campos —
-- essa obrigatoriedade passa a ser garantida só pela validação Zod de
-- `createClienteSchema` (lib/validations/cliente.ts), que este quick task
-- NÃO altera.
--
-- NEW file — nunca editar 0001-0022, que já estão aplicadas em produção
-- (regra do CLAUDE.md / Pitfall 11 do projeto: uma vez pusheada, qualquer
-- mudança futura é uma migration NOVA).
--
-- Source: .planning/quick/260819-m8q-tornar-cep-rua-numero-cidade-e-estado-ca/260819-m8q-PLAN.md

alter table clientes
  alter column cep drop not null,
  alter column rua drop not null,
  alter column numero drop not null,
  alter column cidade drop not null,
  alter column estado drop not null;

-- D-04 — por que `chk_estado_valido` (migration 0007) não precisa de
-- nenhuma alteração aqui: a constraint é `check (estado in (...))`. Em
-- Postgres, quando `estado` é nulo essa expressão avalia para
-- desconhecido (UNKNOWN), não para falso — e um CHECK só reprova a linha
-- quando a expressão é literalmente falsa. Um valor nulo, portanto, já
-- passa pela constraint sem qualquer mudança nela. Texto vazio ('')
-- continua sendo reprovado normalmente (a expressão avalia para falso),
-- e essa é justamente a trava que impede a camada de importação e a
-- Server Action de edição de gravarem texto vazio por engano em vez de
-- nulo — ambas precisam converter "campo em branco" em nulo de verdade
-- antes de gravar. Nenhum `alter constraint`, `drop constraint` nem
-- `validate constraint` nesta migration.

-- Nenhuma alteração em `importar_clientes_lote` (migrations 0004/0005/
-- 0006/0019): a função já repassa os cinco campos de endereço direto de
-- `jsonb_to_recordset(p_clientes)` para o INSERT em `clientes`, e
-- `jsonb_to_recordset` produz valor nulo de coluna quando a chave
-- correspondente no JSON de entrada vem com valor `null` (ou está
-- ausente). Não recriar essa função por causa deste quick task — o lado
-- que precisa mudar é a camada de anotação da importação (annotarLinha),
-- que passa a gravar nulo em vez de string vazia nos campos de endereço
-- em branco.
