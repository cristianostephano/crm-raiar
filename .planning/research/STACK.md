# Stack Research

**Domain:** B2B sales CRM (kanban/pipeline + client management + role-based access + reporting dashboard) — internal tool, MVP, zero-infra-cost constraint
**Researched:** 2026-07-14
**Confidence:** MEDIUM (library choices cross-referenced across multiple independent sources; exact version numbers pulled live from the npm registry, HIGH confidence; free-tier limits cross-checked against supabase.com/pricing and vercel.com/docs directly)

This document does **not** revisit the frontend/backend split — Next.js (React/TypeScript) + Supabase is fixed in `CLAUDE.md`. It answers: given that, what specific libraries and patterns should this MVP use?

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

```bash
# Core (Supabase client + SSR helpers)
npm install @supabase/supabase-js @supabase/ssr

# Kanban drag-and-drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# Dashboard charts (installs Recharts as a dependency of the shadcn/ui chart component)
npx shadcn@latest add chart

# UI primitives (repeat per component needed)
npx shadcn@latest add button form input table dialog badge select

# Tables (only if a table view is added)
npm install @tanstack/react-table

# Client-side cache/mutations for the kanban board
npm install @tanstack/react-query

# Dates
npm install date-fns

# Dev dependencies
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test
npx playwright install
```

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

**If the dashboard needs are still just counts/aggregates (as scoped today):**
- Use Recharts via shadcn/ui's Chart component for bar/pie/line views
- Compute aggregates with Postgres views or RPC functions (see `supabase-conventions` skill), not client-side reduction over a full client list — keeps egress low against the 5GB/month free-tier cap

