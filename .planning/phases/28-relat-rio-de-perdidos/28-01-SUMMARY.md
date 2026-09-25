---
phase: 28-relat-rio-de-perdidos
plan: 01
subsystem: database
tags: [supabase, postgres, rls, sql, rpc, lgpd]

requires:
  - phase: 28-relat-rio-de-perdidos (28-02)
    provides: apareceNaProspeccao/STATUS_FORA_DA_PROSPECCAO (regra que já tira perdido do Kanban)
provides:
  - "função clientes_perdidos(p_inicio, p_fim) — leitura nova, security invoker, escopada só pela RLS"
  - "11 testes de integração contra o banco real provando escopo por papel, período, reabrir e LGPD"
affects: [28-03, 28-04]

tech-stack:
  added: []
  patterns:
    - "left join lateral a partir de clientes (não de historico) para nunca perder um perdido sem linha de histórico"
    - "SECURITY INVOKER por omissão em toda leitura nova, RLS como única fronteira (mesmo padrão de dashboard_*/mover_card_funil)"

key-files:
  created:
    - supabase/migrations/0034_clientes_perdidos.sql
    - tests/funil/perdidos-rpc.test.ts
  modified: []

key-decisions:
  - "Data de perda lida via left join lateral (mais recente 'Status alterado para \"perdido\"' em historico), com atualizado_em como reserva para o caso anômalo sem linha de histórico (D-11)"
  - "Aprovação do dono concedida (\"pode aplicar\"). O classificador de modo automático bloqueou o executor de rodar `supabase db push` diretamente (mesma restrição já registrada nas Fases 18/19/21) — o dono aplicou a migration 0034 manualmente colando o SQL no SQL Editor da Supabase (Success, sem erro). Testes de integração então rodados e confirmados verdes pelo orquestrador."

patterns-established:
  - "Toda leitura nova de relatório segue o molde de 0003_dashboard_aggregates.sql: language sql, stable, sem security definer, RLS como fronteira única"

requirements-completed: [PERD-02, PERD-03, PERD-04, PERD-05]

coverage:
  - id: D1
    description: "Migration 0034 cria clientes_perdidos(p_inicio, p_fim) com as 7 colunas do contrato, sem security definer, sem checagem de papel/dono no corpo"
    requirement: "PERD-02"
    verification:
      - kind: unit
        ref: "node -e (verificação mecânica de estrutura SQL, ver 28-01-PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/funil/perdidos-rpc.test.ts — 11 casos de integração contra o banco real (motivo-data-vendedor, lgpd-colunas, rls-vendedor, rls-supervisor, periodo, data-da-perda, ultima-perda, reabrir, reabrir-outro-vendedor, sem-historico, paginacao)"
    requirement: "PERD-02"
    verification:
      - kind: integration
        ref: "tests/funil/perdidos-rpc.test.ts"
        status: pass
    human_judgment: false
    rationale: "Rodado após a aplicação da migration: 11/11 casos verdes contra o banco de produção real."
  - id: D3
    description: "Aplicar a migration 0034 no banco de produção"
    requirement: "PERD-02"
    verification:
      - kind: other
        ref: "SQL colado manualmente pelo dono no SQL Editor da Supabase (executor bloqueado pelo classificador de modo automático, mesma restrição das Fases 18/19/21)"
        status: pass
    human_judgment: true
    rationale: "Checkpoint bloqueante (Tarefa 2) exigia aprovação explícita do dono antes de qualquer escrita em produção — concedida (\"pode aplicar\"), aplicada manualmente com sucesso (\"Success. No rows returned\"), confirmada nenhuma migration anterior editada."

duration: ~30min (Tarefas 1-3 completas, incluindo pausa de checkpoint entre sessões)
completed: 2026-09-26
status: complete
---

# Phase 28 Plan 1: Relatório de Perdidos — Leitura no Banco Summary

**Nova função somente-leitura `clientes_perdidos(p_inicio, p_fim)` (migration 0034, sem elevação de privilégio) aplicada em produção e provada por 11/11 testes de integração verdes contra o banco real.**

## Performance

- **Duration:** ~25min até o checkpoint (Tarefas 1-2) + retomada em sessão seguinte pra Tarefa 3
- **Started:** 2026-09-25T23:05:00Z (aprox.)
- **Completed:** 2026-09-26 (após aprovação do dono e aplicação manual via SQL Editor)
- **Tasks:** 3/3 concluídas
- **Files modified:** 2

## Accomplishments

