-- Phase 22 Plan 1: camada de banco inteira da Conclusao Remota com Motivo
-- (CONC-02, CONC-03, CONC-04, CONC-05). Este arquivo faz seis coisas e so
-- essas seis: tabela nova (6a lista editavel) + quatro regras de acesso +
-- valores iniciais + duas colunas opcionais de chave estrangeira (uma em
-- tarefas, uma em visitas) + as duas funcoes de conclusao apagadas e
-- recriadas com o parametro novo + os dois gatilhos de auditoria
-- recriados para resolver o motivo em texto legivel no Diario.
--
-- A leitura da tabela nova (motivos_conclusao_remota) fica ABERTA a
-- qualquer usuario autenticado, de proposito: e ela que alimenta a lista
-- de escolha do Vendedor no dialogo de conclusao (planos 22-02/22-03).
-- Restringi-la ao Supervisor por engano deixaria essa lista
-- permanentemente vazia para todo Vendedor, sem dar erro nenhum — e o
-- modo de falha silenciosa que a migration 0016 ja documentou neste
-- projeto. As tres regras de escrita (insert/update/delete) passam por
-- is_supervisor(), nunca por comparacao de papel a mao.
--
-- As duas funcoes de conclusao (concluir_tarefa_prospeccao, concluir_visita)
-- continuam SEM clausula de elevacao de privilegio, rodando como o
-- chamador — a RLS de tarefas/visitas/clientes continua sendo a UNICA
-- fronteira de autorizacao, exatamente como a migration 0015 as deixou.
-- Os dois gatilhos de auditoria (tarefas_before_update_historico,
-- visitas_after_update_historico) continuam com a clausula de elevacao de
-- privilegio, porque sao a UNICA forma de escrever em historico desde a
-- migration 0002. Essa categoria de gatilho ja e abencoada e existente no
-- projeto, e NAO entra na contagem das quatro excecoes de privilegio
-- elevado de nivel de RPC (is_supervisor, desativar_membro_equipe/
-- reativar_membro_equipe, cidades_com_clientes_por_estado) — o projeto
-- termina este arquivo com as MESMAS quatro excecoes de RPC de hoje.
-- E PROIBIDO criar qualquer regra de escrita em historico.
--
-- Por que apagar-antes-de-criar (nunca "create or replace") nas duas
-- funcoes de conclusao: a identidade de uma funcao no Postgres e o nome
-- MAIS os tipos dos parametros. Recriar por cima com um parametro a mais
-- nao substitui a funcao antiga, cria uma SEGUNDA funcao — a partir dai
-- toda chamada existente com a quantidade antiga de argumentos casaria
-- com as duas candidatas e falharia por ambiguidade. E exatamente o tiro
-- no pe que a migration 0018 ja documentou neste projeto com
-- mover_card_funil. As duas instrucoes (drop + create) ficam no mesmo
-- arquivo/transacao, sem janela em que a funcao nao exista.
--
-- Por que o texto gravado no Diario e um retrato congelado (D-04):
-- renomear ou desativar um motivo depois de uma conclusao NAO reescreve o
-- historico ja gravado — mesmo comportamento ja travado para
-- frequencias_pedido (migration 0016) e para motivo_perda (migration
-- 0002). O nome e resolvido uma UNICA vez, no momento da conclusao, pelo
-- gatilho.
--
-- Source: .planning/phases/22-conclus-o-remota-com-motivo/22-01-PLAN.md
--         supabase/migrations/0016_frequencias_pedido.sql (molde da
--           tabela + regras de acesso + valores iniciais)
--         supabase/migrations/0015_conclusao_com_resumo.sql (corpos
--           atuais das duas funcoes de conclusao e dos dois gatilhos de
--           auditoria)
--         supabase/migrations/0002_clientes_and_funil.sql (forma de
--           motivos_perda, tarefas, historico)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabela motivos_conclusao_remota — copia estrutural literal de
--    motivos_perda/frequencias_pedido. Sem coluna de descricao, sem ordem
--    manual, sem indicador de "padrao".
-- ─────────────────────────────────────────────────────────────────────────
create table motivos_conclusao_remota (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security — obrigatoria antes de qualquer regra de acesso.
-- ─────────────────────────────────────────────────────────────────────────
alter table motivos_conclusao_remota enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Quatro regras de acesso, uma por operacao — mesmo padrao literal das
--    outras cinco listas editaveis. Leitura aberta a qualquer
--    autenticado (o motivo pelo qual esta aberta esta explicado no
--    cabecalho deste arquivo). As tres escritas passam por
--    is_supervisor().
-- ─────────────────────────────────────────────────────────────────────────
create policy "usuarios autenticados leem motivos_conclusao_remota"
on motivos_conclusao_remota for select to authenticated using (true);

create policy "somente supervisor gerencia motivos_conclusao_remota (insert)"
on motivos_conclusao_remota for insert to authenticated with check (is_supervisor());

create policy "somente supervisor gerencia motivos_conclusao_remota (update)"
on motivos_conclusao_remota for update to authenticated using (is_supervisor()) with check (is_supervisor());

create policy "somente supervisor gerencia motivos_conclusao_remota (delete)"
on motivos_conclusao_remota for delete to authenticated using (is_supervisor());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Conjunto inicial de valores — starter set only, adequado a um
--    distribuidor de alimentos, so para o campo de escolha nunca aparecer
--    vazio no primeiro uso. O Supervisor edita/adiciona/desativa pela
--    tela de Configuracoes (plano 22-02) sem precisar de migration nova.
-- ─────────────────────────────────────────────────────────────────────────
insert into motivos_conclusao_remota (nome) values
  ('Pedido por telefone'),
  ('Pedido por WhatsApp'),
  ('Pedido por e-mail'),
  ('Reunião por vídeo'),
  ('Cliente não pôde receber');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Duas colunas opcionais de chave estrangeira — uma em tarefas, uma em
--    visitas. Ficar vazia significa "foi presencial" — chave preenchida
--    E o proprio sinal de "foi remoto" (D-05), sem nenhum indicador
--    booleano irmao. Sem comportamento de remocao em cascata: apagar de
--    vez um motivo ja usado por uma conclusao existente e recusado pelo
--    banco, o que e desejavel ja que a tela nunca apaga de verdade, so
--    desativa.
-- ─────────────────────────────────────────────────────────────────────────
alter table tarefas add column motivo_conclusao_remota_id uuid references motivos_conclusao_remota(id);

alter table visitas add column motivo_conclusao_remota_id uuid references motivos_conclusao_remota(id);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. As duas assinaturas ANTIGAS das funcoes de conclusao, apagadas
--    explicitamente ANTES das criacoes novas (ver cabecalho deste
--    arquivo para o motivo).
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists concluir_tarefa_prospeccao(uuid, text);

drop function if exists concluir_visita(uuid, text, date);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. concluir_tarefa_prospeccao recriada — corpo ATUAL da migration 0015
--    reproduzido integralmente (mesmo guard de resumo primeiro, mesma
--    mensagem de erro, mesma checagem de zero-linhas-afetadas), com DUAS
--    adicoes: a guarda nova do motivo (existe e esta ativo — a lista de
--    opcoes da tela nao e fronteira nenhuma, e a chave estrangeira
--    sozinha nao barraria um valor ja desativado) e a coluna nova
--    acrescentada ao UPDATE que ja existia. Continua SEM clausula de
--    elevacao de privilegio, rodando como o chamador — a RLS de tarefas
--    continua sendo a unica fronteira de autorizacao.
-- ─────────────────────────────────────────────────────────────────────────
create function concluir_tarefa_prospeccao(
  p_tarefa_id uuid,
  p_resumo text,
  p_motivo_conclusao_remota_id uuid default null
)
returns void
language plpgsql
as $$
declare
  v_resumo text;
  v_row_count int;
begin
  v_resumo := btrim(p_resumo);

  if v_resumo is null or v_resumo = '' or char_length(v_resumo) < 10 or char_length(v_resumo) > 500 then
    raise exception 'O resumo precisa ter entre 10 e 500 caracteres';
  end if;

  if p_motivo_conclusao_remota_id is not null and not exists (
    select 1 from motivos_conclusao_remota
    where id = p_motivo_conclusao_remota_id
      and ativo = true
  ) then
    raise exception 'Motivo de conclusão remota inválido';
  end if;

  update tarefas
  set resumo = v_resumo,
      concluida = true,
      motivo_conclusao_remota_id = p_motivo_conclusao_remota_id
  where id = p_tarefa_id
    and concluida = false;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    raise exception 'Tarefa não encontrada ou já concluída';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. concluir_visita recriada — corpo ATUAL da migration 0015 reproduzido
--    integralmente, com as MESMAS duas adicoes da funcao anterior. O
--    bloco inteiro que le a frequencia do cliente e cria a proxima
--    visita fica BYTE A BYTE como estava (D-07, CONC-04): nenhuma
--    condicao nova, nenhuma mencao ao motivo — aquele bloco ja funciona
--    igual para os dois caminhos (presencial e remoto) porque nunca leu
--    nada sobre COMO a visita foi concluida.
-- ─────────────────────────────────────────────────────────────────────────
create function concluir_visita(
  p_visita_id uuid,
  p_resumo text,
  p_proxima_data date default null,
  p_motivo_conclusao_remota_id uuid default null
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
  v_resumo := btrim(p_resumo);

  if v_resumo is null or v_resumo = '' or char_length(v_resumo) < 10 or char_length(v_resumo) > 500 then
    raise exception 'O resumo precisa ter entre 10 e 500 caracteres';
  end if;

  if p_motivo_conclusao_remota_id is not null and not exists (
    select 1 from motivos_conclusao_remota
    where id = p_motivo_conclusao_remota_id
      and ativo = true
  ) then
    raise exception 'Motivo de conclusão remota inválido';
  end if;

  update visitas
  set resumo = v_resumo,
      data_realizada = (now() at time zone 'America/Sao_Paulo')::date,
      motivo_conclusao_remota_id = p_motivo_conclusao_remota_id
  where id = p_visita_id
    and data_realizada is null
  returning cliente_id into v_cliente_id;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    raise exception 'Visita não encontrada ou já concluída';
  end if;

  select frequencia_visita into v_frequencia
  from clientes
  where id = v_cliente_id;

  if v_frequencia is null or v_frequencia = 'nenhuma' then
    return;
  end if;

  if p_proxima_data is null then
    raise exception 'A próxima data de visita precisa ser confirmada para este cliente';
  end if;

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
-- 9. tarefas_before_update_historico recriada — so o corpo da funcao; o
--    gatilho trg_tarefas_before_update_historico que a chama (migration
--    0002) continua o mesmo e NAO e recriado aqui. Mantem tudo que ja
--    fazia (mesma condicao de disparo, mesmo carimbo de concluida_em,
--    mesma clausula de elevacao de privilegio, mesmo search_path
--    fixado). Ganha so a resolucao do motivo em nome legivel — logica
--    NOVA neste projeto, nenhum outro gatilho faz isso hoje (o motivo de
--    perda nunca resolveu a propria chave em texto). O texto final e
--    montado exatamente como o CASE de hoje ja monta (resumo aparado, ou
--    o texto generico de reserva); so DEPOIS, se a coluna nova da linha
--    nova estiver preenchida e a busca devolver um nome nao vazio, o
--    texto e prefixado com o nome entre colchetes. Se a busca nao
--    devolver nome, o texto cai de volta no que seria gravado numa
--    conclusao presencial — o NOME resolvido e gravado, jamais o
--    identificador cru. O texto gravado e um retrato congelado (D-04):
--    ver cabecalho deste arquivo.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function tarefas_before_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome_motivo text;
  v_texto_historico text;
begin
  if old.concluida = false and new.concluida = true then
    new.concluida_em := now();

    v_texto_historico := case
      when new.resumo is not null and btrim(new.resumo) <> '' then btrim(new.resumo)
      else 'Tarefa marcada como concluída'
    end;

    if new.motivo_conclusao_remota_id is not null then
      select nome into v_nome_motivo
      from motivos_conclusao_remota
      where id = new.motivo_conclusao_remota_id;

      if v_nome_motivo is not null and btrim(v_nome_motivo) <> '' then
        v_texto_historico := '[' || btrim(v_nome_motivo) || '] ' || v_texto_historico;
      end if;
    end if;

    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id,
      'tarefa_concluida',
      v_texto_historico,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. visitas_after_update_historico recriada — mesmo raciocinio da
--     secao 9, irma literal na forma "depois do update" (nada precisa
--     ser mutado na linha). O gatilho trg_visitas_after_update_historico
--     (migration 0015) continua o mesmo e NAO e recriado aqui.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function visitas_after_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome_motivo text;
  v_texto_historico text;
begin
  if old.data_realizada is null and new.data_realizada is not null then
    v_texto_historico := case
      when new.resumo is not null and btrim(new.resumo) <> '' then btrim(new.resumo)
      else 'Visita concluída'
    end;

    if new.motivo_conclusao_remota_id is not null then
      select nome into v_nome_motivo
      from motivos_conclusao_remota
      where id = new.motivo_conclusao_remota_id;

      if v_nome_motivo is not null and btrim(v_nome_motivo) <> '' then
        v_texto_historico := '[' || btrim(v_nome_motivo) || '] ' || v_texto_historico;
      end if;
    end if;

    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id,
      'visita_concluida',
      v_texto_historico,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;
