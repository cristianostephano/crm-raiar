# Project Research Summary

**Project:** CRM Raiar
**Domain:** B2B sales pipeline CRM (internal tool) - kanban funnel + role-based dashboard, on Next.js + Supabase, zero-infra-cost MVP
**Researched:** 2026-07-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a purpose-built internal sales-tracking CRM, not a general-purpose product - a small sales team tracking PJ (business) clients through a fixed 7-stage funnel, replacing a paid CRM that failed because data-entry friction caused people to stop updating it. Experts building this kind of tool converge on a clear pattern: Next.js App Router (Server Components + Server Actions) as a thin presentation layer, with Postgres - via Supabase RLS, SECURITY DEFINER helper functions, and RPC functions - as the entire authorization and business-rule engine. There is no separate backend service; CLAUDE.md explicitly forbids one, and research confirms this is the standard, lower-risk approach at this scale.

The recommended build order is vertical slices by dependency: auth/RLS foundation first, then client (PJ) cadastro, then the kanban board (the actual reason the project exists), then task management, then admin CRUD for the four editable enum lists, then the dashboard last. Stack choices largely already fixed by CLAUDE.md are filled in with dnd-kit for drag-and-drop, react-hook-form + zod for forms, shadcn/ui's Recharts-based Chart component for the dashboard, and TanStack Query for optimistic kanban updates.

The key risk is Postgres RLS going subtly wrong in silent ways: RLS-disabled tables leak all client data with no error; testing only from a Supervisor account hides Vendedor-visibility bugs; unwrapped auth.uid() in policies creates a quiet performance cliff; and business rules (ganho only from the final stage, motivo required on loss) must be enforced in the database, not just the UI, or they're bypassable via direct API calls. A second risk cluster is scope creep past the agreed MVP boundaries. Two gaps were identified worth adding to MVP scope: search/filter on the client list, and a lightweight activity/change log per client (both cheap given they reuse data already being captured).

## Key Findings

### Recommended Stack

Core technologies (Next.js 16, React 19, TypeScript, Supabase) are already fixed by CLAUDE.md. This research fills in the supporting library layer - all free/open-source, running inside the existing Next.js + Supabase footprint.

**Core technologies:**
- @supabase/ssr (0.12.3): cookie-based session sync across Server Components/Actions/middleware - official replacement for the deprecated @supabase/auth-helpers-nextjs
- @dnd-kit/core + @dnd-kit/sortable: kanban drag-and-drop - accessible out of the box, current community standard; do NOT use react-beautiful-dnd (archived, no React 18/19 support)
- react-hook-form + zod + @hookform/resolvers: forms with one shared client/server validation schema
- shadcn/ui Chart component (Recharts v3): dashboard charts, reuses the existing design system
- TanStack Query: client-side cache/optimistic updates for kanban drag state

### Expected Features

Nearly all table stakes are already scoped in PROJECT.md. Research surfaced two gaps worth promoting into MVP, plus anti-features to resist.

**Must have (already scoped):** kanban with drag-and-drop (7 fixed stages); fast client creation with minimal required fields; role-based visibility (vendedor own / supervisor all); required lost-reason on "perdido"; task list per card with due dates; visual staleness/aging indicator; free-text notes per card.

**Must have (recommended additions):** search/filter on client list/kanban (by responsavel, categoria, produto, texto livre) - without it the supervisor's full-team view is unusable at scale; lightweight activity/change log per client - reuses the staleness-highlight's "last updated" data, gives dashboard numbers a credible basis.

**Should have (differentiators, protect this scope):** prospeccao por produto/categoria on the dashboard - the single most domain-specific feature; self-service editable enums (categoria, produtos, tipos de tarefa, motivo de perda) restricted to Supervisor.

**Defer/resist (anti-features):** active notifications, compliance-grade audit trail, configurable pipelines, marketing automation, third-party integrations, native mobile app, spreadsheet import UI, deal-value/forecasting, granular per-field permissions.

### Architecture Approach

No separate backend service. Postgres - via RLS, a SECURITY DEFINER is_supervisor() helper, security_invoker views for dashboard aggregates, and plpgsql RPC functions for multi-step business rules (e.g. mover_card_funil) - is the entire authorization and business-rule layer. Next.js Server Components handle reads, Server Actions/RPC calls handle writes; deliberately no app/api/ route-handler layer.

