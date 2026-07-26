---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rpc, ibge, migration]

# Dependency graph
requires: []
provides:
  - "cidades table (IBGE municipality reference data, read-only, RLS enabled, SELECT-only for authenticated, zero write policy)"
  - "cidades_por_estado(p_uf text) RPC, SECURITY INVOKER by omission"
  - "chk_estado_valido CHECK constraint on clientes.estado (27 UF codes, NOT VALID, genuinely best-effort VALIDATE)"
  - "scripts/gerar-seed-cidades.ts, versioned offline IBGE seed generator"
affects: [09-02, 09-03, 09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only reference table (RLS enabled, SELECT-only, zero write policy) mirroring historico's posture, not the Supervisor-CRUD categorias/produtos_consumidos pattern"
    - "NOT VALID CHECK constraint + best-effort VALIDATE CONSTRAINT wrapped in a DO $$ ... EXCEPTION WHEN check_violation ... $$ block, so a stray legacy row cannot abort the whole supabase db push transaction"
    - "One-time offline seed-generation script (scripts/gerar-seed-cidades.ts) versioned in the repo but never invoked at app runtime"

key-files:
  created:
    - scripts/gerar-seed-cidades.ts
    - supabase/migrations/0007_cidades_e_estado_valido.sql
    - tests/clientes/cidades-por-estado.test.ts
    - tests/clientes/estado-constraint.test.ts
  modified: []

key-decisions:
  - "D-01 (CONTEXT.md): backfill normalization is simple exact/case-insensitive matching only, no fuzzy match — current clientes are all test data the owner will delete"
  - "chk_estado_valido's final VALIDATE CONSTRAINT step must be wrapped in DO $$ ... EXCEPTION WHEN check_violation ... $$ to be genuinely best-effort — an unconditional VALIDATE CONSTRAINT would abort the entire supabase db push transaction if any legacy row (found: a real estado='ZZ' test row) doesn't match after backfill. Found by human review during the Task 2 checkpoint, before push."
  - "cidades_por_estado is SECURITY INVOKER by omission (never security definer), matching 0003_dashboard_aggregates.sql's project-wide convention"

patterns-established:
  - "Read-only seed reference table: enable RLS, add exactly one SELECT-for-authenticated policy, add zero write policies (Postgres RLS default-deny blocks all writes via API)"
  - "NOT VALID -> backfill -> DO/EXCEPTION-wrapped best-effort VALIDATE CONSTRAINT sequence for adding a hard constraint against a column with known-inconsistent legacy data"

requirements-completed: [LOC-01, LOC-02, LOC-04]

coverage:
  - id: D1
    description: "cidades table exists in the hosted Supabase project, RLS enabled, SELECT-only for authenticated, zero write policy, seeded with the full IBGE municipality list"
    requirement: "LOC-02"
    verification:
      - kind: integration
        ref: "tests/clientes/cidades-por-estado.test.ts#cidades seed completeness (LOC-02) > cidades table has at least 5000 rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "cidades_por_estado(p_uf) RPC returns only the requested UF's municipalities, sorted by nome, SECURITY INVOKER (never security definer)"
    requirement: "LOC-02"
    verification:
      - kind: integration
        ref: "tests/clientes/cidades-por-estado.test.ts#cidades_por_estado RPC (LOC-02) > returns only São Paulo municipalities, all with a string nome, ordered by nome asc"
        status: pass
    human_judgment: false
  - id: D3
    description: "chk_estado_valido rejects any clientes.estado value outside the 27 UF codes on new writes"
    requirement: "LOC-01"
    verification:
      - kind: integration
        ref: "tests/clientes/estado-constraint.test.ts#chk_estado_valido rejects an invalid UF (LOC-01) > direct INSERT with estado='ZZ' is rejected with a CHECK violation and creates no row"
        status: pass
    human_judgment: false
  - id: D4
    description: "chk_estado_valido does not block reads/writes of clientes with a valid estado (positive control, LOC-04's 'don't block access' discretion note)"
    requirement: "LOC-04"
    verification:
      - kind: integration
        ref: "tests/clientes/estado-constraint.test.ts#chk_estado_valido does not block access to valid clientes (LOC-04 positive control) > direct INSERT with estado='SP' succeeds and the row remains readable"
        status: pass
    human_judgment: false
  - id: D5
    description: "Migration 0007 applied to the live hosted Supabase project via supabase db push, with prior human review/approval of the SQL"
    requirement: "LOC-01, LOC-02, LOC-04"
    verification:
      - kind: manual_procedural
        ref: "Coordinator reviewed the migration SQL at the Task 2 checkpoint, found and required a fix (DO/EXCEPTION wrap on VALIDATE CONSTRAINT), then approved; supabase db push completed with 'Finished supabase db push.' and the expected RAISE NOTICE"
        status: pass
    human_judgment: true
    rationale: "Deploying to the live production Supabase project requires an explicit human approval gate per CLAUDE.md ('não fazer deploy direto em produção sem passar por uma etapa de revisão'); this is a one-time deploy action, not something a future automated re-run would need to re-verify."

duration: ~50min (active work; paused mid-plan awaiting human checkpoint approval)
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 1: Cidades (IBGE) + Estado Valido Summary

**cidades reference table (IBGE-seeded, read-only, ~5,571 municipalities) + cidades_por_estado(p_uf) RPC + chk_estado_valido CHECK constraint on clientes.estado, applied to the live Supabase project via a human-reviewed migration**

## Performance

- **Duration:** ~50 min active work (session paused for a human-verify checkpoint between Task 1 and Task 3)
- **Started:** 2026-07-26 (session start)
- **Completed:** 2026-07-26T21:41:21Z
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint:human-verify, Task 3 auto/blocking)
- **Files modified:** 4 created (scripts/gerar-seed-cidades.ts, supabase/migrations/0007_cidades_e_estado_valido.sql, tests/clientes/cidades-por-estado.test.ts, tests/clientes/estado-constraint.test.ts)

