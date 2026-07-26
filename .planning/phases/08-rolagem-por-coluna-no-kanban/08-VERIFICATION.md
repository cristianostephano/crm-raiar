---
phase: 08-rolagem-por-coluna-no-kanban
verified: 2026-07-25T22:30:00Z
status: human_needed
score: 5/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Arrastar e soltar cards entre colunas continua funcionando com auto-scroll correto durante o drag (measuring Always)"
    test: "Numa coluna mais alta que a tela (mais cards do que cabem em h-[calc(100vh-300px)]), arrastar um card do topo até o fundo com o mouse."
    expected: "(a) A coluna faz auto-scroll sozinha quando o cursor se aproxima da borda de baixo; (b) o card cai na posição correta, não num slot errado. Arrastar entre colunas diferentes também deve continuar funcionando."
    why_human: "É uma interação de mouse em tempo real (drag physics + auto-scroll do dnd-kit); não existe teste automatizado (Vitest ou Playwright) que exercite o drag real do dnd-kit neste repositório, e um PointerEvent sintético não aciona o sensor interno do dnd-kit (limitação conhecida). A revisão de código confirma que os dois pré-requisitos estruturais do Pitfall 12 estão presentes e corretamente ligados (ver Key Link Verification), mas isso prova que o código está montado corretamente, não que o comportamento de auto-scroll/drop-slot funciona em runtime."
human_verification:
  - test: "Numa coluna mais alta que a tela, arrastar um card do topo até o fundo com o mouse."
    expected: "Auto-scroll engaja perto da borda inferior da coluna e o card cai no slot correto; arrastar entre colunas também funciona."
    why_human: "Interação de mouse em tempo real que nenhum teste automatizado no repositório exercita; a sessão anterior de verificação humana não conseguiu completar este teste específico (browser pane não estava renderizando)."
---

# Phase 8: Rolagem por Coluna no Kanban Verification Report

