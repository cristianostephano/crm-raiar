-- Phase 15 Plan 1: camada de banco da Conclusao com Resumo e Proxima
-- Visita — a fase de maior risco do marco v1.3. Coluna de resumo em
-- tarefas (a irma em visitas ja existe desde a 0013), as duas RPCs
-- atomicas de conclusao (concluir_tarefa_prospeccao / concluir_visita), a
-- extensao dos gatilhos de auditoria para que o resumo chegue ao historico
-- do cliente, e agenda_do_vendedor() recriada com frequencia_visita e
-- proxima_data_sugerida.
--
-- As tres funcoes chamaveis pelo aplicativo (as duas de conclusao e a da
-- agenda) nascem SEM clausula de elevacao de privilegio, espelhando
-- mover_card_funil e toda funcao dashboard_*: a RLS de
-- clientes/tarefas/visitas continua sendo a UNICA fronteira de
-- autorizacao. Este projeto continua com EXATAMENTE tres excecoes de
-- privilegio elevado no nivel de RPC (is_supervisor,
-- desativar_membro_equipe/reativar_membro_equipe, e
-- cidades_com_clientes_por_estado — ver STATE.md > Deferred Items) e este
-- arquivo NAO adiciona uma quarta.
--
-- <!-- planner-discipline-allow: security definer -->
-- As duas funcoes de GATILHO de auditoria (tarefas_before_update_historico,
-- recriada, e visitas_after_update_historico, nova) PRECISAM continuar
-- rodando com privilegio elevado — e assim que a tabela historico e
-- escrita desde a migration 0002 sem nenhuma permissao de escrita aberta
-- para usuarios. Sao da categoria de gatilho, ja abencoada e ja existente
-- no projeto (clientes_before_update, clientes_after_update_historico,
-- tarefas_before_update_historico), e NAO entram na contagem de excecoes
-- de RPC acima.
--
-- Regra absoluta: jamais criar policy de escrita na tabela historico. Se
-- isso aparecer num diff futuro, e sinal de parar e reconsiderar o desenho
-- inteiro — a trilha de auditoria deixaria de ser a prova de adulteracao.
--
-- Source: .planning/phases/15-conclus-o-com-resumo-e-pr-xima-visita/15-01-PLAN.md
--         .planning/research/ARCHITECTURE.md (Pattern 1)
--         .planning/research/PITFALLS.md (Pitfall 1 fuso horario,
--           Pitfall 2 atomicidade de 3 tabelas)
--         supabase/migrations/0002_clientes_and_funil.sql (forma de
--           tarefas/historico, tarefas_before_update_historico original,
--           clientes_after_update_historico como molde do gatilho novo)
--         supabase/migrations/0007_cidades_e_estado_valido.sql (padrao
--           NOT VALID + VALIDATE CONSTRAINT dentro de bloco que captura
--           check_violation)
--         supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql
--           (forma de visitas, proxima_data_visita — autoridade unica do
--           calculo, NAO redefinida aqui)
--         supabase/migrations/0014_agenda_do_vendedor.sql (corpo atual de
--           agenda_do_vendedor, recriado abaixo com 2 colunas a mais)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Coluna de resumo em tarefas — nullable, deliberadamente: toda tarefa
--    ja existente e toda tarefa ainda pendente nao tem resumo. A coluna
--    irma em visitas ja existe desde a 0013 e NAO e recriada aqui. A
--    obrigatoriedade do resumo e imposta pelo guard das RPCs (secoes 5 e 6
--    abaixo), nunca pelo schema — mesmo raciocinio da Pitfall 3 que a fase
--    anterior aplicou as colunas de cliente.
-- ─────────────────────────────────────────────────────────────────────────
alter table tarefas add column resumo text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Constraints de tamanho do resumo — toleram nulo (a obrigatoriedade e
--    do guard do RPC, nao do schema). Adicionadas NOT VALID e validadas
--    dentro de um bloco que captura violacao de check, padrao literal da
--    migration 0007: um VALIDATE CONSTRAINT incondicional aborta o
--    `supabase db push` inteiro se alguma linha legada violar.
-- ─────────────────────────────────────────────────────────────────────────
alter table tarefas
  add constraint chk_tarefas_resumo_tamanho
  check (resumo is null or char_length(btrim(resumo)) between 10 and 500)
  not valid;

do $$
begin
  alter table tarefas validate constraint chk_tarefas_resumo_tamanho;
exception
  when check_violation then
    raise notice 'chk_tarefas_resumo_tamanho permanece NOT VALID: existe(m) linha(s) legada(s) de tarefas.resumo fora do intervalo 10..500 apos aparar espacos. Novas gravacoes continuam bloqueadas se invalidas; nenhuma linha existente foi afetada ou bloqueada.';
end;
$$;

alter table visitas
  add constraint chk_visitas_resumo_tamanho
  check (resumo is null or char_length(btrim(resumo)) between 10 and 500)
  not valid;

do $$
begin
  alter table visitas validate constraint chk_visitas_resumo_tamanho;