## Accomplishments
- Wrote `scripts/gerar-seed-cidades.ts`, a one-time offline generator that fetches IBGE's official `servicodados.ibge.gov.br/api/v1/localidades/municipios` API, extracts `nome`/UF `sigla` (with a fallback path for the one record IBGE returns with `microrregiao: null`), sorts by (uf, nome), and escapes apostrophes for safe SQL literals — never called at app runtime
- Wrote and applied `supabase/migrations/0007_cidades_e_estado_valido.sql`: `cidades` table (RLS, SELECT-only for `authenticated`, zero write policy — mirrors `historico`'s posture, not the Supervisor-CRUD lookup tables), `cidades_por_estado(p_uf)` RPC (SECURITY INVOKER by omission), a D-01 simple-normalization backfill of `clientes.estado`, and `chk_estado_valido` (NOT VALID, with a genuinely best-effort `VALIDATE CONSTRAINT` wrapped in a `DO $$ ... EXCEPTION WHEN check_violation ... $$` block)
- Seeded ~5,571 Brazilian municipalities via a single generated `INSERT` (chunked into 6 statements of up to 1000 rows each for readability)
- Wrote two integration test files exercising the RPC, the seed row count, and the constraint's reject/positive-control behavior against the real hosted Supabase project — confirmed RED before the push, GREEN after
- Ran `supabase db push` against the live project after explicit human approval; confirmed via a `RAISE NOTICE` that the constraint correctly stayed NOT VALID for a pre-existing test row (`estado='ZZ'`) without aborting the migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Gerar script do seed IBGE + migration 0007 + testes de integração (RED)** - `56b72a1` (feat)
2. **Fix (found at Task 2 checkpoint): make chk_estado_valido VALIDATE CONSTRAINT genuinely best-effort** - `3970ada` (fix)
3. **Task 3: supabase db push + integration tests GREEN** - no new file changes (migration applied to the remote project only; no local diff to commit beyond what Task 1/fix already committed)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified
- `scripts/gerar-seed-cidades.ts` - one-time offline IBGE municipality seed generator, versioned but not app runtime code
- `supabase/migrations/0007_cidades_e_estado_valido.sql` - cidades table + RLS + index, cidades_por_estado RPC, clientes.estado backfill, chk_estado_valido constraint (NOT VALID + best-effort VALIDATE), ~5,571-row IBGE seed
- `tests/clientes/cidades-por-estado.test.ts` - RPC + seed row-count integration tests
- `tests/clientes/estado-constraint.test.ts` - constraint reject + positive-control integration tests
- `.env.local` (worktree-local only, gitignored, not committed) - copied from the main checkout so tests in this isolated worktree could authenticate against the same live Supabase project

## Decisions Made
- Followed D-01 (CONTEXT.md) exactly: backfill normalization is simple exact/case-insensitive full-name-to-UF mapping only, no fuzzy matching, since current `clientes` rows are all test data the owner plans to delete
- `cidades_por_estado` kept SECURITY INVOKER by omission (never `security definer`), matching `0003_dashboard_aggregates.sql`'s explicit project-wide convention, even though `cidades`'s RLS is already read-open (defense-in-depth/consistency, not a functional requirement)
- Real bug found and fixed during the Task 2 human-review checkpoint (see Deviations below) before any push occurred — no production risk, since the coordinator caught it pre-deploy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed the IBGE seed generator to handle a record with a null `microrregiao`**
- **Found during:** Task 1, part (A) — first run of `scripts/gerar-seed-cidades.ts` against the live IBGE API
- **Issue:** One municipality out of 5,571 ("Boa Esperança do Norte", MT) returns `microrregiao: null` from IBGE's API, crashing the naive `item.microrregiao.mesorregiao.UF.sigla` access path with a TypeError
- **Fix:** Added a fallback extraction path reading `item["regiao-imediata"]["regiao-intermediaria"].UF.sigla` when `microrregiao` is null, with an explicit error if neither path resolves a UF
- **Files modified:** `scripts/gerar-seed-cidades.ts`
- **Verification:** Re-ran the script; all 5,571 municipalities extracted successfully, seed row count confirmed
- **Committed in:** `56b72a1` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `chk_estado_valido`'s final `VALIDATE CONSTRAINT` step to be genuinely best-effort**
- **Found during:** Task 2 checkpoint — the human coordinator independently queried the live `clientes` table and found a real `estado='ZZ'` test row that the backfill's full-name-to-UF mapping cannot and should not resolve (it isn't a state name, just invalid test data per D-01)
- **Issue:** The originally-written migration's last statement, a plain `alter table clientes validate constraint chk_estado_valido;`, is NOT actually best-effort despite its own comment saying so — Postgres raises `check_violation` and aborts the entire migration transaction on `supabase db push` if any row still violates the check after the backfill
- **Fix:** Wrapped the `VALIDATE CONSTRAINT` statement in a `DO $$ begin ... exception when check_violation then raise notice ... end; $$;` block, so a failure just emits a `RAISE NOTICE` and leaves the constraint `NOT VALID` (still fully enforced on all new inserts/updates) instead of aborting the push. Did NOT special-case `'ZZ'` in the backfill mapping, per D-01 and the coordinator's explicit instruction — it's disposable test data
- **Files modified:** `supabase/migrations/0007_cidades_e_estado_valido.sql`
- **Verification:** `supabase db push` completed successfully with the expected `RAISE NOTICE (00000): chk_estado_valido permanece NOT VALID: ...` in the CLI output, confirming the constraint stayed NOT VALID without aborting the migration; re-ran RED integration tests before the push (unaffected, still failing for the right reason), then GREEN after the push
- **Committed in:** `3970ada`

