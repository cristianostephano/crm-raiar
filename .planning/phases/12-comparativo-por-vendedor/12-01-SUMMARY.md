---
phase: 12-comparativo-por-vendedor
plan: 01
subsystem: database
tags: [postgres, supabase, rls, sql, dashboard, rpc]

# Dependency graph
requires:
  - phase: 10-desativa-o-de-membro-da-equipe
    provides: "profiles.ativo column + is_supervisor() ativo-aware extension"
  - phase: 11-funil-de-convers-o-detalhado
    provides: "ultimo_status_change dedup-latest-event CTE pattern, ganho/perdido closing-event reconstruction from historico"
provides:
  - "dashboard_comparativo_vendedor() RPC — one row per active vendedor with negocios_iniciados (all-time), ganho, perdido, ciclo_medio_dias (ganho-only)"
  - "tests/dashboard/comparativo-vendedor.test.ts — disposable-fixture integration test covering ativo/desativado/iniciados/ciclo/conversao"
  - "tests/dashboard/rls-dashboard.test.ts extended with VEND-01 cross-vendedor isolation coverage"
affects: [12-02, 12-03, 12-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY INVOKER by omission for every dashboard_* RPC (0003/0009/0011 all follow this)"
    - "Row-list filter (vendedores_ativos CTE) kept structurally separate from the aggregation CTE (agregados) so a soft-deactivation flag never leaks into historical aggregates"
    - "ganho-only average via a FILTER clause on avg(), leaving NULL (not 0) when the filtered set is empty"

key-files:
  created:
    - supabase/migrations/0011_dashboard_comparativo_vendedor.sql
    - tests/dashboard/comparativo-vendedor.test.ts
  modified:
    - tests/dashboard/rls-dashboard.test.ts

key-decisions:
  - "negocios_iniciados counts clientes.responsavel as it stands TODAY (current assignment), not historical reassignment provenance — reviewed and explicitly accepted by the project owner at the Task 2 checkpoint"
  - "ciclo_medio_dias uses a FILTER (where status_evento = 'ganho') on both the count and the avg, so perdido never contributes to the average and a vendedor with zero ganhos gets NULL, never 0 (D-04)"
  - "ativo = true appears exactly once in the migration, confined to the vendedores_ativos CTE — the agregados CTE aggregates over ALL clientes rows unconditionally, so deactivating a vendedor removes only their ROW from this RPC and never touches any other dashboard_* RPC's totals"

patterns-established:
  - "Zero-argument dashboard_* RPC + disposable createTestMember/deleteTestMember fixture (not shared SEED_ACCOUNTS) for any future dashboard test needing exact-count assertions"

requirements-completed: [VEND-01]

coverage:
  - id: D1
    description: "dashboard_comparativo_vendedor() returns one row per ACTIVE vendedor with negocios_iniciados/ganho/perdido/ciclo_medio_dias, SECURITY INVOKER, RLS-scoped"
    requirement: "VEND-01"
    verification:
      - kind: integration
        ref: "tests/dashboard/comparativo-vendedor.test.ts#vendedor ativo sem nenhum cliente atribuido aparece como linha completa de zeros (VEND-01)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/comparativo-vendedor.test.ts#negocios_iniciados conta todos os clientes atribuidos desde sempre, sem nenhum recorte de data (VEND-01)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/comparativo-vendedor.test.ts#ciclo_medio_dias considera SO os negocios ganhos (D-04), nunca o perdido, e fica nulo sem nenhum ganho"
        status: pass
      - kind: integration
        ref: "tests/dashboard/comparativo-vendedor.test.ts#conversao: a RPC nunca calcula taxa de conversao no SQL (D-03), e taxaConversao aplicada as contagens cruas devolve o valor esperado"
        status: pass
      - kind: integration
        ref: "tests/dashboard/comparativo-vendedor.test.ts#vendedor desativado desaparece desta lista, mas os totais de dashboard_ganhos_perdidos ficam inalterados (VEND-01)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/rls-dashboard.test.ts#dashboard_comparativo_vendedor never leaks another vendedor's real numbers to Vendedor B (VEND-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migration applied to the hosted production Supabase project via supabase db push, with explicit prior human review/approval"
    verification:
      - kind: manual_procedural
        ref: "Task 2 checkpoint — project owner read the migration file directly and approved; Task 3 supabase db push output confirmed by orchestrator: migrations=[0011_dashboard_comparativo_vendedor.sql]"
        status: pass
    human_judgment: true
    rationale: "Production database schema changes require a human sign-off per CLAUDE.md ('não fazer deploy direto em produção sem passar por uma etapa de revisão') — not something an automated check can substitute for."

# Metrics
duration: ~60min (across two conversation turns, including a blocking human-approval checkpoint and a Claude Code sandbox permission gate)
completed: 2026-08-05
status: complete
---

# Phase 12 Plan 1: Comparativo por Vendedor (backend) Summary

**Additive `dashboard_comparativo_vendedor()` Postgres RPC (SECURITY INVOKER, zero arguments) returning per-active-vendedor negócios iniciados/ganho/perdido/ciclo médio (ganho-only), pushed to production and proven by 6 new/extended integration tests.**

## Performance

- **Duration:** ~60 min total (Task 1 authoring + verification; Task 2 blocking human-approval checkpoint; Task 3 blocked once by a Claude Code sandbox permission gate on `supabase link`, resolved by the orchestrator running the push directly, then green tests)
- **Completed:** 2026-08-05
- **Tasks:** 3/3 (1 auto, 1 checkpoint:human-verify, 1 auto)
- **Files modified:** 3 (1 new migration, 1 new test file, 1 extended test file)

## Accomplishments
- New additive migration `supabase/migrations/0011_dashboard_comparativo_vendedor.sql`: `dashboard_comparativo_vendedor()`, `language sql stable`, no `security definer` — returns `responsavel`, `responsavel_nome`, `negocios_iniciados`, `ganho`, `perdido`, `ciclo_medio_dias`, one row per vendedor with `role = 'vendedor' and ativo = true`
- `negocios_iniciados`/`ganho`/`perdido` all derive from a single `group by c.responsavel` over the unfiltered `clientes` table (D-01/D-02 — all-time, no period parameter, no reassignment-provenance reconstruction), guaranteeing by construction that `ganho + perdido <= negocios_iniciados`
- `ciclo_medio_dias` is GANHO-ONLY via `filter (where f.status_evento = 'ganho')` on the `avg()`, left as `NULL` (never `coalesce`d to 0) when a vendedor has zero ganhos (D-04)
- No `taxa_conversao` column in the RPC — raw `ganho`/`perdido` counts only; `taxaConversao()` from `lib/dashboard/periodo.ts` is reused unchanged in the tests (D-03), to be wired into the reader in plan 02
- The `ativo = true` filter appears exactly once, inside the `vendedores_ativos` CTE only — `agregados` aggregates over every `clientes` row unconditionally, proven by the "desativado" test asserting `dashboard_ganhos_perdidos()`'s totals stay byte-identical after a deactivation while the comparativo row disappears
- New `tests/dashboard/comparativo-vendedor.test.ts` (5 cases: ativo, desativado, iniciados, ciclo, conversao) using a disposable `createTestMember`/`deleteTestMember` fixture vendedor with a deterministic 3-cliente seed (1 ganho, 1 perdido, 1 em_andamento), never the shared `SEED_ACCOUNTS`
- Extended `tests/dashboard/rls-dashboard.test.ts`: added the new RPC to both cross-vendedor before/after `Promise.all` arrays plus a dedicated `it()` block proving Vendedor B never sees Vendedor A's real numbers while the Supervisor does
- Migration applied to the hosted production Supabase project (`afbiwgbqkogsrhxjshkk`) via `supabase db push` after explicit human review and approval at the Task 2 checkpoint
- Both target test files green: `npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/rls-dashboard.test.ts` → **19/19 passed**, run twice for confirmation

## Task Commits

1. **Task 1: Escrever a migration com a RPC nova e criar/estender os testes de integração (RED)** - `6450289` (feat)
2. **Task 2: Aprovação humana — aplicar a migration no banco Supabase de produção** - checkpoint only, no commit (project owner read the migration file directly and approved)
3. **Task 3: [BLOCKING] Aplicar a migration no banco hospedado (supabase db push) e levar os testes a GREEN** - no additional commit (migration pushed as-is from Task 1's commit; tests went GREEN with zero code changes needed)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` - new additive migration, the `dashboard_comparativo_vendedor()` RPC
- `tests/dashboard/comparativo-vendedor.test.ts` - new integration test file (ativo/desativado/iniciados/ciclo/conversao)
- `tests/dashboard/rls-dashboard.test.ts` - extended with the new RPC in both cross-vendedor arrays and a dedicated isolation test

## Decisions Made
- `negocios_iniciados` counts the CURRENT `clientes.responsavel` assignment (not historical reassignment provenance) — this nuance was surfaced explicitly at the Task 2 checkpoint ("se um cliente já foi transferido de um vendedor para outro... ele conta para quem está com ele agora, não para quem o cadastrou") and the project owner confirmed this is the intended reading, matching D-01/D-02.
- Ciclo médio filter applied to both the count and the avg (not just the avg) so the SQL doesn't rely on an implicit NULL-propagation coincidence — an explicit, testable D-04 boundary.

## Deviations from Plan

### Auto-fixed Issues

None — the migration and both test files matched the plan's `12-PATTERNS.md` draft SQL closely, and all structural/behavioral checks passed on the first attempt with zero code changes needed in Task 3.

**Total deviations:** 0
**Impact on plan:** None — plan executed as written.

## Issues Encountered

1. **Claude Code sandbox permission gate on `supabase link`** — the executor agent's own Bash auto-mode classifier denied `npx supabase link --project-ref ...` outright (a sandbox-level block, not a Supabase auth failure — confirmed via `supabase projects list`/`supabase db push --dry-run --linked` both working fine, listing the target project as reachable but unlinked). Per the harness's own guidance, this was escalated back to the orchestrator rather than worked around; the orchestrator ran `supabase link` + `supabase db push` directly in this worktree and confirmed success (`{"upToDate":false,"dryRun":false,"migrations":["0011_dashboard_comparativo_vendedor.sql"],...,"message":"Finished supabase db push."}`).
2. **Missing `.env.local` in the worktree** — git worktrees don't share gitignored files with the main checkout, so this fresh worktree had no `.env.local` at all (not a permissions issue — the file was simply absent on disk here), causing every test to fail on `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"`. Fixed by copying the main checkout's `.env.local` into the worktree (a local secrets file, confirmed still gitignored and never staged) before re-running the tests.
3. **Full `npm test` run hit a known, pre-existing Supabase Auth rate limit ("Request rate limit reached" / HTTP 429)** — flagged in advance by the coordinator as an expected infra constraint (documented in `.planning/STATE.md`'s Blockers/Concerns for this exact live test project) when the whole 385-test suite runs `signInWithPassword` against the same shared seed accounts repeatedly in a short window. Confirmed this is NOT a regression from this plan's changes: the failures were systemic across every test file in the suite (`tests/auth/login.test.ts`, `tests/clientes/*`, `tests/equipe/*`, `tests/importacao/*` — none touched by this plan), all bottoming out in the identical `Request rate limit reached` / `429 Too Many Requests` error from Supabase Auth/the invite Edge Function, not in any assertion against this plan's new RPC. The plan's own required verification command, run in isolation (twice, to rule out a one-off), was fully green both times: `npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/rls-dashboard.test.ts` → **19/19 passed**. `npm test` is expected to go fully green again once the rate-limit window resets; re-running it was not repeated a third time to avoid further exhausting the shared live project's auth quota.

## User Setup Required

None - no external service configuration required beyond the `supabase db push` already completed with the owner's approval.

## Next Phase Readiness
- `dashboard_comparativo_vendedor()` is live in production and ready to be consumed. Plan 02 can now add `getComparativoVendedor()` to `lib/supabase/queries/dashboard.ts` (per `12-PATTERNS.md`'s already-drafted reader, which wires `taxaConversao()` into the response) and the corresponding Server Action in `app/actions/dashboard.ts`.
- No blockers for plans 02-04. The one open item worth a full-suite re-run before shipping the phase: confirm `npm test` is fully green once the shared test project's Supabase Auth rate-limit window has reset (not expected to reveal any new failure — see Issues Encountered #3).

---
*Phase: 12-comparativo-por-vendedor*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0011_dashboard_comparativo_vendedor.sql`
- FOUND: `tests/dashboard/comparativo-vendedor.test.ts`
- FOUND: `.planning/phases/12-comparativo-por-vendedor/12-01-SUMMARY.md`
- FOUND: commit `6450289` in git log