**If the kanban later needs real-time updates across users (e.g. supervisor sees a vendedor's card move live):**
- Use Supabase Realtime (Postgres changes) — already included in the Supabase free tier, no new service
- Keep it optional/deferred for MVP; the requirements as scoped don't call for live multi-user sync yet

**If free-tier Supabase egress (5GB/month) becomes tight as the client list grows:**
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

---
*Stack research for: B2B sales CRM (kanban/pipeline) MVP on Next.js + Supabase*
*Researched: 2026-07-14*

---

# v1.1 Addendum: Bulk Spreadsheet Import/Export

**Domain:** Bulk spreadsheet import/export addendum for the existing Next.js + Supabase CRM
**Researched:** 2026-07-22
**Confidence:** MEDIUM (npm registry versions are HIGH confidence/authoritative; several library-choice judgments are LOW-MEDIUM/web-synthesis — flagged inline)

This section covers ONLY the new capabilities for the v1.1 milestone (import via `.xlsx`/`.csv` with column mapping + duplicate detection, and export to `.xlsx`/`.csv`). It assumes the full existing stack above (unchanged) and does not repeat rationale for those entries.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@e965/xlsx` | 0.20.3 | Parse uploaded `.xlsx` workbooks into rows; generate `.xlsx` for export | This is an automated, unmodified republish of official SheetJS Community Edition onto the public npm registry (GitHub Actions mirror, updated automatically whenever SheetJS cuts a new release). It exists specifically because **the `xlsx` package name on the npm registry is stuck on 0.18.5 (published 2022) and is not maintained** — SheetJS stopped publishing there over a licensing/2FA dispute with npm and now distributes only from `cdn.sheetjs.com`. `npm install xlsx` today silently installs a version carrying two known CVEs (see "What NOT to Use"). `@e965/xlsx` gives a normal `npm install`/lockfile/Dependabot workflow with the current, patched SheetJS code (0.20.3+) — important for a non-technical project owner who won't remember to manually track a CDN tarball URL |
| `papaparse` | 5.5.4 | Parse uploaded `.csv` files into rows; generate `.csv` text for export | De facto standard CSV library for JS (works identically in Node and browser), actively maintained (this version published June 2026), handles malformed rows/quoting edge cases gracefully with row-level error reporting — needed for the "mostrar erros antes de confirmar" requirement. `Papa.unparse()` also covers CSV export, so one library does both directions |
| `@types/papaparse` | 5.5.2 | TypeScript types for papaparse | papaparse itself ships untyped JS; this is the community-maintained `@types` package. `@e965/xlsx` does not need a separate types package — it ships its own `.d.ts` (mirrors SheetJS's) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (already in stack, 4.4.3) | — | Per-row validation during import (required fields present, `categoria`/`produtos_consumidos` values are valid enum options, etc.) | Reuse the existing `cliente` Zod schema (or a relaxed "import row" variant of it) to validate each parsed row before showing the preview/error screen — no new dependency needed, and it keeps validation identical to the manual cadastro form |
| `react-hook-form` + shadcn/ui `Table`/`Select` (already in stack) | — | Column-mapping screen (dropdown per spreadsheet column → target `cliente` field) | The client schema has ~10 fields — this is a small, static mapping UI, not a generic "any schema" import wizard. Building it with existing primitives avoids a new dependency entirely (see "What NOT to Use" for the dedicated import-wizard libraries considered and rejected) |
| Postgres `pg_trgm` extension (Supabase-hosted, no npm package) | built into Postgres | Fuzzy duplicate detection (e.g. "Empresa ABC Ltda" vs "Empresa ABC LTDA") when matching import rows against existing clientes | `pg_trgm` ships with every Postgres install, including Supabase's, and is enabled with a one-line migration (`create extension if not exists pg_trgm;`). Exposing a `similarity(razao_social, $1)` check through a Postgres RPC function (per the `supabase-conventions` skill) keeps the entire existing client list — which the duplicate check needs to compare against — server-side and RLS-scoped, instead of shipping it to the browser for a JS fuzzy-match library to chew on. This is the same "compute in Postgres, don't ship the full table to the client" pattern already used for the dashboard aggregates |

### Development Tools

No new dev tools needed. Reuse Vitest (unit-test the Zod row-validation logic and any pure "is this a likely duplicate" helper) and Playwright (E2E: upload a file as Supervisor, map columns, confirm import; verify Vendedor cannot reach the import screen at all — RLS/role check).

## Installation

```bash
# Core: xlsx parsing/generation (patched SheetJS mirror) + CSV parsing/generation
npm install @e965/xlsx papaparse

# Dev dependencies
npm install -D @types/papaparse
```

No changes needed to Supabase project config beyond one migration:

```sql
-- supabase/migrations/xxxx_enable_pg_trgm.sql
create extension if not exists pg_trgm;
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@e965/xlsx` (npm mirror) | Official SheetJS tarball from `cdn.sheetjs.com` (`npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) | If the team wants the package sourced directly from SheetJS with zero third-party republishing in the chain, at the cost of a URL dependency in `package.json` that won't auto-update or trigger Dependabot/`npm outdated` — a real maintenance risk for a non-technical owner who won't remember to bump it by hand |
| `@e965/xlsx` + `papaparse` (two libraries, one per format) | `exceljs` (handles `.xlsx` only) | Not recommended right now: `exceljs`'s last npm publish was October 2023 (per npm registry metadata) and community discussion describes it as effectively unmaintained with multiple open dependency/security issues. SheetJS-family libraries also read/write CSV, so there's no need for a second Excel-only library |
| Postgres `pg_trgm` RPC for duplicate detection | `fuse.js` (7.5.0, actively maintained) as a client-side fuzzy matcher | If duplicate suggestions need to appear instantly while the Supervisor is still on the column-mapping screen (before any server round-trip) — e.g. an inline "did you mean an existing client?" hint. Would need the visible client subset shipped to the browser first, so keep it scoped (own clientes only, or a narrow candidate set) rather than the full table |
| Build column-mapping UI with existing shadcn/ui + react-hook-form | `react-spreadsheet-import` (4.7.1) | If the project later needs a generic "let any user import any CSV shape" wizard with auto-fuzzy column matching out of the box. Today it's not worth it: the library is built on Chakra UI, which would introduce a second component/design system alongside the project's shadcn/ui "nova" (base-ui) setup — the exact tradeoff the project already avoided once by picking shadcn's Chart component over Tremor |
| Build column-mapping UI with existing shadcn/ui + react-hook-form | `react-csv-importer` (0.8.1) / `@importcsv/react` (0.6.1) / `csv-import-react` (1.0.18) | `react-csv-importer` is CSV-only (no `.xlsx`) and last published in 2023. `@importcsv/react` and `csv-import-react` are more current but pull in their own opinionated modal/wizard UI and validation model — redundant given the schema is small and react-hook-form + zod already cover validation |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `npm install xlsx` (the plain npm-registry package) | Resolves to 0.18.5 (published 2022), which is **not maintained and carries known vulnerabilities**: CVE-2023-30533 (prototype pollution, fixed upstream in 0.19.3) and CVE-2024-22363 (ReDoS, fixed upstream in 0.20.2). No non-vulnerable version of this exact package exists on the npm registry — SheetJS never published the fix there | `@e965/xlsx` (0.20.3+) or the official CDN tarball |
| `exceljs` | Effectively unmaintained (no npm publish since Oct 2023); open issues about outdated/vulnerable transitive dependencies (`glob`, `rimraf`, `inflight`) with no fix shipped | `@e965/xlsx` for both `.xlsx` read and write |
| `string-similarity` | **Explicitly marked "no longer supported" on npm** (deprecated notice on the package itself) | Postgres `pg_trgm` `similarity()`, or `fuse.js` if a client-side JS option is ever needed |
| A dedicated import-wizard React library (`react-spreadsheet-import`, etc.) as the primary approach | Adds a second design system (Chakra) or a second opinionated form/validation stack, for a mapping UI that only needs to cover ~10 static fields | Custom screen built on existing shadcn/ui `Table`/`Select` + react-hook-form + zod |
| Persisting the uploaded spreadsheet to Supabase Storage before parsing it | Not needed for this use case — the file is parsed once and discarded; storing it first adds Storage-quota usage (1GB free tier) and an extra round trip for zero benefit, since parsing can happen directly on the in-memory upload | Read the file straight out of `request.formData()` (Route Handler) or the `FormData` argument (Server Action) into an `ArrayBuffer`/`Buffer` and parse in the same request |

