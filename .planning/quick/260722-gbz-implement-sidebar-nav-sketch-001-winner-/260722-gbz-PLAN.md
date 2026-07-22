---
phase: 260722-gbz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/layout/AppSidebar.tsx
  - components/auth/LogoutButton.tsx
  - app/(app)/layout.tsx
  - components/dashboard/GanhosPerdidosCards.tsx
autonomous: false
requirements: [SKETCH-001, SKETCH-002]

must_haves:
  truths:
    - "The app shell shows a persistent dark left sidebar (no top nav bar) on every protected page: /clientes, /dashboard, /equipe, /configuracoes"
    - "The sidebar starts as a 64px icon-only rail (tooltips on hover) and expands to a 240px labeled sidebar via a toggle arrow at the top"
    - "A Vendedor sees only the 'Principal' section (Clientes, Dashboard) and NO 'Administração' section"
    - "A Supervisor additionally sees the 'Administração' section (Gerenciar equipe, Configurações)"
    - "The sidebar footer shows the user's initials avatar, full name, role label, and a working 'Sair' button that signs out"
    - "Dashboard KPI cards are neutral white cards with neutral-colored numbers and a thin colored left accent bar: green for Ganhos, red for Perdidos, neutral for Taxa de conversão"
  artifacts:
    - components/layout/AppSidebar.tsx
    - app/(app)/layout.tsx
    - components/auth/LogoutButton.tsx
    - components/dashboard/GanhosPerdidosCards.tsx
  key_links:
    - "app/(app)/layout.tsx passes profile.role to AppSidebar, which gates the Administração section on role === 'supervisor' — the exact same condition as the previous inline `profile?.role === 'supervisor'` check"
    - "AppSidebar's sign-out reuses LogoutButton's supabase.auth.signOut() + window.location.assign('/login') logic (single source of truth, no duplicated auth logic)"
    - "Active nav link is derived from usePathname()"
---

<objective>
Restyle the CRM's app shell to match two approved sketches, without changing any auth, data, or permission logic:

1. Replace the current top nav bar in `app/(app)/layout.tsx` with a persistent dark, collapsible left sidebar matching sketch 001 variant B.
2. Restyle the Dashboard KPI tiles (`GanhosPerdidosCards.tsx`) to match sketch 002 variant C (neutral card + thin colored left accent bar), replacing the current "traffic-light" colored-number treatment the owner called "infantil".

Purpose: A more sober/corporate look and more screen space for content, staying entirely within the already-locked shadcn "nova" design tokens (existing blue `--primary`). This is a layout/tone change only — NOT a new color system and NOT any change to authorization (RLS remains the real boundary; nav visibility is a UX reflection only).

Output: A new `AppSidebar` client component, a restyled `LogoutButton`, a rewired `(app)` layout, and restyled KPI cards.
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Design references (the winning variants — study before editing)
@.planning/sketches/001-sidebar-nav/index.html
@.planning/sketches/002-stat-numbers/index.html
@.planning/sketches/themes/default.css

# Files being changed / reused
@app/(app)/layout.tsx
@components/auth/LogoutButton.tsx
@components/dashboard/GanhosPerdidosCards.tsx
@components/ui/tooltip.tsx
@app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace top nav with a dark collapsible left sidebar (sketch 001 variant B)</name>
  <files>components/layout/AppSidebar.tsx, components/auth/LogoutButton.tsx, app/(app)/layout.tsx</files>
  <action>
Build the persistent dark, collapsible sidebar from sketch 001 variant B and wire it into the protected-area layout. Three edits:

