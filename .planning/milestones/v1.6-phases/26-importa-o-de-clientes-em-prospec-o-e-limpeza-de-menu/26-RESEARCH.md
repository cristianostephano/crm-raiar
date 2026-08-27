# Phase 26: Importação de Clientes em Prospecção e Limpeza de Menu - Research

**Researched:** 2026-08-26
**Domain:** Extension of an existing Next.js 16 + Supabase CRM — relaxing/renaming an existing bulk-import flow's required-field vocabulary, plus full removal of two now-redundant menu items and their entire code/route/test surface
**Confidence:** HIGH (entirely first-party codebase research — every claim below is grounded in a specific file/line read this session; no external sources needed)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROSP-01 | "Importar clientes" renomeada para "Importar Clientes em Prospecção" no menu | `components/layout/AppSidebar.tsx` label/route confirmed (single-line label change); `AppSidebar.test.tsx` assertions using the string "Importar clientes" must be updated to match |
| PROSP-02 | Planilha de prospecção exige só Nome Fantasia + Responsável; razão social e demais campos ficam opcionais | Exact before/after required-ness table below; concrete file list (`lib/importacao/types.ts`, `lib/validations/importacao.ts`, `lib/importacao/annotarLinha.ts`, `lib/importacao/dedupe.ts`); two previously-unflagged runtime bugs found (ON CONFLICT collision on empty-string razão social; `normalizeRazaoSocial(null)` crash) |
| PROSP-03 | Cliente importado por essa planilha entra na primeira etapa do funil ("Aguardando contato"), como já acontece hoje | No code change needed — confirmed `importar_clientes_lote`'s INSERT never sets `etapa`/`status_acompanhamento`, relying on column defaults (`aguardando_contato`/`em_andamento`); untouched by this phase |
| MENU-01 | "Importar CNPJ" é removida do sistema por completo (código, rota, testes) | Full deletion inventory below — 15 files, zero Playwright E2E spec exists today (correction of milestone-level assumption) |
| MENU-02 | "Importar frequências" é removida do sistema por completo (código, rota, testes) | Full deletion inventory below — 16 files, including 1 Playwright spec + 2 shared-fixture test files needing repair, not deletion |
</phase_requirements>

## Summary

This phase is two independent, low-schema-risk changes bundled together because the milestone frames the second as validated-by-the-first: (1) relax and rename the ORIGINAL "Importar clientes" wizard's required-field vocabulary — a targeted edit to `lib/importacao/types.ts`'s existing `SYSTEM_FIELDS` array plus three follow-on files, no new import flow, no new migration — and (2) delete two now-redundant bulk-import wizards ("Importar CNPJ", "Importar frequências") end-to-end: routes, lib modules, Server Actions, components, and every test file that references them.

The milestone-level research (`research/PITFALLS.md` Pitfall 4) worried that prospecção and the new "Importar Clientes Ativos" flow (Phase 25) would need a shared multi-profile required-ness abstraction over `SYSTEM_FIELDS`. That risk is now **moot**: Phase 25 already forked a fully separate `lib/importacao/typesAtivo.ts` (`SYSTEM_FIELDS_ATIVO`, its own array, explicitly never touching `SYSTEM_FIELDS`) as a documented "fourth vocabulary" with a comment explicitly closing this exact risk. `SYSTEM_FIELDS` in `types.ts` is, after Phase 25, used **only** by the original/prospecção flow — so Phase 26 can edit it directly with no profile abstraction needed. This is the single most important scoping simplification this research found relative to the milestone-level guess.