## Stack Patterns by Variant

**Import (upload + parse):**
- Either a Server Action or a Route Handler (`app/api/clientes/import/route.ts`) can receive the uploaded file — Next.js Server Actions accept `File` values inside `FormData` natively. A Route Handler is slightly easier to reason about here since it can return a normal JSON `Response` with a clear preview/error payload before anything is written to the database
- Must run on the **Node.js runtime**, not Edge (`export const runtime = 'nodejs'` if not already the default) — `@e965/xlsx`/SheetJS relies on Node `Buffer` APIs that aren't guaranteed on Edge
- Two-step flow matches the requirement ("mostrar erros/duplicados antes de confirmar"): (1) parse + validate + duplicate-check → return a preview to the client, nothing persisted yet; (2) a separate confirm action performs the actual inserts (all new rows into "Aguardando contato", per the milestone decision) inside a transaction/RPC scoped by RLS to the Supervisor role

**Export (generate + download):**
- Must be a **Route Handler**, not a Server Action — Server Actions can only return serializable data to React, not a binary/text `Response` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (or `text/csv`) and `Content-Disposition: attachment` headers needed to trigger a file download
- Query the client list the normal RLS-scoped way (Vendedor gets own clientes, Supervisor gets all — same policies already enforcing this everywhere else), then hand the rows to `XLSX.utils.json_to_sheet` + `XLSX.write` (or `Papa.unparse` for CSV) and stream the result back