- Escrita `supabase/migrations/0034_clientes_perdidos.sql`: função `clientes_perdidos(p_inicio timestamptz default null, p_fim timestamptz default null)`, `language sql stable`, SEM `security definer`, devolvendo exatamente as 7 colunas do contrato de interfaces (`cliente_id, razao_social, nome_fantasia, motivo_perda_nome, perdido_em, responsavel, responsavel_nome`).
- A data de perda vem de uma junção lateral pela esquerda com `historico` (linha mais recente `'Status alterado para "perdido"'`), com `atualizado_em` como reserva para o caso anômalo sem linha de histórico — nunca de `etapa_alterada_em` (D-11).
- Escrito `tests/funil/perdidos-rpc.test.ts` com os 11 casos de integração pedidos pelo plano, usando fixtures descartáveis (`createTestMember`/`deleteTestMember`), no máximo 2 autenticações (`signInAs`) no arquivo inteiro, e nenhuma referência às contas semente apagadas.
- Todas as verificações estruturais mecânicas da Tarefa 1 passaram: `npx tsc --noEmit`, `npx eslint tests/funil`, e os dois scripts `node -e` do plano que conferem a forma da migration e do arquivo de teste.
- Migration aplicada em produção (Tarefa 3, ver abaixo) e os 11 testes de integração confirmados verdes contra o banco real.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0034 com clientes_perdidos e testes de integração (RED até o push)** - `19939e2` (feat)

**Tarefa 2 (checkpoint bloqueante):** aprovada pelo dono do projeto ("pode aplicar") em sessão seguinte. Sem commit associado (é uma decisão, não uma mudança de código).

**Tarefa 3:** `supabase db push` bloqueado pelo classificador de modo automático do ambiente (mesma restrição das Fases 18/19/21) — o orquestrador pediu ao dono para aplicar manualmente. O dono colou o conteúdo de `0034_clientes_perdidos.sql` no SQL Editor da Supabase e confirmou "Success. No rows returned". O orquestrador então rodou `npx vitest run tests/funil/perdidos-rpc.test.ts` (11/11 passou) e a verificação de integridade das migrations antigas (`OK migrations antigas intocadas`). Nenhum commit de código associado — a mudança está no banco hospedado, não em arquivo.

## Files Created/Modified

- `supabase/migrations/0034_clientes_perdidos.sql` - função `clientes_perdidos`, leitura nova só de leitura, sem elevação de privilégio
- `tests/funil/perdidos-rpc.test.ts` - 11 casos de integração contra o banco real (pasta `tests/funil/` nova)

## Decisions Made

- Data de perda lida via `left join lateral` a partir de `clientes` (não de `historico`), garantindo que todo cliente perdido hoje apareça mesmo sem linha de histórico — reserva: `atualizado_em` (conflito técnico #1 do plano, já resolvido antes da execução).
- Ordenação por posição de coluna (`order by 5 desc, 1 asc`) em vez de nome de saída, para não depender de como o Postgres resolve nomes de `returns table` dentro de função `language sql` (conflito técnico #2 do plano).
- Aprovação humana antes do `supabase db push` tratada como checkpoint bloqueante de tipo `decision` (conflito técnico #3 do plano, vence sobre o contexto de planejamento que sugeria não haver checkpoint nesta fase) — é exatamente o que está pausado agora.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentário do cabeçalho do teste continha a substring literal "console.log", disparando falso positivo na verificação mecânica da Tarefa 1**
- **Found during:** Task 1 (verificação mecânica automatizada, segundo script `node -e`)
- **Issue:** A frase explicativa do cabeçalho dizia "nenhum console.log de linha" — a verificação do plano varre o arquivo por `console\.log` para garantir que o teste nunca imprime dado real (LGPD), e o texto explicativo disparava o próprio alarme que deveria só pegar chamadas reais.
- **Fix:** Reescrita a frase para não citar a construção literal, mesmo padrão já registrado em STATE.md para a Fase 19-04 (comentário reescrito para não citar a palavra "duplicado" e disparar o script de verificação daquele plano).
- **Files modified:** tests/funil/perdidos-rpc.test.ts
- **Verification:** Script `node -e` de verificação do arquivo de teste voltou a passar (`OK testes`).
- **Committed in:** 19939e2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug de falso positivo em verificação mecânica)
**Impact on plan:** Sem impacto de escopo — ajuste de texto de comentário, nenhuma mudança de comportamento.

## Issues Encountered

None além do desvio documentado acima.

## Checkpoint resolvido (Tarefa 2)

O dono do projeto aprovou explicitamente ("pode aplicar"), confirmando que o comportamento combinado (D-08 — reabrir um perdido de vendedor desativado mantém o mesmo responsável, Supervisor troca depois pela ficha) está correto e não precisa de ajuste.

## User Setup Required

None. O `supabase db push` automático foi bloqueado pelo classificador de modo automático do ambiente (mesma restrição já registrada nas Fases 18/19/21) — o dono aplicou manualmente colando o SQL no SQL Editor da Supabase. Nenhuma configuração de serviço externo foi necessária além disso.

## Next Phase Readiness

- Migration aplicada em produção, testes estruturalmente conferidos e 11/11 verdes contra o banco real.
- Os planos 28-03 (leitor TypeScript) e 28-04 (tela) já podem começar — a função `clientes_perdidos` existe de fato no banco de produção.
- Zero exceção nova de privilégio elevado introduzida (mantém as 5 já documentadas em STATE.md); zero migration anterior a 0034 editada.

---
*Phase: 28-relat-rio-de-perdidos*
*Status: complete*
