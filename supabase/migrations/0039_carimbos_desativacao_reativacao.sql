-- Phase 30 Plan 1: profiles.desativado_em + profiles.reativado_em + as 2
-- RPCs da migration 0008 recriadas com o carimbo.
--
-- Por que (D-07): o calculo de aderencia de uso (dashboard_aderencia_uso(),
-- migration 0040, plano 30-02) precisa contar so os dias em que o vendedor
-- estava de fato ativo no time — nunca os 28 dias completos para quem
-- entrou ou saiu recentemente. A migration 0008 so tinha o liga/desliga
-- (`profiles.ativo`), sem nenhuma data de QUANDO a troca aconteceu.
--
-- Correcao de planejamento (conflitos_resolvidos item 4 do
-- 30-01-PLAN.md — corrige o esboco de 30-RESEARCH.md, que so propunha
-- `desativado_em`): a formula que so olha `desativado_em` jogaria fora os
-- dias ANTES da desativacao e contaria como "dia util esperado" todo o
-- periodo em que a pessoa esteve desativada — o percentual cairia
-- justamente no unico caso real de D-07 (quem saiu e voltou, por exemplo
-- em ferias). Por isso esta migration cria DUAS colunas — `desativado_em`
-- e `reativado_em` — cada uma carimbada SO na troca real de estado
-- (reativar alguem que ja esta ativo nao mexe em nada, senao uma
-- reativacao a toa apagaria semanas da conta; desativar alguem ja
-- desativado idem). A leitura (migration 0040, plano 30-02) exclui do
-- numerador e do denominador os dias entre a ultima desativacao e a ultima
-- reativacao.
--
-- Limitacao aceita (pesquisa 30-RESEARCH.md Pitfall 3, confirmada pelo
-- orquestrador em conflitos_resolvidos item 4): com dois ciclos de
-- desativacao/reativacao dentro da MESMA janela de 28 dias, so a lacuna
-- mais recente e descontada — um unico carimbo nao-cumulativo nao consegue
-- representar mais de um ciclo. Nada de tabela de historico de ativacao
-- para isso.
--
-- As duas funcoes recriadas abaixo continuam sendo as MESMAS excecoes de
-- privilegio elevado ja documentadas desde a Fase 10 (STATE.md >
-- "SECURITY DEFINER exceptions") — nenhuma excecao NOVA nesta migration.
-- `profiles` continua sem nenhuma policy de escrita para usuario comum
-- (migration 0001), entao ninguem altera estes dois carimbos pela API —
-- so estas duas RPCs, que ja rodam com privilegio elevado desde a 0008.
--
-- Source: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-01-PLAN.md
--           (Tarefa 1, bloco conflitos_resolvidos item 4)
--         .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-RESEARCH.md
--           (Summary 3, Pitfall 3, Code Examples)
--         supabase/migrations/0008_desativacao_membro_equipe.sql (os dois
--           corpos copiados, o guard is_supervisor(), a mesma assinatura)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Duas colunas novas em profiles — nullable por padrao (todo membro
--    existente nunca foi desativado/reativado por este mecanismo ainda).
-- ─────────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists desativado_em timestamptz;
comment on column profiles.desativado_em is 'Quando foi a última desativação (Fase 30, D-07). Usado só pelo cálculo de aderência de uso — nunca alterado pela API, só por desativar_membro_equipe.';