**Major components:**
1. Auth & Identity (Supabase Auth + profiles table with role) - the foundation everything else's RLS depends on
2. Authorization (is_supervisor() function + RLS policies on every table)
3. Client (PJ) module (clientes table) - the entity everything hangs off; a client row IS the funnel card
4. Kanban/Funnel module (etapa, status_acompanhamento + mover_card_funil RPC) - enforces ganho/perdido rules server-side
5. Tasks module (tarefas table)
6. Editable enum module (4 lookup tables, write-restricted to Supervisor)
7. Dashboard/reporting module (security_invoker views, inheriting RLS scoping automatically)

### Critical Pitfalls

1. **RLS disabled or policy-less table** - leaks all rows with zero errors; enforce via migration checklist and Supabase Advisors before every merge.
2. **Testing only as Supervisor** - hides Vendedor-scoped RLS bugs; seed two Vendedor test accounts from the first migration and require a cross-vendedor isolation test.
3. **RLS on joined/related tables evaluated independently** - locking down clientes doesn't protect cards/tarefas/dashboard views; each needs its own explicit policy.
4. **Unwrapped auth.uid() in RLS policies** - write (SELECT auth.uid()) from the first policy onward to avoid a quiet per-row performance cliff.
5. **Business rules enforced only in the frontend** - "ganho only from final stage" / "motivo required on perdido" must live in a DB constraint/RPC, not just the drag UI.

## Implications for Roadmap

### Phase 1: Auth & RLS Foundation
**Rationale:** Every other table's RLS depends on profiles.role and is_supervisor() existing first; highest-leverage phase, root of most critical pitfalls.
**Delivers:** Supabase Auth wiring, profiles table, is_supervisor() function, wrapped-auth.uid() RLS baseline, two seeded Vendedor test accounts, first cross-vendedor isolation test, migration discipline.
**Addresses:** Role-based visibility (table stakes)
**Avoids:** Pitfalls 1, 2, 4, 10, 11

### Phase 2: Client (PJ) Cadastro
**Rationale:** First end-to-end vertical slice; a kanban card IS a clientes row, so this is a hard prerequisite for Phase 3. Seed the 4 enum tables here even though admin CRUD UI comes later.
**Delivers:** clientes table with RLS, minimal-required-field creation form, role-scoped client list, enum tables seeded via migration.
**Uses:** react-hook-form + zod + @hookform/resolvers, @supabase/ssr
**Implements:** Client (PJ) module, Editable enum module (schema only)

### Phase 3: Kanban Board (Core Value)
**Rationale:** The actual reason the project exists - should land as soon as client records exist.
**Delivers:** 7-column drag-and-drop board, mover_card_funil RPC enforcing ganho/perdido rules server-side, fractional card-position strategy, visual staleness highlight, touch-friendly drag with non-drag fallback.
**Addresses:** Kanban board, lost-reason capture, visual staleness indicator
**Avoids:** Pitfalls 3, 5, 6

### Phase 4: Card Detail - Tarefas & Observacao
**Rationale:** Builds directly on the client/card slice; tipos_tarefa already seeded.
**Delivers:** Task list per card with due dates, free-text observacao.
**Addresses:** Task list, free-text notes

### Phase 5: Search/Filter + Activity Log (recommended addition)
**Rationale:** Both enhance already-built features rather than adding new UI surface - natural to slot in once the kanban is actually being used.
**Delivers:** Filter by responsavel/categoria/produto + text search; append-only historico table.
**Addresses:** Search/filter, activity/change history (recommended MVP additions)

### Phase 6: Admin CRUD for Editable Enums
**Rationale:** Enum values are already in real use by this point via seeded data; only editability is missing, and nothing else blocks on it.
**Delivers:** 4 supervisor-only CRUD screens (shared EnumList/EnumForm), soft-delete to preserve referential integrity.
**Addresses:** Self-service editable enums (differentiator)
**Avoids:** Pitfall 8

### Phase 7: Dashboard
**Rationale:** Read-only aggregate over everything else; building earlier risks reworking views as schema shifts. Indexes should already exist from earlier phases' migrations.
**Delivers:** 6 security_invoker views/RPCs, rep-scoped and supervisor-scoped dashboard UI (shadcn/ui Chart).
**Addresses:** Dashboard (5 decided metrics), rep-scoped view (differentiator)
**Avoids:** Pitfalls 3, 7

### Phase Ordering Rationale

