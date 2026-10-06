/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0050 (quick task 261006-gvo). Recoloca a policy
  original da 0002: so o Supervisor apaga clientes.

  Aplicar SO se o dono decidir desfazer, colando este conteudo no SQL Editor
  do Supabase.

  Clientes que ja foram apagados NAO voltam.

  A parte da tela volta revertendo o commit feat da Tarefa 2 desta quick
  task (botao Apagar cliente para o Vendedor).
*/

drop policy if exists "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos" on clientes;
drop policy if exists "somente supervisor apaga clientes" on clientes;
create policy "somente supervisor apaga clientes"
on clientes for delete
to authenticated
using (is_supervisor());
