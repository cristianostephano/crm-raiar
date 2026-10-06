/*
  NAO APLICAR automaticamente. Este arquivo fica FORA de supabase/migrations
  de proposito: o CLI do Supabase nunca o le.

  Volta atras da migration 0051 (quick task 261006-ncy). Remove as duas
  colunas de texto da Agenda (o_que_fazer e o_que_foi_feito) e os limites de
  tamanho delas.

  ATENCAO: APAGA todos os textos ja escritos em Motivo da visita e O que foi feito, sem volta.

  ORDEM obrigatoria: primeiro publicar a versao da tela SEM os campos
  (reverter os commits feat das Tarefas 2 e 3 desta quick task e publicar),
  so DEPOIS colar este arquivo no SQL Editor do Supabase. Na ordem inversa a
  Agenda para de carregar para todo o time, porque a tela nova le estas
  colunas.

  Aplicar SO se o dono decidir desfazer.
*/

alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;
alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;
alter table agenda2_itens drop column if exists o_que_fazer;
alter table agenda2_itens drop column if exists o_que_foi_feito;
