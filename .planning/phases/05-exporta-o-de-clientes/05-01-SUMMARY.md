---
phase: 05-exporta-o-de-clientes
plan: 01
subsystem: clientes-export-data-layer
tags: [supabase, rls, xlsx, export, data-layer]
dependency-graph:
  requires: []
  provides:
    - getClientesParaExportacao
    - ClienteExportRow
    - buildClientesWorkbook
    - sanitizeCell
  affects:
    - lib/supabase/queries/clientes.ts
    - lib/clientes/exportacao.ts
tech-stack:
  added:
    - "@e965/xlsx@0.20.3 (SheetJS Community Edition mirror, human-approved)"
  patterns:
    - "RLS-only authorization for reads (no manual is_supervisor() branch), matching every other reader in lib/supabase/queries/clientes.ts"
    - "Dependency-free transform module (lib/clientes/exportacao.ts) mirroring lib/clientes/completude.ts's shape, safe for both server and future client import"
key-files:
  created:
    - lib/clientes/exportacao.ts
    - tests/clientes/rls-exportacao.test.ts
    - tests/clientes/exportacao.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - package.json
    - package-lock.json
decisions:
  - "@e965/xlsx approved via human legitimacy checkpoint (npm registry cross-check: 0.20.3, 752,961 weekly downloads, SheetJS mirror, no CVEs) before install"
  - "getClientesParaExportacao has zero id-field in ClienteExportRow — output rows carry only the D-02 export columns, not an internal id, per the plan's literal field list"
metrics:
  duration: "~35min"
  completed: 2026-07-22
status: complete
---

# Phase 5 Plan 1: Exportação de Clientes — Data Layer Summary

Built the RLS-scoped export read (`getClientesParaExportacao`) and the dependency-free `.xlsx` workbook builder (`buildClientesWorkbook` + `sanitizeCell`) that plan 05-02's Route Handler will wire into a download endpoint — both proven by passing automated tests before any HTTP/UI code exists.

## What Was Built

**`getClientesParaExportacao(ids?: string[] | null)`** (`lib/supabase/queries/clientes.ts`) — an async reader returning `ClienteExportRow[]`, modeled directly on `getClienteById` + `getClientesAgrupadosPorEtapa` (the 8th instance of the "one RLS-scoped read shaped for a specific screen need" pattern in this file). RLS on `clientes` (`is_supervisor() OR responsavel = auth.uid()`, from migration 0002) is the sole authorization boundary — there is no manual `responsavel` filter or `is_supervisor()` branch anywhere in the function. When `ids` is a non-empty array, an additional `.in("id", ids)` narrows an already-RLS-scoped result (D-05's mechanism for EXP-03); when `ids` is null/undefined/empty, every RLS-visible row comes back. `ClienteExportRow` carries the full D-02 shape (razão social, endereço breakdown, categoria/produtos names, contato/telefone/email, número de lojas, responsável name, and the funil fields etapa/statusAcompanhamento/observação) with `etapa`/`statusAcompanhamento` left as raw enum values — presentation labels are `buildClientesWorkbook`'s job.

**`buildClientesWorkbook(rows: ClienteExportRow[])`** and **`sanitizeCell(value: string)`** (`lib/clientes/exportacao.ts`) — a dependency-free transform module (no Supabase import, no `"use server"`/`"use client"` directive) that turns already-fetched rows into a `.xlsx` `Buffer` via `@e965/xlsx`'s `json_to_sheet`/`book_new`/`write`. Column order/labels match D-02 exactly (Razão Social → Observação, 17 columns), `etapa`/`statusAcompanhamento` are resolved to their pt-BR labels (from `lib/funil/etapas.ts`'s `ETAPAS` and a local status-label record), `produtos` are joined with `", "`, and every nullable field coalesces to an empty cell — never the string `"null"`. Every string cell passes through `sanitizeCell`, which prefixes a leading single quote onto any value whose first character is `=`, `+`, `-`, `@`, tab, or carriage return (Pitfall A4 / T-05-01), applied through one shared `cell()` helper so a future new column can never silently reopen the formula-injection hole.