However, direct code reading surfaced two concrete, previously-unflagged runtime bugs that a naive implementation of PROSP-02 will trigger, both grounded in exact file/line evidence (not the milestone research's more abstract "NULL never conflicts" framing):
1. **`annotarLinha.ts` resolves a blank razão social to `""` (empty string), never `null`.** Since Postgres treats two empty strings as a genuine unique-constraint conflict (unlike two `NULL`s), the *first* prospecção row with blank razão social inserts fine, but *every subsequent* blank-razão-social row across the whole system's lifetime collides on `ON CONFLICT (razao_social) DO NOTHING` and gets silently dropped as a false "duplicado" — the opposite failure mode from what the milestone research assumed, and one that defeats PROSP-02's entire purpose (many prospects with no razão social yet) after the very first import.
2. **`normalizeRazaoSocial()` will crash on `null`.** `app/actions/importacao.ts`'s `existentes`/`existentesRazaoSocial` arrays are built via `row.razao_social as string` — an unchecked TypeScript cast over a column that has been DB-nullable since migration `0024` (Phase 23). The moment any client in the table has a genuinely `NULL` razão social, the next import's dedup pass calls `normalizeRazaoSocial(null)` → `null.normalize("NFD")` → `TypeError`, crashing the entire validation/confirm Server Action for every future import, not just the one touching that client. Fixing bug 1 (never storing `NULL`, only sanitized empty string) sidesteps this specific crash for prospecção-inserted rows, but the cast itself remains a latent landmine that should be hardened.

Menu cleanup (MENU-01/02) is broader than "delete two files" and broader than the milestone research anticipated. Live grep of the actual codebase (not assumption) found: **zero** Playwright E2E spec exists for `/clientes/importar-cnpj` today (only `AppSidebar.test.tsx` references that route — the milestone research's PITFALLS.md incorrectly implied a `importar-cnpj-guard.spec.ts` sibling would need deletion; it does not exist), while `/clientes/importar-frequencias` *does* have one (`tests/e2e/importar-frequencias-guard.spec.ts`). A **third test layer** beyond the two the milestone research named (AppSidebar DOM tests + Playwright E2E) was found: two live-database RLS integration tests (`tests/importacao/rls-cnpj-lote.test.ts`, `tests/importacao/rls-frequencia-lote.test.ts`) that directly exercise the `atualizar_cnpj_lote`/`atualizar_frequencia_visita_lote` RPCs. And most importantly: **two generic-infrastructure test files will break on deletion, not because they test the CNPJ/frequência flows, but because they borrow `SYSTEM_FIELDS_FREQUENCIA` purely as a "smaller alternate vocabulary" fixture to test the *shared* mapping/`ColumnMappingTable` machinery** (`tests/importacao/mapping.test.ts`, `tests/importacao/column-mapping-table.test.tsx`) — deleting `typesFrequencia.ts` outright breaks these two files' imports even though they have nothing to do with the frequência import feature itself.

**Primary recommendation:** Implement PROSP-02 as a 4-file edit (`types.ts`, `validations/importacao.ts`, `annotarLinha.ts`, `dedupe.ts`) that stores `null` (never `""`) for a blank razão social, widens `ResolvedRow.razaoSocial`/`RpcClienteRow.razao_social` to `string | null`, adds a `nomeFantasia`-based dedup fallback key, and hardens `existentes`/`normalizeRazaoSocial` against `null`/blank input before wiring up the required-field swap. Implement MENU-01/02 as a single commit deleting all 31 files listed below (CNPJ: 15, Frequência: 16), replacing the two "borrowed fixture" test files' `SYSTEM_FIELDS_FREQUENCIA` import with a small inline test-only fixture, and — as an explicit Discuss-phase decision, not a default — deciding whether the two `atualizar_*_lote` RPCs are also dropped from the database via a new migration or intentionally left as orphaned-but-harmless (still `is_supervisor()`-gated) callable functions.

## Project Constraints (from CLAUDE.md)

- **Stack is locked:** Next.js (React/TypeScript) + Supabase — this phase introduces zero new packages/services (confirmed: no npm install needed for either PROSP-* or MENU-* work).
- **RLS/Auth is the only authorization boundary:** no hand-rolled permission logic. The two RPCs under consideration for removal (`atualizar_cnpj_lote`, `atualizar_frequencia_visita_lote`) are `is_supervisor()`-gated exactly like every other bulk RPC; if left in place they remain safe but orphaned.
- **TypeScript strict, no unjustified `any`.** The existing `row.razao_social as string` casts (in `app/actions/importacao.ts`) are exactly the kind of unjustified/unsafe cast this phase should tighten, not add more of.
- **Every new table needs RLS + explicit policies:** not applicable — this phase adds no new tables.
- **Migrations are additive-only, never edit an applied one:** if the RPC-drop decision (see Open Questions) is "yes, drop them," it must be a brand-new migration file (e.g. `0028_remove_cnpj_e_frequencia_lote.sql`), never an edit to `0017`/`0020`.
- **Non-technical project owner:** any Discuss-phase question this research raises (the RPC-drop decision, the blank-razão-social display fallback) needs to be phrased in plain-language terms ("apagar essas duas planilhas do banco também, ou só escondê-las?", "o que aparece no lugar do nome da empresa quando ela ainda não tem razão social preenchida?").
- **Toda funcionalidade nova precisa de teste automatizado antes de ser considerada concluída** — every deletion in the inventory below must be paired with either a deleted test file or an updated assertion, never left to fail silently; every fixed bug (empty-string collision, `normalizeRazaoSocial(null)` crash) needs its own new test case.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Required-field vocabulary for prospecção import (PROSP-02) | API / Backend (`lib/importacao/*`, pure modules) | Browser/Client (mapping-UI "Continuar" disabled state reads the same array) | `SYSTEM_FIELDS[].required` and `createImportRowSchema` are pure server-adjacent modules consumed by both the Server Action (`annotarLinha`) and the Client Component (`ColumnMappingTable` via `requiredFieldsFaltando`) — single source of truth, no new tier |
| Blank razão social storage/dedup (PROSP-02) | Database / Storage (uniqueness semantics: NULL vs `''`) | API / Backend (`dedupe.ts`, `confirmar.ts` type widening) | The bug this research found is a storage-tier semantic (NULL vs empty-string collision under a UNIQUE constraint) that the API tier's type choices directly control — fix belongs in the API tier's mapping to storage, not the DB schema itself |
| Menu entry removal (MENU-01/02) | Browser/Client (`AppSidebar.tsx`) | API/Backend (routes, Server Actions, RPCs) | Menu visibility is client-tier UI; but "removida do sistema por completo" per REQUIREMENTS.md spans every tier down to the RPC, so this capability's true scope is NOT client-only — flagged explicitly to avoid a plan that only edits the sidebar |
| Route/page guard removal (MENU-01/02) | Frontend Server (SSR, `page.tsx`'s server-side role redirect) | — | `ImportarCnpjPage`/`ImportarFrequenciasPage` are Server Components doing the auth/role check before render — this entire tier's artifact is deleted, not just unlinked, per the recommended disposition below |

## Standard Stack

No new libraries, no new services. This phase is a pure edit-and-delete operation over already-installed dependencies (`zod`, `@supabase/supabase-js`, existing Vitest/Playwright setup). **Package Legitimacy Audit is not applicable — no packages are installed in this phase.**

## Required-Ness Before/After Table (PROSP-02)

Verified by reading `lib/importacao/types.ts`, `lib/validations/importacao.ts`, `lib/importacao/annotarLinha.ts`, and every relevant migration (`0002`, `0013`, `0019`, `0023`, `0024`) side by side — not assumed from naming.

| Field (`SystemField` key) | Required today (prospecção) | Required after Phase 26 | Enforced by DB `not null`? |
|---|---|---|---|
| `razaoSocial` | **TRUE** — `SYSTEM_FIELDS` `required: true`; `createImportRowSchema.razaoSocial: z.string().min(1,...)` | **FALSE** | NO — dropped by migration `0024` (Phase 23) |
| `nomeFantasia` | **FALSE** — `SYSTEM_FIELDS` `required: false`; **absent entirely** from `createImportRowSchema` (not validated at all today, just read raw in `annotarLinha.ts` step 6) | **TRUE** | NO — always nullable since migration `0013` |
| `responsavel` | **TRUE** — `SYSTEM_FIELDS` `required: true`; `createImportRowSchema.responsavel: z.string().min(1,...)` | **TRUE (unchanged)** | **YES** — `responsavel uuid not null references profiles(id)` (migration `0002` line 114) |
| `cep`, `rua`, `numero`, `cidade`, `estado` | FALSE (relaxed by quick task `260819-m8q`, migration `0023`) | FALSE (unchanged) | NO — migration `0023` |
| `complemento`, `contato`, `telefone`, `email`, `numeroDeLojas`, `categoria`, `produtos`, `cnpj` | FALSE | FALSE (unchanged) | NO |

**Three sources of truth today, confirmed to already diverge (not just "agree by convention" as the milestone research phrased it):**
1. `SYSTEM_FIELDS[].required` (`lib/importacao/types.ts`) — drives `requiredFieldsFaltando()` (Step 2 mapping-UI "Continuar" gate). Generic over any field list (`mapping.ts`'s `K extends string` parameterization) — editing this array alone is sufficient for the mapping-UI behavior, zero other code change needed there.
2. `createImportRowSchema` (`lib/validations/importacao.ts`) — a **hand-written Zod object that does not even declare `nomeFantasia`, `cnpj`, `categoria`, or `produtos` as fields at all** (only `razaoSocial`, `responsavel`, and the 5 address fields + `complemento`/`contato`/`telefone`/`email`/`numeroDeLojas` are present). Confirmed by direct read — this schema is NOT derived from `SYSTEM_FIELDS`, it is independently maintained. To make `nomeFantasia` required, it must be **added** to this schema for the first time, not just have a flag flipped.
3. `annotarLinha.ts`'s hardcoded required-field-check block (lines ~193-221) — parses via `createImportRowSchema.safeParse(...)`, then hardcodes exactly two error-message mappings: `field === "razaoSocial"` → `RAZAO_SOCIAL_REASON`, `field === "responsavel"` → `RESPONSAVEL_REASON`. A plan that only edits source #1 and #2 above will not change what gets rejected here unless this `if/else if` chain is also updated to check `nomeFantasia` instead of `razaoSocial`.

**DB-level fourth source, confirmed:** `clientes.razao_social` has NO `not null` constraint since migration `0024` — so a blank razão social genuinely can reach the database today; the only remaining gate for it is the three application-layer sources above.

## Two Concrete, Previously-Unflagged Runtime Bugs (verified by reading code, not assumed)

### Bug A: Blank razão social will be stored as `''`, not `NULL` — causing false "duplicado" collisions after the first import

**Trace (each step verified by reading the actual file):**
1. `annotarLinha.ts` line 242: `razaoSocial: sanitized.razaoSocial ?? ""` — `ResolvedRow.razaoSocial` is typed `string` (never `null`), and a missing/blank cell resolves to the empty string `""`, unlike `cnpj`/`nomeFantasia`/`cep` etc. which all correctly resolve to `null` when blank (lines 243-247 use the `valorX ? valorX : null` pattern; `razaoSocial` alone does not).
2. `lib/importacao/confirmar.ts`'s `RpcClienteRow.razao_social: string` (not `string | null`, unlike every other optional field in that type) and `toRpcClienteRow()` passes `resolved.razaoSocial` straight through — so `""` reaches the RPC payload unchanged.
3. `supabase/migrations/0019_importar_clientes_lote_cnpj_nome_fantasia.sql` line 45: `r.razao_social` is inserted directly from `jsonb_to_recordset`, with **no `nullif`/`coalesce` applied** — the RPC stores exactly what it receives, so `''` is written to the `razao_social` column, not `NULL`.
4. Migration `0024`'s own header comment explicitly reasons that "dois valores nulos nunca conflitam" (two NULLs never conflict) as the justification for NOT needing to touch `importar_clientes_lote`'s `ON CONFLICT (razao_social) DO NOTHING` — but this reasoning only holds if the app layer actually sends `NULL`. It currently sends `''`, and **two empty strings DO conflict** under a Postgres unique constraint (unlike two `NULL`s). Confirmed via direct SQL semantics, not assumed.
5. **Net effect:** the *first* prospecção row ever imported with a blank razão social succeeds. The *second* row (a completely different company, also with blank razão social, in the same or any later import batch) collides on `ON CONFLICT (razao_social) DO NOTHING` at the DB layer and is silently dropped. `reconcileImportados` (in `confirmar.ts`) already has a fallback path for "row was sent but not in the RPC's returned set" — it reports this case under `DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON` ("Duplicado encontrado ao confirmar"), so it is not a *silent* data loss (the Supervisor sees a "puladas" count), but it is a **wrong and misleading classification** — two unrelated prospects with no razão social yet are not duplicates of each other, and after the very first such import, every subsequent blank-razão-social prospect would appear to "already exist," defeating PROSP-02's entire purpose.

**Fix required:** Change `ResolvedRow.razaoSocial` to `string | null` and resolve blank to `null` (mirroring the existing `cnpj`/`nomeFantasia` pattern), widen `RpcClienteRow.razao_social` to `string | null` in `confirmar.ts`, and confirm `importar_clientes_lote`'s existing `ON CONFLICT (razao_social) DO NOTHING` behaves correctly against `NULL` (it will — no RPC change needed here per migration `0024`'s own correct reasoning, once the app layer actually sends `NULL`).

### Bug B: `normalizeRazaoSocial(null)` will throw once any client has a genuinely NULL razão social

**Trace:**
1. `app/actions/importacao.ts` line 119-121 and line 235-237: `const existentes = (existentesResult.data ?? []).map((row) => row.razao_social as string)` — an **unchecked TypeScript cast**. `clientes.razao_social` has been DB-nullable since migration `0024`; at runtime this array can and will contain actual `null` values once any client (including a Phase-26-imported one, per Bug A's intended fix) has a `NULL` razão social.
2. `lib/importacao/dedupe.ts`'s `findDuplicates()` calls `normalizeRazaoSocial(nome)` for every entry in `existentes` (line 89). `normalizeRazaoSocial(valor: string)` immediately calls `stripDiacritics(valor)`, which calls `valor.normalize("NFD")` — if `valor` is `null` at runtime (despite the lying `string` type), this throws `TypeError: Cannot read properties of null (reading 'normalize')`.
3. **Net effect:** the moment Bug A's fix is applied (storing genuine `NULL` for blank razão social, the correct fix) AND at least one such client exists in the table, the *next* import's `validarLoteImportacao`/`confirmarLoteImportacao` call crashes entirely — not just for the row with the blank razão social, but for the whole batch, because `existentes`/`findDuplicates` operates over the full existing-client list before any per-row logic runs.

**Fix required:** Filter out `null`/blank values from `existentes` **before** passing to `findDuplicates` (e.g. `.filter((v): v is string => Boolean(v))`), in both `app/actions/importacao.ts` call sites (`validarLoteImportacao` and `confirmarLoteImportacao`). This is a two-line defensive fix but must not be skipped — it is the direct, mechanical consequence of correctly fixing Bug A.

### Fallback dedup key needed (confirmed live blind spot, matches milestone research)

`dedupe.ts`'s `findDuplicates()` line 101: `if (!key) continue` — confirmed live: any row whose razão social normalizes to an empty string is **completely skipped** by the dedup loop (no comparison against the DB, no comparison against other batch rows). Two prospects named "Empresa A" and "Empresa B" with both blank razão social will never be flagged as duplicates of each other under the current logic, even though they might be database-adjacent worth flagging. Recommend adding a `nomeFantasia`-normalized fallback key, mirroring the primary key's shape, activated only when the primary (razão social) key is blank — this requires `findDuplicates`'s batch input type to carry `nomeFantasia` alongside `razaoSocial`, and the two call sites in `app/actions/importacao.ts`/`confirmar.ts` (`batchForDedupe`) to pass it through.

## Display Fallback Audit (razaoSocial rendered as primary identity)

Confirmed via grep — every one of these currently renders `cliente.razaoSocial`/`row.razao_social` directly with no "fall back to Nome Fantasia when blank" logic. This is a genuinely new gap Phase 26 introduces (Phase 23/25 never produced a row with blank razão social in practice; Ativos imports require it). Full audit is broader than this list — treat as starting points, re-grep at implementation time:

| File | Line(s) | Usage |
|---|---|---|
| `components/clientes/ClienteCard.tsx` | ~200-204 | Kanban card title (`CardTitle`) — the PRIMARY identity shown on every card in the funil board |
| `components/clientes/ClienteDetailSheet.tsx` | ~714, ~1489 | Ficha header title, delete-confirmation dialog text |
| `components/clientes/KanbanBoard.tsx` | 98, 316 | Sort comparator (`localeCompare` on razão social) and search-text filter — both null/empty-safe already (string methods on `""` don't crash), but degrade UX (unsorted/unsearchable-by-name clients) |
| `lib/clientes/exportacao.ts` | 57 | "Razão Social" column in the client export spreadsheet |
| `lib/supabase/queries/clientes.ts` | ~178, ~313, ~438, ~673 | Multiple `razaoSocial: row.razao_social` mappings across dashboard/diário/list queries — one (line 673, diário) already defensively does `?? ""`, the others do not even have that minimal guard |

**Recommendation:** add a single shared "nome de exibição" helper (`cliente.razaoSocial || cliente.nomeFantasia || "Sem nome"`, or similar), analogous to the existing `lib/clientes/completude.ts`/`lib/clientes/rotuloLocalizacao.ts` single-authority pattern this project already uses for "what do we show when a field is missing," and apply it at minimum to the kanban card title and ficha header (the two places a blank name would be most visibly broken). Flag the full display-site enumeration as a task for plan-time grep, since TypeScript's current (incorrect) non-nullable `razaoSocial: string` types across ~10 call sites mean the compiler will not catch every site that needs updating once the type is correctly widened.

## Architecture Patterns

### Pattern 1: Edit `SYSTEM_FIELDS` in place — no new "profile" abstraction needed

**What:** Because `typesAtivo.ts` (Phase 25) already forked into its own fully independent `SYSTEM_FIELDS_ATIVO` array, `SYSTEM_FIELDS` in `types.ts` is — after Phase 25 shipped — used exclusively by the original/prospecção flow. Phase 26 can flip `required: true → false` on `razaoSocial` and add `required: true` on `nomeFantasia` directly in the existing array, with zero risk of affecting the Ativos flow.
**When to use:** This phase, for the mapping-UI required-field gate (`requiredFieldsFaltando`, generic and already correctly wired).
**Example:**
```typescript
// lib/importacao/types.ts — before
{ key: "razaoSocial", label: "Razão social", required: true },
{ key: "nomeFantasia", label: "Nome Fantasia", required: false },
// after
{ key: "razaoSocial", label: "Razão social", required: false },
{ key: "nomeFantasia", label: "Nome Fantasia", required: true },
```

### Pattern 2: Optional fields resolve to `null`, never `""` — mirror the existing `cnpj`/`nomeFantasia` shape

**What:** Every genuinely-optional resolved field in `annotarLinha.ts` already follows `valorX ? valorX : null`. `razaoSocial` was the one exception (because it has always been required until now). Bringing it in line with the established pattern is both the correct fix for Bug A and consistent with this file's own existing convention.
**When to use:** The `resolved.razaoSocial` computation in `annotarLinha.ts`.

### Pattern 3: Guards/required-checks are hardcoded per-field, not derived generically — update the literal `if/else if` chain, don't expect the array edit alone to work

**What:** `annotarLinha.ts`'s required-field-error mapping is NOT generic over `SYSTEM_FIELDS[].required` — it's a literal two-branch `if (field === "razaoSocial") ... else if (field === "responsavel")`. Editing `SYSTEM_FIELDS`/`createImportRowSchema` alone does not change what `annotarLinha` accepts/rejects.
**When to use:** Any required-field change to the prospecção flow — this is the "looks done but isn't" trap the milestone-level Pitfall 4 warned about, now pinpointed to the exact lines.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A second required-ness "profile" mechanism spanning mapping UI + Zod schema + dedup | A generic `REQUIRED_FIELDS_BY_PROFILE` lookup (as the milestone-level research speculatively suggested) | Direct edit to the existing single `SYSTEM_FIELDS` array | Ativos already solved the "second vocabulary" problem by forking a whole new file in Phase 25; introducing a second abstraction now would be solving an already-solved problem and adds indirection with no consumer |
| Fallback dedup key computation | A new normalization function for `nomeFantasia` | Reuse `normalizeRazaoSocial()` verbatim (it's a generic string-normalization function despite its name — already used this way for categoria/produto/vendedor name matching in `annotarLinha.ts`'s `findByNome`) | The function has no razão-social-specific logic; it's purely lowercase+diacritic-strip+punctuation-strip+corporate-suffix-strip, safe to reuse for any free-text company-name comparison |

**Key insight:** This phase's entire required-ness change fits inside the codebase's existing conventions with zero new abstractions — the risk is not "what pattern to invent," it's "which of 3+ already-existing hardcoded surfaces will someone forget to touch."

## Full Deletion Inventory (MENU-01: "Importar CNPJ")

Confirmed via exhaustive grep — no other file imports/re-exports anything from this list beyond what's enumerated (one exception noted below, comment-only, non-breaking).

| # | File | Type |
|---|------|------|
| 1 | `app/(app)/clientes/importar-cnpj/page.tsx` | Route (Server Component, role guard) |
| 2 | `app/actions/importacaoCnpj.ts` | Server Actions (`validarLoteCnpj`, `confirmarLoteCnpj`) |
| 3 | `lib/importacao/typesCnpj.ts` | Vocabulary (`SYSTEM_FIELDS_CNPJ`) |
| 4 | `lib/importacao/annotarLinhaCnpj.ts` | Row annotation |
| 5 | `lib/importacao/confirmarCnpj.ts` | Confirm-time shaping |
| 6 | `lib/importacao/modeloCnpj.ts` | Spreadsheet-model generator |
| 7 | `components/importacao/CnpjImportWizard.tsx` | Wizard shell |
| 8 | `components/importacao/CnpjPreviewTable.tsx` | Preview table |
| 9 | `components/importacao/CnpjImportSummary.tsx` | Result summary |
| 10 | `tests/importacao/annotarLinhaCnpj.test.ts` | Unit test |
| 11 | `tests/importacao/confirmarCnpj.test.ts` | Unit test |
| 12 | `tests/importacao/cnpj-preview-table.test.tsx` | Component test |
| 13 | `tests/importacao/cnpj-import-summary.test.tsx` | Component test |
| 14 | `tests/importacao/cnpj-vocabulario.test.ts` | Vocabulary test |
| 15 | `tests/importacao/rls-cnpj-lote.test.ts` | **Live-DB RLS integration test for `atualizar_cnpj_lote`** — a third test layer not named by the milestone-level research |

**No Playwright E2E spec exists for `/clientes/importar-cnpj` today** — confirmed via grep of `tests/e2e/*.spec.ts` and a repo-wide search for the string `importar-cnpj`. Only `tests/importacao/AppSidebar.test.tsx` (menu-visibility layer, updated not deleted — see below) and `app/(app)/clientes/importar-ativos/page.tsx` (a header **comment** citing it as the structural precedent, non-breaking) reference this route outside the 15 files above.

**RPC:** `atualizar_cnpj_lote` (migration `0020`) — remains in the database unless the Discuss-phase decision below is "drop it too" (requires a new migration, e.g. `drop function if exists atualizar_cnpj_lote(jsonb);`).

## Full Deletion Inventory (MENU-02: "Importar frequências")

| # | File | Type |
|---|------|------|
| 1 | `app/(app)/clientes/importar-frequencias/page.tsx` | Route (Server Component, role guard) |
| 2 | `app/actions/importacaoFrequencia.ts` | Server Actions (`validarLoteFrequencia`, `confirmarLoteFrequencia`) |
| 3 | `lib/importacao/typesFrequencia.ts` | Vocabulary (`SYSTEM_FIELDS_FREQUENCIA`) — **see "stray import" warning below before deleting** |
| 4 | `lib/importacao/annotarLinhaFrequencia.ts` | Row annotation |
| 5 | `lib/importacao/confirmarFrequencia.ts` | Confirm-time shaping |
| 6 | `lib/importacao/modeloFrequencia.ts` | Spreadsheet-model generator |
| 7 | `components/importacao/FrequenciaImportWizard.tsx` | Wizard shell |
| 8 | `components/importacao/FrequenciaPreviewTable.tsx` | Preview table |
| 9 | `components/importacao/FrequenciaImportSummary.tsx` | Result summary |
| 10 | `tests/importacao/annotarLinhaFrequencia.test.ts` | Unit test |
| 11 | `tests/importacao/confirmarFrequencia.test.ts` | Unit test |
| 12 | `tests/importacao/frequencia-preview-table.test.tsx` | Component test |
| 13 | `tests/importacao/frequencia-import-summary.test.tsx` | Component test |
| 14 | `tests/importacao/frequencia-vocabulario.test.ts` | Vocabulary test |
| 15 | `tests/importacao/rls-frequencia-lote.test.ts` | **Live-DB RLS integration test for `atualizar_frequencia_visita_lote`** |
| 16 | `tests/e2e/importar-frequencias-guard.spec.ts` | **Playwright E2E route guard spec** |

**RPC:** `atualizar_frequencia_visita_lote` (migration `0017`) — same disposition decision as CNPJ's RPC above.

### Critical stray-dependency finding: deleting `typesFrequencia.ts` breaks two GENERIC infrastructure tests

Confirmed via direct read of both files — **not a guess**:
- `tests/importacao/mapping.test.ts` line 9: `import { SYSTEM_FIELDS_FREQUENCIA } from "@/lib/importacao/typesFrequencia"` — used at line 50 purely to prove `suggestMapping()` correctly scopes its alias table to whatever `fields` list is passed in (a generic-mapping-infrastructure test, unrelated to the frequência import feature itself).
- `tests/importacao/column-mapping-table.test.tsx` line 7: same import — used across 3 test cases (`"frequencia:"`, `"sentinela:"`, `"mudanca:"`) purely as a stand-in "smaller alternate vocabulary" to prove `ColumnMappingTable`'s `fields` prop correctly restricts the rendered `<Select>` options.

Both tests exist to validate **shared infrastructure** (`lib/importacao/mapping.ts`, `components/importacao/ColumnMappingTable.tsx`) that Phase 26's own prospecção flow and Phase 25's Ativos flow both still depend on. If `typesFrequencia.ts` is deleted per MENU-02's "removida do sistema por completo," these two test files will fail to even compile/import, despite testing code that must remain.

**Required fix, not optional:** before deleting `typesFrequencia.ts`, replace its import in these two test files with a small test-local fixture that is NOT sourced from production code being deleted, e.g.:
```typescript
// tests/importacao/mapping.test.ts and column-mapping-table.test.tsx — inline replacement
import type { SystemFieldDefinition } from "@/lib/importacao/types"
type TestField = "razaoSocial" | "outroCampo"
const SISTEMA_TESTE: SystemFieldDefinition<TestField>[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "outroCampo", label: "Outro campo", required: true },
]
```
`SYSTEM_FIELDS_ATIVO` (Phase 25) is **not** a usable substitute — it shares the same 16 keys/labels as `SYSTEM_FIELDS`, so it cannot prove the "Select scopes options to a genuinely smaller/different list" assertions these tests make.

### `AppSidebar.test.tsx` — exact assertions affected (by test name, not just "update the test")

Read in full; all 12 tests currently pass. Impact of PROSP-01 (rename) + MENU-01/02 (remove):

| Test (`it(...)` description) | Disposition |
|---|---|
| `"shows 'Importar clientes' for a supervisor"` | **Update** — string literal `"Importar clientes"` must become `"Importar Clientes em Prospecção"` (or whatever exact label PROSP-01 locks) |
| `"hides 'Importar clientes' for a vendedor"` | **Update** — same string change |
| `"shows Importar frequências for a supervisor (frequenciassupervisor)"` | **Delete** |
| `"hides Importar frequências for a vendedor (frequenciasvendedor)"` | **Delete** (note: this test ALSO asserts `"Gerenciar equipe"`/`"Configuracoes"` are hidden — those assertions are section-level and unrelated to frequências; if deleting the whole test, confirm no other test still covers the "whole ADMIN_SECTION hidden for vendedor" invariant, or keep a trimmed version) |
| `"renders Importar frequências after Importar clientes in DOM order (frequenciasordem)"` | **Delete** |
| `"shows Importar CNPJ for a supervisor with the correct route (cnpjsupervisor)"` | **Delete** |
| `"hides Importar CNPJ for a vendedor (cnpjvendedor)"` | **Delete** |
| `"renders Importar CNPJ after Importar frequências in DOM order (cnpjordem)"` | **Delete** (references both retiring routes — must go regardless) |
| `"shows Importar Clientes Ativos for a supervisor with the correct route (ativossupervisor)"` | **Keep unchanged** |
| `"hides Importar Clientes Ativos for a vendedor (ativosvendedor)"` | **Keep unchanged** |
| `"renders Importar Clientes Ativos after Importar CNPJ in DOM order (ativosordem)"` | **Must update** — this test's ordering assertion depends on `/clientes/importar-cnpj` still existing in the links array; once CNPJ is removed, this needs a new anchor (e.g. "after Importar Clientes em Prospecção" or "after Gerenciar equipe", whatever the plan settles the ADMIN_SECTION's post-cleanup order to be) |

**`ADMIN_SECTION`'s final order after this phase** (in `components/layout/AppSidebar.tsx`) must be decided explicitly during planning — today's order is Gerenciar equipe → Configurações → Importar clientes → Importar frequências → Importar CNPJ → Importar Clientes Ativos. Removing the middle two collapses it to: Gerenciar equipe → Configurações → Importar Clientes em Prospecção → Importar Clientes Ativos. The icon-differentiation comments (lines 94-96, 102-105, 111-115) in `AppSidebar.tsx` reference the now-deleted entries by name and need updating too (not a functional break, but stale documentation).

## Common Pitfalls

### Pitfall 1: Editing `SYSTEM_FIELDS`/`createImportRowSchema` without touching `annotarLinha.ts`'s hardcoded branch — "looks done but isn't"

**What goes wrong:** The mapping-UI Step 2 "Continuar" button correctly reflects the new required fields (nomeFantasia nags, razão social doesn't) because `requiredFieldsFaltando` is generic — but Step 3 row validation (`annotarLinha`) keeps rejecting rows on missing razão social and keeps accepting rows with a missing Nome Fantasia, because its required-field-to-error-message mapping is a hardcoded two-branch `if/else if`, not derived from `SYSTEM_FIELDS[].required`.
**Why it happens:** Three independently-maintained surfaces (confirmed above) happen to agree today only because nobody has needed them to diverge yet.
**How to avoid:** Update all three surfaces in the same commit: `SYSTEM_FIELDS`, `createImportRowSchema` (add `nomeFantasia: z.string().min(1, ...)`, change `razaoSocial` to `.optional()`), and `annotarLinha.ts`'s branch (swap `razaoSocial` check for `nomeFantasia`, rename `RAZAO_SOCIAL_REASON` usage accordingly).
**Warning signs:** A test that uploads a row with blank Nome Fantasia and non-blank razão social succeeds end-to-end when it should fail.

### Pitfall 2: Storing `""` instead of `null` for blank razão social (Bug A above)

**Phase to address:** Same commit as the required-field swap — this is not a separate, deferrable concern; PROSP-02 cannot ship correctly without this fix.
**Warning signs:** A test importing two separate batches, each containing one blank-razão-social row, where the second batch's row is wrongly flagged "duplicado."

### Pitfall 3: `normalizeRazaoSocial(null)` crash (Bug B above)

**Phase to address:** Same commit — must ship together with Pitfall 2's fix, since fixing Pitfall 2 correctly (storing real `NULL`) is what makes this crash reachable in practice.
**Warning signs:** A test seeding one existing client with `razao_social = null` directly (service-role insert, bypassing the app layer) and then running `validarLoteImportacao` against a new batch — if this throws instead of returning a result, the crash is unfixed.

### Pitfall 4: Deleting `typesFrequencia.ts` without first repairing `mapping.test.ts`/`column-mapping-table.test.tsx`

**What goes wrong:** `npm test` fails immediately on module resolution, not on an assertion — a noisy, confusing failure that looks like a bigger break than it is.
**How to avoid:** Replace the borrowed import with a local test fixture (exact replacement code given above) in the SAME commit as the `typesFrequencia.ts` deletion, never as a follow-up.
**Warning signs:** Running `npm test` after deleting `lib/importacao/typesFrequencia.ts` and seeing `Cannot find module '@/lib/importacao/typesFrequencia'` in files that are not `FrequenciaImportWizard`/`annotarLinhaFrequencia`-related.

### Pitfall 5: Assuming route deletion needs a matching Playwright spec deletion for BOTH menu items equally

**What goes wrong:** A plan written from the milestone-level research alone (which says "both `AppSidebar.test.tsx` and the corresponding Playwright E2E specs") might create a phantom task to delete a `importar-cnpj-guard.spec.ts` file that does not exist, wasting a task/verification step, or worse, writing a NEW Playwright spec for CNPJ under the mistaken belief one is being removed.
**How to avoid:** Confirmed via this research: only `tests/e2e/importar-frequencias-guard.spec.ts` needs Playwright-layer deletion. `importar-guard.spec.ts` (the file that DOES exist matching a similar name) tests `/clientes/importar` — the ORIGINAL/prospecção route being renamed, not removed — and must be **updated** (its heading assertion `"Importar clientes"` → the new PROSP-01 label), never deleted.
**Warning signs:** A plan task titled "delete tests/e2e/importar-cnpj-guard.spec.ts" — this file does not exist; grep before writing that task.

### Pitfall 6: `importar-guard.spec.ts` silently orphaned instead of updated

**What goes wrong:** `tests/e2e/importar-guard.spec.ts` (line 53) asserts `page.getByRole("heading", { name: "Importar clientes" })`. PROSP-01 changes this heading text (whatever `page.tsx` for `/clientes/importar` renders as its `<h1>`). If this file is not touched, it silently starts failing on the next full Playwright run — it is NOT in either deletion inventory above (it belongs to the flow being renamed, not removed), so a plan focused only on the two deletion inventories could miss it entirely.
**How to avoid:** Explicitly list `tests/e2e/importar-guard.spec.ts` (and `app/(app)/clientes/importar/page.tsx`'s own `<h1>` text) as an UPDATE target under PROSP-01, separate from the MENU-01/02 deletion tasks.

## Code Examples

### Correct `resolved.razaoSocial` shape after the fix (mirrors existing `cnpj`/`nomeFantasia` pattern)
```typescript
// lib/importacao/annotarLinha.ts — ResolvedRow.razaoSocial becomes `string | null`
const razaoSocialValor = sanitized.razaoSocial?.trim()
// ...
const resolved: ResolvedRow = {
  razaoSocial: razaoSocialValor ? razaoSocialValor : null, // was: sanitized.razaoSocial ?? ""
  cnpj: cnpjValor ? cnpjValor : null,       // unchanged, already correct
  nomeFantasia: nomeFantasiaValor ? nomeFantasiaValor : null, // unchanged, already correct
  // ...
}
```

### Defensive `existentes` filter before dedup (fixes Bug B)
```typescript
// app/actions/importacao.ts — both validarLoteImportacao and confirmarLoteImportacao
const existentes = (existentesResult.data ?? [])
  .map((row) => row.razao_social)
  .filter((v): v is string => Boolean(v && v.trim()))
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact display fallback rule ("show Nome Fantasia when razão social is blank") is the right UX, versus e.g. showing a literal "(sem razão social)" placeholder | Display Fallback Audit | Low — either choice is a small, easily-changed UI decision; flagged for Discuss-phase confirmation with the non-technical project owner, phrased in plain language |
| A2 | The two `atualizar_*_lote` RPCs (`atualizar_cnpj_lote`, `atualizar_frequencia_visita_lote`) should be dropped from the database as part of "removida do sistema por completo," not just left orphaned | Deletion Inventories | Medium — leaving them is not a security risk (still `is_supervisor()`-gated) but is inconsistent with REQUIREMENTS.md's literal wording; dropping them needs a new migration and a decision on whether that's in this phase's scope or deferred |
| A3 | `AppSidebar.test.tsx`'s "hides Importar frequências for a vendedor" test's ADMIN_SECTION-hidden assertions (Gerenciar equipe/Configurações) should be preserved in some form after deleting the frequências-specific parts of that test | AppSidebar test impact table | Low — if dropped without a replacement, the codebase loses coverage for "the whole admin section, not just one item, is gated," though this is likely still covered by the "Importar Clientes Ativos" vendedor-hides test's structure |

**If this table is empty:** N/A — see entries above; all are low-to-medium risk UX/scope decisions, not technical unknowns.

## Open Questions

1. **Should `atualizar_cnpj_lote` and `atualizar_frequencia_visita_lote` be dropped from the database in this phase, or left as orphaned-but-safe RPCs?**
   - What we know: REQUIREMENTS.md says "removida do sistema por completo (código, rota, testes)" — DB is not explicitly named. `CLAUDE.md` forbids editing applied migrations but permits new ones that alter/drop.
   - What's unclear: whether "completo" is meant to include the database layer.
   - Recommendation: raise explicitly in Discuss-phase; recommend dropping them (via a new migration) for genuine completeness, since they become fully dead code with zero remaining caller once the Server Actions/routes are deleted — but this is a product-scope call, not a technical requirement.

2. **What should the new ADMIN_SECTION menu order be after removing 2 of 4 import entries?**
   - What we know: current order is Gerenciar equipe → Configurações → Importar clientes → Importar frequências → Importar CNPJ → Importar Clientes Ativos.
   - What's unclear: whether "Importar Clientes em Prospecção" and "Importar Clientes Ativos" should be adjacent (both import flows together) or kept in their current relative positions.
   - Recommendation: default to keeping relative order (Prospecção immediately before Ativos, since CNPJ/Frequência simply vanish from between them) — lowest-diff option, update `AppSidebar.test.tsx`'s DOM-order test accordingly.

3. **Exact final label text for PROSP-01's rename** — "Importar Clientes em Prospecção" (matches PROJECT.md target features verbatim) vs. a shorter menu-friendly variant, given the sidebar's compact-mode truncation behavior (`truncate` class already present) for longer labels.
   - Recommendation: use the exact PROJECT.md string; the existing `truncate` CSS class already handles longer labels safely (confirmed present on every `NavLink` label span in `AppSidebar.tsx`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit/component, jsdom via `@vitest-environment jsdom` per-file pragma) + Playwright 1.61.1 (E2E) |
| Config file | `vitest.config.ts` (root), `playwright.config.ts` (root) |
| Quick run command | `npx vitest run tests/importacao/` |
| Full suite command | `npm test` (Vitest) + `npm run test:e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROSP-01 | Menu label renamed | unit (component) | `npx vitest run tests/importacao/AppSidebar.test.tsx` | ✅ (update existing 2 tests) |
| PROSP-01 | Route heading text updated | e2e | `npx playwright test tests/e2e/importar-guard.spec.ts` | ✅ (update existing assertion) |
| PROSP-02 | Only Nome Fantasia + Responsável required; razão social/rest optional | unit | `npx vitest run tests/importacao/annotarLinha.test.ts` | ✅ file exists — add new cases (blank razão social accepted, blank nome fantasia rejected) |
| PROSP-02 | Blank razão social does not collide with a different blank-razão-social row (Bug A fix) | unit + integration | `npx vitest run tests/importacao/dedupe.test.ts` (app-layer) + `npx vitest run tests/importacao/rls-importar-lote.test.ts` (DB-layer, ON CONFLICT behavior) | ✅ both files exist — add new cases |
| PROSP-02 | `normalizeRazaoSocial`/dedup does not crash when an existing client has `NULL` razão social (Bug B fix) | unit | `npx vitest run tests/importacao/dedupe.test.ts` | ✅ file exists — add new case seeding a `null` entry in `existentes` |
| PROSP-03 | Imported prospecção client lands in "Aguardando contato" | integration (already covered, no new test needed) | `npx vitest run tests/importacao/rls-importar-lote.test.ts` | ✅ unchanged behavior |
| MENU-01 | "Importar CNPJ" fully removed | unit (component) + build | `npx vitest run tests/importacao/AppSidebar.test.tsx` + `npm run build` (confirms no stray import) | ✅ update existing, ❌ no new file needed |
| MENU-02 | "Importar frequências" fully removed | unit + e2e | `npx vitest run tests/importacao/AppSidebar.test.tsx` + confirm `tests/e2e/importar-frequencias-guard.spec.ts` deleted + `npm run build` | ✅/🗑️ mixed — see deletion inventory |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/importacao/` (fast, scoped to the affected directory)
- **Per wave merge:** `npm test` (full Vitest suite) + `npm run build` (catches any stray import from the 31 deleted files)
- **Phase gate:** `npm test` AND `npx playwright test` both green before `/gsd-verify-work` — per Pitfall 5 of the milestone-level research, skipping the Playwright run is the single most likely way this phase's menu-removal half ships silently broken.

### Wave 0 Gaps
- None — existing test infrastructure (`tests/importacao/annotarLinha.test.ts`, `tests/importacao/dedupe.test.ts`, `tests/importacao/rls-importar-lote.test.ts`, `tests/importacao/AppSidebar.test.tsx`, `tests/e2e/importar-guard.spec.ts`) already covers every affected surface; this phase only needs new test *cases* inside existing files, not new test *files* (aside from the deletions listed above, which remove coverage rather than requiring new coverage).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — no auth logic touched this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | `is_supervisor()` role gate — must remain the terminal authorization boundary; the two RPCs under consideration for removal are currently gated this way, and if left in place (per Open Question 1), they must **remain** gated, never left callable-but-ungated |
| V5 Input Validation | Yes | `zod` (`createImportRowSchema`) — the required-field swap (nomeFantasia required, razão social optional) must be validated server-side in `annotarLinha`/the Zod schema, never trusted from client-side mapping-UI state alone (already the existing pattern; no regression risk if Pitfall 1 above is avoided) |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Orphaned-but-still-callable RPC after its UI is removed (`atualizar_cnpj_lote`/`atualizar_frequencia_visita_lote`, if the Open Question 1 decision is "leave them") | Elevation of Privilege (theoretical, mitigated) | Confirmed both RPCs independently re-check `is_supervisor()` as their first statement (existing code, unchanged) — a Vendedor calling `supabase.rpc("atualizar_cnpj_lote", ...)` directly (bypassing the deleted UI) is still rejected server-side. No new risk introduced by leaving them, but flag as intentional dead surface if that's the chosen disposition, not an oversight |
| Blank razão social used as an injection/duplication vector (e.g. an attacker deliberately uploading many blank-razão-social rows to probe dedup behavior) | Tampering / Denial of Service (mild) | Existing Supervisor-only gate on the whole import feature already limits this to a trusted role; the Bug A/B fixes above are correctness fixes, not new attack-surface-closing controls — no new mitigation beyond what's already documented |
| Stale UI comments referencing deleted routes (`AppSidebar.tsx` icon-differentiation comments) | Information leakage (negligible) | Not a real security concern — code comments aren't shipped to the client — but worth cleaning up for maintainability per this project's own documentation-habit convention |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `lib/importacao/types.ts`, `lib/validations/importacao.ts`, `lib/importacao/annotarLinha.ts`, `lib/importacao/dedupe.ts`, `lib/importacao/confirmar.ts`, `lib/importacao/typesAtivo.ts`, `lib/importacao/typesFrequencia.ts`, `lib/importacao/typesCnpj.ts` — required-ness source-of-truth trace, Bug A/B discovery
- `app/actions/importacao.ts`, `app/actions/importacaoCnpj.ts`, `app/actions/importacaoFrequencia.ts` — existing dedicated per-flow Server Action files (confirms the file-per-flow precedent, and the `existentes` cast that causes Bug B)
- `supabase/migrations/0002, 0013, 0017, 0018, 0019, 0020, 0023, 0024, 0025` — DB nullability/constraint history, `mover_card_funil`'s current guard shape, `importar_clientes_lote`'s literal INSERT statement
- `components/layout/AppSidebar.tsx`, `tests/importacao/AppSidebar.test.tsx` — exact menu structure and every existing test assertion, read in full
- `tests/e2e/importar-guard.spec.ts`, `tests/e2e/importar-frequencias-guard.spec.ts` — confirmed exact scope of each Playwright spec, confirmed no `importar-cnpj`-specific spec exists
- `tests/importacao/mapping.test.ts`, `tests/importacao/column-mapping-table.test.tsx` — confirmed the stray-dependency risk on `typesFrequencia.ts`
- Repo-wide `Grep` for `importar-cnpj`, `importar-frequencias`, `typesCnpj`, `typesFrequencia`, `modeloCnpj`, `modeloFrequencia`, `annotarLoteCnpj`, `atualizar_cnpj_lote`, `atualizar_frequencia_visita_lote`, `.razaoSocial`/`.razao_social` display sites — exhaustive deletion-inventory and blast-radius confirmation
- `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md` — milestone-level context and prior research to build on/correct

No web research was needed or used — this phase is entirely first-party codebase work with no new external dependency or unfamiliar technology.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, confirmed by reading `package.json` conventions already documented in `.claude/CLAUDE.md`
- Architecture: HIGH — every claim grounded in a specific file/line read this session
- Pitfalls: HIGH — Bugs A and B are not speculative; both were traced through actual, currently-committed code paths line by line, and are new/corrected relative to the milestone-level research's more general framing

**Research date:** 2026-08-26
**Valid until:** 30 days (stable, first-party codebase — no external API/library drift risk)
