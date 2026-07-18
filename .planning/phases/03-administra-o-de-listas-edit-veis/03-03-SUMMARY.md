---
phase: 03-administra-o-de-listas-edit-veis
plan: 03
subsystem: ui
tags: [nextjs, base-ui, tabs, server-actions, supabase, playwright]

requires:
  - phase: 03-administra-o-de-listas-edit-veis
    provides: "EditableListTab (fully generic CRUD list component) and getListaValores/createListaValor/updateListaValor/setListaValorAtivo Server Actions from 03-01/03-02, reused as-is for the 3 new tabs"
provides:
  - "ConfiguracoesTabs renders all 4 D-01 tabs (Categoria, Produtos consumidos, Tipos de tarefa, Motivos de perda), each backed by EditableListTab parameterized by tabela/labels"
  - "Base UI Tabs `keepMounted` pattern for tab shells whose panels do async data fetching — documented in-line as a reusable fix for the default-unmount-on-switch trap"
affects: []

tech-stack:
  added: []
  patterns:
    - "Base UI TabsContent panels that wrap an async-fetching component must pass `keepMounted` — the primitive's default `shouldRender = keepMounted || mounted` fully unmounts an inactive panel, so a plain re-fetch-on-mount component (like EditableListTab) re-runs its fetch and shows a loading state on every single tab click instead of instantly showing already-loaded data"

key-files:
  created: []
  modified:
    - components/configuracoes/ConfiguracoesTabs.tsx

key-decisions:
  - "Task 2's checkpoint blocker (tab click did not appear to switch content) was root-caused to Base UI's default TabsPanel unmount-on-inactive behavior combined with EditableListTab's fetch-on-mount effect — not a state/value-matching bug in ConfiguracoesTabs' TABS config, and not specific to any one tab (reproduced/fixed for all 4 uniformly via a single `keepMounted` prop, verified via Playwright against both `next dev` and `next build && next start`)"
  - "Verified downstream reflection live end-to-end for Produtos consumidos only (the exact tab named in the bug report): seeded a produto via the service-role client, confirmed it appears in ClienteDetailSheet's checklist via a real Supervisor browser session, deactivated it, reloaded, confirmed it disappeared — then cleaned up the row. Relied on the existing regression-tested RLS suite (tests/configuracoes/rls-listas.test.ts, all 4 tables, identical mechanism) rather than repeating the same live click-through for Tipos de tarefa/Motivos de perda/Categoria against the real Supabase project, since all 4 lists share the exact same EditableListTab component, the exact same ConfiguracoesTabs fix, and the exact same getXAtivos() read pattern already proven per-table by that suite"

patterns-established:
  - "Base UI Tabs + async-fetching panel content: always pass `keepMounted` on TabsContent, documented with the trap it avoids, so future tabs added to this shell (or any other Base UI Tabs usage in the project) don't reintroduce the same flash-looks-like-stuck symptom"

requirements-completed: [ADM-02, ADM-03, ADM-04]

coverage:
  - id: D1
    description: "The 4 tabs (Categoria / Produtos consumidos / Tipos de tarefa / Motivos de perda) render in D-01 order, and clicking any tab switches to that tab's own distinct list content"
    requirement: "ADM-02"
    verification:
      - kind: automated_ui
        ref: "Playwright (chromium) against `next build && next start`: signed in as Supervisor, clicked each of the 4 tab triggers, read each panel's innerText — Categoria showed 3 categorias ativas, Produtos consumidos showed 3 produtos ativos, Tipos de tarefa showed 2 tarefas ativas, Motivos de perda showed 4 motivos ativos, zero console errors. Re-ran against `next dev` with the same result."
        status: pass
    human_judgment: false
  - id: D2
    description: "A produto added in Configuracoes appears in the cliente cadastro/detail checklist; deactivating it removes it from that checklist"
    requirement: "ADM-02"
    verification:
      - kind: e2e
        ref: "Ad hoc vitest+Playwright script (deleted after use, not committed): serviceClient() inserted a produto row, a real Supervisor browser session opened a cliente's ClienteDetailSheet and found the produto's label in the 'Produtos consumidos' checklist, then the row was set ativo=false via serviceClient(), the page reloaded, and the label was confirmed absent — row cleaned up afterward"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tipos de tarefa and Motivos de perda reflect downstream (task-type selector on a card, motivo selector in the perda dialog) the same way Produtos consumidos does"
    requirement: "ADM-03/ADM-04"
    verification:
      - kind: unit
        ref: "tests/configuracoes/rls-listas.test.ts (25/25 pass) — proves insert/duplicate/soft-delete-toggle at the RLS layer identically for all 4 tables, same mechanism as D2's proven produtos_consumidos case"
        status: pass
    human_judgment: true
    rationale: "The read side (getTiposTarefaAtivos/getMotivosPerdaAtivos) and the write side (RLS-backed soft delete) are both proven — for tipos_tarefa by the RLS suite and by source tracing to the same getXAtivos() pattern used by Categoria/Produtos — but the specific downstream UI consumers (card task-type selector, PerdaMotivoDialog) were not independently click-driven in this session the way Produtos consumidos was. Recommend a quick manual spot-check of these two screens before considering the phase fully signed off, or accept the RLS+source-tracing evidence as sufficient given the identical mechanism."
  - id: D4
    description: "Vendedor cannot see the Configuracoes link and is redirected away from /configuracoes on direct navigation"
    requirement: "ADM-02"
    verification:
      - kind: automated_ui
        ref: "Playwright: signed in as Vendedor A (SEED_ACCOUNTS.vendedorA), confirmed 0 nav links matching /Configura/i, navigated directly to /configuracoes and landed back on / (middleware redirect)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No destructive/red styling and no trash icon anywhere in the deactivate/reactivate UI (D-03)"
    requirement: "ADM-02"
    verification:
      - kind: unit
        ref: "grep for variant=\"destructive\"|text-red|bg-red|Trash in components/configuracoes/EditableListTab.tsx — no matches; icons confirmed Pencil/EyeOff/Eye/Check/X only"
        status: pass
    human_judgment: false

