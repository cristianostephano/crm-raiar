-- Phase 30 Plan 1: tabela acessos_diarios + RLS + registrar_acesso_diario().
--
-- Finalidade (ADER-01/02/03): esta migration cria a base minima que guarda
-- "quem usou o sistema em qual dia", para a fase 30 (Aderencia de Uso no
-- Dashboard) calcular o percentual de dias uteis usados nas ultimas 4
-- semanas por vendedor. Este registro E dado pessoal de funcionario sob a
-- LGPD (identifica um vendedor especifico e um comportamento de uso), entao
-- guarda SO quem e qual dia (D-10) — nunca horario, IP, aparelho ou
-- localizacao. O dia gravado e sempre o dia corrente no fuso de Sao Paulo,
-- calculado DENTRO do Postgres, nunca aceito cru do que o navegador manda
-- (mesma disciplina de concluir_visita/proxima_data_visita, migration
-- 0015). O descarte de linhas com mais de 35 dias roda embutido na propria
-- chamada de registrar_acesso_diario() (D-11) — este projeto nao tem
-- cron/worker de fundo desde a Fase 13, entao a limpeza precisa piggyback
-- numa escrita que ja acontece com frequencia. Nenhuma funcao deste arquivo
-- ganha clausula de elevacao de privilegio: a RLS abaixo e a UNICA
-- fronteira de autorizacao, exatamente como todo `dashboard_*`/
-- `mover_card_funil`/`concluir_visita` ja fazem neste codebase — este
-- arquivo termina com as MESMAS exceçoes de privilegio elevado documentadas
-- hoje em STATE.md (nenhuma nova).
--
-- Correcoes de planejamento (conflitos_resolvidos do 30-01-PLAN.md,
-- itens 1-3 — corrigem o esboco da pesquisa 30-RESEARCH.md):
--
-- 1. O apagar "so da propria linha" pelo vendedor (como a pesquisa havia
--    esboçado) nao funcionaria: no Postgres, um DELETE com condicao sobre
--    colunas so enxerga as linhas que a policy de LEITURA deixa ver. Como a
--    leitura desta tabela e so do Supervisor (D-08), um DELETE feito na
--    chamada de um vendedor apagaria zero linhas — a limpeza nunca
--    rodaria, e as linhas de um vendedor desativado (que nunca mais
--    acessa) ficariam para sempre, ferindo D-11. Por isso a policy de
--    apagar exige is_supervisor() e a limpeza roda de fato quando um
--    Supervisor chama a RPC (uma vez por dia, pelo middleware do plano
--    30-04) — e ninguem, nem o Supervisor, apaga pela API uma linha ainda
--    dentro do prazo.
-- 2. A policy de gravacao da pesquisa so exigia `usuario_id = auth.uid()`,
--    o que permitiria um vendedor gravar direto na tabela (sem passar pela
--    RPC) um dia qualquer do passado, inflando a propria aderencia — fere
--    D-10 e o criterio 4 do ROADMAP. Por isso a policy de gravacao TAMBEM
--    exige que o dia seja exatamente hoje em Sao Paulo e que quem grava
--    seja vendedor ativo: gravar direto na tabela passa a ter exatamente o
--    mesmo efeito de chamar a RPC hoje.
-- 3. Minimizacao (LGPD): so vendedor ativo e medido. O painel so mostra
--    vendedores — guardar os dias de uso do Supervisor seria dado pessoal
--    sem finalidade. A RPC so grava quando o chamador e vendedor ativo (e
--    a policy de gravacao exige o mesmo); a chamada de um Supervisor so
--    executa o descarte.
--
-- Source: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-01-PLAN.md
--           (Tarefa 1, bloco conflitos_resolvidos itens 1-4 e 6)
--         .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-RESEARCH.md
--           (Pattern 1, Code Examples)
--         supabase/migrations/0001_profiles_and_roles.sql (forma de
--           profiles, is_supervisor(), leitura aberta, zero escrita para
--           usuario comum)
--         supabase/migrations/0008_desativacao_membro_equipe.sql
--           (is_supervisor() vigente, exigindo ativo = true)
--         supabase/migrations/0015_conclusao_com_resumo.sql (precedente do
--           dia de Sao Paulo calculado dentro do Postgres)
--         supabase/migrations/0022_conclusao_remota_com_motivo.sql (tom de
--           cabecalho, forma re-executavel de policy com drop antes)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabela acessos_diarios — EXATAMENTE 2 colunas. Nenhum horario, IP,
--    aparelho ou localizacao (D-10). Nenhum default de data: o dia e
--    sempre passado explicitamente pela RPC/policy, nunca por default do
--    schema.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists acessos_diarios (
  usuario_id uuid not null references profiles(id) on delete cascade,
  dia date not null,
  primary key (usuario_id, dia)
);

