---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 04
subsystem: ui
tags: [react, base-ui, combobox, filters, kanban]

# Dependency graph
requires:
  - phase: 09-01
    provides: "cidades table + cidades_por_estado(p_uf) RPC (SECURITY INVOKER, read-open RLS)"
  - phase: 09-02
    provides: "UFS frontend constant (27 UF siglas) + components/ui/combobox.tsx (base-nova preset)"
provides:
  - "FiltersPopover.tsx with Estado rendering before Cidade (LOC-03)"
  - "Estado filter fed by the fixed UFS constant instead of a dynamically-derived estadoOptions prop (LOC-01)"
  - "Cidade filter as a searchable Combobox over cidades_por_estado(draft.estado), disabled until Estado is chosen, with cascade reset on Estado change (LOC-02/D-02)"
  - "clienteAtendeFiltros exact-match Cidade comparison instead of substring includes() (Pitfall 4)"
  - "tests/clientes/filters-popover.test.tsx contract test (order, disable, exact-match)"
affects: [09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft-state cascade reset: an onValueChange handler that sets two fields at once (estado + cidade: '') instead of a separate effect, mirroring the non-RHF hand-rolled state style already used by this popover"
    - "Placeholder-by-state switching on a single ComboboxInput (disabled / closed / open) driven by local component state (cidadeComboboxOpen) tied to the Combobox's onOpenChange, rather than a separate always-visible search box"

key-files:
  created:
    - tests/clientes/filters-popover.test.tsx
  modified:
    - components/clientes/FiltersPopover.tsx
    - components/clientes/ClienteToolbar.tsx
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "Cidade Combobox reuses the single ComboboxInput as both the display field and the search box (per components/ui/combobox.tsx's actual API), switching its placeholder between 'Escolha o Estado primeiro' (disabled), 'Todas as cidades' (enabled, closed) and 'Buscar cidade...' (enabled, popup open) to satisfy all three Copywriting Contract strings with one control"
  - "estadoOptions removed in the same commit from FiltersPopover, ClienteToolbar, and KanbanBoard (including the now-dead useMemo) to keep tsc green throughout — matches the plan's explicit instruction to do this atomically"

requirements-completed: [LOC-01, LOC-02, LOC-03]

coverage:
  - id: D1
    description: "Estado block renders before Cidade block in the filter popover's DOM order (LOC-03)"
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "tests/clientes/filters-popover.test.tsx#renderiza o bloco de Estado antes do bloco de Cidade (LOC-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Estado filter options come from the fixed UFS constant (dead estadoOptions prop/useMemo removed in chain across FiltersPopover/ClienteToolbar/KanbanBoard)"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "node -e grep-style script asserting UFS import present and estadoOptions absent in all three files (see Task 2 <verify> block)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cidade is a searchable Combobox over cidades_por_estado, disabled until Estado is chosen, and switching Estado resets Cidade"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "tests/clientes/filters-popover.test.tsx#mantém Cidade desabilitada até um Estado ser escolhido (D-02)"
        status: pass
    human_judgment: true
    rationale: "Automated test only proves the disabled state and placeholder; the cascade-reset-on-Estado-change and the live RPC-backed search dropdown interaction are best confirmed visually in the running app (no RTL coverage of the reset-on-change behavior was added, to keep the jsdom/base-ui popup interaction stable per the plan's own fallback allowance)."
  - id: D4
    description: "clienteAtendeFiltros compares Cidade by exact case-insensitive match instead of substring includes()"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "tests/clientes/filters-popover.test.tsx#clienteAtendeFiltros compara Cidade por igualdade exata, não substring (Pitfall 4)"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 04: Filtros de Estado e Cidade Estruturados Summary

**FiltersPopover reordered (Estado before Cidade), Estado now fed by the fixed UFS constant, Cidade turned into a cascading Combobox over `cidades_por_estado` disabled until Estado is picked, and Cidade matching switched from substring to exact — with `estadoOptions` dead code removed in chain from ClienteToolbar/KanbanBoard.**

## Performance

- **Duration:** ~25 min (active edits; environment setup — `npm install`, since this worktree had no `node_modules` — took ~2 min of that)
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Fixed the two real bugs RESEARCH.md found in `FiltersPopover.tsx`: Cidade rendered before Estado (now reordered), and Cidade matched by substring `includes()` (now exact case-insensitive match)
- Estado filter now sourced from the fixed `UFS` constant (09-02) instead of a dynamically-derived list of whatever states already have clientes loaded — a UF with zero clientes no longer disappears from the filter
- Cidade filter is now a searchable `Combobox` calling `cidades_por_estado(draft.estado)`, disabled until an Estado is chosen (D-02), with a cascade reset (picking a new Estado clears any previously-chosen Cidade)
- Removed the now-dead `estadoOptions` prop in one atomic change across `FiltersPopover.tsx` → `ClienteToolbar.tsx` → `KanbanBoard.tsx` (including the `useMemo` that derived it), keeping `tsc` green throughout
- New contract test `tests/clientes/filters-popover.test.tsx` proves the DOM order, the disabled-until-Estado state, and the exact-match filtering behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Teste de contrato do FiltersPopover — ordem, disable de Cidade e exact-match (RED)** - `812910b` (test)
2. **Task 2: FiltersPopover — reorder + UFS + Combobox de Cidade + exact-match, e remoção em cadeia de estadoOptions (GREEN)** - `b9816b6` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `tests/clientes/filters-popover.test.tsx` - New RTL contract test: Estado-before-Cidade DOM order, Cidade disabled without Estado, and `clienteAtendeFiltros` exact-match on Cidade
- `components/clientes/FiltersPopover.tsx` - Reordered Estado/Cidade blocks, imports `UFS` (dropped `estadoOptions` prop), Cidade is now a `Combobox` wired to `cidades_por_estado` with cascade reset and state-driven placeholder, `clienteAtendeFiltros` uses exact match
- `components/clientes/ClienteToolbar.tsx` - Stopped threading `estadoOptions` to `FiltersPopover`
- `components/clientes/KanbanBoard.tsx` - Removed the dead `estadoOptions` `useMemo` and its passthrough to `ClienteToolbar`

## Decisions Made
- The Cidade Combobox uses a single always-visible `ComboboxInput` (per the actual shape of `components/ui/combobox.tsx`, which doesn't have a separate trigger-vs-search-box split like `Select` does) and switches its placeholder by local state — disabled → "Escolha o Estado primeiro", enabled+closed → "Todas as cidades", enabled+open → "Buscar cidade..." — to honor all three strings in the UI-SPEC's Copywriting Contract with one control instead of inventing a two-control layout not present in the shared component.
- Task 1's test had to pass a placeholder `estadoOptions={[]}` prop to keep `tsc --noEmit` clean against the *pre-fix* `FiltersPopover` (which still required it at that point in the RED phase), then drop that prop from the test's render call in Task 2 alongside removing it from the component itself — otherwise Task 1's own acceptance criteria ("tsc clean") and Task 2's ("no `estadoOptions` in the same file") would have been mutually exclusive at different points in time. This is documented here since the plan's `<files>` list for Task 2 didn't explicitly call out re-touching the test file for this reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed npm dependencies in the worktree**
- **Found during:** Task 1 (writing the contract test)
- **Issue:** This worktree had no `node_modules` at all (only source files were checked out), so neither `npx tsc` nor `npx vitest` could run.
- **Fix:** Ran `npm install` (using the existing `package-lock.json`, no new packages added or changed) to materialize `node_modules` for this worktree.
- **Files modified:** None tracked (`node_modules` is gitignored).
- **Verification:** `npx tsc --noEmit` and `npx vitest run` both execute successfully afterward.
- **Committed in:** N/A (untracked/gitignored, nothing to commit).

**2. [Rule 1 - Bug] Updated a stale doc comment that still described Estado as derived from loaded clientes**
- **Found during:** Task 2
- **Issue:** The file-header JSDoc comment on `ClienteFiltros` still said "estado/vendedor options are still derived from the already-loaded RLS-scoped card set" — no longer true for Estado after this plan's fix.
- **Fix:** Rewrote the comment to describe Estado as UFS-fed and Cidade as the new RPC-backed Combobox, keeping the vendedor-options note accurate.
- **Files modified:** `components/clientes/FiltersPopover.tsx`
- **Verification:** Re-ran `npx tsc --noEmit` and the contract test after the doc-only edit; both still clean/green.
- **Committed in:** `b9816b6` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment setup, 1 bug/stale comment)
**Impact on plan:** Neither affects runtime behavior; both were necessary to execute and verify the plan as written. No scope creep.

## Issues Encountered
- The full `npx vitest run` across the whole repo shows 166 pre-existing failures across 21 files, all rooted in a missing `.env.local` in this worktree (`Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"`) — these are RLS/Server-Action integration tests that need a live Supabase project and are entirely unrelated to `FiltersPopover`/`ClienteToolbar`/`KanbanBoard`. None of the 09-04-touched files appear in that failure list; the one new test file (`filters-popover.test.tsx`) passes 3/3. This is a pre-existing environment gap, out of scope for this plan (logged, not fixed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `FiltersPopover.tsx`'s Estado/Cidade contract is now consistent with the cadastro/edição forms' cascade behavior (D-02) for 09-05/09-06 to build on.
- No blockers for downstream plans in this phase.

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*

## Self-Check: PASSED
- FOUND: components/clientes/FiltersPopover.tsx
- FOUND: tests/clientes/filters-popover.test.tsx
- FOUND: commit 812910b (test)
- FOUND: commit b9816b6 (feat)