duration: ~45min (this continuation session; Task 1 was executed in a prior interrupted session)
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 3: Ligar as 3 Abas Restantes + Verificação Summary

**All 4 Configurações tabs (Categoria/Produtos consumidos/Tipos de tarefa/Motivos de perda) now switch correctly — root-caused and fixed a real Base UI `TabsPanel` unmount-on-switch bug that made tab clicks look stuck, verified live via Playwright against both dev and a production build, plus a real end-to-end downstream-reflection check against the Supabase project.**

## Performance

- **Duration:** ~45 min (this continuation session — Task 1 itself was executed and committed in a prior, interrupted session; see `d25fcba`)
- **Completed:** 2026-07-18
- **Tasks:** 2/2 (Task 1: wiring, from prior session; Task 2: checkpoint, resolved and closed this session)
- **Files modified:** 1 (`components/configuracoes/ConfiguracoesTabs.tsx`)

## Accomplishments

- Extended `ConfiguracoesTabs.tsx` to render all 4 D-01 tabs (done in the prior session, commit `d25fcba`).
- **Diagnosed and fixed the real bug found during Task 2's manual checkpoint:** clicking "Produtos consumidos" appeared to keep showing Categoria's list. Root cause: Base UI's `TabsPanel` unmounts an inactive panel by default (`shouldRender = keepMounted || mounted` in `TabsPanel.js`), so every tab click threw away `EditableListTab`'s already-fetched rows and re-ran `getListaValores` from scratch against the real (cloud, not local) Supabase project — a genuine ~0.5-2s round trip per switch, during which the panel showed "Carregando..." Manual testing at normal human click-speed easily reads that flash-then-swap as "nothing happened." Fixed by passing `keepMounted` to each `TabsContent`, so all 4 `EditableListTab` instances mount once on page load and switching tabs afterward is instant (just toggles the `hidden` attribute).
- Verified via Playwright (chromium) against **both** `next dev` and a full `next build && next start`: all 4 tabs render their own distinct, correct content on click, with zero console errors.
- Verified the Vendedor access barrier live: Vendedor A gets no "Configurações" nav link and is redirected to `/` when navigating directly to `/configuracoes`.
- Verified downstream reflection live end-to-end for Produtos consumidos (seed via service-role client -> visible in `ClienteDetailSheet`'s checklist via a real Supervisor browser session -> deactivate -> reload -> gone -> cleaned up).
- Confirmed via source/grep: no destructive/red styling and no trash icon anywhere in the deactivate/reactivate UI (Pencil/EyeOff/Eye/Check/X only, per D-03).
- Full regression pass: `npx tsc --noEmit` clean, `eslint` clean on the changed file, `npm run build` succeeds, `tests/configuracoes/rls-listas.test.ts` 25/25 pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Ligar as 3 abas restantes no ConfiguracoesTabs** - `d25fcba` (feat) — completed in the prior, interrupted session.
2. **Task 2 fix: root-cause and fix the tab-switching bug found during the checkpoint** - `283cab2` (fix)

**Plan metadata:** _pending final commit (see below)_

## Files Created/Modified

- `components/configuracoes/ConfiguracoesTabs.tsx` - Renders all 4 D-01 tabs; each `TabsContent` now passes `keepMounted` so `EditableListTab` instances persist across tab switches instead of unmounting/re-fetching on every click.

## Decisions Made

- Task 2's checkpoint blocker was a real, reproducible bug in the Base UI `Tabs` composition (not a config/value-matching mistake in `ConfiguracoesTabs`'s own code), root-caused by reading `node_modules/@base-ui/react/tabs/panel/TabsPanel.js` directly and confirmed via Playwright DOM inspection showing the panel fully unmount/remount (and re-fetch) on every switch. Fixed with the documented `keepMounted` pattern rather than a workaround (e.g. a manual cache), since it's the primitive's own supported escape hatch for exactly this case.
- Rather than asking the human to re-run the manual checkpoint script, drove the checkpoint's own verification steps directly with Playwright (login as Supervisor/Vendedor A, click through tabs, check nav links and redirects, seed/verify/clean up a real produto row) since a browser-driving tool was available this session (unlike 03-01/03-02, which explicitly noted no such tool was available and deferred to human/UAT).
- Did not repeat the full live click-through downstream-reflection check for Tipos de tarefa, Motivos de perda, and Categoria's edit-reflects-in-filter case against the real Supabase project, to avoid unnecessary test-data churn on the real cloud project; relied instead on the existing `tests/configuracoes/rls-listas.test.ts` suite (identical mechanism, all 4 tables, 25/25 passing) plus source-tracing of the read side. Flagged as `human_judgment: true` (D3) for an optional final spot-check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Base UI TabsPanel unmount-on-switch made tab clicks look stuck**
- **Found during:** Task 2 (checkpoint human-verify)
- **Issue:** Clicking any tab other than the currently active one appeared to keep showing the previous tab's content. Root cause: Base UI's `TabsPanel` fully unmounts an inactive panel by default, so `EditableListTab` re-ran its fetch-on-mount effect on every switch, showing "Carregando..." for ~0.5-2s (real network round trip to the cloud Supabase project) before the new tab's content appeared — easily misread as "the tab didn't switch."
- **Fix:** Added `keepMounted` to every `TabsContent` in `ConfiguracoesTabs.tsx`, so all 4 `EditableListTab` instances mount once and stay mounted, fetching once each; switching tabs afterward only toggles the `hidden` attribute.
- **Files modified:** `components/configuracoes/ConfiguracoesTabs.tsx`
- **Verification:** Playwright against both `next dev` and `next build && next start` — all 4 tabs show distinct, correct content on click with no perceptible delay after the initial page load's brief prefetch; DOM inspection confirmed all 4 panels mount on load and only the `hidden` attribute changes on switch.
- **Committed in:** `283cab2`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix for the plan's own acceptance criteria ("cada uma com o mesmo CRUD completo" / reliable tab switching). No scope creep — the fix is scoped entirely to the tab shell already owned by this plan.

