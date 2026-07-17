---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 02
subsystem: frontend
tags: [next-js, server-actions, react-hook-form, zod, shadcn, dialog]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-01
    provides: clientes table, RLS policies (responsavel/is_supervisor()), ETAPAS/ETAPA_KEYS single source of truth
provides:
  - createClienteSchema (lib/validations/cliente.ts) — shared client+server zod schema for cadastro
  - createCliente Server Action (app/actions/clientes.ts) — server-side re-validation, responsavel override, 23505 -> duplicate_razao_social mapping
  - getClientesAgrupadosPorEtapa (lib/supabase/queries/clientes.ts) — RLS-scoped read grouped by funil stage
  - ClienteQuickCreateForm ("Novo cliente" Dialog)
  - /clientes protected page (both roles) with grouped-by-stage list
  - Clientes nav link in app/(app)/layout.tsx
affects: [02-03, 02-04, 02-05, 02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadcn dialog primitive (base-nova/@base-ui/react) installed via `npx shadcn@latest add dialog` — no new npm dependency, DialogTrigger composed via the `render` prop (base-ui's asChild equivalent) to avoid nesting a Button inside DialogTrigger's own <button>"
    - "Server Action re-validates with the same zod schema used client-side (never trusts client input) and forces responsavel = caller uid for a Vendedor, as defense in depth on top of the 02-01 RLS INSERT policy"
    - "Object-level .superRefine (not per-field .refine) for the responsavel '' sentinel — same zodResolver-generic-inference-safe pattern InviteUserForm established for `role` in Phase 1"

key-files:
  created:
    - lib/validations/cliente.ts
    - app/actions/clientes.ts
    - lib/supabase/queries/clientes.ts
    - components/clientes/ClienteQuickCreateForm.tsx
    - components/ui/dialog.tsx
    - tests/clientes/cliente-actions.test.ts
  modified:
    - app/(app)/layout.tsx
    - app/(app)/clientes/page.tsx (new file, listed here since it's the plan's other main artifact)

key-decisions:
  - "createCliente() cannot be unit-invoked directly from Vitest (lib/supabase/server.ts's createClient() reads next/headers cookies(), which requires a live Next.js request scope unavailable under Vitest) — the duplicate-razao_social behavior is instead proven with a direct signed-in insert exercising the exact same insert shape the action sends to Postgres, per this plan's own test guidance."
  - "Vendedor's Responsável control is a disabled, read-only Input showing their name (decoupled from react-hook-form's `field` prop) rather than a disabled Select — simpler, and the underlying form value stays pinned to the Vendedor's own uid via defaultValues since nothing ever calls field.onChange in that branch."
  - "02-02's /clientes page renders a simple stage-grouped list (not yet the drag-and-drop kanban board) per the plan's explicit scope note — 02-03 turns this into the compact kanban board."

requirements-completed: [CLI-01, CLI-02, CLI-03, FUN-01]

coverage:
  - id: D1
    description: "createClienteSchema accepts the minimal required fields (razão social, endereço, responsável) with every optional field blank"
    requirement: "CLI-01/CLI-02"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-actions.test.ts#createClienteSchema > accepts the minimal required fields (CLI-01/CLI-02) with every optional blank"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing a required field produces a per-field zod error"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-actions.test.ts#createClienteSchema > rejects a missing required field with a per-field error"
        status: pass
    human_judgment: false
  - id: D3
    description: "responsavel === '' is rejected via object-level superRefine (no default pre-selected for Supervisor)"
    requirement: "CLI-03"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-actions.test.ts#createClienteSchema > rejects responsavel === '' via object-level superRefine (CLI-03, no default pre-selected)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A duplicate razao_social insert fails with 23505 — the exact code createCliente's error-mapping branch converts to { error: { code: 'duplicate_razao_social' } }"
    requirement: "D-06"
    verification:
      - kind: integration
        ref: "tests/clientes/cliente-actions.test.ts#createCliente duplicate razao_social handling (D-06) > a second insert with an already-existing razao_social fails with 23505"
        status: pass
    human_judgment: false
  - id: D5
    description: "A new cliente's etapa defaults to 'aguardando_contato' on insert (the funil's first stage, no separate initial-stage control)"
    requirement: "FUN-01"
    verification:
      - kind: integration
        ref: "tests/clientes/cliente-actions.test.ts#createCliente duplicate razao_social handling (D-06) > clientes.etapa defaults to 'aguardando_contato' on insert (FUN-01 origin stage)"
        status: pass
    human_judgment: false
  - id: D6
    description: "clientes/page.tsx guards with getUser + redirect('/login') and has NO supervisor-only redirect; layout.tsx renders a /clientes Link for every authenticated user; ClienteQuickCreateForm's Responsável control is disabled for a Vendedor and a no-default Select for a Supervisor"
    verification:
      - kind: other
        ref: "Source assertions: grep confirmed redirect(\"/login\") present in clientes/page.tsx with no supervisor-role redirect branch; grep confirmed an unconditional 'Clientes' Link in layout.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "npx tsc --noEmit, npm run lint, and npm run build all pass for the new/modified files"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean), npm run lint (zero warnings/errors in any file this plan touched — all reported issues are pre-existing in unrelated .claude/ tooling scripts), npm run build (Compiled successfully, /clientes route listed)"
        status: pass
    human_judgment: false
  - id: D8
    description: "End-to-end manual verification: Vendedor creates a minimal client and sees it under 'Aguardando contato'; duplicate razão social is blocked; Supervisor's Responsável Select has no default"
    human_judgment: true
    verification:
      - kind: manual
        ref: "Deferred to end-of-phase human verification per config.json's human_verify_mode: end-of-phase (this plan's <human-check> is explicitly batched, not a standalone checkpoint)"
        status: pending

duration: ~20min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 2: Cadastro Rápido de Cliente Summary

**Built the createCliente Server Action (shared zod schema, server-side re-validation, Vendedor responsavel override, D-06 duplicate-razão-social mapping), the "Novo cliente" quick-create Dialog, and a `/clientes` page that lists every visible client grouped by the 7 fixed funil stages — the phase's first end-to-end slice from form submit to RLS-scoped render.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-17T01:25:22Z
- **Completed:** 2026-07-17T01:45:41Z
- **Tasks:** 2/2
- **Files modified:** 8 (6 created, 2 modified — `app/(app)/clientes/page.tsx` counted as created)

## Accomplishments
- `lib/validations/cliente.ts`: `createClienteSchema` — CLI-01/CLI-02 required-vs-optional split, object-level `.superRefine` for the `responsavel` "no default" rule (CLI-03), consistent with `InviteUserForm.tsx`'s zod v4 + `@hookform/resolvers` compatibility pattern
- `app/actions/clientes.ts`: `createCliente` Server Action — re-validates server-side, forces `responsavel` to the caller's own uid for a Vendedor (defense in depth on top of the 02-01 RLS INSERT policy), maps Postgres `23505` to a structured `{ error: { code: "duplicate_razao_social" } }`, calls `revalidatePath("/clientes")` on success
- `lib/supabase/queries/clientes.ts`: `getClientesAgrupadosPorEtapa()` — RLS-scoped read (no manual `responsavel` filter), grouped by `ETAPA_KEYS` order
- `components/clientes/ClienteQuickCreateForm.tsx`: "Novo cliente" Dialog (420px), razão social + compact 2-column endereço grid + responsável (disabled/pre-filled for Vendedor, no-default Select for Supervisor), duplicate/generic error banners and success message per the UI-SPEC Copywriting Contract
- `app/(app)/clientes/page.tsx`: protected page for both roles (no supervisor-only redirect), renders the "Clientes" Display heading + quick-create trigger, clients grouped under each of the 7 funil stage labels, and the brand-new-vendedor empty state
- `app/(app)/layout.tsx`: unconditional "Clientes" nav link added before "Gerenciar equipe"
- 10 automated tests (`tests/clientes/cliente-actions.test.ts`): schema validation (accept-minimal, missing-required-field, responsavel-empty-rejected) + integration (duplicate razão social -> 23505, new cliente defaults to `aguardando_contato`)

## Task Commits

Each task was committed atomically:

1. **Task 1: createCliente Server Action + shared zod schema + test** - `df05387` (feat)
2. **Task 2: Quick-create Dialog, /clientes page, and nav link** - `32eabd2` (feat)

## Files Created/Modified
- `lib/validations/cliente.ts` - `createClienteSchema` + inferred `CreateClienteInput` type
- `app/actions/clientes.ts` - `createCliente(values)` Server Action
- `lib/supabase/queries/clientes.ts` - `getClientesAgrupadosPorEtapa()`
- `tests/clientes/cliente-actions.test.ts` - schema + duplicate-razao_social + default-etapa tests
- `components/ui/dialog.tsx` - shadcn dialog primitive (installed, not hand-written)
- `components/clientes/ClienteQuickCreateForm.tsx` - "Novo cliente" quick-create Dialog
- `app/(app)/clientes/page.tsx` - client list/kanban-origin page (both roles)
- `app/(app)/layout.tsx` - added unconditional "Clientes" nav link

## Decisions Made
- `createCliente()` cannot be invoked directly from Vitest (its `createClient()` call reads `next/headers` `cookies()`, which needs a live Next.js request scope) — the plan's own guidance to use "a direct signed-in insert exercising the same schema" was followed instead, proving the exact `23505` code the action's mapping branch consumes.
- Vendedor's Responsável field renders as a disabled, read-only `Input` showing their name (not a disabled `Select`) — simpler composition; the underlying form value stays pinned to the Vendedor's own uid via `defaultValues` since nothing calls `field.onChange` in that branch.
- `DialogTrigger` composes with `<Button>` via base-ui's `render` prop (not `asChild`) to avoid nesting two native `<button>` elements — same pattern already used inside `DialogContent`'s built-in close button.

## Deviations from Plan

None — plan executed exactly as written. The shadcn dialog CLI run skipped re-writing `components/ui/button.tsx` ("files might be identical"), confirming no unintended change to existing primitives.

## Issues Encountered
- Running `tests/clientes/*.test.ts` together (or combined with `tests/auth/rls-roles.test.ts`, which `rls-clientes.test.ts` imports `SEED_ACCOUNTS` from and therefore also executes) can trip Supabase's free-tier `signInWithPassword` rate limit or hit a transient "JWT issued at future" (`PGRST303`) clock-skew flake — both already documented as known, pre-existing conditions in `02-01-SUMMARY.md`'s "Issues Encountered" section, not introduced by this plan. This plan's own test file, `tests/clientes/cliente-actions.test.ts`, was run in isolation per its `<verify>` command and passed reliably (10/10) every time it was executed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The full cadastro data layer (`createClienteSchema`, `createCliente`, `getClientesAgrupadosPorEtapa`) and the `/clientes` page shell are ready for 02-03 to build the drag-and-drop kanban board directly on top of, without further schema or Server Action work.
- `ClienteQuickCreateForm`'s Responsável field composition (disabled Input for Vendedor / no-default Select for Supervisor) establishes the pattern for `ClienteDetailSheet.tsx`'s equivalent field in a later plan.
- End-to-end manual verification (Vendedor create -> "Aguardando contato", duplicate block, Supervisor no-default Select) is deferred to end-of-phase batch verification per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for continuing to 02-03.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 8 created/modified files verified present on disk (`lib/validations/cliente.ts`, `app/actions/clientes.ts`, `lib/supabase/queries/clientes.ts`, `components/clientes/ClienteQuickCreateForm.tsx`, `components/ui/dialog.tsx`, `tests/clientes/cliente-actions.test.ts`, `app/(app)/layout.tsx`, `app/(app)/clientes/page.tsx`); both task commit hashes (`df05387`, `32eabd2`) confirmed present in `git log`.