comment on table acessos_diarios is 'Aderência de uso (Fase 30): um registro por vendedor por dia de uso. Guarda só quem e qual dia — sem horário, IP, aparelho ou localização. Descarte automático depois de 35 dias.';

alter table acessos_diarios enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tres policies. Nenhuma policy de UPDATE — nenhuma linha pode ser
--    alterada depois de gravada (so inserida ou apagada).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "somente supervisor le acessos_diarios" on acessos_diarios;
create policy "somente supervisor le acessos_diarios"
on acessos_diarios for select to authenticated
using ((select is_supervisor()));
-- D-08: nem o proprio vendedor le o registro bruto. Um vendedor lendo esta
-- tabela recebe zero linhas, sem erro (RLS filtra, nao bloqueia a query).

drop policy if exists "vendedor ativo registra o proprio dia de hoje" on acessos_diarios;
create policy "vendedor ativo registra o proprio dia de hoje"
on acessos_diarios for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and dia = (now() at time zone 'America/Sao_Paulo')::date
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
);
-- Correcao 2: gravar direto na tabela (sem passar pela RPC) tem o mesmo
-- efeito de chamar a RPC hoje — nenhum dia retroativo ou futuro, nenhuma
-- linha de outra pessoa, e so vendedor ativo grava.

drop policy if exists "supervisor descarta registros com mais de 35 dias" on acessos_diarios;
create policy "supervisor descarta registros com mais de 35 dias"
on acessos_diarios for delete to authenticated
using (
  (select is_supervisor())
  and dia < (now() at time zone 'America/Sao_Paulo')::date - 35
);
-- Correcao 1: o Postgres so deixa apagar o que a policy de leitura deixa
-- ver, entao a limpeza de TODAS as linhas vencidas acontece quando um
-- Supervisor chama a RPC (uma vez por dia, pelo middleware do plano
-- 30-04); nenhuma linha dentro do prazo pode ser apagada pela API por
-- ninguem — nem o proprio Supervisor (a metrica nao pode ser "limpa" para
-- esconder dias).

-- Nenhuma policy de UPDATE neste arquivo.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. registrar_acesso_diario() — RPC sem parametros, roda como o chamador.
--    SEM clausula de elevacao de privilegio: a RLS acima e a UNICA
--    fronteira. Corpo com dois comandos: gravacao idempotente + descarte
--    embutido.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function registrar_acesso_diario()
returns void
language plpgsql
as $$
begin
  -- D-04: idempotente — duas chamadas no mesmo dia deixam uma linha so,
  -- sem erro. Correcao 3: so grava quando o chamador e vendedor ativo;
  -- chamador anonimo, Supervisor, ou vendedor inativo nao grava nada (a
  -- condicao `exists` abaixo faz o INSERT nao inserir linha nenhuma nesses
  -- casos, sem lancar excecao).
  insert into acessos_diarios (usuario_id, dia)
  select (select auth.uid()), (now() at time zone 'America/Sao_Paulo')::date
  where exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
  on conflict (usuario_id, dia) do nothing;

  -- D-11: descarte de linhas com mais de 35 dias, SEM filtro de usuario —
  -- quem decide o que pode ser apagado e a policy de DELETE acima (correcao
  -- 1). Efetivo somente quando quem chama e Supervisor; para um vendedor
  -- (ou chamador anonimo), este DELETE apaga zero linhas silenciosamente.
  -- Mantem os dias de hoje menos 35 ate hoje.
  delete from acessos_diarios
  where dia < (now() at time zone 'America/Sao_Paulo')::date - 35;
end;
$$;

-- Nenhuma funcao deste arquivo pode ganhar clausula de elevacao de
-- privilegio (SECURITY DEFINER) — nem agora, nem em revisao futura. A RLS
-- acima e a unica fronteira de autorizacao desta tabela.