**Phase Goal:** Deixar o kanban usável com muitos clientes — cada coluna rola por dentro em vez de esticar a página inteira.
**Verified:** 2026-07-25T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | KAN-01: cada coluna tem altura fixa viewport-relativa (`h-[calc(100vh-300px)]`, piso `min-h-[360px]`) e rola por dentro sem esticar a página | ✓ VERIFIED | `components/clientes/ScrollColumnShell.tsx:51` uses the literal class string on the outer container in both `KanbanBoard.tsx` render branches (lines 660, 710/219). `tests/clientes/kanban-scroll-column.test.tsx` test A asserts the exact classes and passes (`npx vitest run` — 3/3 tests pass). Coordinator's independent live DOM check (documented in SUMMARY, D1) additionally confirmed `scrollHeight` (916px) > `clientHeight` (420px) on a full column with no page-level stretch. |
| 2 | KAN-02: todas as 7 colunas têm a mesma altura, cheias ou vazias — a classe de altura não depende de `clientes.length` | ✓ VERIFIED | Both branches apply `ScrollColumnShell` unconditionally to every `ETAPAS.map` iteration (`KanbanBoard.tsx:660`, `:710`); `cardCount`/`clientes.length` is passed only for the fade's `ResizeObserver` dependency, never used to compute the outer height class. Grep confirms no conditional height logic. Coordinator's live DOM check (SUMMARY D2) confirmed identical height across 0/1/6-card columns, including the 360px floor engaging on a shorter viewport. |
| 3 | O cabeçalho da coluna (título + badge de contagem) continua visível fora do container que rola | ✓ VERIFIED | In both branches, the header `<div className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">` (lines 651/697) is a sibling rendered *before* `ScrollColumnShell`/`DroppableColumn` inside the `w-[280px]` wrapper — structurally outside the scrolling shell, matching UI-SPEC §2. Coordinator's live DOM check (SUMMARY D3) confirmed the header via `previousElementSibling`, outside the scroll container. |
| 4 | Um fade sutil no rodapé aparece só quando há conteúdo abaixo da dobra e desaparece no fim da rolagem ou quando a coluna cabe inteira | ✓ VERIFIED | `ScrollColumnShell.tsx:32-46,60-66` implements the `scrollHeight - scrollTop - clientHeight > 1` check with `onScroll` + `ResizeObserver`, toggling `opacity-100`/`opacity-0`; fade sits as a sibling of the scroll div, inside the outer container (confirmed by test C: `outer.contains(fade)===true`, `scrollDiv.contains(fade)===false`). Coordinator's live DOM check (SUMMARY D4) confirmed the opacity flip in the real browser. |
| 5 | Arrastar e soltar cards entre colunas continua funcionando com auto-scroll correto durante o drag (measuring Always) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code-level re-verification (independent of SUMMARY's claim) confirms both structural prerequisites from Pitfall 12 are present and correctly wired — see Key Link Verification below. No automated test (Vitest or Playwright) exercises an actual dnd-kit drag/auto-scroll interaction in this repository (`Glob` for `**/*kanban*.spec.ts` and the two existing Playwright specs — `session-persistence.spec.ts`, `importar-guard.spec.ts` — found neither drags a kanban card). The human coordinator's own SUMMARY explicitly records this checkpoint item as `human_judgment: true` and a "residual gap," since the live mouse-driven drag test could not be completed in that session (browser pane not compositing). Routed to human verification below — not a code defect, but not yet behaviorally proven either. |
| 6 | A mesma mudança estrutural existe nas DUAS render branches (dragDisabled estática e DndContext arrastável) | ✓ VERIFIED | Grep + direct read confirms `ScrollColumnShell` used identically in the `dragDisabled` branch (`KanbanBoard.tsx:660`, no `droppableRef`) and the `DndContext` branch via `DroppableColumn` (`:710`, `droppableRef={setNodeRef}`); both wrap the same empty-state/map JSX pattern. |

**Score:** 5/6 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/clientes/ScrollColumnShell.tsx` | New presentational Client Component: fixed-height outer, scrollable inner, conditional fade | ✓ VERIFIED | Exists, `"use client"` first line, exports `ScrollColumnShell`, no `@dnd-kit/*` or `@/app/actions/*` imports (only `react`). Matches UI-SPEC §1-§3 class strings verbatim. |
| `components/clientes/KanbanBoard.tsx` | `measuring` prop + `DroppableColumn` refactored + static branch refactored | ✓ VERIFIED | `MeasuringStrategy` added to the existing `@dnd-kit/core` import (single import statement, line 3-14); `DroppableColumn` (lines 208-223) renders `ScrollColumnShell` with `droppableRef={setNodeRef}`; static branch (line 660) uses `ScrollColumnShell` directly. Old `flex min-h-10 flex-col gap-2` wrapper no longer present (grep confirms zero matches). |
| `tests/clientes/kanban-scroll-column.test.tsx` | Structural contract test for the shell | ✓ VERIFIED | 3 tests (fixed-height outer, scroll-div classes, fade positioning/default-hidden state), all pass under `npx vitest run tests/clientes/kanban-scroll-column.test.tsx` (3/3, 1.43s). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `useDroppable({ id: etapaKey })`'s `setNodeRef` | `ScrollColumnShell`'s outer fixed-height container | `droppableRef` prop | ✓ WIRED | `DroppableColumn` (`KanbanBoard.tsx:217-222`) passes `setNodeRef` as `droppableRef={setNodeRef}` into `ScrollColumnShell`, which attaches it to the *outer* `h-[calc(100vh-300px)]` div (`ScrollColumnShell.tsx:49-52`) — NOT the inner `overflow-y-auto` div (which uses a separate `scrollRef`, line 53-54). Matches Pitfall 12's requirement exactly. |
| `<DndContext>` | drag auto-scroll re-measurement | `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` | ✓ WIRED | Present on the `DndContext` opening tag at `KanbanBoard.tsx:685`, between `collisionDetection` and `onDragEnd` as specified. Exactly one `@dnd-kit/core` import in the file (grep confirms `MeasuringStrategy` was appended to the existing import list, not a duplicate import). |
| Inner scroll div | actual scrolling behavior in a flex column | `min-h-0` class | ✓ WIRED | `ScrollColumnShell.tsx:56` — `"min-h-0 flex-1 overflow-y-auto flex flex-col gap-2"` present on the single scrolling element. |
| Fade indicator | correct color token | `from-background` (not `from-secondary`) + `pointer-events-none` | ✓ WIRED | `ScrollColumnShell.tsx:63` — literal string contains `from-background` and `pointer-events-none`; confirmed by test C. |

**Note on D5 (drag-and-drop):** wiring is structurally correct (both pieces present and correctly placed), but this key link supports a *behavior-dependent* truth (#5 above) whose actual runtime effect — auto-scroll engaging, correct drop slot — has not been exercised by any test or a completed live mouse drag. Wiring VERIFIED; behavior PRESENT_BEHAVIOR_UNVERIFIED.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase's own structural contract test passes | `npx vitest run tests/clientes/kanban-scroll-column.test.tsx` | 3 passed (3), 1.43s | ✓ PASS |
| TypeScript strict compiles clean | `npx tsc --noEmit` | No output (exit 0) | ✓ PASS |
| Full workspace test suite — check for phase-8 regressions | `npx vitest run` (run once) | 135 passed, 136 failed — all 136 failures are pre-existing `tests/{auth,clientes,configuracoes,dashboard,importacao}/*` RLS/integration tests failing with `Error: signInAs(...) failed: Request rate limit reached` (Supabase Auth rate-limit against a local/live instance). Zero failures in any file touched by this phase; `kanban-scroll-column.test.tsx` is among the 135 passing files. | ✓ PASS (no regression attributable to this phase; failures are environmental/pre-existing) |
| Real mouse-driven drag-to-bottom with auto-scroll | N/A — no runnable automated check exists for this in the repo | Not executed | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| KAN-01 | 08-01-PLAN.md | Cada coluna do funil kanban tem altura fixa e rolagem própria, independente da quantidade de clientes | ✓ SATISFIED | Truths #1 verified above; code + test + coordinator live DOM check all agree. |
| KAN-02 | 08-01-PLAN.md | Todas as colunas do kanban têm a mesma altura, estejam cheias ou vazias | ✓ SATISFIED | Truth #2 verified above; height class is unconditional on `clientes.length`. |

No orphaned requirements found for Phase 8 in `.planning/REQUIREMENTS.md` (only KAN-01/KAN-02 map to Phase 8, both claimed by the single plan).

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|console\.log|placeholder|not yet implemented` across `components/clientes/ScrollColumnShell.tsx` and the diff scope of `components/clientes/KanbanBoard.tsx` returned zero matches.

### Human Verification Required

### 1. Real mouse-driven drag-to-bottom with auto-scroll

**Test:** With `npm run dev` running and logged in, open `/clientes`, find (or temporarily create test data to get) a column with more cards than fit in `h-[calc(100vh-300px)]`. Drag a card from the top of that column toward the bottom with the mouse, holding it near the column's bottom edge.
**Expected:** The column auto-scrolls on its own as the cursor nears the bottom edge, and the card drops into the correct position (not a neighboring slot). Dragging a card from one column into a different column should also still work correctly.
**Why human:** This is a real-time mouse/pointer interaction driven by dnd-kit's internal sensor and auto-scroll engine. No automated test in this repository (Vitest or Playwright) exercises an actual dnd-kit drag gesture — `tests/clientes/kanban-scroll-column.test.tsx` only tests `ScrollColumnShell`'s static structure in isolation, and the two existing Playwright specs (`session-persistence.spec.ts`, `importar-guard.spec.ts`) don't touch the kanban board. The previous human-verify checkpoint (Task 3 of 08-01-PLAN.md) could not complete this specific check because the browser pane wasn't rendering visually in that session; it was approved based on code-level review alone (which this verification independently re-confirmed is structurally correct — see Key Link Verification). This item remains open until a real mouse drag is exercised.

### Gaps Summary

No blocking gaps. All 4 ROADMAP Success Criteria and both requirements (KAN-01, KAN-02) are supported by code that matches the plan and UI-SPEC exactly, backed by a passing structural unit test, a clean `tsc --noEmit`, and the coordinator's own live DOM inspection for the CSS/layout truths (height, scroll, header, fade). The one open item is Success Criterion 4 ("Arrastar e soltar cards entre colunas continua funcionando normalmente com a rolagem ativa") at the *behavioral* level: the code wiring that Pitfall 12 requires (measuring strategy + droppable/scroll separation) is independently confirmed present and correctly placed, but no automated test and no completed live mouse-drag test has actually exercised the auto-scroll + correct-drop-slot behavior yet. This is a human-verification item, not a code defect — recorded consistently with the executor's own SUMMARY.md (D5, `human_judgment: true`, flagged as a residual gap), and carried forward here as the phase's single open item.

### Resolution Note

The project coordinator reviewed this report and explicitly chose to accept the phase as complete without a follow-up live mouse-drag test, given: (1) every other truth and both requirements are fully verified by code + passing tests + live DOM inspection, (2) the two structural prerequisites for correct drag/auto-scroll behavior (Pitfall 12) are independently code-verified as present and correctly wired, and (3) this is a small, isolated CSS/layout change with no backend/schema involvement, making the residual risk low. If real usage ever surfaces a drag/auto-scroll issue in this kanban board, it should be filed as a normal bug against this phase's commits rather than reopening this verification.

**Decision:** Accepted with known gap. Phase 8 stands complete in ROADMAP.md/STATE.md.

---

_Verified: 2026-07-25T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Resolution: Accepted by coordinator 2026-07-25 — see Resolution Note above_
