---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 07
subsystem: ui
tags: [react, shadcn, supabase, rls, postgres-rpc, vitest, react-day-picker]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-01
    provides: "mover_card_funil RPC, chk_ganho_somente_etapa_final/chk_perdido_exige_motivo CHECK constraints, historico SECURITY DEFINER triggers, tarefas/motivos_perda/tipos_tarefa tables + RLS"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-06
    provides: "ClienteDetailSheet's empty Funil placeholder region, ClienteDetalhe/getClienteById, updateCliente's re-validation pattern"
provides:
  - "marcarStatus Server Action (app/actions/funil.ts) — status_acompanhamento changes routed through mover_card_funil, enforcing FUN-05/FUN-06 with friendly pre-check errors"
  - "adicionarTarefa/toggleTarefa/removerTarefa/atualizarDataTarefa Server Actions (app/actions/tarefas.ts), RLS-gated via the parent cliente"
  - "getTarefas/getHistorico/getTiposTarefaAtivos/getMotivosPerdaAtivos query functions + Server Action wrappers"
  - "observacao folded into updateClienteSchema/updateCliente (FUN-07)"
  - "ClienteDetailSheet's completed Funil section: Status control, Observação, Tarefas checklist, Histórico timeline"
  - "components/clientes/PerdaMotivoDialog.tsx, components/clientes/HistoricoTimeline.tsx"
affects: []

# Tech tracking
tech-stack:
  added: ["shadcn textarea/calendar (react-day-picker as calendar's dependency)"]
  patterns:
    - "Status/business-rule changes always route through the mover_card_funil RPC (never a raw clientes UPDATE), mirroring moverCard's 02-04 pattern — pre-checks only produce friendlier error codes, the 02-01 CHECK constraints remain the real backstop"
    - "Server Actions never insert into historico — only the 02-01 SECURITY DEFINER triggers do; every Funil-section mutation (status, task completion) is proven to produce exactly one historico row via the trigger, not application code"
    - "Tooltip-on-a-disabled-control uses a nested pointer-events-auto icon inside the disabled parent (which itself has pointer-events-none via its own disabled styling) rather than wrapping the whole disabled element in a Tooltip trigger — the same TooltipTrigger props signature already proven in ClienteCard.tsx's overdue icon"
    - "Full-catalog lookup tables that never appear in the already-loaded kanban card set (tipos_tarefa, motivos_perda) get their own dedicated query + Server Action wrapper, unlike categoria/produto/vendedor options which are derived in-memory from the loaded set (02-05's Pitfall-7 convention only applies when the option data is already present in that set)"

key-files:
  created:
    - components/clientes/PerdaMotivoDialog.tsx
    - components/clientes/HistoricoTimeline.tsx
    - app/actions/tarefas.ts
    - tests/clientes/funil-status.test.ts
  modified:
    - app/actions/funil.ts
    - app/actions/clientes.ts
    - lib/validations/cliente.ts
    - lib/supabase/queries/clientes.ts
    - components/clientes/ClienteDetailSheet.tsx
    - components/ui/textarea.tsx
    - components/ui/calendar.tsx
    - package.json

key-decisions:
  - "app/actions/clientes.ts's updateCliente was modified (not listed in the plan's frontmatter files_modified) to actually persist the new observacao field — the plan's own <action> text explicitly required this ('persist it in updateCliente'), so this is treated as a plan-instruction-driven edit, not scope creep"
  - "Added atualizarDataTarefa (app/actions/tarefas.ts) beyond the plan's 3-action list (adicionarTarefa/toggleTarefa/removerTarefa) — the UI-SPEC explicitly describes a Calendar-in-Popover date picker on every EXISTING tarefa row (not just at creation), which would be a non-functional/stub control without a way to persist the edit (Rule 2 — missing critical functionality)"
  - "PerdaMotivoDialog's 'Confirmar perda' button is genuinely HTML-disabled (not just validated-on-click) whenever no motivo is selected, with the required-motivo copy shown as a persistent helper caption — satisfies the acceptance criteria's literal 'source assertion: confirm is disabled until a motivo is selected' more directly than a click-time-only validation would"
  - "getTiposTarefaAtivos/getMotivosPerdaAtivos are real full-catalog queries (unlike categoria/produto/vendedor options elsewhere in this phase) because tipos_tarefa/motivos_perda never appear in the already-loaded kanban card set — 02-05's Pitfall-7 in-memory-derivation convention doesn't apply when the source data isn't already loaded"

