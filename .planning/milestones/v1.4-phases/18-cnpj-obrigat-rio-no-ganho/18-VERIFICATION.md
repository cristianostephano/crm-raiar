---
phase: 18-cnpj-obrigat-rio-no-ganho
verified: 2026-08-11T20:20:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 18: CNPJ Obrigatório no Ganho Verification Report

**Phase Goal:** A partir do momento em que um cliente vira "ganho", o sistema exige CNPJ preenchido — validado no banco, não só na tela — sem afetar clientes já "ganho" sem CNPJ nem o cadastro rápido anterior ao "ganho".
**Verified:** 2026-08-11T20:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, cross-checked against actual code and live test runs — not SUMMARY claims)

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Moving a card to "ganho" without CNPJ is blocked with a clear message, and the guard holds even if the UI is bypassed, because the RPC itself refuses the call | ✓ VERIFIED | `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql:111-116` — guard raises `'CNPJ é obrigatório para marcar um cliente como ganho'` inside the RPC body (not just app code). Confirmed live against the real hosted DB: `tests/clientes/cnpj-ganho.test.ts` cases `obrigatorio` and `vazio` — ran directly, **13/13 passed** against production Supabase (`afbiwgbqkogsrhxjshkk`), not merely read as claims. |
| 2 | Filling in the CNPJ before moving the card, the transition to "ganho" happens normally with no extra friction | ✓ VERIFIED | Migration guard's 4th condition (`v_cnpj_efetivo is null`) only fires when the value is truly empty; `feliz`/`existente` test cases ran green live, confirming CNPJ is persisted in the same transaction (`cnpj = coalesce(nullif(btrim(p_cnpj),''), cnpj)` at line 126) and a client that already has a CNPJ on file doesn't need to resend it. |
| 3 | A client already "ganho" without CNPJ (registered before this guard) remains normally accessible in the Agenda, ficha, and diário — no block or error | ✓ VERIFIED | Guard condition `v_status_atual is distinct from 'ganho'` (line 113) makes the trap transition-only, never state-based. Proven live: `legado` test case inserts a ganho client directly via `serviceClient()` (simulating a pre-migration row) and confirms (i) readable, (ii) editable via a plain UPDATE, (iii) reaffirming ganho via RPC does not error. `arrasta` case confirms the drag-card call shape (no `p_novo_status`) also doesn't trip the guard. Both ran green against the live DB. Frontend mirrors the same condition: `ClienteDetailSheet.tsx:1377` `exigirCnpj={cliente.statusAcompanhamento !== "ganho"}` and `app/actions/funil.ts:197-201` gate the pre-check on `cliente.status_acompanhamento !== "ganho"` — same three-layer condition, verified by reading the actual source, not the SUMMARY's description of it. |
| 4 | Before "ganho" — quick registration and normal editing — CNPJ remains optional, no behavior change | ✓ VERIFIED | `lib/validations/cliente.ts` read in full: `createClienteSchema` has no `cnpj` field at all; `updateClienteSchema` keeps `cnpj: z.string().optional()` with no `.min()`/`.regex()`. `git diff` across all Phase 18 commits (`43bb3a4`, `2863c96`, `d04f19e`) confirms neither `lib/validations/cliente.ts` nor `components/clientes/ClienteQuickCreateForm.tsx` appear in any diff. |

**Score:** 4/4 ROADMAP success criteria verified (0 present-but-behavior-unverified)

### REQUIREMENTS.md Coverage (CNPJ-01, CNPJ-02)

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| CNPJ-01 | Moving a card to "ganho" requires CNPJ — enforced in the `mover_card_funil` RPC (DB), not just the screen | ✓ SATISFIED | Migration guard is inside the RPC body, no client-side-only trap. `p_cnpj` flows: dialog → `marcarStatus(...,cnpj)` → `p_cnpj` param on the RPC call (`app/actions/funil.ts:216`) — same transaction as `p_frequencia_visita`. |
| CNPJ-02 | Clients already "ganho" without CNPJ keep working normally (Agenda, ficha, diário) with no block, until regularized | ✓ SATISFIED | Grandfathering condition present in all three layers (RPC, Server Action pre-check, dialog `exigirCnpj` prop) and proven by the `legado`/`arrasta` integration test cases running green against the live DB. No `NOT NULL`/`CHECK` constraint was added to `clientes.cnpj` (confirmed: migration contains zero `alter table` statements). |

Both marked "Complete" in REQUIREMENTS.md traceability — matches actual code state, not just the doc claim.