---

**Total deviations:** 2 auto-fixed (1 blocking — Rule 3, 1 bug — Rule 1, the second found via human checkpoint review before any production impact)
**Impact on plan:** Both fixes were necessary for the migration to actually apply successfully; no scope creep — no fuzzy matching or new special-casing was added, consistent with D-01.

## Issues Encountered
- This worktree had no `.env.local` (untracked/gitignored files aren't shared across git worktrees) — copied it from the main checkout so the integration tests could run against the same live hosted Supabase project. Not committed (gitignored).
- Running the broader test suite (`tests/clientes tests/importacao`) hit the project's already-known Supabase Auth `signInWithPassword` rate limit (documented in STATE.md's Blockers/Concerns) on unrelated pre-existing tests — not caused by this plan's changes; this plan's own two test files ran and passed cleanly (9/9) when scoped directly.

## User Setup Required
None - no external service configuration required. The IBGE API was only used once, offline, at migration-authoring time; the deployed app makes zero calls to it.

## Next Phase Readiness
- `cidades` table + `cidades_por_estado` RPC + `chk_estado_valido` constraint are live in the hosted Supabase project — plans 09-02 through 09-06 (frontend UFS constant, Combobox, cadastro/edição forms, filtro, importação) can now build against this real backend, no further schema work needed for this phase.
- No blockers. The `estado='ZZ'` test row remains in the live `clientes` table with the constraint marked `NOT VALID` for retroactive validation only (still enforced on new writes) — expected to disappear once the owner deletes the test data (D-01), at which point a future maintenance step could re-run `VALIDATE CONSTRAINT` to fully validate it, though this is not required for correctness.

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*

## Self-Check: PASSED

All created files confirmed present on disk (`scripts/gerar-seed-cidades.ts`, `supabase/migrations/0007_cidades_e_estado_valido.sql`, `tests/clientes/cidades-por-estado.test.ts`, `tests/clientes/estado-constraint.test.ts`, this SUMMARY.md). Both task commits (`56b72a1`, `3970ada`) confirmed present in `git log --oneline --all`.
