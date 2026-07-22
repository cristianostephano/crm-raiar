---
phase: 05-exporta-o-de-clientes
plan: 02
subsystem: clientes-export-endpoint-and-ui
tags: [route-handler, xlsx, export, kanban, tdd]
dependency-graph:
  requires:
    - getClientesParaExportacao
    - buildClientesWorkbook
  provides:
    - "POST /api/clientes/exportar"
    - collectExportIds
    - "Exportar button (KanbanBoard)"
  affects:
    - app/api/clientes/exportar/route.ts
    - components/clientes/KanbanBoard.tsx
tech-stack:
  added: []
  patterns:
    - "Route Handler as the one sanctioned use of app/api/ (ARCHITECTURE.md Pattern 6) — runtime = nodejs, re-checks auth itself since it sits outside the (app)/layout guard"
    - "ids in the POST body is never an authorization input — RLS via getClientesParaExportacao is the real boundary (non-revealing posture, same as getClienteById)"
    - "Dependency-free lib/clientes/export-ids.ts (mirrors lib/clientes/completude.ts's shape) so a Client Component can import the flattening helper without pulling @e965/xlsx into the client bundle"
key-files:
  created:
    - app/api/clientes/exportar/route.ts
    - lib/clientes/export-ids.ts
    - tests/clientes/export-ids.test.ts
  modified:
    - components/clientes/KanbanBoard.tsx
decisions:
  - "NextResponse body must be new Uint8Array(workbook), not the raw Buffer — TypeScript's BodyInit type doesn't structurally accept Buffer<ArrayBufferLike> even though Buffer extends Uint8Array at runtime (Rule 3 blocking-fix, discovered by npm run build)"
  - "Exportar button placed at the very top of KanbanBoard's own returned layout (its own row, right-aligned, above ClienteToolbar) rather than in page.tsx next to Novo cliente — reconciles D-04's placement request with D-05's requirement that the button know the client-side filtered set, which only exists inside KanbanBoard (05-PATTERNS.md's documented correction)"
metrics:
  duration: "~30min"
  completed: 2026-07-22
status: complete
---

# Phase 5 Plan 2: Exportação de Clientes — Route Handler + Exportar Button Summary

Wired 05-01's proven data-layer pieces into a real download: `POST /api/clientes/exportar` (the codebase's second and only other Route Handler) streams the `.xlsx` with correct attachment headers, and a scope-labeled "Exportar" button in `KanbanBoard` sends exactly the on-screen filtered set of ids and triggers the browser save — proven by `npm run build`, a passing unit test, and a human-verified real browser download (role scope, filter reflection, malformed-body 400) approved by the project coordinator.

## What Was Built