(1) Create `components/layout/AppSidebar.tsx` as a Client Component (`"use client"`). Props: `fullName: string`, `roleLabel: string | null`, `role: string`, `initials: string`. Local `useState` boolean for compact vs expanded, defaulting to COMPACT (the rail must start at 64px icon-only per the sketch and the task brief). Use `usePathname()` from `next/navigation` to compute the active link.

  - Layout: a full-height flex-column `<aside>` whose width animates between `w-16` (64px, compact) and `w-60` (240px, expanded) — mirror the sketch's `transition: width` with a Tailwind `transition-[width]`.
  - Chrome/tone: dark neutral SLATE surface using Tailwind's built-in neutral palette utilities (e.g. `bg-slate-900` surface, `text-slate-300` links, `hover:bg-slate-800 hover:text-white`, active link `bg-slate-700 text-white font-medium`, dividers `border-slate-800`). Do NOT introduce any new CSS variables or brand colors — the slate scale is a neutral tone already in Tailwind, and the ONLY brand color used is the existing `--primary` (via `bg-primary text-primary-foreground`) for the square brand mark and the round avatar. This satisfies the "tone change, not a new color system" constraint and the owner's "keep the approved blue, borrow only the corporate feel" decision (MANIFEST.md).
  - Top brand row: a `bg-primary` rounded square mark ("R"), the wordmark "CRM Raiar" (hidden when compact), and a toggle button pinned to the end that flips the compact/expanded state. Use `lucide-react` `ChevronRight` when compact (points right = "expand") and `ChevronLeft` when expanded. Give the toggle an `aria-label` like "Expandir menu" / "Recolher menu".
  - Nav model: build from a typed array of sections so the role gate lives in one place. Section "Principal" (always shown): { Clientes → `/clientes`, icon `Users`; Dashboard → `/dashboard`, icon `LayoutDashboard` }. Section "Administração" (shown ONLY when `role === "supervisor"`): { Gerenciar equipe → `/equipe`, icon `UsersRound`; Configurações → `/configuracoes`, icon `Settings` }. This `role === "supervisor"` condition MUST be exactly equivalent to the layout's previous inline `profile?.role === "supervisor"` checks — do not loosen or change it. Section labels ("Principal"/"Administração") are uppercase muted text (`text-slate-500`), hidden when compact.
  - Links: each is a `next/link` `<Link>` with icon + label; the label `<span>` is hidden when compact. Mark active when `pathname === href || pathname.startsWith(href + "/")`. Icon is always 18px and never hidden.
  - Compact tooltips: when compact, wrap each nav link in the existing `Tooltip`/`TooltipTrigger`/`TooltipContent` primitives (from `@/components/ui/tooltip`) with the label as content and `side="right"`. The app already mounts `TooltipProvider` in `app/layout.tsx`, so do NOT add another provider. When expanded, render the plain link without a tooltip (label is already visible).
  - Footer (bottom, `mt-auto`, top border `border-slate-800`): a round `bg-primary` avatar showing `initials`, then name (`text-white`) + role label (`text-slate-500`) — both hidden when compact — and below it the sign-out button (see edit 3). In compact mode the footer collapses to just the avatar and an icon-only sign-out.

(2) Edit `components/auth/LogoutButton.tsx` to make it restylable while keeping its logic identical. Add optional props `className?: string`, `variant?` (same union the `Button` accepts), and `children?: React.ReactNode`; default `variant` to `"outline"` and default children to `"Sair"` so any existing/plain usage is unchanged. Pass `className` and `variant` through to the `Button`. Do NOT change `handleLogout`: it must still call `createClient().auth.signOut()` then `window.location.assign("/login")` (the hard-navigation rationale in the existing comment must stay). This keeps the sign-out logic single-sourced.

(3) In `AppSidebar`'s footer, render `<LogoutButton>` restyled for the dark rail: `variant="ghost"`, a `className` giving it full width, left-aligned content, gap, and slate colors (`text-slate-300 hover:bg-slate-800 hover:text-white`), with children = a `lucide-react` `LogOut` icon (18px, never hidden) followed by a `<span>Sair</span>` that is hidden when compact. Same logout behavior, restyled and repositioned per the brief.

