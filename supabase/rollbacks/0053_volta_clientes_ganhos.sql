/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0053 (quick 261008-rxw). Remove so a leitura
  clientes_ganhos.

  Nenhum dado e apagado: a 0053 so cria uma leitura, nao guarda nada.

  ORDEM OBRIGATORIA: primeiro reverter os commits feat da tela Ganhos desta
  quick task e publicar (o item Ganhos sai do menu); so DEPOIS colar este
  arquivo no SQL Editor do Supabase. Na ordem inversa, a aba Ganhos
  publicada mostraria "Nao foi possivel carregar os clientes ganhos" ate a
  tela sair do ar.

  Aplicar SO se o dono decidir desfazer a mudanca.
*/

drop function if exists clientes_ganhos(timestamptz, timestamptz);
