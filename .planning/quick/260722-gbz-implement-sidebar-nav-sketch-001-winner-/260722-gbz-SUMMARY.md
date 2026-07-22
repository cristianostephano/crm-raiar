---
phase: 260722-gbz
plan: 01
subsystem: ui
tags: [nextjs, react, tailwind, base-ui, tooltip, sidebar, dashboard]

requires:
  - phase: 04-dashboard-gerencial
    provides: GanhosPerdidosCards KPI tiles, (app) protected layout with role-based nav
provides:
  - AppSidebar client component (dark, collapsible 64px/240px left rail with role-gated Administração section)
  - Restyled, reusable LogoutButton (className/variant/children props, same signOut() + hard-navigation logic)
  - Rewired app/(app)/layout.tsx row flex shell (top nav removed)
  - Neutral + left-accent-bar KPI cards (Ganhos/Perdidos/Taxa de conversão)
affects: [dashboard, layout, ui]

tech-stack:
  added: []
  patterns:
    - "Role-gated nav sections built from a typed NavSection[] array in one place, keeping the role === 'supervisor' condition equivalent everywhere it's checked"
    - "Compact/expanded sidebar state is local useState, not persisted — resets to compact (64px) on every full page load, matching the sketch's default"
    - "Tooltip primitive composed via base-ui's render prop (render={reactElement}) rather than asChild, since @base-ui/react/tooltip does not use Radix's asChild convention"

key-files:
  created:
    - components/layout/AppSidebar.tsx
  modified:
    - components/auth/LogoutButton.tsx
    - app/(app)/layout.tsx
    - components/dashboard/GanhosPerdidosCards.tsx

key-decisions:
  - "Sidebar defaults to compact (64px icon rail) on every load, per the plan's explicit requirement, rather than remembering the user's last toggle choice"
  - "Dark sidebar uses only Tailwind's built-in slate palette + the existing --primary token — no new CSS variables or brand colors introduced (owner's 'keep the approved blue, borrow only the corporate feel' decision)"

patterns-established:
  - "AppSidebar's NavSection[] model is the reusable shape for any future role-gated nav additions"

requirements-completed: [SKETCH-001, SKETCH-002]

coverage:
  - id: D1
    description: "Persistent dark collapsible left sidebar (64px icon rail expanding to 240px) replaces the top nav bar on all protected pages, with role-gated Administração section and working Sair button"
    requirement: "SKETCH-001"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (clean)"
        status: pass
      - kind: unit
        ref: "npx eslint components/layout/AppSidebar.tsx components/auth/LogoutButton.tsx app/(app)/layout.tsx --max-warnings=0 (clean)"
        status: pass
      - kind: integration
        ref: "npm run build (Turbopack production build succeeds, all 4 protected routes compile)"
        status: pass
    human_judgment: true
    rationale: "Visual collapse/expand behavior, tooltip-on-hover, per-role nav visibility (Supervisor vs Vendedor), and active-link highlighting require an actual browser session logged in as both roles — this is exactly what the plan's Task 3 checkpoint:human-verify covers and it has NOT been performed yet (see Known Stubs / Next Phase Readiness below)."
  - id: D2
    description: "Dashboard KPI cards (Ganhos/Perdidos/Taxa de conversão) restyled to neutral white cards with neutral numbers and a thin colored left accent bar, with unchanged pt-BR formatting and em-dash conversão guard"
    requirement: "SKETCH-002"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (clean)"
        status: pass
      - kind: unit
        ref: "npx eslint components/dashboard/GanhosPerdidosCards.tsx --max-warnings=0 (clean)"
        status: pass
    human_judgment: true
    rationale: "Confirming the cards render with correct real numbers and the intended visual treatment (not just that the classNames are present) requires visiting /dashboard in a browser as both roles — part of the same pending Task 3 checkpoint."

duration: ~20min
completed: 2026-07-22
status: complete
---

# Quick Task 260722-gbz: Sidebar Nav + KPI Accent-Bar Summary