**File-size ceiling to design around (Vercel Hobby, zero-infra constraint):**
- Next.js Server Actions default to a 1MB request-body limit (`experimental.serverActions.bodySizeLimit` in `next.config.js` to raise it)
- Vercel enforces a **hard 4.5MB request-body limit on standard serverless Functions regardless of framework config** (Hobby plan included) — raising `bodySizeLimit` above that won't help; requests over 4.5MB get rejected by Vercel's edge layer (413) before the function even runs
- Given this project's actual volume (hundreds to low-thousands of clientes from partner/trade-show lists, not tens of thousands), a plain spreadsheet with ~10 text columns stays well under this ceiling in practice. Still: set `bodySizeLimit` to something safely below 4.5MB (e.g. `'4mb'`) and add a friendly client-side file-size check with a plain-language message ("essa planilha é grande demais, tente dividir em partes menores") rather than letting the user hit a raw 413 error

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@e965/xlsx@0.20.3` | Node.js runtime in Next.js 16 Route Handlers/Server Actions | Confirm `runtime = 'nodejs'` (not `edge`) on whichever handler does the parsing |
| `papaparse@5.5.4` | `@types/papaparse@5.5.2` | Types package version trails the JS package slightly; this is normal and fine — no functional gap for the APIs used here (`parse`/`unparse`) |
| `pg_trgm` | Supabase-hosted Postgres (any current version) | Standard extension; enable per-project via migration, not a dashboard toggle, to keep it versioned like every other schema change (`CLAUDE.md`: migrations always versioned) |

## Sources

- `registry.npmjs.org` — direct registry queries for `xlsx`, `@e965/xlsx`, `exceljs`, `papaparse`, `@types/papaparse`, `react-spreadsheet-import`, `react-csv-importer`, `@importcsv/react`, `csv-import-react`, `fuse.js`, `fast-levenshtein`, `string-similarity` (2026-07-22). Confidence: HIGH for version numbers and publish dates/deprecation flags specifically (authoritative source of truth)
- WebSearch: "SheetJS xlsx npm registry stopped publishing why use CDN" — cross-checked against SheetJS's own GitHub/Gitea issue threads (#2667, #3183) explaining the npm registry dispute. Confidence: MEDIUM (multiple independent primary-adjacent sources agreeing)
- WebSearch: "xlsx package CVE-2024-22363 prototype pollution ReDoS vulnerability fixed version" — cross-checked against GitHub Advisory Database (GHSA-5pgg-2g8v-p4x9) and Snyk. Confidence: MEDIUM-HIGH (security advisory databases are authoritative for CVE existence/fix-version claims)
- WebSearch: "exceljs maintenance status deprecated 2026 alternative" — GitHub discussion threads (#2884, #2987) on exceljs's own repo describing maintainer inactivity. Confidence: MEDIUM (primary-adjacent — the project's own maintainers/community discussing it)
- WebSearch: "react-spreadsheet-import npm column mapping CSV import library React" — npm package pages + GitHub READMEs. Confidence: LOW-MEDIUM (web synthesis, but library READMEs are close to primary source)
- WebSearch: "Next.js Server Actions file upload body size limit default 1MB serverActions.bodySizeLimit" — nextjs.org official docs page surfaced directly (`serverActions` config reference). Confidence: MEDIUM-HIGH (official docs referenced, though not directly WebFetched)
- WebSearch: "Vercel Hobby plan serverless function request body size limit 4.5MB 2026" — vercel.com/docs/functions/limitations and vercel.com/kb surfaced directly. Confidence: MEDIUM-HIGH (official docs referenced, though not directly WebFetched) — worth a manual re-check of `vercel.com/docs/functions/limitations` at implementation time since platform limits can change
- WebSearch: "Postgres pg_trgm similarity fuzzy duplicate detection Supabase extension" — supabase.com/docs/guides/database/extensions and community discussion. Confidence: MEDIUM. Note one surfaced caveat (GitHub issue supabase/supabase#30503) about `similarity()` occasionally not being found after enabling the extension via the dashboard UI — mitigated here anyway, since the recommended approach is a versioned SQL migration (`create extension`) rather than the dashboard toggle

---
*Stack research for: bulk spreadsheet import/export (CRM Raiar v1.1)*
*Researched: 2026-07-22*


---

# Milestone Addendum: v1.2 Gestão de Equipe, Análises de Funil e Filtros

**Domain:** CRM SaaS internal tool — v1.2 milestone additions (team management, funnel analytics, kanban layout, location filters)
**Researched:** 2026-07-25
**Confidence:** MEDIUM (all 5 target items resolved to specific, verifiable answers; two rely on WebSearch synthesis rather than primary docs — see per-item notes)

## Headline Finding

**4 of the 5 sub-questions need ZERO new npm dependencies.** The 5th (searchable UF/Cidade select) also needs zero new npm dependencies — it's a `shadcn add combobox` file copy, because this project's shadcn style (`base-nova`) is built on `@base-ui/react`, which is already installed and already ships its own Combobox primitive. This milestone should not touch `package.json` at all under normal circumstances.

## Recommended Stack

### Core Technologies

No new core technologies. Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) stays exactly as-is. All 6 target features in v1.2 are implemented with existing packages plus native Postgres SQL and CSS.

### Supporting Libraries — per feature

| Feature | New Package? | What to Use Instead |
|---------|--------------|----------------------|
| (a) Deactivate team member without deleting | **None** | `supabase.auth.admin.updateUserById()` — already part of `@supabase/supabase-js` (2.110.5, installed) |
| (b) Per-stage time-in-stage / conversion / dropout metrics | **None** | Native PostgreSQL window functions (`LAG`/`LEAD`, `EXTRACT(EPOCH FROM ...)`) in a view/RPC, same pattern as `supabase/migrations/0003_dashboard_aggregates.sql` |
| (c) Per-salesperson comparison table | **None** | Existing `components/ui/table.tsx` (shadcn) fed by a new Postgres aggregate view/RPC — row count is bounded by team size (a handful of vendedores), no headless table library needed |
| (d) Fixed-height scrollable kanban column | **None** | Tailwind CSS only (`overflow-y-auto` + a height constraint) on the card list inside each `@dnd-kit` droppable column |
| (e) Searchable, cascading UF → Cidade select | **None (npm)** — one `shadcn add combobox` file copy | `@base-ui/react`'s native `Combobox` primitive via shadcn's `base-nova` registry — already installed at `^1.6.0` |

### Development Tools

No changes. Vitest, Playwright, Supabase CLI stay as already configured.

## Installation

```bash
# No npm install needed for this milestone.

