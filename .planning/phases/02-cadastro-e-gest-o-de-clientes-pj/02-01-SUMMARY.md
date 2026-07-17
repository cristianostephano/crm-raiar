---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 01
subsystem: database
tags: [postgres, supabase, rls, plpgsql, vitest, migrations]

# Dependency graph
requires:
  - phase: 01-autentica-o-e-pap-is
    provides: profiles table, user_role enum, is_supervisor() SECURITY DEFINER helper, SEED_ACCOUNTS test identities, RLS wrapped-auth.uid() convention
provides:
  - clientes table (1:1 funnel-card model) with etapa/status_acompanhamento/motivo_perda_id/observacao/posicao columns
  - 4 seeded editable-lookup tables (categorias, produtos_consumidos, tipos_tarefa, motivos_perda) with soft-delete `ativo`
  - cliente_produtos join, tarefas, historico tables
  - RLS policies on all 8 new tables (cross-vendedor isolation, supervisor-only delete, WITH CHECK anti-reassignment, parent-gated joined tables)
  - chk_ganho_somente_etapa_final and chk_perdido_exige_motivo DB CHECK constraints (FUN-05/FUN-06)
  - mover_card_funil RPC + auto-history/stage-timestamp triggers
  - lib/funil/etapas.ts (ETAPAS, ETAPA_KEYS, ETAPA_FINAL) — single source of truth for the 7 fixed stages
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 03-kanban]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres CHECK constraints as the DB-level source of truth for multi-column business rules (ganho/perdido), independent of any RPC or frontend"
    - "mover_card_funil RPC is NOT security definer — runs as the caller so RLS still applies to the underlying UPDATE"
    - "Joined/child tables (cliente_produtos, tarefas, historico) each get their own EXISTS-on-parent RLS policy rather than relying on the clientes policy (Pitfall 3)"
    - "historico has no user-facing INSERT policy — only SECURITY DEFINER triggers write it"

key-files:
  created:
    - supabase/migrations/0002_clientes_and_funil.sql
    - lib/funil/etapas.ts
    - tests/clientes/rls-clientes.test.ts
    - tests/clientes/funil-constraints.test.ts
  modified: []

key-decisions:
  - "A clientes row IS the funnel card (1:1 model) — etapa/status_acompanhamento/motivo_perda_id/observacao/posicao live directly on clientes, per ARCHITECTURE.md and CLAUDE.md's singular 'cada cliente tem um card no funil' wording. No separate cards/opportunities table."
  - "mover_card_funil is a plain plpgsql function (not SECURITY DEFINER) so RLS on the underlying UPDATE still applies to whoever calls it."
  - "Fixed a test-authoring bug found during Task 3: Postgres rejects an UPDATE whose new row fails WITH CHECK with a 42501 error, not by silently filtering the row to 0 rows affected (that silent-filter behavior is specific to USING on SELECT/DELETE). The responsavel-reassignment test now asserts the 42501 error code."

patterns-established:
  - "Every new table this project creates must enable RLS + ship explicit policies in the same migration (mirrors 0001's discipline), and any table with a business rule spanning multiple columns gets a named CHECK constraint, not just app-level validation."
  - "lib/funil/etapas.ts is the single source of truth for the 7 fixed funil stage keys/labels — future UI/kanban plans import from here rather than redefining stage lists."

requirements-completed: [CLI-04, CLI-05, CLI-06, FUN-01, FUN-04, FUN-05, FUN-06, FUN-08, FUN-10]

