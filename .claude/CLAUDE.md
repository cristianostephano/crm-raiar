<!-- GSD:project-start source:PROJECT.md -->

## Project

**CRM Raiar — Acompanhamento de Vendas**

Um CRM de acompanhamento de vendas (funil/kanban) para substituir um CRM pago de custo elevado. Vendedores cadastram e trabalham clientes PJ ao longo de um funil de 7 etapas, do primeiro contato até a primeira venda concluída; um supervisor acompanha todos os clientes do time e tem um dashboard gerencial. MVP construído com custo zero de infraestrutura, pra validar a ideia antes de qualquer investimento em escala.

**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado — porque hoje o preenchimento no CRM pago é ruim (telas longas, esquecimento) e isso é o motivo real de trocar de ferramenta.

### Constraints

- **Custo**: free tier do Supabase (Postgres + Auth + Storage) + Vercel — objetivo é validar a ideia com custo zero de infraestrutura antes de investir em escala
- **Stack**: Next.js (React/TypeScript) + Supabase — fixado em `CLAUDE.md`, não muda sem discutir antes
- **Autorização**: sempre via Supabase Auth + RLS; nenhuma lógica de permissão "feita à mão" no frontend ou em backend próprio
- **Usuário não-técnico**: decisões técnicas precisam ser explicadas em 1-2 frases sem jargão; mudanças grandes exigem plano prévio em linguagem simples

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies (already decided, versions confirmed)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.10 (already in `package.json`) | App framework, App Router, Server Components/Actions | Already committed in `CLAUDE.md`; App Router + Server Actions let most CRUD (client cadastro, kanban moves, enum CRUD) skip a separate API layer entirely — fewer moving parts for a zero-infra-cost MVP |
| React | 19.2.4 (already in `package.json`) | UI library | Ships with Next.js 16; Server Components reduce client JS shipped to the sales team's browsers |
| TypeScript | ^5 (already in `package.json`) | Type safety | Required by `CLAUDE.md` ("estrito habilitado, sem `any` sem justificativa") |
| Supabase (`@supabase/supabase-js`) | 2.110.5 | Postgres client, Auth, Storage, Realtime | Already committed in `CLAUDE.md`; single hosted backend covers Postgres + Auth + RLS + Storage, no separate Node backend needed |
| `@supabase/ssr` | 0.12.3 | Cookie-based session handling for Next.js Server Components/Actions/Middleware | Official replacement for the deprecated `@supabase/auth-helpers-nextjs`; the only supported way to keep the Supabase session in sync across Server Components, Client Components, and Route Handlers in App Router. Confidence: LOW (single web source), but this is the officially documented current package name — verify exact version at install time |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | 6.3.1 / 10.0.0 | Kanban drag-and-drop (cards between the 7 funnel columns) | Standard choice for React drag-and-drop in 2026: ~2.8M weekly downloads, accessible out of the box (keyboard sensor + screen-reader announcements — matters since this is a work tool, not a toy), 6KB core. **Do not use `react-beautiful-dnd`** (see "What NOT to Use") |
| `react-hook-form` | 7.81.0 | Client cadastro form, card edit form, enum CRUD forms | Minimizes re-renders on forms with many optional fields (matches the "cadastro rápido, poucos campos obrigatórios" requirement) — only the changed field re-renders, not the whole form |
| `zod` | 4.4.3 | Schema validation, shared between client and Server Action | One schema defines client-side validation *and* server-side re-validation (Server Actions must never trust client input) — write the shape of a `cliente` or `card` once |
| `@hookform/resolvers` | 5.4.0 | Bridges `react-hook-form` + `zod` (`zodResolver`) | Needed any time a form uses both libraries together; confirmed compatible with zod v4 |
| Recharts (via shadcn/ui Chart component) | 3.9.2 | Dashboard charts (clientes por etapa, ganhos x perdidos, conversão, prospecção por produto/categoria) | shadcn/ui ships an official Chart component built directly on Recharts v3 with no extra abstraction — reuses the same design system as the rest of the UI instead of adding a second one (e.g. Tremor). Handles bar/line/pie, which covers every chart type the dashboard requirements list |
| `@tanstack/react-table` | 8.21.3 | Client list table (if/when a table view is added alongside the kanban) | Headless, pairs with shadcn/ui's `Table` primitives; client-side sorting/filtering/pagination is enough at free-tier data volumes (hundreds, not tens of thousands, of clientes) |
| `@tanstack/react-query` | 5.101.2 | Client-side cache + mutations for interactive views (kanban drag state, dashboard filters) | Server Components handle most initial reads for free; TanStack Query is worth adding specifically for the kanban board, where optimistic updates during drag-and-drop and mutation rollback-on-error matter. Has official DevTools, which helps a non-technical-owner project stay debuggable |
| `date-fns` | 4.4.0 | Formatting/comparing dates (task `data_conclusao`, "cards parados/atrasados" highlighting) | Tree-shakeable, functional, TypeScript-first; the "which cards are overdue" logic is exactly the kind of pure-function date math this library is built for |
| shadcn/ui + `lucide-react` | CLI-installed components / 1.24.0 | UI component primitives (forms, tables, dialogs, badges for kanban status) + icons | Copy-paste components (not an npm dependency to version-bump), built on Radix primitives for accessibility, already matches the Tailwind v4 setup in this repo. No extra design system to learn beyond what the dashboard chart component also uses |
| `class-variance-authority` | 0.7.1 | Variant styling for shadcn/ui components (e.g. kanban card status badges: em andamento/perdido/ganho) | Installed automatically by the shadcn/ui CLI when adding components with variants; don't hand-roll className switch statements |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | 4.1.10 — unit tests (Zod schemas, RLS-adjacent pure logic, Server Action input validation, "card atrasado" date logic) | `CLAUDE.md` requires at least one automated test per feature before it's considered done; Vitest shares config with Vite-style tooling and is fast enough to run on every commit |
| Playwright | 1.61.1 — E2E tests (login as vendedor vs supervisor, drag a card across the funil, verify RLS-driven visibility) | The permission model (vendedor sees only own clientes, supervisor sees all) is exactly the kind of cross-cutting behavior that's cheap to break with a UI change and expensive to catch by hand — E2E coverage here is high value for a 2-person non-technical-owner project |
| Supabase CLI (`supabase start`) | Local Postgres + Auth + Storage for development and CI | Lets tests run against real RLS policies instead of mocks — critical since RLS *is* the authorization system (`CLAUDE.md`: "nenhuma lógica de permissão feita à mão") |

