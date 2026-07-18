---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_phase_name: Administração de Listas Editáveis
status: executing
stopped_at: Phase 3 UI-SPEC approved
last_updated: "2026-07-18T00:09:56.054Z"
last_activity: 2026-07-17
last_activity_desc: Phase 3 execution started
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 15
  completed_plans: 13
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-14)

**Core value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.
**Current focus:** Phase 3 — Administração de Listas Editáveis

## Current Position

Phase: 3 (Administração de Listas Editáveis) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-07-17 — Phase 3 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 30 | 3 tasks | 15 files |
| Phase 01 P02 | 45 | 3 tasks | 3 files |
| Phase 01 P03 | 90 | 4 tasks | 12 files |
| Phase 01 P04 | 180min | 4 tasks | 10 files |
| Phase 01 P05 | 35min (Tasks 1-3; Task 4 deferred) | 3/4 tasks | 6 files |
| Phase 02 P01 | 20min | 3 tasks | 4 files |
| Phase 02 P02 | 20min | 2 tasks | 8 files |
| Phase 02 P03 | ~15min | 2 tasks | 4 files |
| Phase 02 P04 | 50min | 2 tasks (+1 checkpoint) tasks | 8 files files |
| Phase 02 P05 | ~40min | 2 tasks tasks | 10 files files |
| Phase 02 P06 | ~50min | 2 tasks | 10 files |
| Phase 02 P07 | 55min | 2 tasks | 12 files |
| Phase 03 P01 | 35min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Auth & RLS foundation goes first (hard blocker — every table's RLS depends on profiles.role/is_supervisor()), Dashboard goes last (pure read layer over data other phases produce).
- Roadmap: Search/filter (CLI-07) folded into Phase 2 (Client) and activity log (FUN-10) folded into Phase 3 (Kanban), rather than a standalone phase, to keep phases as complete vertical slices per standard granularity.
- Open items flagged by research, still to confirm during Phase 1/2 discuss-phase: whether Vendedor can edit/delete own clients beyond creating (CLAUDE.md currently assumes "can edit, cannot delete" — already reflected in CLI-06), and whether kanban stage names become editable in a future version (currently fixed, out of scope for v1).
- [Phase ?]: Standardize on NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy JWT) for downstream Supabase clients, not the also-present NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Matches RESEARCH.md code examples and the 01-01 test helper
- [Phase ?]: Pinned @vitejs/plugin-react to 5.2.0 instead of latest 6.0.3 — 6.0.3's optional @rolldown/plugin-babel peer requires @babel/core@^8, conflicting with @babel/core@7.29.7 already required by shadcn
- [Phase ?]: Hand-wrote components/ui/form.tsx using React.cloneElement instead of Radix Slot — The base-nova shadcn registry style (built on @base-ui/react) has no form component yet; project has no Radix dependency to build on
- [Phase 01-02]: First Supervisor account seeded with a known temporary password via admin.createUser (not the invite flow, since no Supervisor exists yet to invite the first one) - owner can rotate it later via 'Esqueci minha senha' once that flow ships
- [Phase 01-02]: Vendedor A/B test accounts use fixed @raiar.local test emails, exported as SEED_ACCOUNTS from tests/auth/rls-roles.test.ts as the canonical seeded identities every future phase's RLS tests should reuse
- [Phase 01-02]: RLS enablement (relrowsecurity) verified via the Supabase Management API's database/query SQL endpoint using the same personal access token needed for supabase link/db push, since supabase-js has no raw-SQL passthrough for pg_class
- [Phase 01-03]: Deleted app/page.tsx (default create-next-app scaffold) — app/(app)/page.tsx now owns route "/", avoiding a Next.js routing collision
- [Phase 01-03]: Login/logout use window.location.assign() hard navigation instead of router.push()+router.refresh() — avoids a stale pre-login Router Cache entry silently stranding the user on /login after a successful sign-in
- [Phase 01-03]: Kept the root file named middleware.ts rather than Next.js 16's renamed proxy.ts convention, to match this plan's stated artifact contract; deprecated name confirmed still functional, flagged for a future low-priority rename
- [Phase ?]: [Phase 01-04] SITE_URL Edge Function secret set to http://localhost:3000 (app not yet deployed) - must be updated to the real production URL once deployed
- [Phase ?]: [Phase 01-04] Edge Function CORS uses Access-Control-Allow-Origin: '*' rather than an origin allowlist - acceptable since the real authorization boundary is the server-side Supervisor-role check, not CORS, for this single first-party frontend
- [Phase ?]: [Phase 01-04] Standardized Edge Function error responses on a structured { error: { code, message } } JSON body propagating the real upstream status/code, instead of flattening every failure to one hardcoded status - project convention for future Edge Functions
- [Phase ?]: [Phase 01-04] Declined a request to persist the Supabase personal access token in .env.local (loaded into every test run/server process); the owner instead ran 'supabase login' interactively for persistent CLI-scoped credentials
- [Phase 01-05]: Shared /auth/confirm Route Handler (verifyOtp) serves BOTH the invite link and the password-reset link — one callback for both flows, per RESEARCH.md; future email-based Auth flows should reuse this same route
- [Phase 01-05]: ForgotPasswordForm.tsx now distinguishes rate-limit errors (over_email_send_rate_limit / over_request_rate_limit) from the generic non-revealing success path shown for every other outcome (including "email doesn't exist," which GoTrue's /recover never reports anyway) — found as a real bug while diagnosing a real "reset email never arrived" report; does not violate the non-revealing security requirement since rate-limit codes carry no account-existence information
- [Phase 01-05]: Task 4 (real email round-trip verification for password-reset AND invite-accept) explicitly DEFERRED at the project owner's request, not skipped or silently closed — see Blockers/Concerns below
- [Phase 02-01]: A clientes row IS the funnel card (1:1 model) - etapa/status_acompanhamento/motivo_perda_id/observacao/posicao live directly on clientes, no separate cards/opportunities table
- [Phase 02-01]: mover_card_funil RPC is NOT security definer - runs as the caller so RLS still applies to the underlying UPDATE
- [Phase 02-01]: historico has no user-facing INSERT policy - only SECURITY DEFINER triggers write it, keeping the audit trail tamper-proof from the API surface
- [Phase 02-02]: createCliente() cannot be unit-invoked directly from Vitest (createClient() reads next/headers cookies(), needs a live Next.js request scope) - duplicate-razao_social behavior proven via a direct signed-in insert exercising the same schema, per the plan's own guidance
- [Phase 02-02]: Vendedor's Responsavel field renders as a disabled read-only Input showing their name (not a disabled Select) - underlying form value stays pinned via defaultValues since field.onChange is never called in that branch
- [Phase 02-03]: Quick-action icon row (phone/WhatsApp/calendar) deferred - no wiring target yet, left for a later plan to avoid dead UI
- [Phase 02-03]: isOverdue TriangleAlert uses plain aria-label instead of Tooltip primitive - tooltip.tsx not installed yet and isOverdue is always false until 02-04 wires real data
- [Phase 02-04]: No toast library installed - built a small local transient banner in KanbanBoard instead of adding an unapproved new npm dependency (e.g. sonner) mid-task — Task 1's install list only covered dnd-kit + date-fns + shadcn tooltip; adding sonner would need its own legitimacy checkpoint and the plan gave no signal it was expected
- [Phase 02-04]: moverCard's pre-check SELECT (needed for the ganho guard) is scoped by the same RLS policy as the UPDATE, so it also mitigates T-02-13 (cross-vendedor move) with no extra code — A non-owned clienteId returns no row from the SELECT and the action fails closed before ever calling the RPC
- [Phase ?]: 02-05: isClienteIncompleto lives in lib/supabase/queries/clientes.ts (colocated with ClienteListItem), precomputed once per row as ClienteListItem.incompleto so the Incompleto badge and Incompletos tab can never disagree
- [Phase ?]: 02-05: Filter option lists (categoria/produto/estado/vendedor) are derived in-memory from the already-loaded card set, not a separate lookup query, keeping filtering fully local (Pitfall 7)
- [Phase ?]: 02-05: Drag is disabled (StaticClienteCard) whenever search/filters/Incompletos/a non-'Mais recentes' sort is active, since computeNovaPosicao would otherwise compute a fractional position against the wrong neighbor
- [Phase ?]: [Phase 02-06]: categoriaId/produtoIds/vendedorId edit-Select options reuse KanbanBoard's in-memory-derived option lists (02-05 pattern) instead of a new full-catalog query
- [Phase ?]: [Phase 02-06]: Extracted isClienteIncompleto/ClienteCompletudeInput into dependency-free lib/clientes/completude.ts so KanbanBoard (Client Component) can import the runtime function without pulling next/headers into the client bundle
- [Phase ?]: [Phase 02-07]: marcarStatus always routes through mover_card_funil (never a raw clientes UPDATE) so the 02-01 CHECK constraints stay the real FUN-05/FUN-06 backstop; pre-checks only add friendlier error codes
- [Phase ?]: [Phase 02-07]: Added atualizarDataTarefa beyond the plan's 3-action tarefas list, since the UI-SPEC's per-row Calendar-popover date picker would be a non-functional stub without it
- [Phase ?]: [Phase 02-07]: PerdaMotivoDialog's Confirmar perda is genuinely HTML-disabled (not just validated on click) until a motivo is selected, matching FUN-06's acceptance criteria literally
- [Phase ?]: [Phase 03-01]: getListaValores lives in app/actions/listas.ts (not lib/supabase/queries/clientes.ts) - it's a distinct admin read (active+inactive) that must not be confused with the existing ativo=true-only cadastro readers
- [Phase ?]: [Phase 03-01]: EditableListTab's pluralAtivoLabel is passed fully-formed by the caller (not derived) since Portuguese gender/number agreement differs per tab (categorias ativas vs produtos ativos)

### Pending Todos

None yet.

### Blockers/Concerns

- REQUIREMENTS.md's own "Coverage" note said "28 total" but the actual v1 requirement list (AUTH/CLI/FUN/ADM/DSH) contains 32 items. Roadmap creation used the actual 32-item list as ground truth and corrected the count in REQUIREMENTS.md traceability. Worth a quick sanity check with the user if the number 28 came from somewhere specific.
- Research flags two areas needing deeper research at plan time, not now: Phase 3 (fractional card-position strategy, mover_card_funil RPC validation, touch/mobile drag ergonomics) and Phase 5 (security_invoker view syntax/index strategy — LOW confidence sources in STACK.md).
- REQUIREMENTS.md shows AUTH-02 (Supervisor invites Vendedor) already checked off as Complete, but the invite Edge Function + gerenciar-equipe screen that actually deliver it are still planned for 01-04 (not yet built) — pre-existing inconsistency, not introduced by 01-03; worth a quick correction pass before shipping the phase.
- **OPEN — 01-05 Task 4 deferred (real email round-trip verification):** password-reset and invite-accept email round-trips have not been manually confirmed end-to-end yet. All code (shared `/auth/confirm` callback, forgot/reset-password screens, `updateUser` contract test) is implementation-complete and automated-test-covered, but AUTH-01/AUTH-02 must NOT be treated as fully manually-verified end-to-end until this is resumed and approved. The project owner's first real attempt (password reset to `cristiano.stephano@raiarorganicos.com.br`) did not arrive; diagnosis via `auth.flow_state` points to the free-tier mailer's known 2/hour rate limit (established in 01-04) most likely being exhausted by two prior real recovery attempts for a different account only ~24 seconds earlier — not a defect in this plan's code (though one real defect, silently-swallowed rate-limit errors, was found and fixed, commit `4e12455`). By the time this plan closed out, ~1.5h had passed since the last attempt, so the quota should be clear for a future retry. See `.planning/phases/01-autentica-o-e-pap-is/01-05-SUMMARY.md`'s "Open Item: Task 4" section for the exact resume steps.

### Roadmap Evolution

- Phase 2 edited: merged old Phase 3 (Funil de Vendas/Kanban) into Phase 2 (Cadastro), at owner's request, so cadastro+funil ship as one vertical slice; Admin and Dashboard phases renumbered 4->3, 5->4 accordingly

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Manual verification | 01-05 Task 4 — real password-reset + invite-accept email round-trips (see STATE.md Blockers/Concerns and 01-05-SUMMARY.md "Open Item: Task 4") | Open, deferred at owner's request | 2026-07-16, end of 01-05 execution |

## Session Continuity

Last session: 2026-07-18T00:09:37.660Z
Stopped at: Phase 3 UI-SPEC approved
Resume file: .planning/phases/03-administra-o-de-listas-edit-veis/03-UI-SPEC.md
