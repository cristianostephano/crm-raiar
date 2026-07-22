---
phase: 05-exporta-o-de-clientes
verified: 2026-07-22T20:00:00Z
status: passed
score: 4/4 truths verified (roadmap success criteria); 0 gaps open (1 resolved post-verification)
behavior_unverified: 0
overrides_applied: 0
gaps: []
---

# Phase 5: Exportação de Clientes Verification Report

**Phase Goal:** Vendedor e Supervisor baixam como planilha a lista de clientes que já enxergam na tela, respeitando papel (próprios x todos) e os filtros aplicados.
**Verified:** 2026-07-22T20:00:00Z
**Status:** passed (see Resolution Note)
**Re-verification:** No — initial verification, gap fixed inline by coordinator immediately after

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Vendedor clica em "Exportar" e recebe arquivo contendo apenas os próprios clientes | ✓ VERIFIED | `getClientesParaExportacao` (lib/supabase/queries/clientes.ts:367-415) has zero manual `responsavel`/`is_supervisor()` branch — RLS alone scopes rows. Proven by `tests/clientes/rls-exportacao.test.ts` (9/9 pass): Vendedor A's select returns only own rows; passing a Vendedor B id in `ids` yields 0 rows for that id. Human-verified in browser per 05-02-SUMMARY.md (coordinator: "Vendedor vê 'Exportar meus clientes', download retorna 200, .xlsx correto"). |
| 2 | Supervisor clica em "Exportar" e recebe arquivo com clientes de todos os vendedores | ✓ VERIFIED | Same RLS-only function; `rls-exportacao.test.ts` proves Supervisor's select returns rows across both seeded vendedores. Human-verified: coordinator confirmed export "inclui os dois clientes de vendedores diferentes (Vendedor Teste A e Cristiano Vendedor)". |
| 3 | Quando há filtros aplicados na tela, o arquivo exportado contém somente os clientes filtrados | ✓ VERIFIED | `KanbanBoard.tsx` `handleExport` (line 362-401) computes `ids = collectExportIds(filteredGrouped)` — the already-filtered/searched/tab-narrowed set, never the raw `grouped` — confirmed by direct code read at line 367. `collectExportIds` (lib/clientes/export-ids.ts) unit-tested (3/3 pass): flattens in ETAPA_KEYS order, returns only a narrowed column's ids when `grouped` is narrowed, empty when all columns empty. Route Handler layers `.in("id", ids)` on top of RLS (never replacing it) at lib/supabase/queries/clientes.ts:378-380. |
| 4 | O arquivo abre corretamente (uma coluna por campo, uma linha por cliente) e nenhuma célula é interpretada como fórmula | ✓ VERIFIED | `buildClientesWorkbook` (lib/clientes/exportacao.ts) routes every string field through `cell()` → `sanitizeCell()` (one shared path, no per-column reimplementation, lines 56-74). `tests/clientes/exportacao.test.ts` (15/15 pass) round-trips the buffer through real `XLSX.read`/`sheet_to_json` and confirms: header row matches the exact D-02 17-column order; a leading `=`/`+` value comes back prefixed with a neutralizing apostrophe; nulls coalesce to `""` never `"null"`. Human-verified injection check per 05-02-SUMMARY (Task 3 checkpoint approved). |

