-- Phase 17 Plan 1: fundação de gravação do fluxo de planilha de
-- frequências (IMP-01) — a operação que grava, numa única instrução, a
-- frequência de visita de vários clientes "ganho" de uma vez.
--
-- É irmã de importar_clientes_lote (0004/0005/0006), mas materialmente
-- diferente: aquela função CRIA cliente; esta só ALTERA cliente que já
-- existe. Três dos cinco critérios de sucesso da Fase 17 são garantidos
-- aqui por construção do SQL, não por disciplina de tela:
--   1. A função é estruturalmente incapaz de criar cliente — existe uma
--      única instrução de atualização em todo o arquivo, zero instruções
--      de criação.
--   2. Só altera clientes cujo status é "ganho" — a cláusula de status na
--      condição da atualização.
--   3. Uma linha que não casa com nenhum cliente apto simplesmente não
--      afeta linha nenhuma e não aparece no retorno — não levanta erro,
--      não reverte o lote inteiro.
--
-- Como mover_card_funil e importar_clientes_lote, esta função NÃO tem
-- elevação de privilégio: roda com os privilégios de quem chama, então a
-- regra de alteração de clientes da migration 0002 continua sendo a
-- fronteira real (defesa em duas camadas: guard de papel abaixo + regra de
-- linha do RLS). O marco v1.3 está proibido de abrir uma quarta exceção de
-- privilégio elevado (ver STATE.md, Deferred Items) e esta função não abre.
--
-- Source: .planning/phases/17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio/17-01-PLAN.md
create or replace function atualizar_frequencia_visita_lote(p_atualizacoes jsonb)
returns table(id uuid, razao_social text)
language plpgsql
as $$
#variable_conflict use_column
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem atualizar frequência de visita em massa';
  end if;

  -- A cláusula de status abaixo é o mecanismo literal que torna verdadeiro
  -- o critério de sucesso 3 (só cliente "ganho" é alterado) — não pode ser
  -- removida nem afrouxada. Esta operação deliberadamente não agenda
  -- visita nenhuma, pelo mesmo motivo já documentado na edição individual
  -- da frequência (app/actions/clientes.ts, atualizarFrequenciaVisita):
  -- definir cadência não é agendar visita — a próxima nasce da conclusão
  -- da anterior (Fase 15).
  return query
  update clientes
  set frequencia_visita = atualizacoes.frequencia_visita
  from jsonb_to_recordset(p_atualizacoes) as atualizacoes(id uuid, frequencia_visita frequencia_visita_enum)
  where clientes.id = atualizacoes.id
    and clientes.status_acompanhamento = 'ganho'
  returning clientes.id, clientes.razao_social;
end;
$$;
