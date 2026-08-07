-- Phase 13 Plan 1: fundação de banco do marco v1.3 (Agenda do Vendedor) —
-- as quatro colunas novas de "cliente ativo" em clientes (todas opcionais),
-- o vocabulário de frequência de visita como enum, a tabela nova `visitas`
-- com a mesma RLS de gate-pelo-pai que `tarefas` já usa, a função pura de
-- cálculo da próxima data, e a extensão de mover_card_funil para exigir a
-- frequência exatamente quando o status novo é "ganho" — semeando a
-- primeira visita na mesma transação.
--
-- As quatro colunas novas de `clientes` entram deliberadamente OPCIONAIS
-- porque a tabela já tem linhas "ganho" em produção: uma restrição de
-- obrigatoriedade aplicada retroativamente abortaria o `supabase db push`
-- (Pitfall 3 — PITFALLS.md). A exigência "frequência obrigatória ao ganho"
-- é imposta pelo guard do RPC `mover_card_funil`, não pelo schema.
--
-- `mover_card_funil` continua rodando como o chamador (SEM cláusula de
-- elevação de privilégio) — a RLS segue sendo a única fronteira de
-- autorização, tanto para o UPDATE em `clientes` quanto para o INSERT em
-- `visitas` que ele passa a fazer. Este marco NÃO adiciona nenhuma exceção
-- nova de privilégio elevado às três já documentadas no projeto
-- (is_supervisor, desativar/reativar_membro_equipe, e
-- cidades_com_clientes_por_estado — ver STATE.md).
--
-- Source: .planning/phases/13-cliente-ativo-e-frequ-ncia-de-visita/13-01-PLAN.md
--         .planning/research/ARCHITECTURE.md (Pattern 1, Pattern 4,
--           Anti-Pattern 1, Anti-Pattern 2, Anti-Pattern 3)
--         .planning/research/PITFALLS.md (Pitfall 1 fuso horário,
--           Pitfall 3 campos graduados, "RLS não cascateia por FK")

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Enum de frequência de visita — exatamente 4 valores, na ordem que a
--    UI usa (travada em 13-UI-SPEC.md).
-- ─────────────────────────────────────────────────────────────────────────
create type frequencia_visita_enum as enum (
  'semanal',
  'quinzenal',
  'mensal',
  'nenhuma'
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Colunas novas em clientes — TODAS opcionais (Pitfall 3): a tabela já
--    tem linhas "ganho" em produção e uma obrigatoriedade retroativa
--    quebraria o push. Nenhuma constraint de validação é adicionada aqui.
--    frequencia_pedidos é texto livre de propósito — é puramente
--    informativo (ATV-02) e o vocabulário/validação dele é decisão da
--    Fase 16, que ainda não aconteceu.
--    frequencia_visita é a ÚNICA coluna de frequência de visita do sistema
--    (ATV-03): o que o RPC grava no momento do ganho e o que a ficha do
--    cliente edita depois são o mesmo campo, nunca dois.
-- ─────────────────────────────────────────────────────────────────────────
alter table clientes
  add column nome_fantasia text,
  add column cnpj text,
  add column frequencia_pedidos text,
  add column frequencia_visita frequencia_visita_enum;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Tabela visitas — irmã de tarefas, NÃO uma extensão dela
--    (Anti-Pattern 3 da ARCHITECTURE.md): prospecção e pós-venda são
--    conceitos diferentes, unificados só na leitura da Fase 14.
--    `resumo` fica pronto aqui, preenchido só pela Fase 15 (CONC-01) —
--    criar agora custa zero e evita um segundo alter table em produção
--    depois.
-- ─────────────────────────────────────────────────────────────────────────
create table visitas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  data_prevista date not null,
  data_realizada date,
  resumo text,
  criado_por uuid references profiles(id),
  criado_em timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS de visitas — a RLS NÃO cascateia pela foreign key, então cada
--    operação precisa do próprio gate. Exatamente quatro policies, no
--    molde literal das quatro de tarefas (0002_clientes_and_funil.sql).
-- ─────────────────────────────────────────────────────────────────────────
alter table visitas enable row level security;

create policy "acesso a visitas gated pelo cliente pai (select)"
on visitas for select to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = visitas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

create policy "acesso a visitas gated pelo cliente pai (insert)"
on visitas for insert to authenticated
with check (
  exists (
    select 1 from clientes c
    where c.id = visitas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

create policy "acesso a visitas gated pelo cliente pai (update)"
on visitas for update to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = visitas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
)
with check (
  exists (
    select 1 from clientes c
    where c.id = visitas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

create policy "acesso a visitas gated pelo cliente pai (delete)"
on visitas for delete to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = visitas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Índices — só em visitas. O índice de data de tarefas pertence à
--    Fase 14, junto da RPC que o consome.
-- ─────────────────────────────────────────────────────────────────────────
create index idx_visitas_cliente_id on visitas (cliente_id);
create index idx_visitas_data_prevista on visitas (data_prevista);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. proxima_data_visita — função pura, immutable, sem nenhum acesso a
--    tabela. ÚNICA autoridade sobre essa conta em todo o projeto
--    (Pitfall 1: escolher uma autoridade e nunca duplicar a matemática no
--    cliente) — a Fase 15 vai reusá-la em concluir_visita. O intervalo de
--    1 mês do Postgres já faz o clamp de fim de mês (31/01 + 1 mês =
--    28/02, ou 29/02 em ano bissexto). Recebe a data-base por parâmetro
--    justamente para poder ser testada com datas fixas — quem decide qual
--    é "hoje" é o chamador.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function proxima_data_visita(
  p_base date,
  p_frequencia frequencia_visita_enum
)
returns date
language sql
immutable
as $$
  select case p_frequencia
    when 'semanal' then (p_base + interval '7 days')::date
    when 'quinzenal' then (p_base + interval '14 days')::date
    when 'mensal' then (p_base + interval '1 month')::date
    else null
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. mover_card_funil recriado com o 6º parâmetro p_frequencia_visita.
--    ATENÇÃO: no Postgres, create or replace function com um número
--    diferente de parâmetros NÃO substitui a função — cria uma SOBRECARGA.
--    Se as duas assinaturas coexistirem, toda chamada existente do app
--    passa a falhar por ambiguidade no PostgREST. Por isso o drop
--    explícito da assinatura antiga de 5 parâmetros ANTES do create de 6,
--    na mesma transação da migration (sem janela em que a função não
--    exista). Nenhuma view/trigger depende desta função, então o drop é
--    seguro.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists mover_card_funil(uuid, etapa_funil, status_acompanhamento_enum, uuid, numeric);

create function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa etapa_funil,
  p_novo_status status_acompanhamento_enum default null,
  p_motivo_perda_id uuid default null,
  p_nova_posicao numeric default null,
  p_frequencia_visita frequencia_visita_enum default null
)
returns void
language plpgsql
as $$
declare
  v_row_count int;
  v_proxima_data date;
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  -- Guard novo (VIS-01): é este guard, e só ele, que torna a frequência de
  -- visita obrigatória ao ganho inescapável — o schema é deliberadamente
  -- permissivo (Pitfall 3).
  if p_novo_status = 'ganho' and p_frequencia_visita is null then
    raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = coalesce(p_motivo_perda_id, motivo_perda_id),
      posicao = coalesce(p_nova_posicao, posicao),
      frequencia_visita = coalesce(p_frequencia_visita, frequencia_visita)
  where id = p_cliente_id;

  get diagnostics v_row_count = row_count;

  -- Semeadura da primeira visita: só quando o ganho realmente aconteceu
  -- (row_count > 0 — se a RLS não deixou o chamador alterar aquele
  -- cliente, nada é semeado, o que impede um vendedor de criar visita no
  -- cliente de outro), a frequência escolhida produz uma data (nenhuma
  -- devolve nulo), e ainda não existe uma visita pendente daquele cliente
  -- (idempotência: remarcar ganho não duplica a pendente).
  if p_novo_status = 'ganho' and v_row_count > 0 then
    -- A base do cálculo tem que ser o dia corrente no fuso de São Paulo,
    -- nunca a data crua do servidor (o banco roda em UTC e, depois das
    -- 21h no horário local, o dia já teria virado o seguinte — Pitfall 1).
    v_proxima_data := proxima_data_visita((now() at time zone 'America/Sao_Paulo')::date, p_frequencia_visita);

    if v_proxima_data is not null and not exists (
      select 1 from visitas v
      where v.cliente_id = p_cliente_id
        and v.data_realizada is null
    ) then
      insert into visitas (cliente_id, data_prevista, criado_por)
      values (p_cliente_id, v_proxima_data, (select auth.uid()));
    end if;
  end if;
end;
$$;
