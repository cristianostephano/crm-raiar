---
phase: 29-encerrar-cliente-ativo
plan: 02
subsystem: database
tags: [postgres, supabase, dashboard, sql, rls, lag-window-function]

requires:
  - phase: 29-encerrar-cliente-ativo (plan 01)
    provides: "valor 'encerrado' do enum status_acompanhamento_enum (0035) e a tabela motivos_encerramento + guards de mover_card_funil (0036) — 0037 compara com o literal 'encerrado', que só existe a partir de 0035"
provides:
  - "Migration 0037: as 5 funções dashboard_* que contam ganho (ganhos_perdidos, desempenho_vendedor, tempo_ate_fechamento, comparativo_vendedor, funil_detalhado) tratam 'encerrado' como 'ainda ganho' e ignoram a linha de ganho escrita pela reativação"
  - "Teste de integração encerrado-preserva-historico.test.ts provando encerrar-nao-muda-numeros, reativar-nao-redata e novo-ciclo-conta contra o banco real"
affects: [30-ader-ncia-de-uso-no-dashboard]

tech-stack:
  added: []
  patterns:
    - "lag() over (partition by cliente_id order by criado_em) calculado ANTES do filtro ganho/perdido, para reconhecer reativação (encerrado -> ganho) sem redatar o ganho original"
    - "status_anterior is distinct from 'encerrado' (nunca a forma not(...) com nulo perigoso, que descartaria o primeiro evento legítimo de um cliente)"
    - "conferência 'continua com esse status hoje' estendida para (status_atual = evento or (evento = 'ganho' and status_atual = 'encerrado'))"

key-files:
  created:
    - supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql
    - tests/dashboard/encerrado-preserva-historico.test.ts
  modified: []

key-decisions:
  - "As 5 funções recriadas mantêm assinatura e returns table idênticos aos vigentes (0003/0009/0010/0011) — create or replace só troca o corpo, nenhuma tela do Dashboard precisa mudar"
  - "dashboard_funil_detalhado preserva a correção de avancou_pct da 0010 (avancados via stage_events, filtro m.etapa_max > se.etapa) — não reverte aquele fix ao aplicar a regra do encerrado"
  - "Nenhuma das 5 funções ganha cláusula de elevação de privilégio (security definer) — continuam SECURITY INVOKER por omissão, RLS de clientes/historico/profiles como única fronteira"

patterns-established:
  - "Toda função dashboard_* que classifica eventos de status via historico.descricao ILIKE deve calcular o evento anterior (lag) sobre TODAS as linhas de status antes de filtrar para ganho/perdido, para não perder a visibilidade de uma reativação"

requirements-completed: [ENCR-03, ENCR-05]

coverage:
  - id: D1
    description: "Migration 0037 recria as 5 funções dashboard_* com a regra do encerrado (mesma assinatura, sem elevação de privilégio)"
    requirement: "ENCR-03"
    verification:
      - kind: unit
        ref: "script estrutural do bloco <verify> da Tarefa 1 (compara assinatura/returns table com 0003/0009/0010/0011, confere lag()/status_anterior is distinct from 'encerrado'/c.status_acompanhamento = 'encerrado', proíbe security definer e outras DDLs)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Teste de integração prova que encerrar e reativar não mudam os números do Dashboard (encerrar-nao-muda-numeros, reativar-nao-redata, novo-ciclo-conta)"
    requirement: "ENCR-05"
    verification:
      - kind: integration
        ref: "tests/dashboard/encerrado-preserva-historico.test.ts"
        status: unknown
    human_judgment: true
    rationale: "O teste está estruturalmente correto (tsc/eslint/script limpos) mas fica VERMELHO contra o banco real até o plano 29-03 aplicar 0035/0036/0037 — o resultado real da suíte só pode ser confirmado depois do push, não nesta dispatch."

duration: ~25min
completed: 2026-09-26
status: complete
---

