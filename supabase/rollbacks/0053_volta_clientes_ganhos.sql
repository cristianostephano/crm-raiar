/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0053 (quick 261008-rxw): remove a leitura
  clientes_ganhos, o gatilho de preenchimento da data do ganho, a regra do
  gatilho e a coluna clientes.ganho_em.

  ATENCAO: esta volta APAGA a coluna ganho_em com TODAS as datas de ganho
  (as automaticas, as do preenchimento pelo historico e as digitadas na
  ficha) - nao ha como recupera-las depois. Se quiser guardar as datas
  antes, rode no SQL Editor uma consulta so de leitura das colunas id e
  ganho_em dos clientes que tem data e guarde o resultado em local seguro
  da empresa.

  ORDEM OBRIGATORIA: primeiro reverter os commits feat desta quick task
  (tela Ganhos E campo "Data do ganho" da ficha) e publicar; so DEPOIS
  colar este arquivo no SQL Editor do Supabase. Na ordem inversa, a ficha
  de QUALQUER cliente (Clientes, Agenda, Ganhos) deixa de abrir, porque o
  codigo novo le a coluna.

  Aplicar SO se o dono decidir desfazer a mudanca.
*/

drop function if exists clientes_ganhos(timestamptz, timestamptz);
drop trigger if exists trg_clientes_preenche_ganho_em on clientes;
drop function if exists clientes_preenche_ganho_em();
alter table clientes drop column if exists ganho_em;