(4) Rewire `app/(app)/layout.tsx`: KEEP the server-side auth guard and profile fetch EXACTLY as-is (the `supabase.auth.getUser()` → redirect-to-`/login` guard, and the `profiles` select of `nome, sobrenome, role`). Keep computing `fullName` and `roleLabel` from `ROLE_LABELS` unchanged. Additionally compute `initials` from the first letters of `nome` + `sobrenome` (uppercase; fall back to the first char of the email when there's no profile). Remove the old `<header>` top-nav block (the inline Clientes/Dashboard/Gerenciar equipe/Configurações `<Link>`s and inline `<LogoutButton>`). Change the outer wrapper from a column to a ROW: `<div className="flex min-h-full flex-1">` containing `<AppSidebar fullName={...} roleLabel={roleLabel} role={profile?.role ?? ""} initials={...} />` followed by `<main className="flex flex-1 flex-col overflow-x-hidden">{children}</main>`. Passing `profile?.role ?? ""` preserves current behavior: a null/absent profile is not a supervisor, exactly as the old `profile?.role === "supervisor"` evaluated to false.

Study the sketch section `id="variant-b"` (and `.sidebar.compact` rules) in `.planning/sketches/001-sidebar-nav/index.html` plus the slate token values in `.planning/sketches/themes/default.css` for the intended proportions, spacing (8pt scale), and hover/active treatment. Reproduce the look with Tailwind utilities on the existing `--primary`/neutral palette — do not copy the sketch's raw hex vars into the app.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint components/layout/AppSidebar.tsx components/auth/LogoutButton.tsx "app/(app)/layout.tsx"</automated>
  </verify>
  <done>
`AppSidebar.tsx` exists and compiles. `app/(app)/layout.tsx` renders `<AppSidebar>` (no `<header>` top nav remains) with a row flex shell. The Administração section is gated on `role === "supervisor"` (semantically identical to the old inline check). `LogoutButton` still calls `supabase.auth.signOut()` + `window.location.assign("/login")` and now accepts `className`/`variant`/`children`. tsc + eslint pass clean on all three files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Restyle Dashboard KPI cards to neutral + left accent bar (sketch 002 variant C)</name>
  <files>components/dashboard/GanhosPerdidosCards.tsx</files>
  <action>
Change ONLY the color/background/border treatment of the three KPI tiles in `components/dashboard/GanhosPerdidosCards.tsx` to match sketch 002 variant C (`id="variant-c"` in `.planning/sketches/002-stat-numbers/index.html`): a neutral white card with a neutral number and a thin colored accent bar on the left edge only. Do NOT touch any data logic, fetch effect, loading/error states, `integerFormatter`/`percentFormatter`, `formatConversao`, the em-dash divide-by-zero guard, or the 36px Stat typography (`text-[36px] leading-[1.1] font-semibold` stays).

Per card (in the `state.status === "ready"` return):
  - Ganhos `<Card>`: add `className="border-l-4 border-l-green-600"`. Change the number `<p>` from `text-green-600 dark:text-green-500` to the neutral `text-foreground`. Change the small `TrendingUp` icon from green to neutral `text-muted-foreground`.
  - Perdidos `<Card>`: add `className="border-l-4 border-l-destructive"`. Change the number `<p>` from `text-destructive` to neutral `text-foreground`. Change the small `TrendingDown` icon from `text-destructive` to neutral `text-muted-foreground`.
  - Taxa de conversão `<Card>`: add `className="border-l-4 border-l-border"` (neutral accent, same width as the others so all three share the same geometry). The number `<p>` is already `text-foreground` and the `Percent` icon already `text-muted-foreground` — leave both as-is.

Net effect: all three cards are neutral white with neutral numbers; meaning is carried by the left accent bar only (green = good, red = bad, neutral = informational), exactly as variant C. Green stays `green-600` (already used in this file and matching the sketch's `--color-success`); red uses the project's `destructive` token (staying within approved tokens rather than a raw hex). Confirm no `bg-green-*`/`bg-red-*` fill and no colored number remain anywhere in the ready-state markup.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint components/dashboard/GanhosPerdidosCards.tsx</automated>
  </verify>
  <done>
Each ready-state card has a `border-l-4` colored accent (green-600 / destructive / border) and its number uses `text-foreground`. No `text-green-*`/`text-destructive` remains on the numbers, and no background fill was added. The 36px typography, pt-BR formatters, and em-dash conversão guard are byte-for-byte unchanged. tsc + eslint pass clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
A dark collapsible left sidebar replacing the top nav (Task 1) and neutral KPI cards with left accent bars (Task 2). Before the human check, the executor runs the full toolchain to confirm a clean build: `npx tsc --noEmit`, `npx eslint .`, and `npm run build` — all must pass.
  </what-built>
  <how-to-verify>
The dev server is already running on http://localhost:3000. Verify both roles:

1. Automated gate (executor runs first, paste results): `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` succeeds.

2. Log in as SUPERVISOR (cristiano.stephano@raiarorganicos.com.br / TestSupervisor!2026):
   - The left sidebar is dark and starts as a narrow ~64px icon-only rail; hovering an icon shows a tooltip with its label.
   - Clicking the toggle arrow at the top expands it to ~240px with labels and the "Principal" / "Administração" section headers.
   - "Principal" shows Clientes + Dashboard; "Administração" shows Gerenciar equipe + Configurações. All four links navigate correctly and the active page is highlighted.
   - Footer shows the initials avatar + name + "Supervisor" role. The "Sair" button signs you out to /login.
   - Open /dashboard: the Ganhos / Perdidos / Taxa de conversão cards are neutral white with a thin colored left bar (green / red / neutral), neutral numbers, and show the correct real numbers (not colored-box tiles).

3. Log in as VENDEDOR (vendedor.a+test@raiar.local / TestVendedorA!2026):
   - The sidebar has ONLY the "Principal" section (Clientes, Dashboard). There is NO "Administração" section and NO Gerenciar equipe / Configurações links anywhere.
   - Collapse/expand toggle still works; footer shows "Vendedor" role; Sair works.
  </how-to-verify>
  <resume-signal>Type "approved" once all three build commands pass and both roles verify correctly, or describe what's wrong.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser (client) → RLS-protected Supabase | The only real authorization boundary; unchanged by this plan |
| server layout → AppSidebar props | Role label/flag passed to a client component purely for nav visibility (a UX reflection, not a security control) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-nav-01 | Information Disclosure | Role-gated nav in AppSidebar | low | mitigate | Nav visibility is UX-only; RLS still blocks a Vendedor from any Supervisor data even if a link were shown. Task 1 preserves the exact `role === "supervisor"` gate; Task 3 explicitly verifies the Vendedor sees no Administração section. |
| T-nav-02 | Elevation of Privilege | LogoutButton refactor | low | accept | Refactor is presentational (className/variant/children) only; `signOut()` + hard-navigation logic is unchanged, so no new auth path is introduced. |
</threat_model>

<verification>
- `npx tsc --noEmit` passes (no type errors introduced).
- `npx eslint .` passes on all changed files (no `any` without justification, no unused imports).
- `npm run build` succeeds.
- Existing test suite (`npm test`) still passes — this plan changes presentation only, no data/logic, so no behavior tests should break. No new automated test is added because there is no new business logic (the role gate is preserved, not created); correctness of the visual/role-gated behavior is confirmed by the Task 3 human checkpoint per the task brief.
- Manual: sidebar collapse/expand works; Vendedor has no Administração section; KPI cards show accent-bar treatment with correct real numbers for both roles.
</verification>

<success_criteria>
- Top nav bar is gone; a persistent dark collapsible left sidebar is present on all protected pages.
- Sidebar starts compact (64px icon rail with tooltips) and expands to 240px labeled via the top toggle.
- Supervisor sees Principal + Administração; Vendedor sees only Principal (exact prior role gate preserved).
- Sidebar footer shows initials avatar + name + role + working Sair.
- Dashboard KPI cards are neutral white with neutral numbers and a thin colored left accent bar (green Ganhos / red Perdidos / neutral Taxa de conversão), with unchanged pt-BR formatting and em-dash conversão guard.
- tsc, eslint, and build are clean; owner approves the browser verification for both roles.
</success_criteria>

<output>
Create `.planning/quick/260722-gbz-implement-sidebar-nav-sketch-001-winner-/260722-gbz-SUMMARY.md` when done.
</output>
