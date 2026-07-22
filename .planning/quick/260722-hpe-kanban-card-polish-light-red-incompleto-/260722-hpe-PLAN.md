---
phase: 260722-hpe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/clientes/ClienteCard.tsx
  - components/clientes/KanbanBoard.tsx
  - lib/funil/staleness.ts
  - tests/clientes/staleness.test.ts
autonomous: false
requirements: [POLISH-01, POLISH-02, POLISH-03]

must_haves:
  truths:
    - "The 'Incompleto' badge on a kanban card renders in a light-red treatment (bg-destructive/10 + text-destructive), not the neutral outline it uses today"
    - "Long column titles like 'Aguardando aprovação final do cliente/comitê' wrap onto two lines and stay fully readable instead of being truncated mid-word with an ellipsis"
    - "Every kanban card shows an always-visible 3-color left border: green when it has an open task none of which is overdue, amber when it has an open task that is overdue, red when it has no open tasks at all"
    - "The existing 'parado/atrasado' TriangleAlert tooltip icon behavior is preserved unchanged as a separate signal"
  artifacts:
    - lib/funil/staleness.ts
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx
    - tests/clientes/staleness.test.ts
  key_links:
    - "toCardData() in KanbanBoard.tsx computes taskStatus(cliente.tarefas_abertas) once and passes it into ClienteCardData, so both the Draggable and Static render branches get the border with no per-branch prop change"
    - "The new taskStatus() pure function reuses the existing tarefaAtrasada() to classify 'late', so the border and the overdue icon can never disagree on what 'atrasado' means"
    - "The Card root's left-border className is keyed off cliente.taskStatus (always rendered), replacing the old isOverdue-only amber border; isOverdue still drives the separate TriangleAlert tooltip"
---

<objective>
Three small, self-contained kanban-card visual polish changes requested by the owner, with no change to auth, data, or permission logic:

1. Make the "Incompleto" badge light-red (reuse the existing `destructive` badge variant — already `bg-destructive/10 text-destructive`).
2. Stop truncating long funnel-column titles — let them wrap onto two lines and stay fully readable.
3. Replace the current single amber "overdue" left border with an always-visible 3-color left border that reflects the card's open-task status: green = has an on-time open task, amber = has an overdue open task, red = no open task scheduled.

Purpose: Sharper at-a-glance signal on the board — the owner wants to instantly see which clients have no task scheduled (red) versus a late task (amber) versus a healthy one (green), and to read every column title in full. This is a presentation change plus one tiny new pure function; RLS remains the only authorization boundary and no query behavior changes.

Output: A restyled Incompleto badge, wrapping column headers (both render branches), a new `taskStatus()` pure function with unit tests, and a 3-color card left border driven by it.
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Files being changed / reused (study before editing)
@components/clientes/ClienteCard.tsx
@components/clientes/KanbanBoard.tsx
@lib/funil/staleness.ts
@lib/supabase/queries/clientes.ts
@components/ui/badge.tsx
@tests/clientes/staleness.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Light-red "Incompleto" badge</name>
  <files>components/clientes/ClienteCard.tsx</files>
  <action>
In components/clientes/ClienteCard.tsx (the `incompleto ? (...)` block, ~line 191), change the "Incompleto" Badge from `variant="outline"` to `variant="destructive"`. Keep everything else identical: the `className="shrink-0"` and the "Incompleto" text stay exactly as-is. The `destructive` variant already resolves to `bg-destructive/10 text-destructive` (verified in components/ui/badge.tsx), a light-red treatment, and is one of the three variants the UI-SPEC allows on this card (outline/secondary/destructive) — so no new variant or token is introduced. Do NOT touch the categoria/status badges or any other Badge on the card.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>The Incompleto badge uses `variant="destructive"` and renders light-red (bg-destructive/10 / text-destructive); it keeps `shrink-0` and its label. No other badge on the card changed. tsc is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Wrap long column titles instead of truncating</name>
  <files>components/clientes/KanbanBoard.tsx</files>
  <action>
In components/clientes/KanbanBoard.tsx there are TWO near-identical column-header blocks: one in the `dragDisabled` branch (~line 568-575) and one in the DndContext branch (~line 613-620). Update BOTH occurrences identically:

1. On the wrapping `<div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">`, change `items-center` to `items-start` so the count Badge pins to the top-right when the title wraps to a second line (instead of vertically centering against a two-line title).
2. On the `<h2 className="truncate text-xl font-semibold">`, remove `truncate`, change `text-xl` to `text-base`, and add `leading-tight`. Final className: `text-base leading-tight font-semibold`. This lets a long label such as "Aguardando aprovação final do cliente/comitê" wrap onto two lines and fit comfortably in the 280px-wide column.
3. Leave the count `<Badge variant="outline" className="shrink-0">{clientes.length}</Badge>` exactly as-is in both branches.