exception
  when check_violation then
    raise notice 'chk_visitas_resumo_tamanho permanece NOT VALID: existe(m) linha(s) legada(s) de visitas.resumo fora do intervalo 10..500 apos aparar espacos. Novas gravacoes continuam bloqueadas se invalidas; nenhuma linha existente foi afetada ou bloqueada.';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. tarefas_before_update_historico recriada — so o corpo da funcao; o
--    gatilho trg_tarefas_before_update_historico que a chama (0002)
--    continua o mesmo e NAO e recriado aqui. Mantem tudo que ja fazia
--    (mesma condicao de disparo, mesmo carimbo de concluida_em, mesma
--    clausula de privilegio elevado, mesmo search_path fixado). A UNICA
--    mudanca: a descricao gravada no historico passa a ser o resumo do
--    vendedor quando houver um resumo nao vazio, e continua sendo o texto
--    generico de antes quando nao houver — preserva o caminho antigo de
--    concluir tarefa pela ficha do cliente, que nao pede resumo. A coluna
--    historico.descricao e NOT NULL, entao nunca pode receber nulo aqui.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function tarefas_before_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.concluida = false and new.concluida = true then
    new.concluida_em := now();
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id,
      'tarefa_concluida',
      case
        when new.resumo is not null and btrim(new.resumo) <> '' then btrim(new.resumo)
        else 'Tarefa marcada como concluída'
      end,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. visitas_after_update_historico — funcao de gatilho NOVA, irma literal
--    da de tarefas mas na forma "depois do update" (nada precisa ser
--    mutado na linha, entao segue o molde de clientes_after_update_historico
--    da 0002). Dispara quando a visita passa de pendente (data_realizada
--    nula) para realizada (data_realizada preenchida). Mesma clausula de
--    privilegio elevado e mesmo search_path fixado das outras funcoes de
--    gatilho do projeto.
-- <!-- planner-discipline-allow: security definer -->
-- ─────────────────────────────────────────────────────────────────────────
create or replace function visitas_after_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.data_realizada is null and new.data_realizada is not null then
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id,
      'visita_concluida',
      case
        when new.resumo is not null and btrim(new.resumo) <> '' then btrim(new.resumo)
        else 'Visita concluída'
      end,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

create trigger trg_visitas_after_update_historico
  after update on visitas
  for each row execute function visitas_after_update_historico();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. concluir_tarefa_prospeccao — RPC nova, SEM clausula de elevacao de
--    privilegio. Roda como o chamador: o UPDATE abaixo fica sob a RLS de
--    tarefas (0002), entao uma tarefa de cliente que este usuario nao pode
--    tocar simplesmente nao muda linha nenhuma. O carimbo de conclusao e a
--    linha de auditoria sao responsabilidade exclusiva do gatilho da
--    secao 3 — esta funcao nunca escreve na trilha de auditoria.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function concluir_tarefa_prospeccao(
  p_tarefa_id uuid,
  p_resumo text
)
returns void
language plpgsql
as $$
declare
  v_resumo text;
  v_row_count int;
begin
  -- Guard de resumo primeiro — e a fronteira REAL do CONC-01, imposta no
  -- banco e nao so na tela.
  v_resumo := btrim(p_resumo);

  if v_resumo is null or v_resumo = '' or char_length(v_resumo) < 10 or char_length(v_resumo) > 500 then
    raise exception 'O resumo precisa ter entre 10 e 500 caracteres';
  end if;

  update tarefas
  set resumo = v_resumo,
      concluida = true
  where id = p_tarefa_id
    and concluida = false;

  get diagnostics v_row_count = row_count;

  -- Zero linhas cobre tres casos de uma vez: id inexistente, tarefa ja
  -- concluida (idempotencia), e — o mais importante — tarefa de cliente
  -- que a RLS nao deixa este usuario tocar, o que faz a funcao falhar
  -- fechada sem nenhuma checagem de papel escrita a mao.
  if v_row_count = 0 then
    raise exception 'Tarefa não encontrada ou já concluída';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. concluir_visita — RPC nova ATOMICA, SEM clausula de elevacao de
--    privilegio. Fecha a visita atual, o gatilho da secao 4 grava o
--    historico, e a proxima visita e criada — tudo numa transacao so,
--    porque uma funcao plpgsql roda inteira dentro da transacao da
--    chamada (Pitfall 2). Nunca chama proxima_data_visita: aquele calculo
--    serve so para SUGERIR, dentro de agenda_do_vendedor (secao 7); quem
--    decide a data gravada aqui e sempre o vendedor.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function concluir_visita(
  p_visita_id uuid,
  p_resumo text,
  p_proxima_data date default null
)
returns void
language plpgsql
as $$
declare
  v_resumo text;
  v_row_count int;
  v_cliente_id uuid;
  v_frequencia frequencia_visita_enum;
