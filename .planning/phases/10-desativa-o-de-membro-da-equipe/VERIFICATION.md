---
phase: 10-desativa-o-de-membro-da-equipe
verified: 2026-08-03T13:10:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 10: Desativação de Membro da Equipe Verification Report

**Phase Goal:** O Supervisor consegue desativar (nunca apagar) um membro da equipe pela tela "Gerenciar equipe", transferindo antes os clientes em andamento desse membro para um substituto escolhido. Um membro desativado não consegue mais entrar no sistema, mas seu nome e histórico continuam intactos e visíveis. O sistema nunca permite ficar sem nenhum Supervisor ativo. É possível reativar um membro desativado depois.

**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, EQP-01..04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supervisor desativa um vendedor escolhendo, antes de confirmar, um substituto que herda os clientes em andamento (EQP-01) | ✓ VERIFIED | `desativar_membro_equipe` (migration 0008) reassigns only `status_acompanhamento = 'em_andamento'` clientes as a separate top-level statement, returns the count. `tests/equipe/reassignment.test.ts` — re-ran live: 7/7 passing, including `-t "reassigns em_andamento"` (1 passed). `DesativarMembroDialog.tsx` always renders the substitute `Select` (D-03) and blocks submission client-side until one is picked (proven by `equipe-list.test.tsx`'s `not.toHaveBeenCalled()` assertion, re-ran: passing). `substitutosDisponiveis()` excludes the target from their own picker (self-assignment bug caught and fixed during planning) — re-ran unit assertion, passing. |
| 2 | Sistema impede desativar o último Supervisor ativo, explicando o motivo (EQP-02) | ✓ VERIFIED | Migration's TOCTOU-safe guard (`for update` lock before `count(*)`) plus D-01's self-deactivation block make "zero active Supervisors" structurally unreachable — proven as an invariant by `tests/equipe/rls-desativar-membro.test.ts` (`-t "self"` and `-t "last supervisor"`, both re-ran live and passing). UI shows the exact contracted explanation string `"Não é possível desativar o último Supervisor ativo — a equipe sempre precisa de pelo menos um Supervisor."` in `DesativarMembroDialog.tsx`. |
| 3 | Membro desativado não consegue mais entrar no sistema; nome e histórico continuam intactos e visíveis (EQP-03) | ✓ VERIFIED | Two independent enforcement layers, both proven: (a) Postgres/RLS — `is_supervisor()` now requires `ativo = true`, cascading to every existing policy with zero edits; `rls-desativar-membro.test.ts`'s `-t "is_supervisor"` test proves the same still-valid access token flips from `true` to `false` and a previously-allowed Supervisor-only INSERT is refused, on the very next request, without re-authentication (re-ran live: passing). (b) Auth — `desativarMembroEquipe` Server Action calls `ban_duration: "876000h"` after the RPC commits; `tests/equipe/auth-ban.test.ts` proves the ban persists and `"none"` clears it (re-ran live: passing). The literal login-screen refusal (the part no automated test can reach) was personally performed by the project owner in a live 9-step browser walkthrough (`10-06-SUMMARY.md`, Task 2 checkpoint): deactivating `vendedor.b+test@raiar.local` via the real UI caused a real login attempt with the correct password to be refused with "E-mail ou senha incorretos...", and after reactivation the same credentials logged in successfully ("Bem-vindo(a), Vendedor"). Name/history stay visible because the migration never deletes or nulls any `profiles`/`clientes`/`historico` row — only flips `ativo`. |
| 4 | Clientes já ganhos ou perdidos do vendedor desativado continuam atribuídos a ele; só os em andamento são transferidos (EQP-04) | ✓ VERIFIED | The reassignment `UPDATE` filters strictly on `status_acompanhamento = 'em_andamento'` (`grep` and code read confirm this is the only reassignment path). `tests/equipe/reassignment.test.ts`'s `"preserves closed"` test (part of the 7/7 whole-file run, re-ran live: passing) explicitly asserts a `ganho` and a `perdido` cliente still name the deactivated member as `responsavel` after deactivation. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0008_desativacao_membro_equipe.sql` | `profiles.ativo`, extended `is_supervisor()`, `desativar_membro_equipe`, `reativar_membro_equipe` | ✓ VERIFIED | File exists, content matches plan verbatim (guard order, TOCTOU lock, two-separate-UPDATE-statements, em_andamento filter) — read directly, not from SUMMARY claim |
| `lib/supabase/admin.ts` | service_role client factory, confined-import discipline | ✓ VERIFIED | Single export `createAdminClient()`, reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix), `persistSession: false`/`autoRefreshToken: false` |
| `lib/equipe/erros.ts` | pure error-code mapper, 8-member union | ✓ VERIFIED | Dependency-free (`RPC_ERROR_MATCHERS` single source of truth), `mapRpcErrorToCode()` correctly orders fragments; `erro-mapping.test.ts` re-ran (9/9 passing) |
| `lib/equipe/membros.ts` | `EquipeMember` type + `substitutosDisponiveis()` | ✓ VERIFIED | Excludes target/inactive/non-vendedor from picker; unit-tested |
| `app/actions/equipe.ts` | `desativarMembroEquipe`/`reativarMembroEquipe` Server Actions | ✓ VERIFIED | RPC-then-Auth-Admin-API ordering confirmed by direct read; `ban_failed` distinct from `rpc_failed` |
| `components/equipe/DesativarMembroDialog.tsx` | always-present substitute picker, Copywriting Contract strings verbatim | ✓ VERIFIED | Direct read confirms exact contracted strings; render test passing |
| `components/equipe/EquipeList.tsx` | Status column (both states), per-row actions, D-01 hiding | ✓ VERIFIED | Direct read + render test (`D-01: esconde Desativar...`) passing |
| `app/(app)/equipe/page.tsx` | wired to `EquipeList`, `select()` includes `ativo`, `currentUserId` passed | ✓ VERIFIED | Direct read: `select("id, nome, sobrenome, email, role, ativo")`, `<EquipeList members={...} currentUserId={user.id} />`; no inline `<table>` remains |
| `tests/equipe/*` (6 files) | schema smoke, reassignment, RLS guards, auth-ban, erro-mapping, render test | ✓ VERIFIED | All 6 files exist; **43/43 tests pass** on a fresh live run performed during this verification (not taken from SUMMARY claims) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `is_supervisor()` | every existing RLS policy | `ativo = true` condition added once, zero policy edits | ✓ WIRED | Proven live by `rls-desativar-membro.test.ts`'s `categorias` INSERT probe — refused post-deactivation on the same unrefreshed token |
| `desativar_membro_equipe` | `clientes.responsavel` + `profiles.ativo` | two sequential top-level UPDATEs in one transaction | ✓ WIRED | `get diagnostics v_reatribuidos = row_count` present exactly once; reassignment test confirms only `em_andamento` moved |
| `app/actions/equipe.ts` | `lib/supabase/admin.ts` | import, confined | ✓ WIRED | `grep -rl "supabase/admin" --include=*.tsx .` returns nothing — no `.tsx`/Client Component imports it |
| `EquipeList.tsx`/`page.tsx` | `currentUserId` | prop passed from `auth.getUser()` down to hide D-01 action | ✓ WIRED | `currentUserId={user.id}` in page.tsx; `isSelf` check in `EquipeList.tsx`; render test confirms |
| `error.code` from Server Action | Copywriting Contract strings | `DesativarMembroDialog`'s ternary mapping | ✓ WIRED | All 4 distinct strings present verbatim, confirmed by direct read and by acceptance-criteria greps in the plans |

