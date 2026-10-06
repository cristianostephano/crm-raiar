/*
  Quick task 261006-gvo - Vendedor apaga os proprios clientes em prospeccao.

  Decisao do dono de 2026-10-06: o Vendedor ATIVO passa a apagar somente os
  clientes dele que ainda estao "em andamento". Clientes ganho, perdido e
  encerrado continuam so com o Supervisor. O Supervisor continua apagando
  qualquer cliente, sem mudanca. Isto emenda o requisito CLI-06 (antes:
  vendedor edita os proprios clientes, mas nao apaga).

  Recria a policy de DELETE de clientes, que ate aqui era so do Supervisor
  (migration 0002), no mesmo formato das policies de escrita da 0048 (perfil
  vendedor ativo). A autorizacao fica toda no banco: mesmo quem chamar a API
  direto, fora da tela, so apaga o que a regra permite.

  A cascata nao precisa de policy nova: tarefas, visitas, cliente_produtos
  e historico do cliente saem junto pelas chaves estrangeiras com cascata
  (0002 e 0013). Essa cascata roda com os direitos do dono da tabela e nao
  passa pela RLS, por isso nenhuma policy e criada nessas tabelas e o
  historico continua sem policy de escrita para usuarios.

  Apagar e DEFINITIVO e remove todo o historico do funil do cliente. LGPD:
  apoia a minimizacao de dados; a decisao fica registrada no SUMMARY da
  quick task. O sistema nao guarda registro de quem apagou nem quando.

  Nenhuma funcao nova e nenhuma clausula de elevacao de privilegio.
  Re-executavel: cada create vem precedido de drop policy if exists.

  Volta atras: supabase/rollbacks/0050_volta_policy_delete_clientes.sql, que
  NAO e aplicado automaticamente. Clientes ja apagados nao voltam.
*/

drop policy if exists "somente supervisor apaga clientes" on clientes;
drop policy if exists "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos" on clientes;
create policy "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos"
on clientes for delete
to authenticated
using (
  (select is_supervisor())
  or (
    responsavel = (select auth.uid())
    and status_acompanhamento = 'em_andamento'
    and exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
    )
  )
);