begin
  -- Mesmo guard de resumo da secao 5.
  v_resumo := btrim(p_resumo);

  if v_resumo is null or v_resumo = '' or char_length(v_resumo) < 10 or char_length(v_resumo) > 500 then
    raise exception 'O resumo precisa ter entre 10 e 500 caracteres';
  end if;

  -- O dia-base do carimbo de conclusao tem que ser o dia corrente no fuso
  -- de Sao Paulo, nunca a data crua do servidor (o banco roda em UTC e,
  -- depois das 21h no horario local, o dia ja teria virado o seguinte —
  -- Pitfall 1). A coluna e data pura de calendario, nunca instante com
  -- fuso.
  update visitas
  set resumo = v_resumo,
      data_realizada = (now() at time zone 'America/Sao_Paulo')::date
  where id = p_visita_id
    and data_realizada is null
  returning cliente_id into v_cliente_id;

  get diagnostics v_row_count = row_count;

  -- Mesmo raciocinio de falha fechada pela RLS da secao 5, adaptado para
  -- visita.
  if v_row_count = 0 then
    raise exception 'Visita não encontrada ou já concluída';
  end if;

  -- Nunca confiar no que o navegador mandou sobre frequencia — a tela nao
  -- passa esse valor e esta funcao nao aceita esse parametro. A leitura
  -- acontece DENTRO da RPC, direto da tabela de clientes.
  select frequencia_visita into v_frequencia
  from clientes
  where id = v_cliente_id;

  -- Regra a: frequencia nula ou "sem cadencia" — nao cria proxima visita e
  -- ignora completamente qualquer data recebida. E o criterio de sucesso
  -- 4 da fase, imposto no banco para valer mesmo se a tela errar ou for
  -- contornada.
  if v_frequencia is null or v_frequencia = 'nenhuma' then
    return;
  end if;

  -- Regra b: frequencia real e nenhuma data confirmada — falha alto. O
  -- marco decidiu que nada e agendado em silencio, mas o inverso tambem
  -- vale: a cadencia de um cliente ativo nao pode parar em silencio por
  -- causa de um defeito de tela.
  if p_proxima_data is null then
    raise exception 'A próxima data de visita precisa ser confirmada para este cliente';
  end if;

  -- Regra c: insere a proxima visita com data_prevista EXATAMENTE igual a
  -- data recebida — esta funcao nunca recalcula por cima da escolha do
  -- vendedor (VIS-03). Mesma guarda de idempotencia que mover_card_funil
  -- ja usa: so insere se nao existir outra visita pendente daquele
  -- cliente.
  if not exists (
    select 1 from visitas v
    where v.cliente_id = v_cliente_id
      and v.data_realizada is null
  ) then
    insert into visitas (cliente_id, data_prevista, criado_por)
    values (v_cliente_id, p_proxima_data, (select auth.uid()));
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. agenda_do_vendedor recriada com duas colunas a mais. Copia o corpo
--    atual da 0014 e o estende — mesmos joins, mesmos filtros, mesma
--    ordenacao. Drop explicito ANTES do create (nao "create or replace"):
--    mudar o conjunto de colunas de retorno com create or replace e
--    recusado pelo Postgres, e recriar sem apagar deixaria duas
--    assinaturas ambiguas — a fase anterior documentou exatamente esse
--    tiro no pe com mover_card_funil. As duas instrucoes ficam no mesmo
--    arquivo/transacao, sem janela em que a funcao nao exista.
--    Continua language sql, stable, SEM clausula de elevacao de
--    privilegio, SEM nenhuma checagem de papel e SEM nenhum filtro de
--    dono no corpo — a RLS de clientes/tarefas/visitas continua sendo a
--    unica fronteira de autorizacao (AGD-04, migration 0014).
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists agenda_do_vendedor();

create function agenda_do_vendedor()
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
    -- Coluna nao se aplica a prospeccao — cast explicito para o tipo do
    -- enum, senao o union all abaixo recusa por tipos incompativeis entre
    -- as duas metades.
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
  union all
  select
    'visita'::text as origem,
    v.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    'Visita'::text as titulo,
    v.data_prevista as data,
    c.frequencia_visita,
    -- Razao desta coluna existir: a tela recebe a data ja calculada pelo
    -- banco e nunca refaz a conta, entao a autoridade do calculo continua
    -- sendo uma so no projeto inteiro (Pitfall 1). A funcao de calculo e
    -- so chamada aqui, nunca redefinida.
    proxima_data_visita((now() at time zone 'America/Sao_Paulo')::date, c.frequencia_visita) as proxima_data_sugerida
  from visitas v
  join clientes c on c.id = v.cliente_id
  left join profiles p on p.id = c.responsavel
  where v.data_realizada is null
  -- Ordenacao decidida aqui e em nenhum outro lugar: posicao 8 = data,
  -- posicao 4 = razao_social como desempate. As colunas novas foram
  -- apendadas no fim (posicoes 9 e 10), entao as posicoes usadas aqui nao
  -- mudam em relacao a 0014.
  order by 8, 4;
$$;
-- No `security definer` — nao adicionar.
