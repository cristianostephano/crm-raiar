/*
 * Fase 30 Plano 3 - diagnostico temporario, parte 5.
 * Mesma tabela isolada de teste do 0045 (nao mexe em nada real). Agora
 * testa uma policy SEM o exists de profiles - so usuario_id + dia - para
 * confirmar se o problema e especificamente o EXISTS que consulta outra
 * tabela dentro do WITH CHECK quando chamado via funcao, ou se e mais
 * generico (qualquer WITH CHECK falha quando chamado de dentro de uma
 * funcao via .rpc()).
 */

drop policy if exists "diag insert" on diagnostico_temp_rls;
create policy "diag insert sem exists"
on diagnostico_temp_rls for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and dia = (now() at time zone 'America/Sao_Paulo')::date
);
