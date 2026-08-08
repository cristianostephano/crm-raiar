---
phase: 13-cliente-ativo-e-frequ-ncia-de-visita
plan: 03
subsystem: ui
tags: [react, nextjs, server-actions, supabase, vitest, base-ui]

requires:
  - phase: 13-01
    provides: "migration 0013 — frequencia_visita_enum, clientes.frequencia_visita nullable column, mover_card_funil extended with p_frequencia_visita"
  - phase: 13-02
    provides: "lib/funil/frequencia.ts vocabulary module, GanhoFrequenciaDialog, ClienteDetalhe.frequenciaVisita read"
provides:
  - "atualizarFrequenciaVisita — Server Action in app/actions/clientes.ts, an ordinary clientes UPDATE (never mover_card_funil) that edits/cancels the standing frequência de visita, failing closed via .select('id').maybeSingle() when RLS blocks a cross-vendedor edit"
  - "Standing 'Frequência de visita' Select in ClienteDetailSheet's Funil section — renders only when statusAcompanhamento === 'ganho', saves immediately on change, explains the null/legacy state (VIS-04)"
affects: [14, 15, 16, 17]

tech-stack:
  added: []
  patterns:
    - "Ordinary clientes field edits (frequencia_visita, like observacao before it) go through a dedicated Server Action that does a plain .update().select('id').maybeSingle() — never through mover_card_funil, which is reserved exclusively for etapa/status transitions"

key-files:
  created:
    - tests/clientes/frequencia-visita-edicao.test.ts
  modified:
    - app/actions/clientes.ts
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "atualizarFrequenciaVisita mirrors deleteCliente's shape (auth check, .select('id').maybeSingle() as the fail-closed proof RLS actually gated the write) rather than updateCliente's shape, since it touches exactly one column and needs no Zod re-parse beyond the existing isFrequenciaVisita type guard."
  - "The standing Select's onValueChange calls handleFrequenciaChange directly, never handleStatusChange/marcarStatus — this keeps the funil stage-transition RPC and the plain preference-edit UPDATE on two structurally separate code paths, matching 13-UI-SPEC.md's Interaction Contract point 4."

patterns-established: []

requirements-completed: [VIS-02, VIS-04, ATV-03]

coverage:
  - id: D1
    description: "atualizarFrequenciaVisita Server Action: ordinary UPDATE on clientes.frequencia_visita, re-validates input server-side, fails closed on cross-vendedor edits, never calls mover_card_funil"
    requirement: "VIS-02"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita-edicao.test.ts — edita, outro cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cancelling the cadence (frequência = 'nenhuma') does not remove or close the pending visita already agendada"
    requirement: "VIS-02"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita-edicao.test.ts — cancela, pendente cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "A legacy 'ganho' cliente with a null frequência can receive its first cadence through this same UPDATE path"
    requirement: "VIS-04"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita-edicao.test.ts — legado case"
        status: pass
    human_judgment: false
  - id: D4
    description: "The RPC-written value (at ganho) and the directly-edited value are the exact same column — last write wins, never two parallel values"
    requirement: "ATV-03"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita-edicao.test.ts — coluna case"
        status: pass
    human_judgment: false
  - id: D5
    description: "Standing 'Frequência de visita' Select renders in the Funil section, positioned between Status and observação, only when statusAcompanhamento === 'ganho'; shows 'Frequência ainda não definida.' when null; saves immediately with no confirmation dialog"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "structural node-eval check embedded in 13-03-PLAN.md's Task 2 <verify> block (position, guard, items prop, copy, handler isolation, lint-suppression count) — ran clean"
        status: pass
    human_judgment: true
    rationale: "The live popup interaction of the Base UI Select (open, pick an option, confirm it saves and persists after reopening the Sheet) is deliberately excluded from jsdom render tests (known jsdom/Base UI instability) and needs a real browser — this is exactly Task 3's blocking human-verify checkpoint, not yet approved as of this SUMMARY."
  - id: D6
    description: "End-to-end browser walkthrough of both Fase 13 surfaces (ganho dialog from 13-02 + standing frequência control from this plan), including the legacy-client empty state and the field's absence outside status=ganho"
    verification: []
    human_judgment: true
    rationale: "Task 3 is a blocking human-verify checkpoint (gate=\"blocking\") — the executing agent is explicitly instructed not to self-approve it. Awaiting the project owner's live browser walkthrough per the plan's how-to-verify steps."

duration: "~35min (Tasks 1-2 only; Task 3 checkpoint pending)"
completed: 2026-08-07
status: complete
---

# Phase 13 Plan 03: Edição Permanente de Frequência de Visita Summary

**Server Action `atualizarFrequenciaVisita` (ordinary `clientes` UPDATE, never the funil RPC) plus a standing "Frequência de visita" Select in `ClienteDetailSheet`'s Funil section, saving immediately with no confirmation step — closes VIS-02/VIS-04/ATV-03 for the phase.**

## Performance