alter table profiles add column if not exists reativado_em timestamptz;
comment on column profiles.reativado_em is 'Quando foi a última reativação (Fase 30, D-07). Usado só pelo cálculo de aderência de uso — nunca alterado pela API, só por reativar_membro_equipe.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. desativar_membro_equipe — corpo IDENTICO ao da migration 0008,
--    trocando SOMENTE o UPDATE final. No CASE, `ativo` lido dentro da
--    expressao e o valor ANTES da troca (Postgres avalia a condicao do
--    CASE com o valor antigo da linha) — so carimba quem estava ativo,
--    entao desativar quem ja esta desativado nao recarimba.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function desativar_membro_equipe(
  p_profile_id uuid,
  p_novo_responsavel_id uuid
)
returns table(clientes_reatribuidos bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role user_role;
  v_reatribuidos bigint;
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem desativar membros da equipe';
  end if;

  -- D-01: a Supervisor can never deactivate their own account, even when
  -- other Supervisors remain active. Separate rule from the last-active-
  -- Supervisor guard below (that one is about never zeroing Supervisors;
  -- this one is about never self-locking-out mid-action).
  if p_profile_id = (select auth.uid()) then
    raise exception 'Não é possível desativar a própria conta';
  end if;

  select role into v_target_role from profiles where id = p_profile_id;
  if v_target_role is null then
    raise exception 'Membro não encontrado';
  end if;

  -- Defensive check required precisely because SECURITY DEFINER bypasses
  -- RLS, so the caller's own scoping cannot be trusted — the substitute
  -- must be independently verified as an active profile.
  if not exists (
    select 1 from profiles
    where id = p_novo_responsavel_id and ativo = true
  ) then
    raise exception 'Vendedor substituto inválido ou inativo';
  end if;

  -- EQP-02: never allow the system to end up with zero active Supervisors.
  -- The row-locking `perform` statement below is taken BEFORE the count(*)
  -- check — that ordering is the whole TOCTOU mitigation (T-10-02): a
  -- concurrent deactivation of another Supervisor cannot race past this
  -- point until the first transaction commits or rolls back.
  if v_target_role = 'supervisor' then
    perform 1 from profiles
    where role = 'supervisor' and ativo = true
    for update;

    if (
      select count(*) from profiles
      where role = 'supervisor' and ativo = true and id <> p_profile_id
    ) < 1 then
      raise exception 'Não é possível desativar o último Supervisor ativo';
    end if;
  end if;

  -- EQP-01/EQP-04 reassignment as its own top-level statement. Only
  -- em_andamento clientes move to the substitute; already-won/already-lost
  -- clientes stay credited to the deactivated member, preserving historical
  -- accuracy. Deliberately NOT chained into the same CTE as the next
  -- UPDATE — that would reintroduce the exact same-snapshot visibility
  -- defect this repository already had to fix in migration 0006. The
  -- `get diagnostics` line immediately below is the structural proof these
  -- stayed two separate statements.
  update clientes
  set responsavel = p_novo_responsavel_id
  where responsavel = p_profile_id
    and status_acompanhamento = 'em_andamento';
  get diagnostics v_reatribuidos = row_count;

  -- Deactivation as a separate top-level statement. Fase 30 (D-07):
  -- desativado_em so e carimbado na troca REAL de ativo -> inativo — o
  -- CASE le o valor de `ativo` ANTES desta atribuicao, entao desativar de
  -- novo quem ja esta desativado preserva o carimbo original.
  update profiles set ativo = false, desativado_em = case when ativo then now() else desativado_em end where id = p_profile_id;

  return query select v_reatribuidos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. reativar_membro_equipe — corpo IDENTICO ao da migration 0008,
--    trocando SOMENTE o UPDATE final. Mesmo raciocinio de nao-recarimbar
--    na troca repetida.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function reativar_membro_equipe(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem reativar membros da equipe';
  end if;

  -- Fase 30 (D-07): reativado_em so e carimbado na troca REAL de
  -- inativo -> ativo — o CASE le o valor de `ativo` ANTES desta
  -- atribuicao, entao reativar de novo quem ja esta ativo preserva o
  -- carimbo original.
  update profiles set ativo = true, reativado_em = case when ativo then reativado_em else now() end where id = p_profile_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Nenhum outro objeto (policy, tabela, permissao) e criado neste arquivo.
-- ─────────────────────────────────────────────────────────────────────────
