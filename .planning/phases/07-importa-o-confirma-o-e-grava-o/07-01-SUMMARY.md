---
phase: 07-importa-o-confirma-o-e-grava-o
plan: 01
subsystem: database
tags: [postgres, plpgsql, rls, supabase, rpc, vitest]

# Dependency graph
requires:
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    provides: "validarLoteImportacao dry-run Server Action, ResolvedRow shape, ImportWizard's no-op Confirmar button"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj
    provides: "clientes/cliente_produtos tables, razao_social unique constraint, is_supervisor(), mover_card_funil RPC pattern"
provides:
  - "importar_clientes_lote(p_clientes jsonb) RPC — the single write path of milestone v1.1, live on the Supabase project"
  - "Set-based bulk insert into clientes (etapa defaults to aguardando_contato) plus cliente_produtos, Supervisor-gated, ON CONFLICT DO NOTHING duplicate backstop"
  - "Integration test proving Supervisor-only write, IMP-09, and IMP-06 duplicate-skip behavior against the live RPC"
affects: [07-02, 07-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PL/pgSQL RETURNS TABLE(col_name, ...) can shadow a same-named table column as an implicit OUT variable — add '#variable_conflict use_column' as the function body's first line whenever a RETURNS TABLE column name also appears as a bare identifier elsewhere in the function (e.g. ON CONFLICT (col) targets)."
    - "Never chain two data-modifying CTEs in one WITH statement when the second one's RLS policy needs to re-scan (not CTE-reference) a table the first CTE just wrote to — the second CTE's plain table scan runs against the same command snapshot and won't see the first CTE's new rows. Split into two sequential set-based statements instead, passing ids across via plpgsql arrays."

key-files:
  created:
    - supabase/migrations/0004_importar_clientes_lote.sql
    - supabase/migrations/0005_fix_importar_clientes_lote_variable_conflict.sql
    - supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql
    - tests/importacao/rls-importar-lote.test.ts
  modified: []

key-decisions:
  - "importar_clientes_lote mirrors mover_card_funil exactly: language plpgsql, NOT security definer, no set search_path, explicit is_supervisor() guard before any DML — the existing clientes INSERT RLS policy is the row-level backstop, no new/changed RLS policy needed on clientes."
  - "etapa is never named in the RPC's INSERT column list — every imported cliente lands at the clientes.etapa DB default ('aguardando_contato'), so IMP-09 holds structurally, not by convention."
  - "Split the final implementation into two sequential set-based SQL statements (clientes insert, then cliente_produtos insert) instead of one combined multi-CTE statement, to work around a genuine Postgres CTE/RLS-visibility interaction — still zero row-by-row loops or per-row exception handling (Pitfall A5/A6 intact)."

patterns-established:
  - "Rule 1 bug fixes against an already-pushed migration are shipped as new migration files (0005, 0006), never edits to 0004 — per CLAUDE.md/Pitfall 11, confirmed live via 'supabase migration list' after each push."

requirements-completed: [IMP-01, IMP-06, IMP-09]

coverage:
  - id: D1
    description: "Supervisor calling importar_clientes_lote bulk-inserts every valid row in one set-based write, each landing at etapa='aguardando_contato' with its produtos in cliente_produtos"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-importar-lote.test.ts#Supervisor bulk-inserts rows at aguardando_contato with produtos populated"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every imported cliente starts at etapa 'aguardando_contato' via the clientes.etapa DB default, never set explicitly by the RPC"
    requirement: "IMP-09"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-importar-lote.test.ts#Supervisor bulk-inserts rows at aguardando_contato with produtos populated"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Vendedor calling importar_clientes_lote is rejected before any row is written — the write path is Supervisor-only"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-importar-lote.test.ts#Vendedor calling the RPC is rejected — no row is written"
        status: pass
    human_judgment: false
  - id: D4
    description: "A duplicate razão social already present in the base is skipped via ON CONFLICT DO NOTHING without aborting the rest of the batch"
    requirement: "IMP-06"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-importar-lote.test.ts#a duplicate razão social is skipped without blocking the rest of the batch"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-07-25
status: complete
---

# Phase 7 Plan 1: importar_clientes_lote RPC Summary

**Supervisor-only, set-based `importar_clientes_lote(p_clientes jsonb)` RPC live on the Supabase project — bulk-inserts clientes at `aguardando_contato` plus their produtos, with `ON CONFLICT DO NOTHING` as the duplicate backstop, proven by a 3-case integration test against the real RLS policies.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-07-25T01:48:24Z
- **Completed:** 2026-07-25T02:07:09Z
- **Tasks:** 3 (all `type="auto"`, Task 2 marked `[BLOCKING]`)
- **Files modified:** 4 (3 new migrations, 1 new test file)

## Accomplishments
- `importar_clientes_lote` RPC applied to the live Supabase project — the single write path of milestone v1.1, mirroring `mover_card_funil`'s non-security-definer, explicit-guard pattern exactly
- Set-based bulk insert into `clientes` (etapa always defaults to `aguardando_contato`) plus a correlated set-based insert into `cliente_produtos`, no row-by-row loop or per-row exception handling anywhere
- Integration test proving all three must-haves live: Supervisor bulk-insert + produtos, Vendedor rejected with zero writes, duplicate skipped without blocking the batch

## Task Commits

1. **Task 1: Write the importar_clientes_lote RPC migration (0004)** - `8adeff3` (feat)
2. **Task 2: [BLOCKING] Apply migration 0004 to the live Supabase project** - no commit (deployment-only action; migration file was already committed in Task 1). Verified via `supabase migration list` showing `0004` applied on remote.
3. **Task 3: Integration test for the importar_clientes_lote RPC** - `4613bca` (test)

**Bug-fix commit (Rule 1, discovered by Task 3's test run):** `370f956` (fix) — see Deviations below.

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/0004_importar_clientes_lote.sql` - the RPC as originally specified in the plan/ARCHITECTURE.md
- `supabase/migrations/0005_fix_importar_clientes_lote_variable_conflict.sql` - fixes a PL/pgSQL OUT-parameter/column-name ambiguity bug
- `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql` - fixes a Postgres CTE/RLS-visibility bug; this is the version now live
- `tests/importacao/rls-importar-lote.test.ts` - 3-case integration test against the live RPC (Supervisor success, Vendedor rejection, duplicate skip)

## Decisions Made
- Followed the plan's exact RPC shape (non-security-definer, explicit `is_supervisor()` guard, `etapa` never named in the INSERT) — no deviation on the architecture itself.
- Where the plan's literal single-CTE SQL body didn't work due to a genuine Postgres RLS-visibility interaction (see below), resolved it while preserving every explicit constraint from the plan: still set-based, still no loop, still `ON CONFLICT DO NOTHING`, still `etapa` never set explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PL/pgSQL variable/column-name ambiguity on `ON CONFLICT (razao_social)`**
- **Found during:** Task 3 (first test run against the live RPC)
- **Issue:** `RETURNS TABLE(razao_social text, id uuid, status text)` implicitly declares `razao_social` as a PL/pgSQL OUT-parameter variable, scoped to the whole function body. Postgres raised `column reference "razao_social" is ambiguous` (SQLSTATE 42702) on `on conflict (razao_social) do nothing` — one of PL/pgSQL's documented tricky cases for variable-vs-column resolution.
- **Fix:** Added `#variable_conflict use_column` as the function body's first line (official PL/pgSQL compiler pragma; safe here since the function never reads the OUT variables directly, only builds the result via `return query`).
- **Files modified:** `supabase/migrations/0005_fix_importar_clientes_lote_variable_conflict.sql` (new migration — 0004 was already applied to the live project, so per CLAUDE.md/Pitfall 11 it was never edited in place)
- **Verification:** `supabase db push` applied 0005; re-running the test surfaced the second bug below (not this one) — 0005's own fix confirmed correct by 0006 no longer failing on this error.
- **Committed in:** `370f956`

**2. [Rule 1 - Bug] Postgres CTE/RLS-visibility gap on the `cliente_produtos` insert**
- **Found during:** Task 3 (second test run, after 0005's fix)
- **Issue:** The original body chained the `clientes` INSERT and the `cliente_produtos` INSERT as two data-modifying CTEs inside one `WITH` statement. All CTEs in a single `WITH` statement share the same command snapshot; `cliente_produtos`' parent-EXISTS RLS policy plainly re-scans the real `clientes` table (not the `inseridos` CTE), so it could not see rows the first CTE had just written in the same statement — the RLS `WITH CHECK` always evaluated to false, raising `new row violates row-level security policy for table "cliente_produtos"` (SQLSTATE 42501).
- **Fix:** Split the function into two sequential, still fully set-based statements: the `clientes` INSERT runs first (its own statement, ids/razao_social captured into two plpgsql arrays via `array_agg`), then the `cliente_produtos` INSERT runs as a second statement (`unnest()` on those arrays rejoined to `p_clientes` by razão social). Once the first statement completes, its effects are normally visible to the second, so the RLS check passes for the caller's own newly-inserted rows. Zero row-by-row loops or per-row exception handling introduced (Pitfall A5/A6 constraint intact).
- **Files modified:** `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql` (new migration — 0004/0005 were already applied to the live project)
- **Verification:** `supabase db push` applied 0006; `npx vitest run tests/importacao/rls-importar-lote.test.ts` — all 8 tests (3 own + 5 inherited from the imported `rls-roles.test.ts`, matching the existing `rls-dedup-read.test.ts` pattern) pass.
- **Committed in:** `370f956`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — correctness bugs found by the plan's own integration test, neither changes the RPC's authorization model, duplicate-handling strategy, or `etapa`-default guarantee)
**Impact on plan:** Both fixes were necessary for the RPC to actually work; the live function today (migration 0006) satisfies every acceptance criterion and constraint stated in the plan. No scope creep — no new tables, no new RLS policies, no change to the feature's authorization boundary.

## Issues Encountered
- The worktree used for this execution did not have `.env.local` or a linked Supabase project (`supabase/.temp/`) checked out (both are gitignored, worktree-local). Copied `.env.local` from the main checkout (content never displayed/logged) and ran `npx supabase link --project-ref afbiwgbqkogsrhxjshkk` — the CLI's login session is global (per STATE.md's Phase 1 decision to use `supabase login` interactively rather than a stored token), so no new authentication was required.
- Running the full `npx vitest run` suite (all files) hits Supabase Auth's "Request rate limit reached" on sign-in when many test files sign in multiple seeded accounts concurrently — this is a pre-existing, already-documented environment characteristic (see `06-01-SUMMARY.md`'s "Issues Encountered"), not a regression from this plan. `tests/importacao/rls-importar-lote.test.ts` passes cleanly in isolation, which is the plan's actual verification command.

## User Setup Required
None - no external service configuration required. The Supabase project link (`npx supabase link --project-ref afbiwgbqkogsrhxjshkk`) was performed by the executor using the already-authenticated CLI session; no new secrets were created or requested.

## Next Phase Readiness
- The RPC is live and proven — 07-02 (Server Action `confirmarLoteImportacao`) can call `supabase.rpc('importar_clientes_lote', { p_clientes: [...] })` directly, per ARCHITECTURE.md's Import Flow.
- The RPC's returned shape (`{ razao_social, id, status }[]`, one row per actually-inserted cliente, skipped duplicates simply absent) is exactly what 07-02 needs to reconcile against its own D-02 revalidation pass and build the `puladas` breakdown for the summary screen (D-01).
- No blockers for 07-02/07-03.

---
*Phase: 07-importa-o-confirma-o-e-grava-o*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: supabase/migrations/0004_importar_clientes_lote.sql
- FOUND: supabase/migrations/0005_fix_importar_clientes_lote_variable_conflict.sql
- FOUND: supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql
- FOUND: tests/importacao/rls-importar-lote.test.ts
- FOUND commit: 8adeff3
- FOUND commit: 370f956
- FOUND commit: 4613bca
