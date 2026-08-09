---
phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
plan: 01
subsystem: database
tags: [postgres, rls, supabase, migrations, editable-lists]

# Dependency graph
requires:
  - phase: 13-cliente-ativo-e-frequ-ncia-de-visita
    provides: "clientes.frequencia_pedidos column (text, nullable, migration 0013) — this plan's table feeds it a controlled vocabulary but does not alter it"
provides:
  - "frequencias_pedido table — the 5th Supervisor-managed editable-list lookup table (id/nome unique/ativo/created_at), structurally identical to categorias/produtos_consumidos/tipos_tarefa/motivos_perda"
  - "4 RLS policies on frequencias_pedido: read-open to any authenticated user, write (insert/update/delete) gated to Supervisor via is_supervisor()"
  - "6 starter values seeded (Semanal/Quinzenal/Mensal/Bimestral/Trimestral/Esporádica), owner-confirmed"
affects: [16-02, 16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5th editable-list lookup table follows the exact 0002_clientes_and_funil.sql shape (id uuid pk / nome text unique / ativo boolean default true / created_at) with 4 RLS policies through is_supervisor() — no new authorization pattern introduced"

key-files:
  created:
    - supabase/migrations/0016_frequencias_pedido.sql
    - tests/configuracoes/rls-frequencias-pedido.test.ts
  modified: []

key-decisions:
  - "Owner confirmed the 6 starter values (Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Esporádica) as-is at the Task 2 checkpoint — no edits needed before push"
  - "Owner confirmed accepting that renaming a frequencias_pedido value later does NOT retroactively update clientes already storing the old name — clientes.frequencia_pedidos stores plain text, not a foreign key, per the phase's D2 design decision (avoids an ALTER on the production clientes table)"
  - "supabase db push for this migration was executed by the orchestrator from its own context, not by this subagent — the harness's security classifier blocks production database pushes from subagents (same constraint hit in Phases 14 and 15)"

patterns-established:
  - "Editable-list lookup tables in this project always mirror the exact 4-column shape + 4-policy RLS pattern from 0002_clientes_and_funil.sql — this is now the 5th confirmed instance (categorias, produtos_consumidos, tipos_tarefa, motivos_perda, frequencias_pedido)"

requirements-completed: [ATV-02]

coverage:
  - id: D1
    description: "5th editable-list lookup table (frequencias_pedido) created in production with RLS: any authenticated user reads, only Supervisor creates/renames/deactivates — proven both directions against the live database"
    requirement: ATV-02
    verification:
      - kind: integration
        ref: "tests/configuracoes/rls-frequencias-pedido.test.ts (13/13 passing against hosted project)"
        status: pass
      - kind: integration
        ref: "tests/configuracoes/rls-listas.test.ts (regression — shared editable-list RLS pattern, 20/20 passing)"
        status: pass
      - kind: integration
        ref: "tests/auth/rls-roles.test.ts (regression — shared is_supervisor() role authority, 10/10 passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migration applied to the hosted production Supabase project only after explicit human approval, per CLAUDE.md's production-review requirement"
    requirement: ATV-02
    verification:
      - kind: manual_procedural
        ref: "Checkpoint Task 2 — owner replied 'approved', confirming both the 6 starter values and the rename-does-not-propagate tradeoff (D2)"
        status: pass
    human_judgment: true
    rationale: "Production database changes require a human sign-off gate per CLAUDE.md; recorded here as an audit trail, not something a test can substitute for."

duration: ~20min (includes the blocking human-approval checkpoint before the production push)
completed: 2026-08-09
status: complete
---

# Phase 16 Plan 1: Fundação da Lista "Frequência de Pedidos" Summary

**Tabela `frequencias_pedido` — a 5ª lista editável do projeto — criada em produção com RLS de 4 regras (leitura aberta, escrita só Supervisor) e conjunto inicial de 6 valores, provada nos dois sentidos contra o banco real.**

## Performance

- **Duration:** ~20min (inclui a pausa do checkpoint de aprovação humana antes do push em produção)
- **Tasks:** 3/3 (Task 1 auto, Task 2 checkpoint humano, Task 3 auto)
- **Files modified:** 2 (1 migration nova, 1 arquivo de teste novo)

## Accomplishments

- Migration `0016_frequencias_pedido.sql` cria a tabela `frequencias_pedido` — cópia estrutural literal das quatro listas irmãs (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`) já existentes desde a migration `0002`: `id uuid`, `nome text unique`, `ativo boolean default true`, `created_at`.
- Exatamente quatro regras de acesso (RLS), no mesmo padrão literal das quatro irmãs: leitura aberta a qualquer autenticado (alimenta o campo na ficha do cliente para todo Vendedor), as três de escrita (insert/update/delete) passando por `is_supervisor()` — nenhuma checagem de papel escrita à mão, nenhuma consulta direta à tabela de perfis.
- Seis valores iniciais semeados na própria migration: Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Esporádica — confirmados pelo dono do projeto no checkpoint sem alteração.
- `tests/configuracoes/rls-frequencias-pedido.test.ts` prova, contra o banco hospedado real (sessões reais via `signInAs`, nunca a chave de serviço para afirmar autorização): os 6 valores de seed existem e estão ativos; Vendedor lê; Supervisor cria/renomeia/desativa/reativa; Vendedor não cria nem desativa; nome duplicado é recusado com o código `23505`; anônimo não lê nada.
- Migration aplicada no projeto Supabase hospedado (produção) pelo orquestrador, após aprovação humana explícita no checkpoint da Task 2 — nenhuma migration já existente foi editada.
- Regressão nas suítes de maior risco (`rls-listas.test.ts` e `rls-roles.test.ts`, que compartilham `is_supervisor()` com a migration nova) permanece 100% verde — nenhuma quebra na função de checagem de papel do projeto.
- A tabela `clientes` não foi tocada nesta migration: as três colunas da Fase 13 (incluindo `frequencia_pedidos`, que continua texto opcional) seguem exatamente como estavam.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Escrever a migration da lista de frequência de pedidos e o teste de autorização (RED)** - `85ddd7f` (feat)
2. **Task 2: Aprovação humana** - checkpoint humano; sem commit próprio (nenhuma alteração de código)
3. **Task 3: Aplicar a migration (supabase db push) e levar o teste a GREEN** - sem commit de código novo: nem a migration nem o arquivo de teste precisaram de ajuste (o dono confirmou os valores iniciais sem alterações), então o push (executado pelo orquestrador) e a re-execução dos testes até GREEN não geraram diff a commitar. Ver "Issues Encountered" abaixo para o detalhe operacional do push.

**Plan metadata:** commit deste SUMMARY.md (ver hash no retorno da task de execução)

## Files Created/Modified

- `supabase/migrations/0016_frequencias_pedido.sql` - tabela `frequencias_pedido`, RLS de 4 regras, seed de 6 valores iniciais
- `tests/configuracoes/rls-frequencias-pedido.test.ts` - teste de integração de autorização cruzada contra o banco real (13 casos)

## Decisions Made

- Valores iniciais (Semanal/Quinzenal/Mensal/Bimestral/Trimestral/Esporádica) mantidos exatamente como propostos — dono confirmou no checkpoint sem pedir ajuste.
- Dono confirmou explicitamente que aceita o comportamento "renomear não propaga para clientes que já usam o nome antigo" (decisão D2 do contrato de interface, `frequencia_pedidos` continua texto simples em `clientes`, sem chave estrangeira, para não alterar a tabela `clientes` em produção).
- `supabase db push` para esta migration foi executado pelo orquestrador em seu próprio contexto, não por este subagente — restrição conhecida do classificador de segurança do harness contra pushes de banco de produção rodando dentro de um subagente (mesmo padrão das Fases 14 e 15).

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma correção automática (Regras 1-3) foi necessária; nenhuma decisão arquitetural (Regra 4) surgiu durante a execução.

## Issues Encountered

- Ambiente de teste do worktree não tinha `.env.local` (arquivo gitignored, não versionado, então não é copiado automaticamente para um worktree novo). Copiado do checkout principal do repositório para o worktree só para viabilizar a execução dos testes de integração contra o banco real — nunca commitado (segue fora do controle de versão em ambos os locais, `git status` confirma isso).
- `npx supabase db push` não pôde ser executado por este subagente (bloqueado pelo classificador de segurança do harness para pushes de produção rodando dentro de um subagente, confirmado nas Fases 14 e 15) — escalado ao orquestrador conforme o precedente documentado no `14-01-SUMMARY.md`. O orquestrador aplicou a migration com sucesso (`{"upToDate":false,"dryRun":false,"migrations":["0016_frequencias_pedido.sql"],...,"message":"Finished supabase db push."}`, sem erros, só o aviso benigno de cache do Docker) e sinalizou "approved" de volta a este agente, que então rodou os testes até GREEN.

## User Setup Required

None - nenhuma configuração externa manual necessária. A migration já foi aplicada em produção com aprovação do dono.

## Next Phase Readiness

- `frequencias_pedido` está pronta em produção com a mesma forma `{ id, nome, ativo }` das quatro listas editáveis existentes — o Plano 16-02 pode plugar diretamente na infraestrutura genérica de administração de listas já existente (tela de Configurações), sem componente novo.
- `clientes.frequencia_pedidos` continua coluna de texto opcional — nenhum plano seguinte pode transformá-la em chave estrangeira nem adicionar restrição a ela (contrato registrado no PLAN.md desta task).
- A validação de que o valor enviado pertence ao vocabulário atual fica para o Plano 16-03 (re-validação no servidor, já que não há chave estrangeira no banco por decisão de desenho D2).
- Nenhum bloqueio conhecido para os Planos 16-02, 16-03 e 16-04.

---
*Phase: 16-ficha-do-cliente-ativo-campos-e-di-rio*
*Completed: 2026-08-09*
