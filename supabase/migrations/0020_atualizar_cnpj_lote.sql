-- Phase 19 Plan 1: atualizar_cnpj_lote (IMP-03) — a operação de gravação
-- em massa do CNPJ de vários clientes já "ganho" de uma vez. É irmã de
-- atualizar_frequencia_visita_lote (0017, Fase 17): mesmo molde, trocando
-- o campo de frequência pelo de CNPJ.
--
-- Três dos cinco critérios de sucesso da Fase 19 são garantidos aqui por
-- construção do SQL, não por disciplina de tela:
--   1. A função é ESTRUTURALMENTE incapaz de criar cliente — existe
--      exatamente uma instrução de alteração em todo o arquivo, ZERO
--      instruções de criação de linha.
--   2. Só altera clientes cujo status_acompanhamento já é 'ganho' — a
--      cláusula de status na condição da alteração é o mecanismo literal
--      disso.
--   3. Uma linha do lote que não casa com nenhum cliente apto simplesmente
--      não afeta linha nenhuma e não aparece no retorno — não levanta
--      erro, não reverte o lote inteiro (comportamento silencioso e
--      por-linha).
--
-- Como mover_card_funil, importar_clientes_lote e
-- atualizar_frequencia_visita_lote, esta função NÃO tem elevação de
-- privilégio: roda com os privilégios de quem chama, então a regra de
-- alteração de clientes (RLS) continua sendo a fronteira real de
-- autorização. O projeto tem exatamente 4 exceções documentadas de
-- SECURITY DEFINER (ver STATE.md, Deferred Items) e esta função não abre
-- uma quinta.
--
-- Recebe `id uuid` já resolvido, NUNCA razão social — o casamento por
-- nome e a detecção de nome ambíguo acontecem fora do banco (plano
-- 19-03), antes desta função ser chamada. Se algum dia esta função passar
-- a casar por nome dentro do banco, a detecção de nome ambíguo (achado
-- real da Fase 17) deixa de existir e a planilha volta a poder gravar no
-- cliente errado.
--
-- Nenhuma validação de formato/dígito verificador de CNPJ existe aqui —
-- só presença ou ausência do valor, mesma postura já travada na Fase 18.
--
-- Source: .planning/phases/19-planilhas-de-cnpj-e-nome-fantasia/19-01-PLAN.md
create or replace function atualizar_cnpj_lote(p_atualizacoes jsonb)
returns table(id uuid, razao_social text)
language plpgsql
as $$
#variable_conflict use_column
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem atualizar CNPJ em massa';
  end if;

  -- A cláusula de status abaixo é o mecanismo literal que torna verdadeiro
  -- o critério de sucesso "só cliente ganho é alterado" — não pode ser
  -- removida nem afrouxada.
  return query
  update clientes
  set cnpj = atualizacoes.cnpj
  from jsonb_to_recordset(p_atualizacoes) as atualizacoes(id uuid, cnpj text)
  where clientes.id = atualizacoes.id
    and clientes.status_acompanhamento = 'ganho'
  returning clientes.id, clientes.razao_social;
end;
$$;