coverage:
  - id: D1
    description: "Vendedor sees only own clientes rows; Supervisor sees all (cross-vendedor isolation)"
    requirement: "CLI-04"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-clientes.test.ts#RLS: clientes cross-vendedor isolation (Pitfall 2) > Vendedor B cannot see Vendedor A's cliente; Supervisor sees it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vendedor cannot delete any cliente (own or otherwise); only Supervisor can"
    requirement: "CLI-06"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-clientes.test.ts#RLS: clientes DELETE is Supervisor-only (CLI-06) > Vendedor A cannot delete their own cliente (0 rows affected)"
        status: pass
      - kind: integration
        ref: "tests/clientes/rls-clientes.test.ts#RLS: clientes DELETE is Supervisor-only (CLI-06) > Supervisor CAN delete any cliente row"
        status: pass
    human_judgment: false
  - id: D3
    description: "razao_social is unique across the whole base (duplicate insert rejected with 23505)"
    requirement: "CLI-05"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-clientes.test.ts#RLS: clientes razao_social uniqueness across vendedores (D-06) > a second insert with an already-existing razao_social fails with 23505"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Vendedor cannot reassign responsavel on their own cliente row via direct UPDATE"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-clientes.test.ts#RLS: clientes UPDATE WITH CHECK blocks responsavel reassignment > Vendedor A cannot reassign their own cliente's responsavel to Vendedor B (0 rows affected)"
        status: pass
    human_judgment: false
  - id: D5
    description: "status_acompanhamento='ganho' is only allowed when etapa='primeira_venda', enforced as a DB CHECK constraint (bypasses UI/RPC)"
    requirement: "FUN-05"
    verification:
      - kind: integration
        ref: "tests/clientes/funil-constraints.test.ts#Funil constraint: ganho only from the final stage (FUN-05) > direct UPDATE setting status_acompanhamento='ganho' while etapa is not primeira_venda is rejected"
        status: pass
      - kind: integration
        ref: "tests/clientes/funil-constraints.test.ts#Funil constraint: ganho only from the final stage (FUN-05) > direct UPDATE setting status_acompanhamento='ganho' while etapa=primeira_venda succeeds"
        status: pass
    human_judgment: false
  - id: D6
    description: "status_acompanhamento='perdido' requires a non-null motivo_perda_id, enforced as a DB CHECK constraint"
    requirement: "FUN-06"
    verification:
      - kind: integration
        ref: "tests/clientes/funil-constraints.test.ts#Funil constraint: perdido requires motivo_perda_id (FUN-06) > direct UPDATE setting status_acompanhamento='perdido' with motivo_perda_id NULL is rejected"
        status: pass
    human_judgment: false
  - id: D7
    description: "mover_card_funil RPC raises a readable exception on an invalid ganho transition"
    verification:
      - kind: integration
        ref: "tests/clientes/funil-constraints.test.ts#Funil RPC: mover_card_funil raises a readable exception on invalid ganho transition > rpc('mover_card_funil', ...) with an invalid ganho transition raises an exception"
        status: pass
    human_judgment: false
  - id: D8
    description: "0002 migration schema (clientes, 4 lookup tables, cliente_produtos, tarefas, historico, mover_card_funil RPC, triggers) is live on the hosted Supabase project"
    verification:
      - kind: other
        ref: "supabase migration list --linked -> 0002 shown local AND remote"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 1: Clientes + Funil Data Model Summary

**Migration 0002 creates the entire Phase 2 Postgres schema — `clientes`-is-the-funnel-card (1:1 model), 4 seeded editable lookup tables, `mover_card_funil` RPC, and the `chk_ganho_somente_etapa_final`/`chk_perdido_exige_motivo` DB CHECK constraints — pushed live and proven with 19 passing negative-case RLS/business-rule tests run as restricted Vendedor accounts.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-16T22:04:04-03:00
- **Completed:** 2026-07-16T22:16:41-03:00
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments
- Wrote and pushed `supabase/migrations/0002_clientes_and_funil.sql`: 2 enums, 4 seeded lookup tables, `clientes` (the funnel card), `cliente_produtos`, `tarefas`, `historico`, RLS on all 8 tables, 2 named CHECK constraints, `mover_card_funil` RPC, 3 triggers, 7 indexes
- Proved cross-vendedor RLS isolation, supervisor-only delete, `razao_social` uniqueness, and the responsavel-reassignment block using real Vendedor A/B/Supervisor sign-ins (never service-role) — Pitfall 2 discipline
- Proved the ganho/perdido business rules are enforced at the database level via direct UPDATE calls that bypass any RPC or UI (Pitfall 6, "Looks Done But Isn't" checklist)
- `lib/funil/etapas.ts` established as the single source of truth for the 7 fixed funil stages, ready for every later kanban/UI plan to import

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the RLS + funil-constraint negative-case tests (RED)** - `ef4221b` (test)
2. **Task 2: Write the 0002 migration** - `c833aa5` (feat)
3. **Task 3: Push 0002 and drive the negative-case tests GREEN** - `bdf4581` (feat)

_Note: Task 3's commit also contains a small test fix (Rule 1 — WITH CHECK failure raises 42501 rather than silently filtering rows), captured in the same commit since it was found while turning the RED gate green._

## Files Created/Modified
- `supabase/migrations/0002_clientes_and_funil.sql` - Full Phase 2 schema: enums, lookup tables, clientes, cliente_produtos, tarefas, historico, RLS policies, CHECK constraints, mover_card_funil RPC, triggers, indexes
- `lib/funil/etapas.ts` - ETAPAS/ETAPA_KEYS/ETAPA_FINAL — single source of truth for the 7 fixed stages
- `tests/clientes/rls-clientes.test.ts` - Cross-vendedor isolation, responsavel-reassignment block, delete-supervisor-only, razao_social uniqueness
- `tests/clientes/funil-constraints.test.ts` - ganho-only-from-final-stage, perdido-requires-motivo, mover_card_funil RPC rejection