- **Duration:** ~35min (Tasks 1-2 automated work; Task 3 human-verify checkpoint reached and left pending, per this plan's explicit gate)
- **Tasks:** 2/3 (Task 3 is a blocking checkpoint, not yet approved)
- **Files modified:** 3 (1 new test file, 2 edited)

## Accomplishments
- `atualizarFrequenciaVisita(clienteId, frequencia)` added to `app/actions/clientes.ts`: checks auth, re-validates the frequência with `isFrequenciaVisita` (never trusts the browser even though it's typed), does a plain `.update({ frequencia_visita }).eq("id", clienteId).select("id").maybeSingle()`, and treats "0 rows returned" as the RLS-blocked-write fail-closed path — same posture `deleteCliente` already established, extended to this new column.
- `tests/clientes/frequencia-visita-edicao.test.ts` (new): 6 integration cases (`edita`, `cancela`, `pendente`, `outro`, `legado`, `coluna`) against the real hosted Supabase project with real signed-in sessions, proving VIS-02 (edit/cancel, no destructive treatment of "Nenhuma"), the pending-visita survives a cadence cancel, cross-vendedor writes fail closed, legacy `ganho` clients can receive a first cadence (VIS-04), and the RPC-write vs. direct-edit paths share one single column (ATV-03).
- `ClienteDetailSheet.tsx`: new standing Select (`id="cliente-frequencia-visita-select"`) inside the Funil section's `data-slot="funil-section"` div, positioned between the Status Select and the `observacao` field, rendered only when `cliente.statusAcompanhamento === "ganho"`. `onValueChange` calls a new, isolated `handleFrequenciaChange` — never `handleStatusChange`/`marcarStatus`/`mover_card_funil`. Shows the `GENERIC_ERROR` constant on save failure (reused, no new copy) and "Frequência ainda não definida." when the value is null (VIS-04's legacy-client explanation).
- No new diálogo, no destructive styling, no `react-hook-form` wiring — the control saves outside the Sheet's "Salvar alterações" submit, matching VIS-02's minimum-friction requirement.

## Task Commits

1. **Task 1: Server Action `atualizarFrequenciaVisita` + integration tests** — `e6ac1bc`
2. **Task 2: Standing frequência Select in ClienteDetailSheet's Funil section** — `5ab2bb5`

**Plan metadata:** pending (this SUMMARY commit, made once the checkpoint's resolution is known)

## Files Created/Modified
- `app/actions/clientes.ts` — added `atualizarFrequenciaVisita` (new export, `AtualizarFrequenciaVisitaErrorCode`/`Result` types); no existing exports touched
- `tests/clientes/frequencia-visita-edicao.test.ts` — new integration test file, 6 cases against the live project
- `components/clientes/ClienteDetailSheet.tsx` — new `frequenciaError`/`isSavingFrequencia` state, `handleFrequenciaChange` handler, standing Select render block

## Decisions Made
- `atualizarFrequenciaVisita`'s failure-closed shape mirrors `deleteCliente` (single-column update, `.select("id").maybeSingle()` as proof-of-write) rather than `updateCliente`'s multi-field Zod-parsed shape — it's a one-column edit and already has a type guard (`isFrequenciaVisita`) from 13-02, so a second validation layer would be redundant.
- Kept `handleFrequenciaChange` fully separate from `handleStatusChange`, even though both ultimately touch `clientes` — this is what keeps the funil stage/status RPC and the plain-preference-edit UPDATE on two independently auditable code paths (13-UI-SPEC.md Interaction Contract point 4; also backs threat mitigation T-13-19 in the plan's threat register).

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2.

## Issues Encountered

None for Tasks 1-2. `.env.local` was missing in this fresh worktree checkout (expected — it's gitignored) and was copied from the main checkout at `C:\Users\Cristiano\workspace\crm-raiar\.env.local` before running the integration tests, per the orchestrator's setup instructions.

## User Setup Required

None - no external service configuration required. `npm run dev` was started in this worktree to prepare the environment for Task 3's browser checkpoint (currently running on `http://localhost:3000`).

## Next Phase Readiness

**This plan is paused at Task 3 — a blocking human-verify checkpoint.** Tasks 1 and 2 are complete, committed, and independently verified (`tsc`, `eslint`, the plan's structural node-eval checks, the new integration test file, and the pre-existing `tests/clientes/ganho-frequencia-dialog.test.tsx` render test all pass). What remains is a live browser walkthrough of both Fase 13 UI surfaces (the 13-02 ganho dialog and this plan's standing frequência control), which only a human can confirm per the plan's own six `how-to-verify` steps. Phase 13 cannot be marked complete, and ROADMAP.md/REQUIREMENTS.md traceability cannot be finalized, until that checkpoint is approved.

---
*Phase: 13-cliente-ativo-e-frequ-ncia-de-visita*
*Plan: 03*
*Completed: 2026-08-07 (Tasks 1-2; Task 3 pending)*

## Self-Check: PASSED

- FOUND: app/actions/clientes.ts
- FOUND: tests/clientes/frequencia-visita-edicao.test.ts
- FOUND: components/clientes/ClienteDetailSheet.tsx
- FOUND: .planning/phases/13-cliente-ativo-e-frequ-ncia-de-visita/13-03-SUMMARY.md
- FOUND commit: e6ac1bc (Task 1)
- FOUND commit: 5ab2bb5 (Task 2)