### Required Artifacts (existence, substance, wiring — all three levels checked against the file, not the SUMMARY)

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql` | Recreates `mover_card_funil` w/ 7th param `p_cnpj` + transition guard | ✓ VERIFIED | Read in full. Exactly 1 `drop function` (citing the exact old 6-param signature) + 1 `create function`. No `alter table`, no `security definer`, no CNPJ format/regex validation. `btrim`/`nullif`/`coalesce`/`is distinct from`/`found`/`get diagnostics`/`America/Sao_Paulo` all present as required. |
| `mover_card_funil` (7-param RPC, live in prod) | New signature is the ONLY signature on the hosted DB — no ambiguous overload | ✓ VERIFIED | `npx supabase@2.111.0 migration list` run directly against the hosted project: **all 18 local migrations show `remote` = `local`**, including `"0018":"0018"`. Regression suites (`funil-status`, `funil-constraints`, `rls-visitas` — 19+11=30 tests) that exercise the old 6-param call shapes all ran green, proving no PostgREST ambiguity was introduced. |
| `tests/clientes/cnpj-ganho.test.ts` | New integration test file, 8 required cases, proves CNPJ-01 + CNPJ-02 against real DB | ✓ VERIFIED | Read in full — real `signInAs()`/`SEED_ACCOUNTS` sessions, `serviceClient()` used only for seed/cleanup (never for assertions). All 8 required case-name keywords present (`obrigatorio`, `vazio`, `feliz`, `existente`, `legado`, `arrasta`, `preserva`, `formato`). **Ran directly: 13/13 passed against the live hosted Supabase project** (not re-run from cache, not trusted from SUMMARY). |
| `tests/clientes/frequencia-visita.test.ts` / `frequencia-visita-edicao.test.ts` (edited) | Ganho helper now sends `p_cnpj` | ✓ VERIFIED | `grep` confirms `p_cnpj: "12.345.678/0001-99"` in both files' `marcarGanhoRpc` helper. Ran directly (isolated, to avoid the known Auth rate-limit): 17/17 and 11/11 passed. |
| `components/clientes/GanhoFrequenciaDialog.tsx` (extended) | Props `cnpjAtual`/`exigirCnpj`, `onConfirm(frequencia, cnpj)`, CNPJ field `id="ganho-cnpj-input"` | ✓ VERIFIED | Read in full. All copy strings present, trim logic present (`cnpjTrimmed = cnpj.trim()`), button `disabled` includes `(exigirCnpj && !cnpjTrimmed)`. No mask/pattern/regex/digit-check. |
| `app/actions/funil.ts` — `marcarStatus` (extended) | 5th param `cnpj`, `cnpj_obrigatorio` error code, reads `status_acompanhamento`, sends `p_cnpj` | ✓ VERIFIED | Read in full. Pre-check at lines 189-208 uses the CNPJ *efetivo* (param OR already-saved column, both trimmed) — correctly avoids blocking a server call the RPC would accept. `p_cnpj` sent conditionally (only on `ganho`), mirroring `p_frequencia_visita`. |
| `components/clientes/ClienteDetailSheet.tsx` (wiring + sync) | Passes `cnpjAtual`/`exigirCnpj` derived from current status; syncs CNPJ into `setCliente` + `form.setValue('cnpj', ...)` post-ganho | ✓ VERIFIED | Read lines 350-450 and the dialog usage (~1369-1380). `exigirCnpj={cliente.statusAcompanhamento !== "ganho"}` — exact transition condition, matches RPC guard. `form.setValue("cnpj", cnpjTrimmed)` present at line 417, inside the success block, with an explanatory comment about the exact data-loss bug (T-18-11) it prevents. `eslint-disable` count unchanged (2 before, 2 after — verified via `git show HEAD:...` diff, not trusted from claim). |
| `tests/clientes/ganho-frequencia-dialog.test.tsx` (extended) | 5 new CNPJ cases + 5 pre-existing preserved | ✓ VERIFIED | Read in full — `cnpjvazio`, `cnpjpreenchido`, `cnpjdispensado`, `cnpjrepassa`, `cnpjformato` all present with correct assertions; original 5 cases (`copy`, `desabilitado`, `variante`, `cancelar`, `vocabulario`) untouched. **Ran directly: 10/10 passed.** |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `GanhoFrequenciaDialog.onConfirm(frequencia, cnpj)` | `ClienteDetailSheet.handleStatusChange('ganho', undefined, frequencia, cnpj)` | direct call at dialog usage site (~line 1379) | ✓ WIRED | Confirmed by direct source read. |
| `handleStatusChange` | `marcarStatus(cliente.id, novoStatus, motivoPerdaId, frequenciaVisita, cnpj)` | 5-argument call at line 369-375 | ✓ WIRED | Confirmed. |
| `marcarStatus` | `mover_card_funil` RPC `p_cnpj` param | `supabase.rpc("mover_card_funil", {..., p_cnpj: ...})` line 210-217 | ✓ WIRED | Sent only when `novoStatus === "ganho"`, trimmed-or-null. |
| `exigirCnpj` prop | RPC transition guard | same boolean condition (`status !== 'ganho'`) expressed independently in dialog prop, Server Action pre-check, and SQL guard | ✓ WIRED | All three read directly and confirmed textually equivalent — no drift between layers. |
| post-ganho success | `ClienteDetailSheet` form state | `setCliente(...)` + `form.setValue('cnpj', cnpjTrimmed)` | ✓ WIRED | Confirmed present and guarded by `novoStatus === "ganho" && cnpjTrimmed`, preventing the CNPJ-erasure bug described in the plan's threat model (T-18-11). |

### Behavioral Spot-Checks / Live Test Execution (run directly by this verifier, not sourced from SUMMARY)

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| RPC guard enforces CNPJ on transition to ganho, against the real hosted DB | `npx vitest run tests/clientes/cnpj-ganho.test.ts` | 13/13 passed | ✓ PASS |
| No regression in existing funil paths (etapa/motivo guards, no ambiguous overload) | `npx vitest run tests/clientes/funil-status.test.ts tests/clientes/funil-constraints.test.ts` | 19/19 passed | ✓ PASS |
| Cross-vendedor RLS behavior preserved (row-not-found silently skips the guard) | `npx vitest run tests/clientes/rls-visitas.test.ts` | 11/11 passed | ✓ PASS |
| Frequency-of-visit helper tests still pass with `p_cnpj` added | `npx vitest run tests/clientes/frequencia-visita.test.ts` (isolated, after rate-limit cooldown) | 17/17 passed | ✓ PASS |
| Frequency-of-visit edit-flow helper still passes | `npx vitest run tests/clientes/frequencia-visita-edicao.test.ts` | 11/11 passed | ✓ PASS |
| Dashboard suites that mark "ganho" via a direct UPDATE (not RPC) still work — proves no column constraint broke them | `npx vitest run tests/dashboard/{ganhos-perdidos,funil-detalhado,comparativo-vendedor,desempenho-vendedor,prospeccao}.test.ts` | 42/42 passed | ✓ PASS |
| Dialog CNPJ UI logic (disabled button, trim, copy) | `npx vitest run tests/clientes/ganho-frequencia-dialog.test.tsx` | 10/10 passed | ✓ PASS |
| TypeScript strictness | `npx tsc --noEmit` | clean, no errors | ✓ PASS |
| Lint | `npm run lint` | clean, no errors | ✓ PASS |
| Migration is genuinely live on the hosted project (not just claimed) | `npx supabase@2.111.0 migration list` | all 18 local migrations show matching `remote` entries, including `"0018":"0018"` | ✓ PASS |

Note: an initial combined run of the two `frequencia-visita*` files hit the project's known `signInWithPassword` rate limit (documented since Phase 6/13) and showed transient failures — re-running each file in isolation after a cooldown produced clean green results (17/17, 11/11). This matches the exact behavior already documented in `STATE.md` and the SUMMARY, and is not a Phase 18 regression.

### Anti-Patterns Found

None. Scanned `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql`, `app/actions/funil.ts`, `components/clientes/GanhoFrequenciaDialog.tsx`, `components/clientes/ClienteDetailSheet.tsx`, and `tests/clientes/cnpj-ganho.test.ts` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`, "coming soon"/"not yet implemented" style copy, empty stub implementations, and hardcoded-empty rendered props — zero matches. No CNPJ format/mask/regex/digit-check anywhere in scope (confirmed by both direct read and grep), matching the explicit Out-of-Scope decision in REQUIREMENTS.md.

### Human Verification Required

None outstanding. The one item that genuinely required a human (browser click-through of the 7-step UAT script in 18-02's Task 3 — dialog behavior, CNPJ surviving a subsequent "Salvar alterações", legacy-client non-blocking) was already executed and approved by the project owner per the SUMMARY and STATE.md ("Checkpoint humano aprovado"). This verifier cannot re-run a live browser session, but every mechanically-verifiable half of that same behavior (form.setValue wiring, exigirCnpj derivation, RPC-level grandfathering) has been independently confirmed against source and against live integration tests above, so there is no unresolved gap left needing a fresh human pass.

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria, both REQUIREMENTS.md items (CNPJ-01, CNPJ-02), all declared artifacts, and all key links were independently verified against the actual source files and by directly executing the test suites (not by reading SUMMARY.md claims). The migration is confirmed live on the hosted Supabase project via `supabase migration list`, not merely asserted. No debt markers, no scope creep (CNPJ format validation, quick-create/edit-schema changes), and no elevated-privilege additions were found.

---

_Verified: 2026-08-11T20:20:00Z_
_Verifier: Claude (gsd-verifier)_