Both blocks must end up byte-for-byte identical to each other after the edit.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Neither column-header `<h2>` uses `truncate` anymore; both use `text-base leading-tight font-semibold`; both header rows use `items-start`; both count Badges are unchanged. The two header blocks are identical to each other. tsc is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Always-visible 3-color task-status left border</name>
  <files>lib/funil/staleness.ts, components/clientes/ClienteCard.tsx, components/clientes/KanbanBoard.tsx, tests/clientes/staleness.test.ts</files>
  <behavior>
    - taskStatus([], now) === "none"  (no open tasks scheduled)
    - taskStatus([one open task due tomorrow/today], now) === "on_time"
    - taskStatus([one open task past due], now) === "late"
    - taskStatus([one on-time task, one overdue task], now) === "late"  (any overdue makes it late)
  </behavior>
  <action>
Add a new open-task-status signal and drive the card's left border off it, keeping the existing "parado/atrasado" TriangleAlert icon as a SEPARATE indicator.

1. lib/funil/staleness.ts — add, colocated right after `tarefaAtrasada`:
   - An exported string-union type `TaskStatus = "on_time" | "late" | "none"`.
   - An exported pure function `taskStatus(tarefas: TarefaAberta[], now: Date = new Date()): TaskStatus`. Logic, in order: return `"none"` when `tarefas.length === 0`; return `"late"` when `tarefas.some((t) => tarefaAtrasada(t, now))`; otherwise return `"on_time"`. Reuse the existing `tarefaAtrasada` — do not reimplement overdue math. Mirror the existing header-comment style (pure function, unit-testable, safe to run every render). NOTE: `tarefas_abertas` already contains only OPEN (not concluída) tarefas, so length 0 genuinely means "no open task scheduled".

2. components/clientes/ClienteCard.tsx:
   - Import `type TaskStatus` from `@/lib/funil/staleness`.
   - Add `taskStatus: TaskStatus` to the `ClienteCardData` type (alongside the existing fields).
   - In the `<Card>` root `className={cn(...)}`, REPLACE the current `isOverdue && "border-l-4 border-l-amber-500"` entry with an always-on 3-color left border keyed off `cliente.taskStatus`: derive the border class from a small lookup — `on_time` → `"border-l-4 border-l-green-500"`, `late` → `"border-l-4 border-l-amber-500"`, `none` → `"border-l-4 border-l-red-500"` — and include that resolved class in the `cn(...)` call. The border must render for every card regardless of isOverdue.
   - Leave the `isOverdue` prop and the entire TriangleAlert tooltip block (in CardContent) UNCHANGED — it stays as the separate "Parado ou atrasado" reason indicator.

3. components/clientes/KanbanBoard.tsx:
   - Import `taskStatus` from `@/lib/funil/staleness` (add to the existing `{ diasParado, staleReason }` import from that module).
   - In `toCardData(cliente)`, add `taskStatus: taskStatus(cliente.tarefas_abertas)` to the returned object. Because BOTH the Draggable and Static branches build their card via `toCardData`, this covers both render branches with no per-branch prop edit.
   - Do NOT modify the drag-end optimistic path (~line 402-409) or `handleClienteSaved`: a stage move / edit never changes `tarefas_abertas`, and `toCardData` recomputes `taskStatus` on every render, so the border stays correct automatically. (This directly answers the "check whether it does" note: it does not.)

4. tests/clientes/staleness.test.ts — add a `describe("taskStatus")` block importing `taskStatus` (and reusing the existing `NOW` / `dateOnlyDaysAgo` helpers) with cases matching the <behavior> above: empty array → "none"; one open non-overdue task (due today) → "on_time"; one open overdue task (due 2 days ago) → "late"; a mixed array (one on-time + one overdue) → "late".

Do not add `taskStatus` to `ClienteListItem` or the `getClientesAgrupadosPorEtapa` query — computing it once in `toCardData` from the already-present `tarefas_abertas` is the minimal correct wiring.
  </action>
  <verify>
    <automated>npx vitest run tests/clientes/staleness.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>`taskStatus()` exists in lib/funil/staleness.ts, returns "none"/"on_time"/"late" per the behavior cases, and reuses tarefaAtrasada. Every card renders an always-visible `border-l-4` in green/amber/red keyed off taskStatus; the old isOverdue-only amber border is gone; the TriangleAlert tooltip is unchanged. The new vitest cases pass and tsc is clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human verify — badge color, wrapping titles, 3-color borders (both roles)</name>
  <what-built>