# Phase 29 Plan 2: Dashboard Sobrevive a Encerrar/Reativar Summary

**Migration 0037 recria as 5 funções `dashboard_*` que contam ganho para tratar "encerrado" como "ainda ganho" e ignorar o ganho redatado pela reativação, provado por um teste de integração (RED até o push do 29-03).**

## Performance

- **Duration:** ~25min
- **Completed:** 2026-09-26
- **Tasks:** 2/2
- **Files modified:** 2 (ambos criados)

## Accomplishments
- `supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql` recria `dashboard_ganhos_perdidos`, `dashboard_desempenho_vendedor`, `dashboard_tempo_ate_fechamento`, `dashboard_comparativo_vendedor` e `dashboard_funil_detalhado`, todas com a mesma assinatura/`returns table` das versões vigentes.
- A regra nova (classificar eventos de status incluindo "encerrado", calcular o evento anterior via `lag()` antes do filtro ganho/perdido, e aceitar "encerrado" na conferência "continua com esse status hoje") é idêntica nas 5 funções.
- `dashboard_funil_detalhado` preserva a correção de "% Avançou" da migration 0010 (`avancados` via `stage_events`, filtro `m.etapa_max > se.etapa`).
- `tests/dashboard/encerrado-preserva-historico.test.ts` cobre os 3 comportamentos do plano: encerrar um ganho não muda nenhum número; reativar não redata o ganho original nem cria uma linha nova na janela da reativação; um ciclo genuinamente novo (ganho → encerrado → em andamento → ganho de novo) conta normalmente na data dele.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Migration 0037** - `4e4ea49` (feat)
2. **Tarefa 2: Teste de integração (RED)** - `f488b88` (test)

**Plan metadata:** pending (this SUMMARY's own commit, handled by the orchestrator)

## Files Created/Modified
- `supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql` - Recria as 5 funções dashboard_* de ganho com a regra do encerrado/reativação
- `tests/dashboard/encerrado-preserva-historico.test.ts` - Prova de integração (3 casos) contra o banco real, RED até o push

## Decisions Made
None - plan executed exactly as written. A migration segue verbatim o desenho do bloco `<interfaces>` do PLAN.md (três CTEs por função: `eventos_status`/`eventos_com_anterior`/`ultimo_status_change`, e para `dashboard_funil_detalhado`: `status_events_todos`/`status_events`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Ambos os scripts de verificação estrutural das duas tarefas (embutidos no PLAN.md) terminaram com código 0 na primeira tentativa; `npx tsc --noEmit` e `npx eslint tests/dashboard/encerrado-preserva-historico.test.ts` limpos.

## User Setup Required

None - no external service configuration required. Nenhuma migration foi aplicada nesta dispatch (`supabase db push` explicitamente fora de escopo) — a aplicação de 0035/0036/0037 acontece no plano 29-03, junto com a aprovação do dono do projeto.

## Next Phase Readiness

- Migration 0037 e o teste de integração estão prontos para a aprovação e o `supabase db push` do plano 29-03 (junto com 0035/0036 do plano 29-01).
- O teste `tests/dashboard/encerrado-preserva-historico.test.ts` fica VERMELHO até esse push — esperado, documentado no bloco `coverage` acima (`D2`, `human_judgment: true`) para que o verificador confirme o resultado real depois da aplicação.
- Nenhum bloqueio para o plano 29-03: as três migrations da fase (0035, 0036, 0037) já existem em disco, prontas para revisão conjunta.

## Self-Check: PASSED

- FOUND: supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql
- FOUND: tests/dashboard/encerrado-preserva-historico.test.ts
- FOUND: .planning/phases/29-encerrar-cliente-ativo/29-02-SUMMARY.md
- FOUND commit: 4e4ea49 (feat(29-02): migration 0037)
- FOUND commit: f488b88 (test(29-02): teste de integração RED)

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-26*