# One shadcn CLI file-copy (not an npm package) for item (e):
npx shadcn@latest add combobox
# This pulls in its registryDependencies (also file copies, zero npm cost):
#   - button      (already present in this project)
#   - input-group (not yet present — will be added by the command above)
```

## Detailed Findings by Item

### (a) Deactivate a team member without deleting their account

**Answer:** Use Supabase Auth's admin "ban" mechanism: `supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" })` (≈100 years — Supabase has no permanent-ban shorthand, so a long duration is the documented workaround) blocks the user from logging in while their `auth.users` row — and therefore your `profiles` row and all `clientes.responsavel` foreign-key references — stays intact. Reactivating sets `ban_duration: "none"`.

**Stack impact:** None. `admin.updateUserById` is part of the GoTrue admin API already exposed by `@supabase/supabase-js` (2.110.5, installed). It is **not** callable with the anon/publishable key — it requires the Supabase **service role key**, which this project does not currently have a server-only client for (`lib/supabase/client.ts` and `lib/supabase/server.ts` both currently use the anon key via cookies). Implementing this feature requires:
1. A new `SUPABASE_SERVICE_ROLE_KEY` env var (server-only, never sent to the browser — add to `.env.local` and Vercel project env, not `NEXT_PUBLIC_*`).
2. A new server-only admin client (e.g. `lib/supabase/admin.ts`) used exclusively inside a Server Action, gated by an explicit `is_supervisor()` check before the ban call — same defense-in-depth pattern already used for `importar_clientes_lote` (non-security-definer RPC + explicit guard), just applied at the Server Action layer since GoTrue admin calls happen outside RLS entirely (RLS doesn't apply to `auth.users`).

This is an **architecture note, not a dependency**, but it's important enough to flag here because it's the one item that introduces a new credential/trust boundary. Do not use `admin.deleteUser()` — that is a hard delete and would break `clientes.responsavel` foreign keys and historical attribution, which the milestone explicitly rules out.

**Confidence:** LOW-MEDIUM (WebSearch-synthesized from Supabase community/GitHub discussion threads, not fetched directly from `supabase.com/docs`; the `ban_duration` field name and format — decimal + unit suffix like `"2h45m"` — is corroborated across multiple independent threads including Supabase's own GoTrue repo issues, so treat the *existence and shape* of the field as reliable, but verify the exact Server Action code against `supabase.com/docs/reference/javascript/auth-admin-updateuserbyid` at implementation time).

### (b) Per-stage time-in-stage / conversion % / dropout metrics from `historico` + `etapa_alterada_em`

**Answer:** This is a native SQL problem, not a library problem. Standard approach:
- **Time-in-stage:** window function `LAG(etapa_alterada_em) OVER (PARTITION BY cliente_id ORDER BY etapa_alterada_em)` (or an equivalent self-join) to pair each stage-entry timestamp with the next one for that client, then `EXTRACT(EPOCH FROM (next_ts - ts)) / 86400.0` for days. For the client's *current* stage (no "next" row yet), pair against `now()` to get an in-progress duration, or exclude it from the average depending on whether "time in stage" should mean "completed stays" only — this is a product decision to confirm with the user, not a technical blocker.
- **Conversion % per stage:** `COUNT(DISTINCT cliente_id)` reaching stage N+1 divided by `COUNT(DISTINCT cliente_id)` that ever reached stage N.
- **Dropout count/rate:** clients whose most recent `historico`/stage record shows `status_acompanhamento = 'perdido'` while sitting in stage N.
- **Avg days-to-win / days-to-loss:** `AVG(data_do_evento_terminal - data_de_criacao_do_cliente)` (or first-stage-entry timestamp) filtered by `status_acompanhamento IN ('ganho','perdido')` respectively.

The complication flagged in the milestone context — `historico` rows carry a free-text `descricao` rather than structured `etapa_anterior`/`etapa_nova` columns — means these queries **cannot reliably regex-parse `historico.descricao`** to know which stage a row represents; `clientes.etapa_alterada_em` only tells you *when* the client's stage last changed, not the full stage-by-stage timeline needed for a per-stage funnel (a client that skipped or revisited stages loses history if only the current stage + one timestamp is tracked). **This is very likely a schema gap, not just a query-writing task** — flag it back to planning: computing a *reliable* per-stage funnel (as opposed to just "current distribution + time since last change") probably needs the trigger that already exists (the one populating `historico`) to also write a structured `etapa_id` (and possibly a dedicated `etapa_historico` table with `cliente_id, etapa, entrada_em, saida_em`) rather than relying on text parsing. Recommend this be resolved as a phase-planning/schema question, not solved by adding any library.

**Stack impact:** None — pure Postgres (views/RPC), matching the existing `supabase/migrations/0003_dashboard_aggregates.sql` pattern. See `supabase-conventions` skill for RLS/RPC/view choice.

**Confidence:** LOW (WebSearch synthesis of general SQL funnel-analysis articles, not project-specific; the schema-gap concern above is my own analysis of the milestone context description, not sourced — verify the actual `historico` table structure via `gsd-map-codebase` or a direct migration read before phase planning).

### (c) Per-salesperson comparison table

**Answer:** A Postgres aggregate view/RPC (conversion %, deals started/won, avg cycle time per `responsavel`) rendered through the existing `components/ui/table.tsx` (shadcn `Table` primitive, already installed). Row count equals team size — small enough that no client-side sorting/pagination library adds value.

**Stack impact:** None. Note: earlier v1.0-era `CLAUDE.md` stack notes recommended `@tanstack/react-table` "if/when a table view is added" — it was **never actually installed** (confirmed absent from current `package.json`), and this feature still doesn't need it: a handful of rows with server-computed aggregates doesn't warrant a headless table library. Do not add `@tanstack/react-table` for this.

**Confidence:** HIGH (verified directly against this project's `package.json` — not a web claim).

### (d) Fixed-height scrollable kanban column

**Answer:** Pure CSS/Tailwind: give the scrollable card-list element inside each column a bounded height (e.g. `max-h-[calc(100vh-Npx)]` or a fixed `h-[...]`) plus `overflow-y-auto`, while the column header (title, count badge) stays outside that scroll region so it doesn't scroll away. `@dnd-kit`'s `DndContext`, `useDroppable`, and `useSortable` operate correctly inside a scrollable ancestor with no special configuration — dnd-kit even auto-detects scrollable containers to power its optional auto-scroll-during-drag behavior, which is a nice-to-have bonus this change unlocks for free, not a requirement to make it work.

**Stack impact:** None. Confirmed both `@dnd-kit/core` (6.3.1) and `@dnd-kit/sortable` (10.0.0) already installed match current npm `latest` exactly — no version bump available or needed.

**What NOT to do:** Don't reach for a virtualization library (e.g. `react-window`, `@tanstack/react-virtual`) to solve this — the milestone's stated problem is "the page grows infinitely," which is a CSS overflow/height problem, not a rendering-performance problem at this team's card volumes. Only revisit virtualization if a single column realistically holds 500+ cards, which is far outside this project's scale.

**Confidence:** MEDIUM (dnd-kit's scroll-container-agnostic behavior is documented in dnd-kit's own docs/source and corroborated by multiple community kanban-board tutorials; the CSS technique itself is standard and not something that needs "verification" so much as application).

### (e) Searchable, cascading UF → Cidade select

**Answer:** This project's `components.json` is configured with `"style": "base-nova"`, and its existing `components/ui/select.tsx` already imports `Select as SelectPrimitive` from `@base-ui/react/select` — confirming this codebase uses **Base UI**, not Radix, and not `cmdk`, as its shadcn primitive layer (a deliberate shadcn v4-era option; different from the Radix-based `new-york`/`default` styles most older shadcn tutorials assume). The generic "shadcn combobox" recipe found in most tutorials/blog posts is built on `cmdk` + Radix `Popover` — **do not follow that recipe here**, it would introduce a mismatched primitive library alongside Base UI.

Instead, shadcn's own `base-nova` registry ships a `combobox` component built directly on `@base-ui/react`'s native `Combobox` primitive (verified by fetching `https://ui.shadcn.com/r/styles/base-nova/combobox.json` directly — its only `dependencies` entry is `@base-ui/react`, already installed at `^1.6.0`, which matches the current npm `latest` of `1.6.0`). Its `registryDependencies` are `button` (already present in this project) and `input-group` (not yet present, but installing the combobox via the CLI will bring it in as a file copy automatically).

**Design for the UF/Cidade case:**
- **Estado (UF):** a fixed 27-item list (26 states + DF) — small enough that a plain `Select` (already installed, already used elsewhere in the form) is arguably sufficient without search; a `Combobox` is a reasonable upgrade for consistency/typeahead but not strictly required by list size.
- **Cidade:** dynamically populated from distinct `clientes.cidade` values scoped to the selected `Estado` (not a static full Brazilian-city list, per the milestone scope) — this is exactly the "searchable, dependent, server/DB-backed options" use case the Base UI `Combobox` is designed for (its docs describe typeahead + async/filtered option lists as a primary use case). Fetch the distinct-cities-for-UF list via a small Postgres RPC/view (existing pattern), not a client-side full list.
- Both fields integrate with the existing `react-hook-form` + `zod` + `@hookform/resolvers` stack exactly like the current `Select` usage does — Base UI's `Combobox.Root` exposes a controlled `value`/`onValueChange` API compatible with RHF's `Controller`, same shape as the existing `Select` wrapper in this codebase.

**Stack impact:** None (npm). One `shadcn add combobox` file copy (plus its `input-group` file dependency), which the CLI (`shadcn` package, already a devDependency at `^4.13.0`) will fetch and write into `components/ui/`.

**What NOT to do:** Do not add `cmdk`, `react-select`, `downshift`, or any other combobox library — all would either duplicate Base UI's own Combobox or introduce a second, inconsistent primitive-library dependency into a codebase that has deliberately standardized on Base UI via shadcn's `base-nova` style.

**Confidence:** MEDIUM (the registry JSON for `combobox.json` was fetched directly from `ui.shadcn.com`, and `@base-ui/react`'s version was verified directly against the npm registry and this project's own `select.tsx` import — both primary-source checks. The recommendation to use `Combobox` specifically for the dynamic Cidade list, versus a plain `Select` re-populated on Estado change, is my synthesis based on Base UI's documented use cases, not a fetched confirmation of "Base UI Combobox supports N cities dynamically" — validate the exact API surface (`Combobox.Root`, `items`, async filtering) against Base UI's own docs at implementation time).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Native Postgres window functions for funnel metrics (b) | A dedicated product-analytics tool (PostHog, Mixpanel funnels) | Never for this project — external paid/metered service, breaks the zero-infra-cost constraint, and the data already lives in Postgres |
| Base UI `Combobox` via shadcn `base-nova` registry (e) | `cmdk` + Radix `Popover` "classic shadcn combobox" | Never for this project — would introduce a second, inconsistent UI primitive library alongside the already-adopted Base UI; only relevant if this project were on a Radix-based shadcn style, which it is not |
| Plain shadcn `Table` for per-salesperson comparison (c) | `@tanstack/react-table` | If the table needs client-side sorting/filtering/pagination across dozens+ of rows — not the case here (row count = team size) |
| CSS `overflow-y-auto` for scrollable kanban columns (d) | `react-window` / `@tanstack/react-virtual` | Only if a single column needs to render hundreds of cards simultaneously; not this team's scale |
| `supabase.auth.admin.updateUserById({ ban_duration })` (a) | Adding an `is_active` boolean to `profiles` and checking it in every RLS policy/query | Ban-based approach is preferred: it stops login at the Auth layer itself (can't be bypassed by a query that forgets the `is_active` check), whereas an app-level flag requires remembering to enforce it everywhere — more attack surface for a "no home-rolled auth logic" project |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `cmdk` | Not compatible with this project's Base UI primitive choice; would introduce a second, redundant combobox implementation | Base UI's native `Combobox` via `shadcn add combobox` (base-nova registry) |
| `admin.deleteUser()` for team member removal | Hard-deletes the `auth.users` row, cascading/orphaning `profiles` and breaking `clientes.responsavel` history — explicitly ruled out by the milestone ("soft-delete, not hard delete") | `admin.updateUserById(id, { ban_duration })` |
| `@tanstack/react-table` for the per-salesperson table | Overkill for a handful of rows; adds a dependency that was already considered and never installed in v1.0/v1.1 | Existing shadcn `Table` component |
| A virtualization library for kanban columns | Solves a rendering-performance problem this project doesn't have; the actual problem is a CSS overflow/height issue | `overflow-y-auto` + a height constraint |
| A static npm package of all Brazilian cities (e.g. full IBGE city list bundled client-side) | Milestone explicitly wants Cidade options **derived from existing client records** per UF, not an exhaustive external list — bundling one would also bloat the client and go stale | A Postgres RPC/view returning `DISTINCT cidade` for the selected `uf` from `clientes` |

## Stack Patterns by Variant

**If a future milestone needs a genuinely reliable stage-by-stage funnel (not just "current stage + last-changed timestamp"):**
- Add a structured `etapa_historico` table (`cliente_id`, `etapa`, `entrada_em`, `saida_em`) populated by the same DB trigger that already writes to `historico`, instead of parsing `historico.descricao` text.
- This is a schema change to flag during phase planning for item (b), not a library decision.

**If the UF/Cidade Combobox needs to handle very large option lists (e.g. thousands of cities nationally, not scoped to one state):**
- Use Base UI Combobox's async/filter-on-type mode (server-side filtered RPC call per keystroke, debounced) rather than loading a full list client-side — not expected to be necessary here since Cidade is always scoped to one selected UF first.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@base-ui/react@^1.6.0` (installed) | shadcn `base-nova` registry `combobox` component | Verified directly: `combobox.json`'s only listed dependency is `@base-ui/react`; installed version matches current npm `latest` (1.6.0, published 2026-06-18) exactly — no bump needed |
| `@dnd-kit/core@^6.3.1` / `@dnd-kit/sortable@^10.0.0` (installed) | Scrollable ancestor containers | Both match current npm `latest` exactly (6.3.1 / 10.0.0, both published Dec 2024) — dnd-kit's scroll-container detection needs no extra config for this use case |
| `@supabase/supabase-js@^2.110.5` (installed) | `auth.admin.updateUserById` (GoTrue admin API) | Current npm `latest` is `2.110.8` (2026-07-21) — a small patch bump exists but is not required for this feature; the admin API shape has been stable across 2.110.x |
| React 19 / Next.js 16 (installed) | Server Actions calling a service-role Supabase client | No compatibility concern — this is the same Server Action pattern already used for `importar_clientes_lote`, just with a new server-only client instance instead of the RLS-bound one |

## Sources

- Direct npm registry lookups (`registry.npmjs.org`) for `@dnd-kit/core`, `@dnd-kit/sortable`, `@base-ui/react`, `@supabase/supabase-js`, `cmdk` (2026-07-25). Confidence: HIGH for the version numbers themselves (authoritative source of truth), though the project's query-plan seam classifies raw npm lookups as LOW by default since no separate legitimacy check was run against them.
- Direct fetch of `https://ui.shadcn.com/r/styles/base-nova/combobox.json` (shadcn's own component registry, base-nova style) — confirms the combobox is built on `@base-ui/react`, not `cmdk`. Confidence: MEDIUM (primary source, official registry, but not cross-verified against a second independent source).
- Direct read of this project's own `components.json` and `components/ui/select.tsx` — confirms `base-nova`/`@base-ui/react` is actually in use, not just configured. Confidence: HIGH (ground truth, this repo).
- Direct read of this project's `package.json` — confirms exact currently-installed versions and confirms `@tanstack/react-table`/`@tanstack/react-query` were never actually added despite earlier stack notes recommending them. Confidence: HIGH (ground truth, this repo).
- WebSearch: "Supabase Auth ban user admin.updateUserById ban_duration disable login without deleting" — Supabase community/GitHub discussion threads (`supabase/auth` issues, `supabase` org discussions). Confidence: LOW-MEDIUM — verify exact code against `supabase.com/docs/reference/javascript/auth-admin-updateuserbyid` before implementing.
- WebSearch: "Postgres SQL compute average time in stage conversion funnel dropout rate from timestamped event log" — general SQL funnel-analysis pattern articles (Silota, Cube Dev, Mode, Tiger Data). Confidence: LOW (generic pattern synthesis, not project-specific; the schema-gap risk noted for item (b) is my own analysis of the milestone description, unsourced).
- WebSearch: "dnd-kit scrollable container fixed height column kanban board React" — multiple community kanban-board tutorials (LogRocket, dev.to, radzion.com) consistently pairing dnd-kit with Tailwind `overflow-y-auto` for column scrolling. Confidence: MEDIUM (consistent across many independent sources, though none is dnd-kit's own docs directly).

---
*Stack research for: CRM Raiar v1.2 milestone (team management, funnel analytics, kanban scroll, location filters)*
*Researched: 2026-07-25*