Three kanban-card polish changes: (1) a light-red "Incompleto" badge, (2) column titles that wrap onto two lines instead of truncating, and (3) an always-visible 3-color card left border (green = on-time open task, amber = overdue open task, red = no open task). Before the human check, the executor runs the full toolchain and pastes results: `npx vitest run tests/clientes/staleness.test.ts`, `npx tsc --noEmit`, `npx eslint components/clientes/ClienteCard.tsx components/clientes/KanbanBoard.tsx lib/funil/staleness.ts tests/clientes/staleness.test.ts`, and `npm run build` — all must pass.
  </what-built>
  <how-to-verify>
The dev server runs on http://localhost:3000. Open /clientes and verify visually in both roles.

1. Automated gate (executor runs first, paste results): staleness vitest passes, `npx tsc --noEmit` clean, eslint clean on the changed files, `npm run build` succeeds.

2. Log in as SUPERVISOR (cristiano.stephano@raiarorganicos.com.br / TestSupervisor!2026):
   - A card with an incomplete cadastro shows the "Incompleto" badge in LIGHT RED (soft red fill + red text), not a plain outline.
   - The column titled "Aguardando aprovação final do cliente/comitê" (and any other long title) is fully readable, wrapping onto two lines with no "…" ellipsis; the count badge sits at the top-right of the header.
   - Left borders read correctly across cards: GREEN on a card that has an open task not yet overdue; AMBER on a card whose open task is past due; RED on a card with no open task scheduled at all. The border is visible on every card (not only "problem" ones).
   - The existing warning-triangle tooltip (parado/atrasado) still appears where it did before.

3. Log in as VENDEDOR (vendedor.a+test@raiar.local / TestVendedorA!2026):
   - Same three checks on that vendedor's own cards (badge light-red, titles wrap, green/amber/red left borders correct).
  </how-to-verify>
  <resume-signal>Type "approved" once the build commands pass and both roles verify correctly, or describe what's wrong. Do NOT self-approve — the coordinator confirms this in the browser.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser (client) → RLS-protected Supabase | The only real authorization boundary; entirely unchanged by this plan (no query, action, or policy touched) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hpe-01 | Information Disclosure | New taskStatus-driven left border | low | accept | The border is derived purely from `tarefas_abertas`, which is already fetched and rendered for every card visible to the caller under the existing 02-01 clientes/tarefas RLS policy. It exposes no data the card did not already carry; a Vendedor still only ever sees their own cards. |
| T-hpe-02 | Tampering | Presentational className / variant edits | low | accept | Tasks 1-2 change only Tailwind classes and a badge variant; Task 3 adds a pure client-side function with no I/O. No new install, no server code, no auth path — nothing to tamper across a trust boundary. |
</threat_model>

<verification>
- `npx vitest run tests/clientes/staleness.test.ts` passes, including the new `taskStatus` cases (this is the real behavior test for the only new logic in the plan).
- `npx tsc --noEmit` passes (no type errors; `TaskStatus` threaded through ClienteCardData/toCardData).
- `npx eslint` passes on the four changed files (no `any` without justification, no unused imports).
- `npm run build` succeeds.
- Tasks 1 and 2 are pure styling (badge variant / Tailwind classes) with no testable logic, so they add no unit test; their correctness is confirmed by the Task 4 human checkpoint per the task brief and the CLAUDE.md "at least one automated test per feature" rule is satisfied by Task 3's new `taskStatus` tests.
</verification>

<success_criteria>
- The "Incompleto" badge renders light-red via the existing `destructive` variant.
- Long funnel-column titles wrap onto two lines (no truncation/ellipsis) in BOTH the drag-enabled and drag-disabled render branches, with the count badge top-aligned.
- Every card shows an always-visible 3-color left border: green (on-time open task) / amber (overdue open task) / red (no open task), driven by the new `taskStatus()` pure function that reuses `tarefaAtrasada()`.
- The pre-existing parado/atrasado TriangleAlert tooltip is preserved unchanged as a separate signal.
- vitest (incl. new taskStatus cases), tsc, eslint, and build are clean; the coordinator approves the browser verification for both roles.
</success_criteria>

<output>
Create `.planning/quick/260722-hpe-kanban-card-polish-light-red-incompleto-/260722-hpe-SUMMARY.md` when done.
</output>
