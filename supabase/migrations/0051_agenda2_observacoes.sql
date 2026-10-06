/*
  Quick task 261006-ncy (decisao do dono de 2026-10-06): a visita da Agenda
  ganha duas colunas de texto livre OPCIONAIS.

  - o_que_fazer: o que o vendedor vai fazer na visita (tela: "Motivo da
    visita").
  - o_que_foi_feito: o que foi feito ou combinado na visita (tela: "O que foi
    feito").

  Cada coluna aceita ate 500 caracteres depois de aparar espacos. Texto vazio
  vira NULL na aplicacao (nao aqui).

  Excecao consciente a minimizacao da 0048, que nao tinha observacao livre:
  foi decisao do dono, com o alerta de LGPD registrado no SUMMARY desta quick
  task. O dono decidiu NAO recusar sequencias longas de digitos nestes dois
  campos (a regra de nome_cliente e bairro continua igual).

  Nenhuma policy muda: as policies da 0048 sao por linha e ja cobrem as
  colunas novas (o dono le e escreve, o Supervisor so le, outro vendedor nao
  ve). O gatilho de carimbos tambem nao muda.

  As colunas sao anulaveis: as linhas existentes ficam com NULL e a tela
  atual continua funcionando. Por isso esta mudanca e aplicada ANTES de
  publicar a tela nova, que le estas colunas.

  O prazo de guarda de 1 ano decidido em 2026-10-01 vale tambem para estes
  textos. O descarte automatico ainda nao foi implementado e nenhum descarte
  acontece aqui.

  Nenhuma rotina nova e nenhuma clausula de elevacao de privilegio.

  Re-executavel: usa add column if not exists e drop constraint if exists
  antes de cada add constraint.

  Volta atras em supabase/rollbacks/0051_volta_agenda2_observacoes.sql, que
  NAO e aplicado automaticamente. Voltar atras APAGA os textos escritos.
*/

alter table agenda2_itens add column if not exists o_que_fazer text;
alter table agenda2_itens add column if not exists o_que_foi_feito text;

alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;
alter table agenda2_itens add constraint chk_agenda2_o_que_fazer_tamanho check (char_length(btrim(o_que_fazer)) <= 500);

alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;
alter table agenda2_itens add constraint chk_agenda2_o_que_foi_feito_tamanho check (char_length(btrim(o_que_foi_feito)) <= 500);

comment on column agenda2_itens.o_que_fazer is 'Agenda: o que o vendedor pretende fazer na visita. Texto livre opcional, ate 500 caracteres. Quick task 261006-ncy.';
comment on column agenda2_itens.o_que_foi_feito is 'Agenda: o que foi feito ou combinado na visita. Texto livre opcional, ate 500 caracteres. Quick task 261006-ncy.';
