# Stack Research

**Domain:** Calendar/agenda view (day/week/month) for an internal sales CRM, plus a small 6th Supervisor-editable reference list
**Researched:** 2026-08-17
**Confidence:** MEDIUM (grounded mostly in the existing codebase + primary react-day-picker v10 docs; ecosystem framing is web-search-sourced, LOW-tier by the project's own classifier)

## Bottom Line

**No new npm dependency is needed for v1.5.** Build the day/week/month calendar view with plain `date-fns` date math (already installed, v4.4.0) + CSS Grid + existing shadcn/ui primitives (`Card`, `Badge`, `Dialog`/`Popover`). `react-day-picker@10.0.1` (already installed) stays exactly where it already is — a single-date picker input — and should **not** be extended into the events calendar. The "conclusão remota" flow (new reason field + 6th editable list) needs zero new libraries either: it's the same table+RLS+CRUD-tab pattern the project has repeated four times already (`categoria`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`, `frequencias_pedido`), plus one more `react-hook-form`+`zod` field on the existing conclusion dialog.

## Recommended Stack

### Core Technologies

No additions. Everything the calendar view needs is already in `package.json`:

| Technology | Version (already installed) | Purpose here | Why it's enough |
|------------|---------|---------|-----------------|
| `date-fns` | 4.4.0 | Build the month grid (leading/trailing days), week columns, day math, "is this item on this day" comparisons | Has every function this needs out of the box: `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `addDays`/`addWeeks`/`addMonths`, `isSameDay`, `isSameMonth`, `isToday`, `format`. The project already committed to "compute dates with `date-fns`/Postgres, never `new Date(string)` in the browser" (see PROJECT.md Key Decisions) — the calendar view is pure client-side *display* grouping of dates already resolved server-side, so this rule is satisfied by reusing `parseISO` exactly as `lib/agenda/itens.ts` already does, not by inventing a new date layer |
| React (CSS Grid, no library) | — | Month grid layout (7 columns × up to 6 rows), week view (7 columns), day view (reuses `AgendaItemRow` list) | `display: grid; grid-template-columns: repeat(7, 1fr)` is standard, well-documented, and needs no library — the month grid is uniform-width cells, not a component library concern |
| shadcn/ui (`Card`, `Badge`, `Button`, `Dialog` or `Popover`, `Tabs`/segmented control) | Already installed | Chips (reuse the existing Prospecção/Visita `Badge` variants from `AgendaItemRow.tsx`), day-cell "+N" overflow trigger, view-switcher toolbar (Lista/Dia/Semana/Mês), "Hoje" button, day-detail popover/dialog when a month cell is clicked | Same design system already used across `AgendaList.tsx`/`AgendaItemRow.tsx` — a new calendar library would introduce a second visual language for exactly the parts (chips, cards, colors) this project already has |

### Supporting Libraries

None new. Reused as-is:

| Library | Version | Purpose here | When to use |
|---------|---------|---------|-------------|
| `date-fns/locale` (bundled with `date-fns`, not a separate package) | 4.4.0 | `pt-BR` weekday/month labels (e.g. "seg", "ter"; "agosto de 2026") for the calendar header/grid | Import `{ ptBR }` from `date-fns/locale` and pass as the `locale` option to `format`/`startOfWeek` — first use of this in the codebase (grep found none yet), but it ships inside the already-installed package, not a new install |
| `react-hook-form` + `zod` + `@hookform/resolvers` | 7.81.0 / 4.4.3 / 5.4.0 | Add the "motivo de conclusão remota" select + "não foi presencial" toggle to the existing conclusion form in `ConcluirItemDialog.tsx` | Exactly the pattern the project already uses for `motivos_perda` on the "perdido" flow — one more conditionally-required field on an existing `zod` schema, not a new form |
| `@supabase/supabase-js` + RLS (Supabase, no new package) | 2.110.5 | 6th editable list ("Motivos de conclusão remota"): new table, RLS, CRUD tab | Follows `supabase-conventions` skill and the exact shape of the 5 existing editable lists — see Architecture note below |

### Development Tools

No additions. `Vitest` covers the pure date-grouping functions this view needs (e.g. "group `AgendaItem[]` by calendar day for a given month", mirroring `lib/agenda/itens.ts`'s existing `agruparAgenda`); `Playwright` covers the view-switcher + month/week/day navigation + day-click-opens-list interactions, same pattern already used for kanban drag-and-drop and RLS-driven visibility checks.

## Installation

```bash
# Nothing to install for the calendar view — date-fns, shadcn/ui primitives,
# and react-day-picker are already in package.json.

# If date-fns/locale/pt-BR labels are needed anywhere else in the app later,
# no install is needed either — it's a subpath import of the existing package:
#   import { ptBR } from "date-fns/locale"
```

## Alternatives Considered

| Recommended | Alternative | When to use alternative instead |
|-------------|-------------|--------------------------|
| Hand-rolled month/week/day grid (`date-fns` + CSS Grid) | Extend `react-day-picker@10` (already installed) for the month view specifically | If the month view only ever needed to show a **single** dot/indicator per day (not distinguishable chips) and never needed click-through to a specific item — `react-day-picker`'s `Day`/`DayButton` customization can render a plain indicator dot cheaply. That is not this milestone's requirement (up to 3 distinguishable colored chips + "+N", click opens the day's item list), so the extra friction of fighting a single-date-picker's `<table role="grid">`/`<button>` semantics for multi-item content isn't worth it. See Pitfall below |
| Hand-rolled calendar (no dependency) | A dedicated React calendar/events library (e.g. `react-big-calendar`, `@fullcalendar/react`, `dayjs`-based scheduler libraries) | If the roadmap eventually needs an **hour-of-day grid** (time slots, overlapping-in-time events, drag-to-reschedule) — none of which apply here: PROJECT.md's Out of Scope already excludes "Calendário completo (arrastar entre dias, visão de mês, recorrência customizável)" as a *full* calendar, and this milestone's items carry no time-of-day at all. Pulling in a scheduling library to render date-only chips in a grid would be materially more dependency weight and API surface than the feature needs |
| `date-fns` pure functions | A date-utility swap to `dayjs` | Not relevant here — the project already standardized on `date-fns` (`CLAUDE.md`/`STACK.md` precedent, "don't mix date libraries"); no reason to introduce a second one for one feature |

## What NOT to Use

| Avoid | Why | Use instead |
|-------|-----|--------------|
| Extending `react-day-picker@10` into a multi-event month calendar | It is a **date picker** (single/range date *input* control), not an events calendar. Its month grid is a `<table role="grid">` with single-selection semantics, and its `DayButton` renders a native `<button>` — stuffing 3 independently-clickable item chips into one button is both an accessibility problem (interactive content nested inside an already-interactive element, ambiguous "what did the user select") and a layout problem (the library's row height/grid is sized for a picker, not for variable-height chip stacks). It also has **no week or day view mode at all** — you'd still hand-build those two, so "reuse" only saves the month grid and costs you two rendering systems to keep visually consistent instead of one | Hand-rolled grid for all three views (month/week/day), sharing one date-grouping helper and one chip component across all three — one system, not two |
| A general-purpose React calendar/scheduler library (`react-big-calendar`, `@fullcalendar/react`, etc.) | Solves a much bigger problem than this milestone has (hour-of-day time grids, drag-to-reschedule, recurring events, timezone-aware event ranges) — none of which apply since Agenda items are date-only with no time-of-day, and dragging/rescheduling is explicitly out of scope (PROJECT.md: "só visualização, sem arrastar"). Adds real bundle weight and a new API surface to learn for capability that's mostly unused | Plain `date-fns` + CSS Grid, matching the "zero new dependency unless justified" convention in `CLAUDE.md` |
| A second date-formatting/locale library just for `pt-BR` labels | `date-fns/locale` already ships inside the installed `date-fns` package | `import { ptBR } from "date-fns/locale"` |
| Client-side re-fetching per calendar month/week (a new paginated RPC) | `agenda_do_vendedor()` already returns the vendor's (or, for Supervisor, the team's) full set of *pending* items in one unbounded read — `AgendaList.tsx` already fetches this once via `getAgendaAction()`. The calendar view is a different **presentation** of the same array the list view already holds, not a different **query** | Reuse the same `AgendaItem[]` the list view fetches; group it client-side by day/week/month with pure functions (mirroring `agruparAgenda` in `lib/agenda/itens.ts`) — no new RPC parameter, no new network round-trip per navigation |

## Integration with Existing Agenda Data Layer

- `agenda_do_vendedor()` (migration `0014_agenda_do_vendedor.sql`) already returns every pending item — no date-range filter, `SECURITY INVOKER`, RLS-scoped — as a flat list with a plain `date` column (`YYYY-MM-DD`, no time-of-day) and `origem` (`prospeccao` | `visita`). This is exactly the shape a month/week/day grid needs: **no RPC changes required for the calendar view itself.**
- `AgendaList.tsx` is currently the single owner of the one `getAgendaAction()` read and of `vendedorFiltroId` (Supervisor's vendor filter). The Lista↔Calendário toggle should live as a **sibling presentation mode inside/near `AgendaList.tsx`**, both fed by the same already-fetched `itens` — not a second fetch, not a second route. Concretely: extract the day-grouping into a new pure function in `lib/agenda/itens.ts` (e.g. `agruparPorDia(itens, mes)`), mirroring the existing `agruparAgenda`/`filtrarPorVendedor`/`vendedoresDaAgenda` pattern (single-authority pure functions, no business logic duplicated in components) — this is the same architectural seam the file's own header comment already documents.
- Each month-grid cell's "up to 3 chips + `+N`" reuses the existing `Badge` variants from `AgendaItemRow.tsx` (`outline` for Prospecção/gray, `secondary` for Visita/blue) — same visual language, no new color system.
- Clicking a day in month view "abre a lista completa daquele dia" (PROJECT.md) — reuse `AgendaItemRow` inside a `Dialog`/`Popover` filtered to that day's items, not a new row component.
- Day view "reaproveita o card da lista atual" (PROJECT.md, explicit) — confirms no new item-card component is needed anywhere in this milestone.
- **Overdue highlighting**: the list view already computes `atrasado` per-item via `bucketDoItem`/`differenceInCalendarDays` (`lib/agenda/itens.ts`). The calendar's day cells for past dates with pending items are inherently "atrasado" by the same definition — reuse `bucketDoItem`, don't reintroduce a second staleness rule (the project has hit this exact pitfall before with kanban staleness logic per PROJECT.md's Key Decisions).

## Conclusão Remota — same pattern, no new tech

The "conclusão remota" flow and its 6th editable list ("Motivos de conclusão remota") require zero new libraries; they're additive to code that already exists:

- **New table + RLS + CRUD tab**: identical shape to the existing 5 editable lists (`categoria`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`, `frequencias_pedido`) — table with `id`/`nome`, RLS restricting write to `is_supervisor()`, read open to authenticated, and a CRUD tab in whatever screen already hosts the other 5. Follow the `supabase-conventions` skill, same as every prior list.
- **Form change**: `ConcluirItemDialog.tsx` already collects a required `resumo` (10-500 chars) via `react-hook-form` + `zod`. Add a "não foi presencial" checkbox/toggle that conditionally requires a `motivo_conclusao_remota_id` select — a `zod` `.refine()` or discriminated shape on the existing schema, not a new form library.
- **RPC change**: `concluir_tarefa_prospeccao`/`concluir_visita` (migration `0015`) gain an optional parameter for the remote-completion motivo, following the same "atomic RPC, `SECURITY INVOKER`" precedent already set for those two functions and for `mover_card_funil`'s CNPJ guard extension in v1.4 — no new RPC pattern, just one more nullable parameter threaded into the existing `historico` write.