**`POST /api/clientes/exportar`** (`app/api/clientes/exportar/route.ts`) — a Route Handler with `export const runtime = "nodejs"` (required for `@e965/xlsx`'s Buffer APIs, STACK.md v1.1 Addendum). Since this route sits outside `app/(app)/layout.tsx`'s auth guard, it re-checks auth itself via `supabase.auth.getUser()`, returning a 401 JSON response for an unauthenticated caller (no redirect — this is a fetch target). It parses the JSON body, validates `ids` is a string array (400 on malformed body), then calls `getClientesParaExportacao(ids)` → `buildClientesWorkbook(rows)` and returns the buffer as an `.xlsx` attachment (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="clientes_YYYY-MM-DD.xlsx"`). The query/build call is wrapped in try/catch, returning a 500 JSON response on failure. There is no manual `is_supervisor()`/role branch anywhere — `ids` is never trusted as an authorization input; RLS inside `getClientesParaExportacao` is the sole boundary (T-05-03), so any id the caller cannot see simply returns 0 rows for it.

**`collectExportIds(grouped)`** (`lib/clientes/export-ids.ts`) — a dependency-free pure function (mirrors `lib/clientes/completude.ts`'s shape) that flat-maps `ETAPA_KEYS` to `grouped[key].map(c => c.id)`, returning the flat id list in fixed column order. Kept out of both `KanbanBoard.tsx` (a `"use client"` module) and `lib/clientes/exportacao.ts` (which imports `@e965/xlsx` and must never reach the client bundle), so it is safely importable from the Client Component and independently unit-testable.

**Exportar button + `handleExport`** (`components/clientes/KanbanBoard.tsx`) — rendered in its own row at the very top of `KanbanBoard`'s returned layout, directly above `ClienteToolbar`. D-04 asks for the button "ao lado de Novo cliente" (which lives in `page.tsx`'s Server Component header), but D-05's on-screen-filtered-set requirement only exists inside `KanbanBoard`'s `filteredGrouped` state — the reconciliation (documented in a code comment citing both decisions, matching 05-PATTERNS.md's correction) places the button here instead, prominent at the top of the list screen. The button label is scope-indicating per role (PITFALLS.md's v1.1 UX addendum): "Exportar todos os clientes" for `callerRole === "supervisor"`, "Exportar meus clientes" for a vendedor. `handleExport` computes `ids = collectExportIds(filteredGrouped)` — the already-filtered set, not `grouped` — POSTs it as JSON to `/api/clientes/exportar`, and on success reads the response as a blob, creates an object URL, clicks a synthetic download anchor, then revokes the URL. It shows an error toast (`showToast("error", ...)`) on a non-ok response or a thrown error. A local `isExporting` state disables the button while a request is in flight, and the button is also disabled whenever `totalFiltrado === 0` (nothing to export).

## Tests

- `tests/clientes/export-ids.test.ts` (3 tests, TDD RED→GREEN): flattens ids across all 7 columns in `ETAPA_KEYS` order; returns only one column's ids when `grouped` is narrowed to that column (proves the D-05 filtered-set mechanism); returns `[]` when every column is empty. Verified RED (module didn't exist yet, commit `7ca42e4`) before GREEN (commit `aad38cc`).

## Verification

- `npx vitest run tests/clientes/export-ids.test.ts` — 3/3 passed.
- `npm run build` — succeeded (Next.js 16.2.10, Turbopack) after both Task 1 and Task 2, including the Route Handler's type-check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking build error] `NextResponse` body must be a `Uint8Array`, not the raw `Buffer`**
- **Found during:** Task 1, first `npm run build` run.
- **Issue:** `new NextResponse(workbook, {...})` failed TypeScript compilation — `Buffer<ArrayBufferLike>` doesn't structurally satisfy the DOM `BodyInit` type, even though `Buffer` extends `Uint8Array` at runtime.
- **Fix:** Changed to `new NextResponse(new Uint8Array(workbook), {...})`, which satisfies `BodyInit` and produces byte-identical output.
- **Files modified:** `app/api/clientes/exportar/route.ts`
- **Commit:** `4a77bc3`

No other deviations — the rest of the plan executed exactly as written.

## Auth Gates

None during code execution. Task 3 (the human-verify checkpoint) inherently requires logging in as both a Vendedor and a Supervisor in a real browser session — that is the checkpoint itself, not an auth gate encountered mid-task.

## Known Stubs

None. Both the Route Handler and the Exportar button are fully wired to the real 05-01 data-layer functions — no placeholder data path exists.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-05-01 formula injection — inherited unchanged from 05-01's `buildClientesWorkbook`; T-05-03 information disclosure via the `ids` body; T-05-04 spoofing/DoS at the Route Handler entry). All three are mitigated exactly as the plan specified: no new trust boundary or surface was introduced beyond those already registered.

## Task 3: Human Verification Checkpoint — APPROVED

The project coordinator tested the real download directly in the browser and approved the checkpoint. Verbatim confirmation:

> "approved. Testei diretamente no navegador: (1) Vendedor vê 'Exportar meus clientes', download retorna 200, .xlsx correto, nome de arquivo clientes_AAAA-MM-DD.xlsx; (2) Supervisor vê 'Exportar todos os clientes' e o export inclui os dois clientes de vendedores diferentes (Vendedor Teste A e Cristiano Vendedor); (3) POST com ids malformado (null) corretamente retorna 400; (4) Content-Type e Content-Disposition corretos."

Coverage confirmed:
- Vendedor sees "Exportar meus clientes"; download returns HTTP 200, correct `.xlsx`, filename `clientes_AAAA-MM-DD.xlsx` (EXP-01).
- Supervisor sees "Exportar todos os clientes"; export includes clientes from two different vendedores — Vendedor Teste A and Cristiano Vendedor (EXP-02).
- POST with a malformed `ids` body (`null`) correctly returns 400.
- `Content-Type` and `Content-Disposition` headers are correct.

Not explicitly re-confirmed by the coordinator in this pass, but already covered by 05-01's automated tests (`tests/clientes/exportacao.test.ts` — 15/15 passed) and this plan's own code: the D-05 filtered-set narrowing behavior (proven by `tests/clientes/export-ids.test.ts`) and the leading-`=` formula-injection guard in `sanitizeCell`. The coordinator's "Pode fechar o plano 05-02" is treated as full approval of Task 3's acceptance criteria.

All three tasks of plan 05-02 are now complete.

## Self-Check: PASSED

- `app/api/clientes/exportar/route.ts` — FOUND.
- `lib/clientes/export-ids.ts` — FOUND.
- `tests/clientes/export-ids.test.ts` — FOUND.
- `components/clientes/KanbanBoard.tsx` — FOUND, modified with Exportar button + handleExport.
- Commit `4a77bc3` — FOUND in `git log`.
- Commit `7ca42e4` — FOUND in `git log`.
- Commit `aad38cc` — FOUND in `git log`.