- Identity/authorization must exist first since every table's RLS policy depends on is_supervisor().
- Client entity precedes kanban because a kanban card IS a clientes row - no separate "opportunity" entity.
- Kanban (Core Value) is prioritized ahead of supporting detail and admin conveniences, per PROJECT.md.
- Search/filter and activity log are placed right after the kanban/card-detail slices since they enhance existing data rather than requiring new entities.
- Admin CRUD for enums is safely last among CRUD work because enum values are usable (seeded) from Phase 2 onward - only self-service editing is deferred.
- Dashboard is last because it's a pure read layer over everything else.
- Every phase inherits the RLS/testing discipline from Phase 1 (wrapped auth.uid(), dual Vendedor accounts, negative-case tests) - this should be enforced at planning time for every subsequent phase, not just Phase 1.

### Research Flags

Needs research: Phase 3 (fractional position strategy, mover_card_funil RPC validation details, touch/mobile drag ergonomics), Phase 7 (security_invoker view syntax/index strategy - some STACK.md sources here are LOW confidence).

Standard patterns (skip research-phase): Phase 1 (HIGH confidence, official Supabase docs), Phase 2/4/6 (standard CRUD-behind-RLS, well documented).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Version numbers HIGH (live npm lookups); library trade-off reasoning LOW-MEDIUM, web-synthesis only - verify @supabase/ssr middleware pattern against current docs at implementation time |
| Features | MEDIUM | Cross-referenced across multiple independent CRM comparison/implementation articles, no official vendor docs needed for domain-pattern questions |
| Architecture | HIGH | Core patterns are official Supabase documentation, cross-checked against multiple GitHub discussions on recursion/security gotchas |
| Pitfalls | MEDIUM-HIGH | RLS mechanics verified against official docs and a real-world incident writeup; kanban/UX/MVP-scope findings MEDIUM, multiple independent community sources |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- @supabase/ssr exact middleware cookie-refresh pattern was not directly fetched from official docs - verify against supabase.com/docs/guides/auth/server-side/nextjs before implementing Phase 1's middleware.
- Vercel Hobby plan's non-commercial-use ToS wording should be manually re-checked before committing long-term, since this is a company's internal tool.
- Two open product decisions in CLAUDE.md are not resolvable by research: whether a Vendedor can edit/delete their own clients beyond creating them, and whether kanban stage names should become editable in a future version. Confirm both explicitly during Phase 1/2 discuss-phase before writing the corresponding RLS policies.
- FEATURES.md's recommendation to promote search/filter and activity-log from "gap" to MVP scope (Phase 5) should be explicitly confirmed with the project owner during requirements/roadmap review - it's a research recommendation, not yet locked in PROJECT.md.

## Sources

### Primary (HIGH confidence)
- Row Level Security | Supabase Docs (https://supabase.com/docs/guides/database/postgres/row-level-security)
- Creating a Supabase client for SSR | Supabase Docs (https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- Setting up Server-Side Auth for Next.js | Supabase Docs (https://supabase.com/docs/guides/auth/server-side/nextjs)
- Supabase Docs | Troubleshooting | RLS Performance and Best Practices (https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- Database Migrations | Supabase Docs (https://supabase.com/docs/guides/deployment/database-migrations)
- Infinite recursion when using users table to specify users role for RLS - supabase Discussion #1138 (https://github.com/orgs/supabase/discussions/1138)
- npm registry (registry.npmjs.org) - live version lookups, 2026-07-14
- .planning/PROJECT.md and project's own Supabase-conventions skill / CLAUDE.md

### Secondary (MEDIUM confidence)
- Postgres Views: The Hidden Security Gotcha in Supabase (https://dev.to/datadeer/postgres-views-the-hidden-security-gotcha-in-supabase-ckd)
- 76 RLS policies rewritten in one migration: the auth.uid() init-plan trap in Supabase (https://dev.to/arvavit/76-rls-policies-rewritten-in-one-migration-the-authuid-init-plan-trap-in-supabase-4hg)
- Supabase RLS Best Practices | MakerKit (https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- A robust mechanism for Kanban board column indexing | Nick McCleery (https://nickmccleery.com/posts/08-kanban-indexing/)
- Multiple CRM comparison articles (Pipedrive/HubSpot/Zoho) cross-referenced in FEATURES.md
- Historical Summary vs. Activity Stream vs. Audit Log - SugarCRM Support (https://support.sugarcrm.com/Knowledge_Base/User_Interface/Historical_Summary_vs._Activity_Stream_vs._Change_Log/)

### Tertiary (LOW confidence)
- WebSearch synthesis on @supabase/ssr App Router integration - verify against official docs before implementing
- WebSearch synthesis on dnd-kit vs alternatives, TanStack Query vs SWR, date-fns vs dayjs
- WebSearch on Vercel Hobby plan ToS limits - recheck before committing long-term

---
*Research completed: 2026-07-14*
*Ready for roadmap: yes*