## Decisions Made
- A `clientes` row IS the funnel card (1:1 model) — no separate cards/opportunities table, per ARCHITECTURE.md and CLAUDE.md's domain wording.
- `mover_card_funil` is NOT `SECURITY DEFINER` — it runs as the calling user so RLS on the underlying UPDATE still applies (a vendedor calling it on someone else's client affects 0 rows).
- `historico` deliberately has no user-facing INSERT policy — only the SECURITY DEFINER triggers can write to it, keeping the audit trail tamper-proof from the API surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed an incorrect test assumption about RLS UPDATE WITH CHECK failure behavior**
- **Found during:** Task 3 (driving the RED tests to GREEN)
- **Issue:** `tests/clientes/rls-clientes.test.ts` originally asserted that a Vendedor A UPDATE attempting to reassign `responsavel` to Vendedor B would silently return 0 rows affected with no error — modeled after how `USING` silently filters rows on SELECT/DELETE. In reality, when a row matches `USING` but the resulting new row fails `WITH CHECK`, Postgres raises a `42501` ("new row violates row-level security policy") error instead of silently filtering it.
- **Fix:** Updated the test to assert `updateError.code === '42501'` and that no rows were returned, matching Postgres's actual documented RLS behavior for `WITH CHECK` violations on UPDATE.
- **Files modified:** `tests/clientes/rls-clientes.test.ts`
- **Verification:** Full clientes test suite green (19/19) after the fix; the underlying RLS policy itself required no change — only the test's expectation was wrong.
- **Committed in:** `bdf4581` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test authoring, not in the shipped schema)
**Impact on plan:** No scope creep; the fix only corrected a test's expectation of Postgres's own documented RLS semantics.

## Issues Encountered
- `supabase db push` printed a benign notice that one RLS policy's identifier ("usuarios cadastram clientes para si (ou supervisor para qualquer um)") was truncated to 63 bytes (Postgres identifier length limit) — cosmetic only, the policy itself is applied correctly and enforces the intended rule (proven by the INSERT-scoped tests passing). Not worth a follow-up migration since policy *names* have no functional effect, only `USING`/`WITH CHECK` bodies do.
- `supabase db push` also printed the same benign Docker-catalog-cache warning noted in 01-02-SUMMARY.md (Docker Desktop not running/elevated on this machine) — does not affect the push itself.
- Running `tests/auth/rls-roles.test.ts` and `tests/clientes/*` together in one combined `vitest run` invocation can trip Supabase's free-tier auth rate limit ("Request rate limit reached") from too many sequential `signInWithPassword` calls in a short window. Both suites pass 100% when run independently (`tests/auth/rls-roles.test.ts` alone: 5/5 green; `tests/clientes/*` together: 19/19 green) — this is a free-tier auth throughput constraint, not a schema/RLS defect. Future phases running the full test suite should be aware sign-in-heavy test files may need to run in smaller batches or with slight spacing.
- One transient "JWT issued at future" (`PGRST303`) failure was observed on a single run of `tests/auth/rls-roles.test.ts` when combined with the new clientes tests — reran in isolation immediately after and it passed cleanly; treated as a one-off clock-skew/token-timing flake, not a regression to the 0001 policies (no code change was made in response).

## User Setup Required

None - no external service configuration required. The Supabase CLI's persistent `supabase login` session (established in Phase 1) was sufficient for both `supabase projects list` and `supabase db push`; no fresh token or manual paste was needed.

## Next Phase Readiness
- The full Phase 2 data model is live on the hosted Supabase project: every later plan in this phase (cadastro form, client list, kanban board, task/detail sheet, filters) can build directly against `clientes`, the 4 lookup tables, `tarefas`, `historico`, and the `mover_card_funil` RPC without further schema work.
- `lib/funil/etapas.ts` is ready to import into the kanban board and any stage-name UI.
- No blockers. One operational note carried forward for future test-writing: batch/space out sign-in-heavy Vitest suites to avoid tripping the free-tier Supabase auth rate limit when running large combined test runs.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created files verified present on disk (`supabase/migrations/0002_clientes_and_funil.sql`, `lib/funil/etapas.ts`, `tests/clientes/rls-clientes.test.ts`, `tests/clientes/funil-constraints.test.ts`); all 3 task commit hashes (`ef4221b`, `c833aa5`, `bdf4581`) confirmed present in `git log`.