This section is included because the milestone bundles both changes, but it confirms the **stack** answer is identical for both halves of v1.5: no new dependency, reuse of an already-proven pattern.

## Stack Patterns by Variant

**If the month grid needs per-day event counts beyond "+N" (e.g. a hover tooltip listing all items) later:**
- Reuse the same `Tooltip` component `AgendaItemRow.tsx` already uses for the overdue-triangle hint — don't add a new tooltip/popover library.

**If a future milestone adds real time-of-day scheduling (calendar entries with hours, not just dates):**
- That is the point at which a dedicated scheduling library becomes worth evaluating — re-research then. It is explicitly out of scope for v1.5 (items have no time-of-day field at all).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `date-fns@4.4.0` | `date-fns/locale` (`ptBR`) | Same package, subpath import, no version concern — already resolved by the existing `package.json` pin |
| `react-day-picker@10.0.1` | Next.js 16 / React 19 | Confirmed current (npm registry, 2026-08-17) — stays exactly as-is for its existing single-date-picker input use case; this research does not change or extend its usage |
| Existing `Badge`/`Card`/`Dialog` shadcn/ui components | Tailwind v4 (already in repo) | No change — the calendar view's chips/cells are built from the same primitives already styled for the list view |

## Sources

- Codebase (primary source for this research): `components/agenda/AgendaList.tsx`, `components/agenda/AgendaItemRow.tsx`, `lib/agenda/itens.ts`, `supabase/migrations/0014_agenda_do_vendedor.sql` — read directly, confidence HIGH (these are the actual files this milestone extends)
- `.planning/PROJECT.md` — v1.5 milestone scope, Out of Scope history (v1.3's "Calendário completo... fica pra depois" entry, now being partially picked back up for view-only/no-drag), Key Decisions on date handling (Postgres-computed dates, `parseISO` not `new Date(string)`)
- `.planning/sketches/MANIFEST.md` — sketch 003 (agenda-calendario), confirms Variante A (toolbar, no mini-calendar sidebar), matches PROJECT.md's target features
- npm registry (`npm view react-day-picker version`, 2026-08-17) — confirms `10.0.1` is current and matches what's already installed. Confidence: HIGH for the version number itself, though the project's classify-confidence seam tags raw npm/websearch lookups LOW by default absent a separate legitimacy check
- WebFetch: `https://daypicker.dev/guides/custom-components` and `https://daypicker.dev/upgrading` (official react-day-picker v10 docs, fetched directly) — confirms v10's `Day`/`DayButton` customization API, confirms `useDayRender` (the v8 hook) is gone, confirms `month_grid` classname / table-based grid structure. Confidence: MEDIUM (primary docs, but synthesized via a single fetch pass, not cross-verified against a second source)
- WebSearch: "react-day-picker v10 components prop custom Day cell rendering for multi-event month calendar" — confirms the `components`/`Day`/`DayButton` customization pattern exists but is designed for picker use cases, not multi-event content. Confidence: LOW (web synthesis)
- WebSearch: "build custom month calendar grid React date-fns CSS grid multiple events per day chips overflow plus N" — confirms the hand-rolled CSS Grid + date-fns + "+N" pattern is the standard, low-dependency approach for this exact shape of problem. Confidence: LOW (web synthesis, but consistent across multiple independent sources in the result set)
- WebSearch: "react-day-picker DayButton customization event dots multiple events per day github discussion" — no dedicated precedent found for multi-chip content inside DayButton; reinforces that react-day-picker's design center is single-date selection, not an events calendar. Confidence: LOW

---
*Stack research for: calendar/agenda view + conclusão remota, CRM Raiar v1.5*
*Researched: 2026-08-17*