### Behavioral Spot-Checks (executed live during this verification, not from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase test directory | `npx vitest run tests/equipe` | 6 files, 43/43 passed | ✓ PASS |
| Seed accounts intact (SQL fix confirmed) | `npx vitest run tests/auth/rls-roles.test.ts` | 1 file, 5/5 passed | ✓ PASS |
| EQP-01 reassignment | `npx vitest run tests/equipe/reassignment.test.ts -t "reassigns em_andamento"` | 1 passed | ✓ PASS |
| EQP-01/EQP-04 whole-file (incl. "preserves closed") | `npx vitest run tests/equipe/reassignment.test.ts` | 7/7 passed | ✓ PASS |
| EQP-02 last-supervisor invariant | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "last supervisor"` | 1 passed | ✓ PASS |
| EQP-02 self-deactivation refusal | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "self"` | 1 passed | ✓ PASS |
| EQP-03 post-deactivation access loss | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` | 1 matched, passed | ✓ PASS |
| No service_role leak into browser bundle | `grep -rl "supabase/admin" --include=*.tsx .` | no matches | ✓ PASS |
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint (equipe files specifically) | `npm run lint \| grep equipe` | no output (zero findings) | ✓ PASS |
| Production build | `npm run build` | Compiled successfully, `/equipe` route present | ✓ PASS |
| Debt markers | `grep -nE "TBD\|FIXME\|XXX"` across all phase files | no matches | ✓ PASS |

Note on `npm run lint`: the full project lint run reports 476 pre-existing errors, all in unrelated Phase 9 files (`components/clientes/EstadoCidadeFields.tsx`, `components/clientes/FiltersPopover.tsx`) — a `react-hooks/set-state-in-effect` rule flagged after this phase's work, not caused by it. Zero findings in any file this phase touched.

### Manual-Only Verifications (10-VALIDATION.md) — resolved, not outstanding

Both items 10-VALIDATION.md marks manual-only (Auth `ban_duration` genuinely refuses a fresh login; `"none"` genuinely restores it) were personally executed end-to-end by the project owner against the live running app, per the `10-06-SUMMARY.md` transcript — not merely reported by the executor:

| Behavior | Status | Evidence |
|----------|--------|----------|
| Real Auth Admin API `ban_duration` blocks a fresh login attempt | ✓ RESOLVED (human checkpoint) | Deactivated `vendedor.b+test@raiar.local` via the real UI with a real replacement picked; logged out; attempted login with the correct password; login was refused with "E-mail ou senha incorretos" |
| `ban_duration: "none"` correctly unbans on reactivation | ✓ RESOLVED (human checkpoint) | Reactivated via the UI; logged out; logged back in with the same credentials; login succeeded |

These are counted toward the verified score above (Truth #3) rather than left as open human-verification items, per the explicit instruction that this checkpoint's transcript is authoritative evidence, and are independently cross-checked from a different angle by the automated `tests/equipe/auth-ban.test.ts` (API-level ban/unban round trip) and `tests/auth/rls-roles.test.ts` (the verification account provably signs in again post-walkthrough) — both re-ran live during this verification and passing.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| EQP-01 | 10-01, 10-02, 10-05, 10-06 | Supervisor desativa escolhendo substituto que herda em_andamento | ✓ SATISFIED | RPC + UI + live-tested |
| EQP-02 | 10-01, 10-03, 10-05 | Bloqueia desativação do último Supervisor ativo | ✓ SATISFIED | Invariant proven live |
| EQP-03 | 10-01, 10-03, 10-04, 10-06 | Membro desativado não entra mais; nome/histórico intactos | ✓ SATISFIED | RLS + Auth ban, live human-confirmed |
| EQP-04 | 10-01, 10-02 | Clientes ganho/perdido continuam com o vendedor desativado | ✓ SATISFIED | Reassignment test |

**Orphaned requirements check:** `.planning/REQUIREMENTS.md` maps exactly EQP-01..04 to Phase 10 — no additional IDs found unclaimed by a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 12-15, 71-74 | EQP-01..04 checkboxes still `[ ]` and traceability table still reads "Pending", despite the phase being fully implemented, tested (43/43), and live-verified | ℹ️ Info | Documentation bookkeeping only — does not affect delivered functionality (contrast with KAN-01/02 and LOC-01..04 above them in the same file, which were flipped to `[x]`/"Complete"). 10-01-SUMMARY.md explicitly recorded leaving this as "Pending" at that point in the phase, mirroring a Phase-9 precedent, but no later plan (10-02 through 10-06) closed the loop by updating REQUIREMENTS.md once the feature was fully done. Recommend running the project's requirements-completion update before/at milestone close so `/gsd-audit-milestone` doesn't need to rediscover this. Not a phase-goal blocker: the ROADMAP.md phase entry itself is already correctly marked `[x]` and "completed 2026-08-03." |

No debt markers (`TBD`/`FIXME`/`XXX`), no stub returns, no hardcoded empty-data patterns, and no unresolved `TODO`/`HACK`/`PLACEHOLDER` comments found in any file this phase touched.

### Human Verification Required

None outstanding. The two items this phase's own validation plan marked manual-only were personally completed by the project owner in a live walkthrough (see "Manual-Only Verifications" above), with a recorded transcript in `10-06-SUMMARY.md` quoting the actual login-refusal and login-success messages observed — not a claim taken on faith.

### Gaps Summary

No gaps blocking the phase goal. One documentation-hygiene note (REQUIREMENTS.md traceability table not flipped to Complete for EQP-01..04) is recorded above as informational; it does not affect the delivered feature, which is live, tested, and confirmed working end-to-end including the two effects (Auth-level login block/unblock) that no automated suite in this codebase can safely exercise against the live free-tier project.

---

*Verified: 2026-08-03*
*Verifier: Claude (gsd-verifier)*