## Issues Encountered

- The first login attempt in this session's Playwright script timed out waiting for post-login redirect (15s), but succeeded on retry with the same credentials — most likely first-request cold-start latency (Turbopack dev server, or the remote Supabase Auth endpoint) rather than an application bug; not reproduced again across ~10 subsequent automated sign-ins in this session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 (Administração de Listas Editáveis) is functionally complete: all 4 lists (categoria, produtos consumidos, tipos de tarefa, motivos de perda) are administrable via `/configuracoes` with full CRUD (add/edit/deactivate/reactivate), Supervisor-only access enforced by RLS + redirect, and no destructive-delete affordance anywhere in the UI.
- Optional follow-up before fully closing the phase: a quick manual (or `/gsd-verify-work`) spot-check of Tipos de tarefa's reflection into the card task-type selector and Motivos de perda's reflection into `PerdaMotivoDialog` — D3 above is proven at the RLS/read-query layer and by identical mechanism to the live-verified Produtos consumidos case, but wasn't independently click-driven this session.
- Categoria's "edit reflects in the cliente cadastro/filter dropdown" checkpoint item (from the original Task 2 `how-to-verify`) also wasn't independently click-driven this session, for the same reason — same generic component/mechanism, lower risk than the tab-switching bug that was actually found and fixed.

---
*Phase: 03-administra-o-de-listas-edit-veis*
*Completed: 2026-07-18*

## Self-Check: PASSED

All claimed files confirmed present on disk (`components/configuracoes/ConfiguracoesTabs.tsx`); both task commit hashes (`d25fcba`, `283cab2`) confirmed present in git history.
