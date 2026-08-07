# Stack Research

**Domain:** Delta stack for v1.3 "Agenda do Vendedor" — unified task/visit agenda, recurring post-sale visit scheduling, next-date suggestion, completion-summary history — inside the existing CRM Raiar (Next.js 16 + Supabase) app
**Researched:** 2026-08-07
**Confidence:** MEDIUM-HIGH (headline finding — no new npm dependency is required — is grounded in direct inspection of this repo's `package.json` and `components/ui/`, HIGH confidence; the two supporting pattern recommendations are web-synthesized, LOW confidence individually but consistent with official React/Next.js docs)

This document does **not** revisit the core stack (Next.js 16 App Router, Supabase Postgres/Auth/RLS, react-hook-form + zod, shadcn/ui, date-fns) — that's already validated in the v1.0 `STACK.md` and unchanged. It answers one question: **does "Agenda do Vendedor" need anything new?**

**Headline finding: no.** Every capability this milestone requires — recurrence math, a date picker for adjusting the suggested visit date, a short-summary form, grouped/sorted list UI, optimistic "mark complete" feedback — is already covered by packages and shadcn components already installed in this repo. The work here is server-side logic (Server Actions / RPCs) and UI composition, not new dependencies.

## Recommended Stack

### Core Technologies

No new core technologies. This milestone is built entirely on the stack already running in production:

| Technology | Version (confirmed in `package.json`) | Role in this milestone |
|------------|------------------------------------------|-------------------------|
| Next.js (App Router, Server Actions) | 16.2.10 | Agenda page/route, Server Actions for "concluir tarefa/visita" and "salvar frequência de visita" |
| React | 19.2.4 | Ships `useOptimistic` — the one *pattern* this milestone newly leans on (not a new package, see below) |
| Supabase (Postgres/Auth/RLS) | `@supabase/supabase-js` 2.110.5, `@supabase/ssr` 0.12.3 | Source of truth for tasks, visits, and the per-client history entries; RLS continues to be the only authorization boundary (vendedor sees own agenda, supervisor sees team's) |

### Supporting Libraries (all already installed — reused, not added)

| Library | Version (in `package.json`) | New role this milestone |
|---------|------------------------------|--------------------------|
| `date-fns` | 4.4.0 | (1) Recurrence math: `addWeeks(date, 1)` for semanal, `addWeeks(date, 2)` for quinzenal, `addMonths(date, 1)` for mensal — computes the *suggested* next visit date. (2) Agenda grouping/highlighting: `isToday`, `isTomorrow`, `isThisWeek`, `isPast`/`differenceInCalendarDays` to bucket the unified task+visit list into Hoje/Próximos dias/Atrasado — the exact same "date math for overdue highlighting" pattern already proven on the kanban board, just applied to a flat list |
| `react-day-picker` (via shadcn `Calendar` component, already in `components/ui/calendar.tsx`) | 10.0.1 | Date-picker UI for "o vendedor ajusta a data sugerida" — no new install, this component already exists in the repo |
| `react-hook-form` + `zod` + `@hookform/resolvers` | 7.81.0 / 4.4.3 / 5.4.0 | Completion-summary form (short required text on every conclusão) and the "frequência de visita" selector on a client card — same form pattern already used for cadastro/edição de cliente |
| shadcn/ui primitives already present: `select.tsx`, `popover.tsx`, `textarea.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx`, `card.tsx`, `dialog.tsx`/`sheet.tsx` | (copy-paste, no version) | Cover every UI element this milestone needs: frequency `<Select>`, summary `<Textarea>`, status `<Badge>` (e.g. "atrasado"), and a `<Dialog>`/`<Sheet>` for the completion-summary prompt. Confirmed via direct listing of `components/ui/` — nothing missing |

### Development Tools

No new dev tools. Reuse what's already required by `CLAUDE.md` ("toda funcionalidade nova precisa de pelo menos um teste"):

| Tool | New role this milestone |
|------|--------------------------|
| Vitest 4.1.10 | Unit-test the pure `nextVisitDate(lastDate, frequencia)` function and the agenda date-bucketing logic — same category of pure-function date-math test already written for "card atrasado" in v1.0 |
| Playwright 1.61.1 | E2E: complete a task/visit from the agenda, confirm the summary is required, confirm the suggested next date appears and can be adjusted, confirm vendedor-vs-supervisor visibility on the agenda (RLS) |

## Installation

```bash
# No new npm installs required for this milestone.

# Optional, zero-cost (copy-paste shadcn primitive, not an npm dependency) —
# only if the agenda's day-grouping benefits from a collapsible section:
npx shadcn@latest add accordion
```

## Alternatives Considered

| Recommended | Alternative | Why not |
|-------------|-------------|---------|
| `date-fns` (`addWeeks`/`addMonths`) for recurrence math | `rrule.js` (iCalendar RFC 5545 recurrence engine) | rrule.js is built for complex recurrence (specific weekdays, exceptions, natural-language parsing, "every 2nd Tuesday"). This feature only ever needs 3 fixed named intervals (semanal/quinzenal/mensal) plus "nenhuma" — a full RFC 5545 engine is unjustified weight and complexity for that. Web sources confirm rrule.js is the specialized tool for genuinely complex recurrence, and date-fns is the right-sized tool for simple fixed-interval math (LOW confidence, web synthesis, but consistent with both libraries' stated purpose) |
| React 19 `useOptimistic` + Server Actions for "mark complete" instant feedback | `@tanstack/react-query` (mutations + optimistic updates) | TanStack Query is **not actually installed** in this repo despite being listed as "already installed" in this milestone's brief (see Gaps below) — introducing it now just for one view would add a client-cache-manager dependency the rest of the app doesn't use. React 19's built-in `useOptimistic` + `useTransition` is the current idiomatic Next.js 16 pattern for exactly this "toggle/complete with instant UI, auto-revert on error" case, at zero new dependency cost |
| A simple grouped/sorted list (Hoje / Próximos dias / Atrasado) using existing shadcn `Tabs`/`Card`/`Badge` | A calendar-grid library (`FullCalendar`, `react-big-calendar`, etc.) | The requirement is explicitly "o que ele precisa fazer, hoje e nos próximos dias" — a chronological to-do list, not a month/week calendar grid. Calendar-grid libraries are heavier, and FullCalendar in particular gates several plugins behind a paid license — directly at odds with the zero-infra-cost constraint even though the core library is free. Not needed for the stated requirement |
| `zod` `.regex()` format check for CNPJ (if any client-side validation is wanted at all) | A dedicated CNPJ-checksum-validation npm package (e.g. `cnpj`) | `PROJECT.md` explicitly defers CNPJ checksum validation ("Validação de CNPJ na importação — adiado para uma v2"); this milestone only adds CNPJ as a stored field on "ativo" clients, not a validated one. Adding a validation package for a field whose validation is explicitly out of scope would be premature |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `rrule.js` or any iCalendar-recurrence library | Solves a much bigger problem (RFC 5545 recurrence rules) than this feature has (3 fixed intervals); adds a dependency and mental overhead for no benefit here | `date-fns` `addWeeks`/`addMonths` on a plain `frequencia_visita` enum column |
| `FullCalendar`, `react-big-calendar`, or any month/week calendar-grid library | The spec calls for a "what's due" chronological list, not a calendar grid; these libraries are heavier and some (FullCalendar) paywall useful plugins, conflicting with the zero-cost constraint | A sorted/grouped list built from existing shadcn `Card`/`Tabs`/`Badge` + `date-fns` bucketing |
| `@tanstack/react-query` (still not an installed dependency in this repo) | Would introduce a new client-cache-manager just for one view; nothing else in the app currently depends on it | React 19's built-in `useOptimistic` + `useTransition` with Server Actions |
| A cron/scheduled job (Supabase Edge Function on a schedule, `pg_cron`) to auto-generate the next visit | The spec is explicit: the system *suggests* a date and the vendedor *confirms/adjusts* — this is a synchronous computation that runs when a visit is completed, not a background process. A scheduler here is unnecessary infra complexity the free-tier constraint doesn't need | Compute `nextVisitDate()` synchronously inside the same Server Action/RPC that records the visit completion |
| A CNPJ-checksum-validation npm package | Checksum validation of CNPJ is explicitly out of scope for this project right now (`PROJECT.md` Out of Scope) | If any format check is wanted, a simple `zod` `.regex()` on digit count/mask is enough |

## Stack Patterns by Variant

**If the agenda groups items visually by day (Hoje / Amanhã / Esta semana / Atrasado):**
- Use `date-fns` `isToday`/`isTomorrow`/`isThisWeek`/`isPast` to bucket one sorted array of `{tipo: 'tarefa'|'visita', data, ...}` items client- or server-side.
- This is the same "date math drives visual highlighting" pattern already proven for kanban's "cards parados/atrasados" — reuse the approach, don't invent a new one.

**If "mark complete" needs instant feedback without a full page reload:**
- Wrap the Server Action call in React 19's `useOptimistic` + `useTransition` (or a form `action`). No query-library needed; this is the idiomatic Next.js 16/React 19 pattern and costs zero new dependencies.

**If the next-visit-date computation needs to be consistent between a client-side preview and the authoritative server write:**
- Put the pure function (`nextVisitDate(lastDate, frequencia)`) in one shared `lib/` module using `date-fns`, called by both the client (to preview the suggestion before the vendedor confirms) and the Server Action/RPC (to compute the authoritative value on save) — avoids client/server logic drift.
- Whether the *authoritative* copy of that computation ultimately lives in TypeScript (Server Action) or in a Postgres RPC (`+ interval '7 days'`, matching the existing `mover_card_funil`-style RPC convention) is a backend architecture decision for `/gsd-discuss-phase` + the `supabase-conventions` skill, not a stack decision — flagging it here so it isn't missed.

## Version Compatibility

No new compatibility surface introduced. Everything recommended here is already pinned in `package.json` and proven working with Next.js 16.2.10 / React 19.2.4 in this repo:

| Package | Version in repo | Notes |
|---------|------------------|-------|
| `date-fns` | 4.4.0 | Confirmed current on npm registry (2026-08-07) — no bump needed |
| `react-day-picker` | 10.0.1 | Confirmed current on npm registry (2026-08-07) — no bump needed; already wired into `components/ui/calendar.tsx` |
| `react` | 19.2.4 | `useOptimistic` ships in `react` itself — no additional package required |

## Gap Flagged for the Roadmap

This milestone's brief states `@tanstack/react-query` and `@tanstack/react-table` are "installed but lightly used" / "installed for tables." **Direct inspection of `package.json`, the lockfile, and a codebase-wide grep for `useQuery`/`useMutation`/`@tanstack` shows neither package is actually a dependency, and neither hook is used anywhere in `app/`, `components/`, or `lib/`.** The only real `@tanstack` reference in the codebase is a *negative* comment in `components/importacao/ImportPreviewTable.tsx` explicitly noting a plain-React-state approach was chosen **instead of** `@tanstack/react-table`. Treat that milestone-context line as stale/aspirational — the recommendation in this document (no new dependency, use `useOptimistic`) already accounts for the corrected, verified state of the repo.

## Sources

- Direct codebase inspection: `package.json` (read 2026-08-07) — confirms `date-fns`, `react-day-picker`, `zod`, `react-hook-form`, `@hookform/resolvers` already installed at the versions cited above; confirms `@tanstack/react-query`/`@tanstack/react-table` are **not** dependencies. Confidence: HIGH (ground truth)
- Direct codebase inspection: `components/ui/` directory listing (read 2026-08-07) — confirms `calendar.tsx`, `select.tsx`, `popover.tsx`, `textarea.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx` already exist. Confidence: HIGH (ground truth)
- Direct codebase inspection: grep for `@tanstack`/`useQuery`/`useMutation` across `app/`, `components/`, `lib/` (2026-08-07) — zero real usages found; only a comment explicitly rejecting `@tanstack/react-table` in `components/importacao/ImportPreviewTable.tsx`. Confidence: HIGH (ground truth)
- npm registry (`npm view date-fns version`, `npm view react-day-picker version`, 2026-08-07) — confirms both packages already pinned at current versions. Confidence: HIGH
- WebSearch: "React 19 useOptimistic with Next.js Server Actions mark item complete pattern" — confirms `useOptimistic` + `useTransition`/form action is the current idiomatic pattern for instant-feedback "mark complete" mutations, auto-reverting on Server Action error. Confidence: LOW (web synthesis, cross-referenced against multiple 2026 Next.js/React pattern articles agreeing on the same shape)
- WebSearch: "rrule.js vs date-fns simple recurring reminder weekly biweekly monthly" — confirms rrule.js targets full iCalendar RFC 5545 recurrence (weekday patterns, exceptions, NL parsing) while date-fns is a general date-manipulation toolkit; multiple sources note projects commonly use date-fns alone when recurrence needs are simple, reaching for rrule.js only when recurrence rules get complex. Confidence: LOW (web synthesis)

---
*Stack research for: v1.3 Agenda do Vendedor (delta on top of validated v1.0-v1.2 stack)*
*Researched: 2026-08-07*