## Installation

# Core (Supabase client + SSR helpers)

# Kanban drag-and-drop

# Forms + validation

# Dashboard charts (installs Recharts as a dependency of the shadcn/ui chart component)

# UI primitives (repeat per component needed)

# Tables (only if a table view is added)

# Client-side cache/mutations for the kanban board

# Dates

# Dev dependencies

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@dnd-kit` | Atlassian `pragmatic-drag-and-drop` | If the funil grows to 1,000+ cards per view and `@dnd-kit`'s built-in collision detection becomes a measurable bottleneck. Not expected for a single sales team's pipeline in the MVP |
| shadcn/ui Chart (Recharts) | Tremor | If the dashboard needs to ship *fast* with zero custom styling and the team is fine running two component systems side by side (shadcn for forms/tables, Tremor for charts). Adds a dependency and a second visual language for no real benefit here since the chart needs (bar/line/pie counts) are simple |
| `@tanstack/react-query` | SWR | If bundle size becomes the binding constraint (SWR is ~4.2KB vs ~13.4KB) and the app never needs complex optimistic mutations. Given the kanban drag-and-drop needs optimistic updates with rollback, TanStack Query's mutation API is worth the extra kilobytes |
| `date-fns` | `dayjs` | If minimal bundle size is the overriding priority and only a handful of date operations are needed. `date-fns` v4's tree-shaking narrows the gap enough that it's not worth the tradeoff here |
| Server Components + Server Actions for CRUD | A separate REST/GraphQL API layer | Never for this project — `CLAUDE.md` explicitly rules out a separate Node backend; Server Actions calling Supabase directly (behind RLS) is the entire backend |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `react-beautiful-dnd` | Archived/unmaintained by Atlassian, doesn't support React 18/19 concurrent features well | `@dnd-kit` |
| `@supabase/auth-helpers-nextjs` | Deprecated in favor of `@supabase/ssr`; official Supabase guidance has moved on | `@supabase/ssr` |
| A hand-rolled Node/Express API for business logic | `CLAUDE.md`: "Não existe backend Node.js separado neste projeto" — and it would introduce a service to host, which breaks the zero-infra-cost constraint | Supabase RLS policies + RPC (PL/pgSQL) + Edge Functions only where RLS/RPC genuinely can't express the rule (see `supabase-conventions` skill) |
| Client-side-only permission checks (hiding UI based on role without RLS backing it) | `CLAUDE.md` explicitly forbids "implementar autenticação/autorização por conta própria"; a vendedor could still query another vendedor's clientes via the API without RLS | Supabase RLS policies as the source of truth; UI hiding is a UX nicety on top, never the security boundary |
| `moment.js` | Long-deprecated (maintainers recommend against new usage), large bundle, mutable API prone to bugs | `date-fns` |
| Any paid/metered third-party service (e.g. hosted charting SaaS, hosted forms SaaS, paid notification service) | Breaks the explicit "custo zero de infraestrutura" MVP constraint in `CLAUDE.md` | Libraries above are all free/open-source and run inside the existing Next.js + Supabase footprint |
| Storing role/permission flags only in a client-readable cookie or localStorage | Trivially spoofable; role must be enforced server-side | Role column in a `profiles`/`users` table (or Supabase custom JWT claim) checked inside RLS policies |

## Stack Patterns by Variant

- Use Recharts via shadcn/ui's Chart component for bar/pie/line views
- Compute aggregates with Postgres views or RPC functions (see `supabase-conventions` skill), not client-side reduction over a full client list — keeps egress low against the 5GB/month free-tier cap
- Use Supabase Realtime (Postgres changes) — already included in the Supabase free tier, no new service
- Keep it optional/deferred for MVP; the requirements as scoped don't call for live multi-user sync yet
- Prefer Server Component reads with narrow `select()` column lists over fetching full rows client-side
- Cache dashboard aggregates (they don't need to be real-time to the second)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `zod@4.4.3` | `@hookform/resolvers@5.4.0` | Confirmed current `@hookform/resolvers` major supports zod v4's new API surface |
| `tailwindcss@^4` (already in repo) | `shadcn/ui` (current CLI) | shadcn/ui has fully migrated to Tailwind v4's CSS-first `@theme` config; no `tailwind.config.js` needed |
| `next@16.2.10` | `@supabase/ssr@0.12.3` | `@supabase/ssr` is designed for App Router middleware + Server Components; confirm the middleware cookie-refresh pattern from Supabase's Next.js Server-Side Auth guide when implementing, since cookie APIs have shifted across recent Next.js majors |
| React 19 | `@dnd-kit` | v6.x line is documented as React 19-compatible; avoid dnd-kit v5 or earlier if pinning manually |

## Sources

- npm registry (`registry.npmjs.org`) — live version lookups for all packages above (2026-07-14). Confidence: HIGH for version numbers specifically (authoritative source of truth), though the query-plan seam classifies raw npm lookups as LOW by default since no legitimacy check was run against them.
- WebSearch: "dnd-kit vs pragmatic-drag-and-drop vs react-beautiful-dnd for a React kanban board" — multiple 2026 comparison articles agreeing on dnd-kit as default. Confidence: LOW (web synthesis, not primary docs)
- WebSearch: "@supabase/ssr Next.js App Router integration" — supabase.com/docs links surfaced but not directly fetched; content synthesized from search snippets. Confidence: LOW — verify exact middleware code against `supabase.com/docs/guides/auth/server-side/nextjs` at implementation time
- WebSearch: "recharts vs tremor vs visx" and "shadcn/ui chart component recharts" — cross-checked two separate searches agreeing shadcn/ui's official chart component wraps Recharts v3. Confidence: LOW-MEDIUM
- WebFetch: `https://supabase.com/pricing` — official pricing page fetched directly for free-tier limits (500MB DB, 1GB storage, 50k MAU, 5GB+5GB egress, 2 project limit, 1-week inactivity pause). Confidence: MEDIUM (verified/cross-checked against a second web search that reported the same numbers)
- WebSearch: "Vercel Hobby plan limits 2026" — bandwidth/function/CPU limits and the non-commercial-use ToS caveat. Confidence: LOW — worth a manual re-check of Vercel's current ToS wording before committing to Hobby long-term, given this is technically a company's internal tool
- WebSearch: "Vitest Playwright Next.js Supabase testing 2026" — testing stack and local-Supabase-instance pattern. Confidence: LOW
- WebSearch: "TanStack Query vs SWR vs Server Components Supabase Next.js 2026" and "date-fns vs dayjs 2026" — library tradeoff synthesis. Confidence: LOW

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| supabase-conventions | Convenções de backend com Supabase para este projeto — quando usar RLS, RPC (PL/pgSQL) ou Edge Function, e como estruturar migrations. Use sempre que a tarefa envolver criar/alterar tabelas, políticas de acesso, regras de negócio no banco, ou qualquer lógica de servidor. | `.claude/skills/Supabase-conventions/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