**`@e965/xlsx@0.20.3`** was installed after an explicit human legitimacy checkpoint. I independently queried the live npm registry (not just the plan's pre-written claims) and confirmed: latest version `0.20.3` (published 2024-07-19), maintainer `e965 <rulaitisk@gmail.com>`, author `sheetjs`, Apache-2.0 license, homepage `sheetjs.com`, 752,961 weekly downloads, tarball served from `registry.npmjs.org`, ships its own TypeScript types — and confirmed we are NOT installing the plain, CVE-carrying `xlsx` npm package. The project owner replied "approved" before the install ran.

## Tests

- `tests/clientes/rls-exportacao.test.ts` (4 new tests, plus 5 re-registered from the imported `SEED_ACCOUNTS` module — same pattern as `rls-clientes.test.ts`): asserts the RLS behavior directly against the same `clientes` SELECT + `.in("id", ids)` shape `getClientesParaExportacao` uses, signed in as each seeded role. `getClientesParaExportacao` itself can't be invoked from Vitest (its `createClient()` call needs a live Next.js request scope — same constraint recorded for `createCliente` in 02-02). Covers: Vendedor A's select returns only Vendedor A's own clientes (with a non-null `etapa` on every row, D-03); passing a Vendedor B id in the `ids` array returns 0 rows for it while Vendedor A's ids still come back; Supervisor's select returns clientes across all vendedores; `ids` narrows an already-RLS-scoped result to exactly those ids.
- `tests/clientes/exportacao.test.ts` (15 tests): `sanitizeCell` neutralizes each of `=`, `+`, `-`, `@`, tab, and CR leading characters and leaves normal strings untouched; `buildClientesWorkbook` output, read back via `XLSX.read`/`sheet_to_json`, has a header row matching the exact D-02 column list and order; etapa/status resolve to pt-BR labels; produtos join with `", "` (empty list → blank cell); every nullable field coalesces to `""`, never `"null"`; an `observacao` starting with `=` round-trips with the neutralizing leading apostrophe intact; a `telefone` starting with `+` is likewise neutralized; multiple input rows produce one output row each, in order.

Both test files pass cleanly in isolation. Running the entire `tests/clientes/` directory at once trips this Supabase project's real hosted auth rate limit (`signInWithPassword` "Request rate limit reached" — the same free-tier constraint already documented in STATE.md's Blockers/Concerns for 01-05) once enough `signInAs()` calls stack up across files in one process; this is a pre-existing environmental constraint, not a defect introduced by this plan.

## Verification

- `npx vitest run tests/clientes/rls-exportacao.test.ts` — 9/9 passed (4 new + 5 re-registered from the imported module).
- `npx vitest run tests/clientes/exportacao.test.ts` — 15/15 passed.
- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — succeeded (Next.js 16.2.10, Turbopack).
- `package.json` lists `@e965/xlsx` at `^0.20.3`; grep confirms no plain `xlsx` or `papaparse` entry.

## Deviations from Plan

None — plan executed exactly as written, including the blocking human legitimacy checkpoint before install.

## Auth Gates

None — Task 1's checkpoint was a package-legitimacy gate (`gate="blocking-human"`), not an authentication gate. It was handled per the plan: findings presented, execution paused, and the coordinator replied "approved" before `npm install @e965/xlsx` ran in Task 3.

## Known Stubs

None. Both `getClientesParaExportacao` and `buildClientesWorkbook`/`sanitizeCell` are fully wired, real implementations — no placeholder data paths. Neither is yet called from any Route Handler or UI button; that wiring is plan 05-02's explicit scope, not a stub in this plan (05-01's own objective is exactly "build the two pure, independently-testable pieces," not the endpoint).

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-05-01 formula injection, T-05-02 RLS-scoping, T-05-SC package-legitimacy) — no new trust boundary or surface was introduced beyond those three.

## Self-Check: PASSED

- `lib/supabase/queries/clientes.ts` — FOUND, modified with `ClienteExportRow`/`getClientesParaExportacao`.
- `lib/clientes/exportacao.ts` — FOUND.
- `tests/clientes/rls-exportacao.test.ts` — FOUND.
- `tests/clientes/exportacao.test.ts` — FOUND.
- Commit `481f9c4` — FOUND in `git log`.
- Commit `91ed439` — FOUND in `git log`.
