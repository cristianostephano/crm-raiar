/*
  Fase 33 (AGD-16) - Agenda atual so com prospeccao.

  A funcao agenda_do_vendedor passa a devolver SOMENTE a metade de
  prospeccao (as tarefas abertas com data). As visitas automaticas dos
  clientes ativos deixam de aparecer. A Lista, os pendentes do Calendario
  e o contador do menu leem esta mesma funcao, entao os tres mudam juntos
  e nunca discordam entre si.

  Mesma assinatura e mesmas dez colunas de retorno da 0036: troca so o
  corpo, sem sobrecarga e sem remover a funcao antes. A metade de
  prospeccao e copiada da 0036 sem nenhuma mudanca, incluindo o filtro de
  cliente encerrado e a ordenacao por data e razao social (D-36).

  As visitas continuam sendo criadas escondidas pelas funcoes de escrita,
  que NAO mudam, e nenhuma visita e apagada (D-34). O historico de
  concluidos tambem nao muda (D-33): visitas ja concluidas seguem no
  Calendario e no Diario.

  A funcao continua rodando com as permissoes de quem chama, sem elevacao
  de privilegio.

  Volta atras: supabase/rollbacks/0049_volta_agenda_do_vendedor.sql, que
  NAO e aplicado automaticamente.
*/

create or replace function agenda_do_vendedor()
returns table (
  origem text,
  item_id uuid,
  cliente_id uuid,
  razao_social text,
  responsavel uuid,
  responsavel_nome text,
  titulo text,
  data date,
  frequencia_visita frequencia_visita_enum,
  proxima_data_sugerida date
)
language sql
stable
as $$
  select
    'prospeccao'::text as origem,
    t.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    tt.nome as titulo,
    t.data_conclusao as data,
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
    and c.status_acompanhamento <> 'encerrado'
  order by 8, 4;
$$;
