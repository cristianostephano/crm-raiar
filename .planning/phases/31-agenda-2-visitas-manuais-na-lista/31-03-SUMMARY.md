---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: 03
subsystem: database
tags: [supabase, postgres, rls, lgpd, migration, vitest]

# Dependency graph
requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista (plano 31-01)
    provides: "migration 0048 escrita (tabela agenda2_itens, policies, trigger de carimbos) e os dois arquivos de teste (estrutural + RLS)"
provides:
  - "Migration 0048 aplicada em produção pelo dono (SQL Editor), com aprovação explícita registrada (LGPD + decisões de planejamento)"
  - "tests/agenda2/rls-agenda2.test.ts (20 casos) e tests/agenda2/migracao-agenda2.test.ts (13 casos) verdes contra o banco real"
  - "Tabela agenda2_itens disponível em produção para os planos 31-04 a 31-08 (tela/menu/visibilidade por papel)"
affects: [31-04-visita-manual-ui, 31-05-agenda2-lista, 31-06, 31-07, 31-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixtures de teste com sufixo de timestamp precisam quebrar sequências de dígitos corridos quando o schema tem constraint anti-documento (chk_*_sem_documento) — Date.now() cru é uma sequência de 13 dígitos e tropeça na própria proteção que o teste existe para provar."

key-files:
  created: []
  modified:
    - "tests/agenda2/rls-agenda2.test.ts"

key-decisions:
  - "Dono aprovou explicitamente (resposta \"aplicar\") o escopo de dados da Agenda 2 (nome livre + bairro + data + vendedor), ciente do alerta de LGPD, da recusa automática de sequências de 8+ dígitos, dos limites de 120/60 caracteres, das duas decisões de visibilidade da Lista (itens concluídos de dias passados saem da Lista; \"Próximos dias\" sem corte) e da pendência do prazo de guarda (sem descarte automático implementado)."
  - "Dono aplicou a migration 0048 manualmente pelo SQL Editor da Supabase (projeto de produção, único ambiente — sem Docker local), confirmando \"Success. No rows returned\". Executor não tentou supabase db push nem qualquer contorno do bloqueio do ambiente."
  - "Corrigido bug no helper de teste nomeInventado() (Date.now() cru formava sequência de 13 dígitos, rejeitada pela própria constraint chk_agenda2_nome_cliente_sem_documento que o teste valida) — sem relaxar nenhuma asserção de segurança."

patterns-established:
  - "Aplicação de schema no projeto único de produção segue sempre: checkpoint:decision (aprovação de escopo/LGPD) → checkpoint:human-action (dono cola no SQL Editor) → task auto (testes de integração contra o banco real) — mesmo padrão das Fases 13/18/19/28/29/30."

requirements-completed: [AGD2-01, AGD2-03, AGD2-04, AGD2-05, AGD2-07]

coverage:
  - id: D1
    description: "Dono aprovou explicitamente o escopo de dados da Agenda 2 (LGPD) e autorizou a aplicação da migration 0048 em produção"
    requirement: "AGD2-01"
    verification:
      - kind: manual_procedural
        ref: "Checkpoint da Tarefa 1 (checkpoint:decision) — resposta do dono: \"aplicar\""
        status: pass
    human_judgment: true
    rationale: "Aprovação de escopo de dados pessoais (LGPD) é uma decisão do controlador do dado (o dono do projeto), não algo que um teste automatizado possa atestar."
  - id: D2
    description: "Migration 0048 aplicada no banco de produção pelo dono via SQL Editor (tabela agenda2_itens, 4 policies, trigger de carimbos)"
    requirement: "AGD2-01"
    verification:
      - kind: manual_procedural
        ref: "Checkpoint da Tarefa 2 (checkpoint:human-action) — resposta do dono: \"Success. No rows returned\""
        status: pass
    human_judgment: true
    rationale: "Aplicação de schema no único projeto Supabase (produção) exige confirmação humana direta no SQL Editor — o executor nunca aplica."
  - id: D3
    description: "RLS dono-escreve / Supervisor-só-lê, isolamento entre vendedores, carimbos do servidor e minimização de dados provados contra o banco real"
    requirement: "AGD2-03"
    verification:
      - kind: integration
        ref: "tests/agenda2/rls-agenda2.test.ts (20 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Limites de tamanho (120/60) e recusa de sequências de 8+ dígitos (anti-documento) funcionando no banco real"
    requirement: "AGD2-04"
    verification:
      - kind: integration
        ref: "tests/agenda2/rls-agenda2.test.ts#limite-de-tamanho, tests/agenda2/rls-agenda2.test.ts#sem-sequencia-de-documento"
        status: pass
    human_judgment: false
  - id: D5
    description: "Vendedor conclui/desmarca e apaga só os próprios itens; Supervisor vê o time inteiro sem poder escrever"
    requirement: "AGD2-05"
    verification:
      - kind: integration
        ref: "tests/agenda2/rls-agenda2.test.ts#vendedor-conclui-e-desmarca, tests/agenda2/rls-agenda2.test.ts#supervisor-le-o-time, tests/agenda2/rls-agenda2.test.ts#supervisor-nao-edita, tests/agenda2/rls-agenda2.test.ts#supervisor-nao-apaga"
        status: pass
    human_judgment: false
  - id: D6
    description: "Forma estrutural da migration 0048 (colunas mínimas LGPD, 4 policies, sem elevação de privilégio, inventário de SECURITY DEFINER inalterado) e nenhuma migration anterior a 0048 editada"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts (13 casos)"
        status: pass
      - kind: other
        ref: "node -e (diff git contra 071871f em supabase/migrations, filtrando 0048/0049+)"
        status: pass
    human_judgment: false

duration: ~15min (Tarefa 3, após aprovação e aplicação manual do dono em turnos anteriores)
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 03: Aprovação, Aplicação Manual e Testes de RLS da Agenda 2 Summary

**Migration 0048 (tabela `agenda2_itens`, RLS dono-escreve/Supervisor-só-lê, carimbos do servidor, anti-documento) aprovada pelo dono com alerta de LGPD, aplicada manualmente no SQL Editor de produção, e provada por 33 testes de integração/estruturais contra o banco real.**

## Performance

- **Duration:** ~15min (Tarefa 3 — Tarefas 1 e 2 foram checkpoints de aprovação/aplicação manual concluídos em turnos anteriores desta mesma sessão de execução)
- **Completed:** 2026-10-01
- **Tasks:** 3/3
- **Files modified:** 1

## Accomplishments

- Dono aprovou explicitamente ("aplicar") o escopo de dados pessoais da Agenda 2, com o alerta de LGPD apresentado em linguagem simples: o que é guardado (nome livre + bairro + data + vendedor), o que nunca é guardado (telefone, endereço completo, observação, localização), quem lê (vendedor só os próprios, Supervisor o time inteiro só-leitura), o comportamento em desativação/promoção/apagamento de conta, e a pendência do prazo de guarda (sem descarte automático implementado — decisão do dono ainda em aberto).
- Dono confirmou as duas decisões de planejamento sobre o que a Lista mostra: itens já concluídos de dias passados saem da Lista (continuam guardados, aparecem no calendário da Fase 32); "Próximos dias" mostra todos os itens futuros sem corte de dias, igual à Agenda atual.
- Dono aplicou a migration 0048 no projeto de produção pelo SQL Editor da Supabase, confirmando "Success. No rows returned" — tabela `agenda2_itens`, 4 policies de RLS e o gatilho `agenda2_itens_carimbos` agora existem no banco real.
- Os 20 casos de `tests/agenda2/rls-agenda2.test.ts` e os 13 casos de `tests/agenda2/migracao-agenda2.test.ts` rodam verdes contra o banco real (33/33), provando dono-escreve/Supervisor-só-lê, isolamento entre vendedores, carimbos do servidor, minimização LGPD, limites de tamanho, recusa de sequências de documento e o comportamento de desativação.
- Nenhuma migration anterior a 0048 foi editada (verificado por diff de git contra o commit-base das migrations); a própria 0048 não foi tocada depois de aplicada.

## Task Commits

Tarefas 1 e 2 são checkpoints (decisão/ação humana) sem artefato de código — não geram commit próprio; a aprovação e a confirmação de aplicação ficam registradas aqui no SUMMARY.

1. **Tarefa 1: Aprovação do dono (checkpoint:decision)** — sem commit (decisão registrada neste SUMMARY)
2. **Tarefa 2: Dono aplica a 0048 pelo SQL Editor (checkpoint:human-action)** — sem commit (confirmação "Success" registrada neste SUMMARY)
3. **Tarefa 3: Testes de RLS a GREEN contra o banco real** - `777a5ae` (test)

**Plan metadata:** (ver commit de encerramento deste plano)

## Files Created/Modified

- `tests/agenda2/rls-agenda2.test.ts` - Corrigido o helper `nomeInventado()` para não gerar sequências de 8+ dígitos corridos (Date.now() quebrado a cada 3 dígitos), evitando colisão com a própria constraint `chk_agenda2_nome_cliente_sem_documento` que a suíte existe para validar.

## Decisions Made

- Ver `key-decisions` no frontmatter: aprovação explícita do escopo de dados/LGPD, aplicação manual confirmada, e correção do bug de fixture sem relaxar nenhuma asserção de segurança.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture de teste `nomeInventado()` tropeçava na própria constraint anti-documento**
- **Found during:** Tarefa 3, primeira rodada de `npx vitest run tests/agenda2/rls-agenda2.test.ts`
- **Issue:** 18 dos 20 casos de RLS falhavam com `violates check constraint "chk_agenda2_nome_cliente_sem_documento"`. Causa: `nomeInventado()` usava `Date.now()` cru no sufixo — um número de 13 dígitos decimais corridos, exatamente o padrão (`[0-9]{8,}`) que a constraint da migration 0048 recusa de propósito (parece CPF/CNPJ/telefone/CEP). A constraint estava correta; o bug era só na fixture de teste.
- **Fix:** `Date.now().toString()` passa por `.replace(/(\d{3})(?=\d)/g, "$1x")`, quebrando o timestamp a cada 3 dígitos com um separador não-numérico — nunca mais forma sequência de 8+ dígitos, continua único o bastante para a fixture. Nenhuma asserção de segurança foi tocada ou relaxada (os casos `supervisor-nao-*`, `vendedor-nao-*`, `anonimo-sem-acesso` e `lgpd-colunas-minimas` permanecem exatamente como escritos).
- **Files modified:** `tests/agenda2/rls-agenda2.test.ts`
- **Verification:** `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/migracao-agenda2.test.ts` — 33/33 verdes; diff de migrations antigas (script do plano) confirma 0048 como a única migration tocada.
- **Committed in:** `777a5ae` (Tarefa 3)

---

**Total deviations:** 1 auto-fixed (1 bug de teste, Rule 1)
**Impact on plan:** Correção isolada no arquivo de teste já listado em `files_modified` do plano; nenhuma mudança de comportamento do banco, nenhuma asserção de segurança relaxada. Sem impacto de escopo.

## Issues Encountered

Nenhum além do já documentado acima. O limite de login do Supabase Auth (mencionado como risco em STATE.md/Blockers) não se manifestou nesta rodada — a suíte completa (33 casos, 2 autenticações) rodou em ~17s sem retry.

## User Setup Required

None - a aplicação de schema já foi feita manualmente pelo dono nas Tarefas 1-2 (não é um passo pendente, já está concluído). Como passo opcional (não bloqueante), o dono pode rodar `supabase migration repair --status applied 0048` para o histórico do CLI local refletir a aplicação manual — a 0048 usa formas re-executáveis, então um `supabase db push` futuro não quebra mesmo sem esse passo.

## Next Phase Readiness

- Tabela `agenda2_itens` está em produção, com RLS e carimbos provados contra o banco real — os planos 31-04 a 31-08 (tela, menu, visibilidade por papel) podem seguir sem bloqueio de schema.
- Pendência explícita, não resolvida nesta fase: prazo de guarda dos itens da Agenda 2 (LGPD) — nenhum descarte automático implementado; decisão do dono antes do uso real continuado em produção.

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: tests/agenda2/rls-agenda2.test.ts
- FOUND: commit 777a5ae
