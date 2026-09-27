/*
 * Fase 30 Plano 3 - correcao final (apos diagnostico 0042-0046,
 * aprovada explicitamente pelo dono do projeto no chat).
 *
 * O QUE FOI DESCOBERTO: um INSERT feito de DENTRO de uma funcao plpgsql
 * chamada via RPC, numa tabela com RLS habilitada cujo WITH CHECK usa
 * auth.uid(), e recusado pela politica mesmo quando todos os valores
 * conferem (confirmado em 0044 contra a tabela real, e reproduzido em
 * 0045/0046 numa tabela isolada de teste, ate com a regra mais simples
 * possivel - so usuario_id e dia, sem nenhuma consulta a outra tabela).
 * Um INSERT identico, feito DIRETO pelo cliente (sem passar por funcao),
 * sempre funcionou. Isola o problema neste ambiente especificamente na
 * combinacao "INSERT dentro de funcao chamada via .rpc()" + "WITH CHECK
 * baseado em auth.uid()" - nao e um erro de logica da funcao ou da regra.
 *
 * CORRECAO (aprovada pelo dono): registrar_acesso_diario() passa a ser
 * SECURITY DEFINER (mesmo padrao ja usado por is_supervisor() desde a
 * Fase 1, com o mesmo motivo: evitar que a checagem de RLS dentro de uma
 * funcao produza um resultado incorreto). A funcao continua fazendo, ela
 * mesma, EXATAMENTE a mesma verificacao que a policy fazia (so vendedor
 * ativo grava; a limpeza de 35 dias so roda quando quem chama e
 * Supervisor, igual ao combinado no checkpoint de aprovacao) - a
 * diferenca e que a checagem agora e feita em codigo explicito dentro da
 * funcao, e nao pela RLS. Isso NAO abre nenhuma brecha nova: um vendedor
 * que tentar gravar DIRETO na tabela (sem passar por esta funcao)
 * continua barrado pela RLS de 0038, ja confirmado funcionando
 * (diagnostico 0038, teste "Test A" do scripts/diag-30-rls.mjs).
 *
 * As tres policies de 0038 continuam exatamente como estao - protegem
 * contra escrita direta. Nao muda nada em 0039/0040. Limpa tambem os
 * artefatos temporarios de diagnostico (0043/0045).
 */

drop function if exists diagnostico_policies_acessos_diarios();
drop function if exists diagnostico_insert_temp();
drop table if exists diagnostico_temp_rls;

drop function if exists registrar_acesso_diario();

create or replace function registrar_acesso_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if exists (
    select 1 from profiles p
    where p.id = v_uid and p.role = 'vendedor' and p.ativo = true
  ) then
    insert into acessos_diarios (usuario_id, dia)
    values (v_uid, v_hoje)
    on conflict (usuario_id, dia) do nothing;
  end if;

  if is_supervisor() then
    delete from acessos_diarios
    where dia < v_hoje - 35;
  end if;
end;
$$;