requirements-completed: [FUN-04, FUN-05, FUN-06, FUN-07, FUN-08, FUN-10]

coverage:
  - id: D1
    description: "The Funil section's Status control lets a user set em andamento/perdido/ganho; Ganho is disabled with the required tooltip copy unless the card is in the final stage (FUN-04/FUN-05)"
    requirement: "FUN-05"
    verification:
      - kind: unit
        ref: "tests/clientes/funil-status.test.ts — 'marcarStatus routes through mover_card_funil, which rejects ganho from a non-final stage'"
        status: pass
      - kind: other
        ref: "Source assertion: the Ganho SelectItem's `disabled` prop is tied to `cliente.etapa !== ETAPA_FINAL`; the disabled item nests a Tooltip (pointer-events-auto icon) showing the exact copy 'Disponível somente na etapa \"1ª venda concluída\".'"
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: open a card not in the final stage — Ganho is disabled with its tooltip; move it to '1ª venda concluída', reopen — Ganho is now selectable"
        status: unknown
    human_judgment: true
    rationale: "Visual disabled-state/tooltip rendering and the drag-then-reopen flow need a human looking at the rendered UI; deferred to end-of-phase batch per config.json's human_verify_mode."
  - id: D2
    description: "Choosing Perdido opens PerdaMotivoDialog, which requires a motivo before it can be confirmed — Confirmar perda is genuinely disabled until one is selected (FUN-06)"
    requirement: "FUN-06"
    verification:
      - kind: unit
        ref: "tests/clientes/funil-status.test.ts — 'perdido without motivo is rejected by mover_card_funil' and 'perdido with a motivo succeeds AND writes exactly one historico row'"
        status: pass
      - kind: other
        ref: "Source assertion: PerdaMotivoDialog's Confirmar perda Button has `disabled={isSubmitting || isLoading || !selectedMotivoId}`; the required-motivo copy renders as a persistent helper caption while unselected."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: choosing Perdido opens the modal; Confirmar perda stays disabled until a motivo is picked; confirming writes the perdido status"
        status: unknown
    human_judgment: true
    rationale: "Modal interaction and disabled-button visual state need a human looking at the rendered UI; deferred to end-of-phase batch."
  - id: D3
    description: "Each card has a free-text observação (FUN-07) persisted through the existing Salvar alterações, and a tarefas checklist where every task has a tipo and its own data_conclusao, addable/checkable/removable with overdue styling (FUN-08)"
    requirement: "FUN-07"
    verification:
      - kind: unit
        ref: "tests/clientes/funil-status.test.ts — 'flipping concluida false -> true creates one historico row'; tests/clientes/update-delete.test.ts's updateClienteSchema describe block (schema now includes observacao)"
        status: pass
      - kind: other
        ref: "Source assertion: observacao is a FormField bound to the same react-hook-form instance as the rest of the Sheet, submitted via the single 'Salvar alterações' button and persisted in updateCliente's .update() call; each tarefa row renders tipo + a Calendar-in-Popover data_conclusao (red text via tarefaAtrasada() when overdue and unchecked) + ghost delete; '+ Adicionar tarefa' is an outline (never filled blue) button per the Copywriting Contract."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: type an observação and Salvar — persists on reopen; add a tarefa with a past due date left unchecked — date shows red; check it — histórico gets a new entry"
        status: unknown
    human_judgment: true
    rationale: "Overdue red styling, strike-through-on-check, and observação persistence-on-reopen need a human looking at the rendered UI; deferred to end-of-phase batch."
  - id: D4
    description: "Each client shows a read-only histórico timeline of stage/status changes and completed tasks with date & time, generated automatically with no manual entry, newest first (FUN-10)"
    requirement: "FUN-10"
    verification:
      - kind: unit
        ref: "tests/clientes/funil-status.test.ts — both historico-row-count assertions (perdido-with-motivo, tarefa-concluida) confirm the trigger — not application code — is what writes historico"
        status: pass
      - kind: other
        ref: "Source assertion: HistoricoTimeline.tsx has no write controls at all (pure read of getHistorico's already-descending-ordered rows); grep of app/actions/funil.ts and app/actions/tarefas.ts confirms neither ever calls .from(\"historico\").insert(...)."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: the histórico list shows stage/status/task events with date & time, newest first, with no interactive controls"
        status: unknown
    human_judgment: true
    rationale: "Visual confirmation of the rendered timeline's ordering/plainness needs a human looking at the UI; deferred to end-of-phase batch."
  - id: D5
    description: "tarefas Server Actions are RLS-gated via the parent cliente — a Vendedor cannot touch tarefas on a non-owned client, even via a direct call bypassing the UI"
    requirement: "FUN-08"
    verification:
      - kind: unit
        ref: "tests/clientes/funil-status.test.ts — 'Vendedor B toggling a tarefa on Vendedor A's cliente is a no-op (0 rows affected)'"
        status: pass
    human_judgment: false
  - id: D6
    description: "npx tsc --noEmit, npm run lint (files this plan touched), npm run build, and npx vitest run tests/clientes/ all pass"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run build — Compiled successfully, /clientes route listed; eslint on every file this plan touched — 0 errors (1 pre-existing form.watch()-incompatible-library warning, same as 02-06); tests/clientes/*.test.ts run in batches (Supabase auth rate-limit constraint, documented since 02-01) — all pass, 62 tests across 7 files"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 7: Funil Section (Status, Observação, Tarefas, Histórico) Summary

**Completes the client detail Sheet's Funil section — status control with the ganho-final-stage-only courtesy and required-motivo perda modal, observação, a tarefas checklist with overdue styling, and a read-only automatic histórico timeline — closing out FUN-04 through FUN-10 and finishing Phase 2's vertical slice.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-17
- **Tasks:** 2/2
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments

- **marcarStatus (FUN-04/FUN-05/FUN-06):** Added to `app/actions/funil.ts` — always routes through `mover_card_funil` (never a raw `clientes` UPDATE) with the card's current etapa, so the 02-01 CHECK constraints remain the real backstop; pre-checks return `ganho_travado`/`motivo_obrigatorio` friendly error codes before ever hitting the RPC.
- **Tarefas data layer (FUN-08):** New `app/actions/tarefas.ts` — `adicionarTarefa`/`toggleTarefa`/`removerTarefa`/`atualizarDataTarefa`, all RLS-gated via the parent cliente (a Vendedor cannot touch a non-owned client's tarefas, proven by a real cross-vendedor test).
- **observação (FUN-07):** Folded into `updateClienteSchema`/`updateCliente` — no separate save action, persists together with the rest of "Salvar alterações".
- **Read layer:** `getTarefas`/`getHistorico`/`getTiposTarefaAtivos`/`getMotivosPerdaAtivos` in `lib/supabase/queries/clientes.ts`, each with a thin Server Action wrapper (`getTarefasAction`/`getHistoricoAction`/`getTiposTarefa`/`getMotivosPerda`) since `ClienteDetailSheet` is a Client Component.
- **`ClienteDetailSheet`'s Funil section (FUN-04/05/06/07/08/10):** Status `Select` (colored dot per state, Ganho disabled unless `cliente.etapa === ETAPA_FINAL` with a hover Tooltip carrying the exact copy), Observação `Textarea`, a tarefas checklist (`Checkbox` + tipo + Calendar-in-Popover due date, red when overdue via `tarefaAtrasada()`, ghost delete, inline "+ Adicionar tarefa" form), and `HistoricoTimeline` — all replacing 02-06's empty placeholder without restructuring the rest of the Sheet.
- **`PerdaMotivoDialog.tsx` (FUN-06):** Required-motivo confirmation modal; "Confirmar perda" is genuinely `disabled` until a motivo is selected, with the exact copywriting-contract validation message shown as a persistent caption.
- **`HistoricoTimeline.tsx` (FUN-10):** Pure read-only, newest-first list — no write controls anywhere in the component, matching the "automatic, non-interactive log" design intent.
- **`tests/clientes/funil-status.test.ts`:** 10 passing tests proving ganho/perdido rejection via the same RPC call marcarStatus makes, exactly-one-historico-row on both perdido-with-motivo and task-completion (proving the 02-01 triggers — not application code — write historico), and cross-vendedor tarefas isolation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Status + tarefas Server Actions and their history side-effects (+ tests)** - `e3a2666` (feat)
2. **Task 2: Funil section UI — status + observação + tarefas + histórico + perda modal** - `c36151a` (feat)
3. **Fixup: make PerdaMotivoDialog's Confirmar perda genuinely disabled** - `3d77c0f` (fix)

## Files Created/Modified

- `app/actions/funil.ts` - `marcarStatus`, `getHistoricoAction`, `getMotivosPerda`
- `app/actions/tarefas.ts` - `adicionarTarefa`, `toggleTarefa`, `removerTarefa`, `atualizarDataTarefa`, `getTarefasAction`, `getTiposTarefa`
- `app/actions/clientes.ts` - `updateCliente` now persists `observacao`
- `lib/validations/cliente.ts` - `updateClienteSchema` gains optional `observacao`
- `lib/supabase/queries/clientes.ts` - `ClienteDetalhe`/`getClienteById` gain `etapa`/`statusAcompanhamento`/`motivoPerdaId`/`observacao`; new `getTarefas`, `getHistorico`, `getTiposTarefaAtivos`, `getMotivosPerdaAtivos`, `StatusAcompanhamento`/`Tarefa`/`HistoricoEntry`/`LookupOption` types
- `components/clientes/ClienteDetailSheet.tsx` - Funil section (status/observação/tarefas/histórico) replacing 02-06's placeholder
- `components/clientes/PerdaMotivoDialog.tsx` - required-motivo perda confirmation modal
- `components/clientes/HistoricoTimeline.tsx` - read-only automatic timeline
- `components/ui/textarea.tsx`, `components/ui/calendar.tsx` - shadcn-CLI-installed primitives
- `tests/clientes/funil-status.test.ts` - 10 tests (status/tarefas RPC behavior + historico + cross-vendedor RLS)

## Decisions Made

See `key-decisions` in the frontmatter above for the full list and rationale (the observacao persistence edit to `app/actions/clientes.ts`, the added `atualizarDataTarefa` action, the genuinely-disabled Confirmar perda button, and why tipos_tarefa/motivos_perda need real full-catalog queries unlike categoria/produto/vendedor options elsewhere in this phase).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Edited app/actions/clientes.ts, which wasn't in the plan's frontmatter files_modified list**
- **Found during:** Task 1
- **Issue:** The plan's own `<action>` text for Task 1 explicitly says to "persist it in updateCliente (already exists from 02-06)" for the new `observacao` field, but `app/actions/clientes.ts` (where `updateCliente` lives) wasn't listed in the plan frontmatter's `files_modified`. Folding observação into the existing save action (rather than a separate `salvarObservacao` action) was the plan's own explicit design — completing Task 1 as written required this edit.
- **Fix:** Added `observacao: parsed.data.observacao || null` to `updateCliente`'s `.update()` payload.
- **Files modified:** `app/actions/clientes.ts`
- **Verification:** `npx tsc --noEmit` clean; `tests/clientes/update-delete.test.ts`'s `updateClienteSchema` tests still pass (schema now accepts the optional field).
- **Committed in:** `e3a2666` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added atualizarDataTarefa beyond the plan's 3-action tarefas list**
- **Found during:** Task 2
- **Issue:** The UI-SPEC explicitly describes a Calendar-in-Popover date picker on every EXISTING tarefa row (not only when creating one), but the plan's Task 1 `<behavior>` only lists `adicionarTarefa`/`toggleTarefa`/`removerTarefa` — no action existed to persist an edit to an existing tarefa's `data_conclusao`. Shipping a "date picker" that couldn't actually save a change would be a non-functional stub control.
- **Fix:** Added `atualizarDataTarefa(tarefaId, dataConclusao)` to `app/actions/tarefas.ts`, same RLS-gated posture as `toggleTarefa`/`removerTarefa`; wired it to each tarefa row's Calendar Popover in `ClienteDetailSheet.tsx`.
- **Files modified:** `app/actions/tarefas.ts`, `components/clientes/ClienteDetailSheet.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` — Compiled successfully.
- **Committed in:** `c36151a` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed PerdaMotivoDialog's Confirmar perda to be genuinely disabled**
- **Found during:** Task 2, after re-reading the acceptance criteria's exact wording
- **Issue:** The initial implementation only validated on click (showing the required-motivo message after an attempted confirm with no motivo selected), rather than the button itself being `disabled` — the acceptance criteria's "source assertion" phrasing ("Confirmar perda is disabled until a motivo is chosen") calls for the literal disabled state.
- **Fix:** Tied the button's `disabled` prop directly to `!selectedMotivoId`; the required-motivo copy now also renders as a persistent helper caption whenever no motivo is selected, not only after a rejected click attempt.
- **Files modified:** `components/clientes/PerdaMotivoDialog.tsx`
- **Verification:** `npx tsc --noEmit`/`npm run build` clean.
- **Committed in:** `3d77c0f` (separate fixup commit, immediately after Task 2's commit)

**4. [Rule 3 - Blocking] eslint-disable for a false-positive react-hooks/set-state-in-effect error**
- **Found during:** Task 2, `npm run lint`
- **Issue:** `PerdaMotivoDialog`'s "fetch motivos on open" effect (an idiomatic fetch-on-prop-change pattern, structurally identical to `ClienteDetailSheet`'s own `getClienteDetalhe` effect) tripped `react-hooks/set-state-in-effect` as a hard error. Comparison confirmed `ClienteDetailSheet`'s identical pattern isn't flagged at all — apparently because that file's separate use of `form.watch()` (react-hook-form) causes React Compiler's static analysis to skip the whole component ("Compilation Skipped: Use of incompatible library", an existing warning from 02-06), which incidentally also silences this newer compiler-based lint rule for that file. `PerdaMotivoDialog` has no such incompatible-library usage, so the rule fired normally on an otherwise-unavoidable "set loading flag before an async fetch" statement.
- **Fix:** Added a single targeted `eslint-disable-next-line react-hooks/set-state-in-effect` on the `setIsLoading(true)` line, with a comment explaining the pattern is intentional and matches the established sibling component; also refactored the dialog's own "reset on close" logic out of the effect into an explicit `handleOpenChange` wrapper (avoids a second, unrelated instance of the same lint shape).
- **Files modified:** `components/clientes/PerdaMotivoDialog.tsx`
- **Verification:** `npx eslint components/clientes/PerdaMotivoDialog.tsx` — 0 errors, 0 warnings.
- **Committed in:** `c36151a` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking file-scope correction, 1 missing-critical-functionality addition, 1 bug fix on a mis-worded disabled-state, 1 blocking lint false-positive)
**Impact on plan:** All four were necessary to complete Task 1/Task 2 as the plan's own `<action>`/UI-SPEC text and acceptance criteria actually specify, or to get a clean `npm run lint`. No scope creep beyond what the plan already called for.

## Issues Encountered

- `tests/clientes/funil-status.test.ts` transitively imports `SEED_ACCOUNTS` from `tests/auth/rls-roles.test.ts`, which re-runs that file's own `describe` blocks too. One run hit the same pre-existing "JWT issued at future" (`PGRST303`) clock-skew flake documented in `02-01-SUMMARY.md`'s "Issues Encountered" — reran in isolation immediately after and all 10 tests passed cleanly. Not a regression introduced by this plan.
- Running the full `tests/clientes/` directory in one `vitest run` invocation still trips Supabase's free-tier auth sign-in rate limit (documented since 02-01/02-06) — all 7 files pass cleanly (62/62 tests) when run in 2-3 file batches, consistent with the established pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every FUN-0x requirement (FUN-01 through FUN-10) is now user-visible and DB-enforced. Phase 2's full vertical slice — cadastro → kanban board → drag-move → search/filter → edit/delete → funil detail (status/observação/tarefas/histórico) — is implementation-complete.
- End-to-end manual verification of the Funil section (Ganho enable/disable + tooltip, perda modal, observação persistence, tarefa overdue styling + completion, histórico ordering) is deferred to the end-of-phase human-check batch per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for closing out the phase, but should be run before considering Phase 2 fully signed off.
- No blockers for Phase 3 (Admin/enum CRUD) or Phase 4 (Dashboard) — both can build directly on the `clientes`/`tarefas`/`historico`/lookup-table schema and Server Action patterns established across this phase.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created files verified present on disk (`app/actions/tarefas.ts`, `components/clientes/PerdaMotivoDialog.tsx`, `components/clientes/HistoricoTimeline.tsx`, `tests/clientes/funil-status.test.ts`, `components/ui/textarea.tsx`, `components/ui/calendar.tsx`); all task commit hashes (`e3a2666`, `c36151a`, `3d77c0f`) confirmed present in `git log`.
