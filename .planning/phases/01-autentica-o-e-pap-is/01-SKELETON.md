# Walking Skeleton — CRM Raiar (Autenticação e Papéis)

**Phase:** 1
**Generated:** 2026-07-15

## Capability Proven End-to-End

A seeded Supervisor can start the full stack (hosted Supabase + `npm run dev`), log in with email + senha, land on a protected page that shows their name and a "Supervisor" role badge, reload the page and remain logged in — with the Supervisor/Vendedor distinction enforced by Postgres RLS (`is_supervisor()`), not just hidden in the UI.

This single round-trip exercises every layer the rest of the project builds on: real Supabase project connection → migration → RLS policy → `@supabase/ssr` cookie session → middleware refresh → protected route → real DB read of `profiles`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.10 App Router (already in `package.json`) | Server Components + Server Actions remove the need for a separate API layer; locked in `.claude/CLAUDE.md` |
| Data layer | Supabase Postgres (hosted, free tier) via `@supabase/supabase-js@2.110.5` | Single hosted backend covers Postgres + Auth + RLS + Storage; zero-infra-cost MVP constraint |
| Session | `@supabase/ssr@0.12.3` cookie-based session, refreshed in `middleware.ts` via `auth.getUser()` | Official replacement for the deprecated `@supabase/auth-helpers-nextjs`; never `getSession()` in server contexts |
| Auth model | Supabase Auth (no hand-rolled auth). User creation is admin-invite-only (no public sign-up) | Locked by D-01/D-02 and `CLAUDE.md` ("nunca implementar autenticação/autorização por conta própria") |
| Authorization | `profiles.role` (`user_role` enum) + `is_supervisor()` `SECURITY DEFINER` helper called by every RLS policy | RLS is the authorization source of truth; the app layer only reflects role in the UI |
| Server-side privileged logic | Supabase Edge Functions (Deno/TS), not a Next.js Server Action holding the secret key | `CLAUDE.md` + `supabase-conventions` skill: secret-key / send-email logic lives in an Edge Function |
| Deployment target (skeleton) | Documented local full-stack run (`npm run dev` against the hosted Supabase project). Vercel preview deploy deferred to a later slice. | Keeps the skeleton thin and free-tier; the Playwright e2e test drives the real UI against the real API |
| Directory layout | Route groups: `app/(auth)/*` (public), `app/(app)/*` (protected). Supabase clients in `lib/supabase/*`. Migrations in `supabase/migrations/*`. Edge Functions in `supabase/functions/*`. Tests in `tests/*`. | Matches RESEARCH.md Recommended Project Structure; every later phase inherits it |

## Stack Touched in Phase 1

- [x] Project scaffold (deps installed, Vitest + Playwright test runners, Supabase CLI init) — Plan 01
- [x] Routing — `app/(auth)/login`, `app/(app)/*` protected group, `app/auth/confirm` callback — Plans 03/05
- [x] Database — real read AND write: `profiles` table + RLS + trigger, seeded users, `supabase db push` to hosted project — Plan 02
- [x] UI — interactive login form wired to `signInWithPassword`, protected page reading `profiles` — Plan 03
- [x] Deployment — documented local full-stack run command exercised by the session-persistence e2e test — Plan 03

## Out of Scope (Deferred to Later Slices)

Explicit — this list prevents later phases from re-litigating Phase 1's minimalism:

- Deactivating / reactivating a user's access from the UI (D-04 — done directly in the DB for now; candidate future phase).
- Changing an existing user's role from the UI (D-07 — done directly in the DB if it happens; no `UPDATE` policy on `profiles` in this phase).
- Vercel preview / production deployment automation (skeleton uses the local full-stack run; deploy is a later slice, and `CLAUDE.md` requires a review step before any production deploy).
- Editable kanban stages, client CRUD, dashboard — later phases (2–5).
- Custom SMTP / branded invite emails — Supabase built-in email is used; a manual "did the real email arrive?" check gates the phase.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Vendedores e supervisores cadastram, editam e encontram clientes PJ (CLI-01…CLI-07).
- Phase 3: O time move clientes pelas 7 etapas do funil kanban, com tarefas, observações e histórico (FUN-01…FUN-10).
- Phase 4: Supervisor mantém as listas editáveis (categoria, produtos, tipos de tarefa, motivos de perda) (ADM-01…ADM-04).
- Phase 5: Dashboard gerencial, cada papel na medida da própria visão (DSH-01…DSH-07).