**Score:** 4/4 roadmap success criteria verified. 1 additional code-quality gap found during the explicitly-requested regression checks (see Gaps Summary) — does not affect any of the 4 truths above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/supabase/queries/clientes.ts` — `getClientesParaExportacao` + `ClienteExportRow` | RLS-scoped export read, D-02 shape | ✓ VERIFIED | Present (lines 299-415), substantive (real Supabase query + mapping, no stub), wired (imported by route handler). |
| `lib/clientes/exportacao.ts` — `buildClientesWorkbook` + `sanitizeCell` | Dependency-free .xlsx builder w/ injection guard | ✓ VERIFIED | Present, substantive, wired (imported by route handler). No Supabase/next import — confirmed dependency-free per plan requirement. |
| `lib/clientes/export-ids.ts` — `collectExportIds` | Pure flattening helper for filtered ids | ✓ VERIFIED | Present, substantive, wired (imported by KanbanBoard.tsx line 44, called line 367). |
| `app/api/clientes/exportar/route.ts` | POST Route Handler, nodejs runtime | ✓ VERIFIED | Present, substantive (401/400/500 branches all real, not stubbed), wired (called by KanbanBoard's fetch). `runtime = "nodejs"` set (line 26). |
| `components/clientes/KanbanBoard.tsx` — Exportar button + `handleExport` | Scope-labeled button, POSTs filtered ids, triggers download | ✓ VERIFIED | Present, substantive (real fetch + blob + anchor-click download flow, error toast, in-flight guard), wired into the returned JSX (lines 580-594). |
| `tests/clientes/rls-exportacao.test.ts` | RLS negative-case tests | ✓ VERIFIED | 9/9 passing, asserts from role-restricted clients (Pitfall 2/10 compliant — service client used only for teardown). |
| `tests/clientes/exportacao.test.ts` | Unit tests for workbook builder | ✓ VERIFIED | 15/15 passing, round-trips through real XLSX parser. |
| `tests/clientes/export-ids.test.ts` | Unit tests for id-flattening helper | ✓ VERIFIED at runtime (3/3 pass via Vitest) / ✗ FAILS `tsc --noEmit` | See Gaps Summary — a type-cast in the test's own helper fails strict compilation. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `getClientesParaExportacao` | RLS on `clientes` | `is_supervisor() OR responsavel = auth.uid()` (migration 0002, lines 185/199) | ✓ WIRED | Grep confirms zero `is_supervisor`/`role ===` branches in the query function itself — only doc-comments referencing the RLS policy. This is the sole authorization boundary, exactly as the plan required. |
| `buildClientesWorkbook` | `sanitizeCell` | Every string cell routed through local `cell()` helper | ✓ WIRED | All 17 D-02 columns call `cell(...)` (lines 57-73) — no column bypasses it. |
| `KanbanBoard` Exportar button | `POST /api/clientes/exportar` | `fetch(..., { body: JSON.stringify({ ids: collectExportIds(filteredGrouped) }) })` | ✓ WIRED | Confirmed at KanbanBoard.tsx:367-373 — uses `filteredGrouped`, not `grouped`. |
| `POST /api/clientes/exportar` | `getClientesParaExportacao` → `buildClientesWorkbook` | Direct function calls, ids passed straight through (never an authz input) | ✓ WIRED | route.ts:62-63; RLS re-verified as the real boundary, `ids` is caller-controlled but non-revealing (T-05-03). |
| Route Handler | Auth guard | `supabase.auth.getUser()` → 401 if absent | ✓ WIRED | route.ts:29-37, since this route sits outside `app/(app)/layout.tsx`'s guard. |

### Data-Flow Trace (Level 4)

Not applicable in the traditional dashboard sense — this phase is a pure read→transform→download pipeline (no rendered dynamic list to trace). The full flow was traced end-to-end above: RLS-scoped DB read → workbook transform → HTTP attachment → client-side blob download, with no static/hardcoded fallback anywhere in the chain.

### Behavioral Spot-Checks / Automated Test Run

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RLS scoping (EXP-01/EXP-02) + D-03 etapa presence | `npx vitest run tests/clientes/rls-exportacao.test.ts` | 9/9 passed | ✓ PASS |
| Workbook build + formula-injection sanitization | `npx vitest run tests/clientes/exportacao.test.ts` | 15/15 passed | ✓ PASS |
| Filtered-set id flattening (EXP-03/D-05) | `npx vitest run tests/clientes/export-ids.test.ts` | 3/3 passed | ✓ PASS |
| Combined run (as requested by coordinator) | `npx vitest run tests/clientes/rls-exportacao.test.ts tests/clientes/exportacao.test.ts tests/clientes/export-ids.test.ts` | 3 files / 27 tests passed | ✓ PASS |
| Strict type-check (regression check) | `npx tsc --noEmit` (run twice, once after clearing incremental cache) | Exit code 2 — TS2352 in `tests/clientes/export-ids.test.ts:14` | ✗ FAIL |
| Production build (regression check) | `npm run build` | Compiled successfully, "Finished TypeScript" with no errors reported, all routes generated including `/api/clientes/exportar` | ✓ PASS |

Note the discrepancy between the two "regression check" commands: `npm run build` passes because Next.js's TypeScript pass only checks files reachable from the app's module graph, while bare `tsc --noEmit` checks every file matched by `tsconfig.json`'s `include` (which has no test-file exclusion) and catches the type error in the test-only helper. Both commands were run as literally requested; both results are reported rather than only the passing one.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| EXP-01 | 05-01, 05-02 | Vendedor exporta a lista dos próprios clientes | ✓ SATISFIED | RLS test + human-verified browser download. |
| EXP-02 | 05-01, 05-02 | Supervisor exporta a lista de todos os clientes | ✓ SATISFIED | RLS test + human-verified browser download. |
| EXP-03 | 05-01, 05-02 | Exportação respeita os filtros aplicados na tela | ✓ SATISFIED | `collectExportIds(filteredGrouped)` wiring + unit test + `.in("id", ids)` server-side narrowing. |

No orphaned requirements — REQUIREMENTS.md traceability table maps exactly EXP-01/02/03 to Phase 5, matching both plans' `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/clientes/export-ids.test.ts` | 14 | `Object.fromEntries(...) as ClientesAgrupadosPorEtapa` — TS2352, insufficiently-overlapping type cast | ⚠️ Warning (isolated to test code; does not affect shipped feature or `npm run build`) | Fails `npx tsc --noEmit`, one of the two explicitly-requested regression checks for this verification pass. Violates CLAUDE.md's "TypeScript estrito habilitado" convention (no unjustified unsafe cast). Trivial one-line fix. |

No debt markers (TBD/FIXME/XXX/TODO/HACK), no placeholder returns, no hardcoded-empty stubs, and no unreferenced role-branching found in any of the phase's created/modified files (`lib/supabase/queries/clientes.ts`, `lib/clientes/exportacao.ts`, `lib/clientes/export-ids.ts`, `app/api/clientes/exportar/route.ts`, `components/clientes/KanbanBoard.tsx`).

### Human Verification Required

None outstanding. The coordinator already completed the end-to-end browser verification specified in 05-02-PLAN.md Task 3 (role scope, filter reflection, malformed-body 400, headers) — documented and approved in 05-02-SUMMARY.md. This verification pass focused on the automated/source-level checks per the request and did not repeat that manual pass.

### Gaps Summary

**One gap, narrow in scope, does not affect the phase's functional goal:**

`tests/clientes/export-ids.test.ts` (introduced in commit `7ca42e4`, part of plan 05-02) fails `npx tsc --noEmit` with TS2352 at line 14. The test's `emptyGrouped()` helper builds a plain object via `Object.fromEntries` and casts it to `ClientesAgrupadosPorEtapa` with a single `as`, which TypeScript's strict compiler rejects because the source and target types don't structurally overlap enough to consider the cast safe (the compiler's own suggested fix is a double cast through `unknown`).

This does **not** affect:
- The actual exported feature (route handler, query, workbook builder, button) — all fully wired, type-checked cleanly on their own, and pass `npm run build`.
- Any of the phase's 4 roadmap success criteria — all verified above via passing behavioral tests plus prior human verification.
- Vitest test execution — the 3 tests in this file pass at runtime (esbuild transpiles without full type-checking, so the type error is invisible to `vitest run`).

It **does** affect:
- `npx tsc --noEmit`, one of the two regression commands this verification pass was explicitly asked to run — it exits non-zero.
- CLAUDE.md's strict-TypeScript convention ("TypeScript estrito habilitado, sem `any` sem justificativa em comentário") — this is an unjustified unsafe cast, not a documented exception.

**Recommended fix (one line):** change `tests/clientes/export-ids.test.ts:14` from
```ts
return Object.fromEntries(ETAPA_KEYS.map((key) => [key, []])) as ClientesAgrupadosPorEtapa
```
to
```ts
return Object.fromEntries(ETAPA_KEYS.map((key) => [key, []])) as unknown as ClientesAgrupadosPorEtapa
```
(or equivalently type the `fromEntries` call so its inferred type already matches). Re-run `npx tsc --noEmit` to confirm.

Given the fix is a single line in test-only code with zero risk to the shipped feature, this was flagged as `gaps_found` for auditability rather than as a blocker to the phase's actual delivered capability.

### Resolution Note (post-verification)

Fixed immediately by the coordinator, commit `3c02c43`: changed the cast to `as unknown as ClientesAgrupadosPorEtapa` exactly as recommended above. Re-ran `npx tsc --noEmit` (clean) and `npx vitest run tests/clientes/export-ids.test.ts` (3/3 passed). Status updated to `passed`.

---

_Verified: 2026-07-22T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