**Replaced the top nav bar with a dark collapsible left sidebar (sketch 001 variant B) and restyled the dashboard KPI tiles to a neutral-card + left-accent-bar treatment (sketch 002 variant C) — pure presentation changes, zero auth/data/permission logic touched.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 of 3 completed (Task 3 is a `checkpoint:human-verify` — explicitly deferred to the coordinator, see below)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Built `components/layout/AppSidebar.tsx`: a dark (`bg-slate-900`/slate neutral palette) client component sidebar that starts as a 64px icon-only rail with hover tooltips and expands to 240px with labels via a toggle in the brand row.
- Nav is built from a single typed `NavSection[]` array; the "Administração" section (Gerenciar equipe, Configurações) is gated on `role === "supervisor"` — semantically identical to the previous inline `profile?.role === "supervisor"` checks in `app/(app)/layout.tsx`.
- Sidebar footer shows an initials avatar, full name, role label (all hidden when compact) and a restyled `LogoutButton` (icon-only when compact).
- `LogoutButton` gained optional `className`/`variant`/`children` props (defaulting to the prior `variant="outline"` / `"Sair"` text) so it can be reused inside the dark rail without touching its `signOut()` + hard-navigation logic.
- Rewired `app/(app)/layout.tsx`: removed the `<header>` top nav entirely, kept the server-side auth guard and `profiles` fetch byte-for-byte, added `initials` computation, and changed the outer shell to a row flex (`AppSidebar` + `<main>`).
- Restyled all three `GanhosPerdidosCards` tiles: neutral `text-foreground` numbers, neutral `text-muted-foreground` icons, and a `border-l-4` accent (`border-l-green-600` / `border-l-destructive` / `border-l-border`) — no data/fetch/formatter logic touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace top nav with a dark collapsible left sidebar (sketch 001 variant B)** - `ce3a29d` (feat)
2. **Task 2: Restyle Dashboard KPI cards to neutral + left accent bar (sketch 002 variant C)** - `1ff1d00` (feat)
3. **Task 3: Human verification checkpoint** - NOT YET PERFORMED (see below)

_No plan-metadata commit yet — the orchestrator handles the docs commit (SUMMARY.md/STATE.md) separately._

## Files Created/Modified

- `components/layout/AppSidebar.tsx` - New dark collapsible sidebar (64px/240px), role-gated nav sections, tooltip-on-hover in compact mode, footer with avatar/name/role/Sair
- `components/auth/LogoutButton.tsx` - Added optional `className`/`variant`/`children` props; `signOut()` + hard-navigation logic unchanged
- `app/(app)/layout.tsx` - Removed `<header>` top nav; row flex shell rendering `AppSidebar` + `<main>`; added `initials` computation
- `components/dashboard/GanhosPerdidosCards.tsx` - Neutral cards with `border-l-4` accent bars replacing colored numbers/icons

## Decisions Made

- Sidebar defaults to compact (64px) on every load per the plan's stated requirement — not persisted across sessions.
- Compact-mode tooltips reuse the existing `Tooltip`/`TooltipTrigger`/`TooltipContent` primitives via base-ui's `render` prop (passing the `<Link>` element directly), since `@base-ui/react` doesn't use Radix's `asChild` pattern — confirmed against `node_modules/@base-ui/react/tooltip/trigger/TooltipTrigger.js` and `internals/types.d.ts` (the `render` prop accepts a `ReactElement`).
- Dark sidebar surface uses only Tailwind's built-in `slate-*` scale plus the existing `--primary` token for the brand mark/avatar — no new CSS variables, matching the "tone change, not a new color system" constraint.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2.

One environment note (not a plan deviation): `node_modules` did not exist yet in this worktree (git worktrees don't carry installed dependencies), so `npm install --prefer-offline` was run first to reproduce the existing `package-lock.json` exactly — no new packages were added or changed.

## Issues Encountered

None.

## Next Phase Readiness

**Task 3 (`checkpoint:human-verify`) has NOT been performed and this plan is not yet fully complete.** Per this session's explicit instruction, the coordinator (not this execution) will do the actual browser verification. What's confirmed so far:

- `npx tsc --noEmit` — clean, no errors.
- `npx eslint components/layout/AppSidebar.tsx components/auth/LogoutButton.tsx "app/(app)/layout.tsx" components/dashboard/GanhosPerdidosCards.tsx --max-warnings=0` — clean, zero warnings on all four changed files.
- `npx eslint .` (full repo) — 0 errors; 1 pre-existing warning in `components/clientes/ClienteDetailSheet.tsx` (react-hooks/incompatible-library, unrelated to this plan, out of scope per deviation-rule scope boundary).
- `npm run build` — Turbopack production build succeeds; all 4 protected routes (`/clientes`, `/dashboard`, `/equipe`, `/configuracoes`) compile.

Still needed before this plan can be marked fully approved (per the plan's Task 3 `<how-to-verify>`):
1. Log in as **Supervisor** and confirm: sidebar starts compact with hover tooltips, toggle expands to 240px with "Principal"/"Administração" labels, all four links navigate + highlight correctly, footer shows initials/name/"Supervisor"/working Sair, and `/dashboard` KPI cards show the neutral + left-accent-bar treatment with correct real numbers.
2. Log in as **Vendedor** and confirm: sidebar shows ONLY "Principal" (no "Administração", no Gerenciar equipe/Configurações links anywhere), collapse/expand still works, footer shows "Vendedor" role, Sair works.

No code changes are expected from this verification unless a real bug is found — the automated gate (tsc/eslint/build) is already clean.

## Self-Check: PASSED

- FOUND: components/layout/AppSidebar.tsx
- FOUND: components/auth/LogoutButton.tsx
- FOUND: app/(app)/layout.tsx
- FOUND: components/dashboard/GanhosPerdidosCards.tsx
- FOUND: commit ce3a29d
- FOUND: commit 1ff1d00
