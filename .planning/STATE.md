---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Gestão de Equipe, Análises de Funil e Filtros
current_phase: 08
current_phase_name: rolagem-por-coluna-no-kanban
status: verifying
stopped_at: Completed 08-01-PLAN.md
last_updated: "2026-07-26T01:20:53.260Z"
last_activity: 2026-07-25
last_activity_desc: Phase 08 execution started
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.
**Current focus:** Phase 08 — rolagem-por-coluna-no-kanban

## Current Position

Phase: 08 (rolagem-por-coluna-no-kanban) — EXECUTING
Plan: 1 of 1
Status: Phase complete — ready for verification
Last activity: 2026-07-25 — Phase 08 execution started

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
| Phase 03 P02 | 20min | 2 tasks | 3 files |
| Phase 03-administra-o-de-listas-edit-veis P03 | ~45min | 2 tasks | 1 files |
| Phase 04 P01 | 60min | 3 tasks | 10 files |
| Phase 04-dashboard-gerencial P02 | ~20min | 2 tasks | 5 files |
| Phase 04-dashboard-gerencial P03 | ~25min | 2 tasks | 5 files |
| Phase 04-dashboard-gerencial P04 | ~15min | 2 tasks | 2 files |
| Phase 04-dashboard-gerencial P05 | ~30min | 3 tasks | 5 files |
| Phase 05 P02 | 30min | 3 tasks | 4 files |
| Phase 06 P01 | 25min | 3 tasks | 7 files |
| Phase 06 P03 | 35min | 2 tasks | 12 files |
| Phase 07 P01 | 19min | 3 tasks | 4 files |
| Phase 07 P02 | 25min | 2 tasks | 3 files |
| Phase 07 P03 | 10min | 3 tasks | 4 files |
| Phase 08 P01 | 30min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap v1.2 (2026-07-25): 5 fases derivadas dos 14 requisitos do marco, ordenadas pela ordem de build da research — 8 Kanban scroll (KAN) e 9 Filtros Estado/Cidade (LOC) independentes e paralelizáveis; 10 Desativação (EQP) precede 12 por dependência de schema (`profiles.ativo`); 11 Funil detalhado (FNL) estabelece a lógica de reconstrução de duração; 12 Comparativo por vendedor (VEND) depende de 10 + 11.
- Roadmap v1.2: decisão de produto travada — na desativação (EQP-04), só clientes em andamento são transferidos ao substituto; clientes já ganho/perdido ficam atribuídos ao vendedor desativado para preservar a precisão histórica. Reflita isso no critério de sucesso da Fase 10 e no comparativo da Fase 12 (vendedor desativado some da lista de ativos, mas seus históricos continuam contando).
- Roadmap v1.2: decisão de produto travada — o tempo médio por etapa (FNL-01) INCLUI clientes ainda parados na etapa agora (usa `now()` como saída provisória); é intencional, para revelar cards travados, não é bug.
- Roadmap v1.2: decisão de produto travada — Cidade (LOC-02) vem de uma lista oficial de municípios IBGE previamente carregada (tabela `cidades` + RPC), NÃO de um SELECT DISTINCT sobre os clientes existentes; confirmado pelo dono após a research sinalizar que a abordagem por dados existentes impediria cadastrar uma cidade nova.
- Roadmap v1.1: fases derivadas dos 13 requisitos do marco (IMP-01..10 + EXP-01..03), ordenadas por risco crescente — Export (5) → Import preview (6) → Import commit (7). Só a Fase 7 grava no banco; 5 e 6 são leitura/pré-visualização, o que reduz o risco e as torna testáveis isoladamente.
- Roadmap v1.1: IMP-10 (restrito ao Supervisor) mapeado na Fase 6 (porta de entrada da importação), mas o RPC de gravação da Fase 7 também precisa impor Supervisor-only via RLS — a restrição vale para o fluxo inteiro.
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
- [Phase 03]: [Phase 03-02]: Row-scoped errors (duplicate-name on edit, generic failure on deactivate) render inline in their own context (edit Input / deactivate Dialog) rather than the shared top banner, matching PerdaMotivoDialog's own-dialog-owns-its-error precedent
- [Phase 03]: [Phase 03-02]: Reactivate has no confirmation dialog (only deactivate does) - D-03 treats reactivation as the deliberately low-friction reversal path
- [Phase 03-03]: Task 2's checkpoint blocker (tab click looked stuck) was a real Base UI TabsPanel unmount-on-switch bug, fixed by passing keepMounted to every TabsContent in ConfiguracoesTabs.tsx so EditableListTab fetches once per tab instead of re-fetching (and flashing Carregando) on every click — Root-caused via node_modules/@base-ui/react/tabs/panel/TabsPanel.js source and confirmed with Playwright DOM inspection; verified against both next dev and next build && next start
- [Phase ?]: [Phase 04-01]: Every dashboard_* function is SECURITY INVOKER by omission (no security definer), mirroring mover_card_funil — RLS on clientes/historico/cliente_produtos is the only authorization boundary
- [Phase ?]: [Phase 04-01]: Ganhos/perdidos and desempenho-por-vendedor source their date basis from historico.criado_em (status-change event), never clientes.etapa_alterada_em/criado_em (D-02)
- [Phase ?]: [Phase 04-01]: Prospecção por produto/categoria filters by clientes.criado_em (cadastro date), a deliberately different basis than ganhos/perdidos (D-09)
- [Phase ?]: [Phase 04-01]: Clientes por etapa takes zero date parameters — always a live snapshot, unaffected by the period filter (D-08)
- [Phase ?]: recharts resolved to 3.8.0 via shadcn's registry pin at install time (not 3.9.2 referenced in CLAUDE.md/plan) - same recharts org package, older patch, no re-approval needed — Human legitimacy checkpoint approved the package/publisher, not a specific patch digit
- [Phase ?]: [Phase 04-03]: DashboardClient defers resolvePeriodo() computation until a period-filtered child exists (04-04) - avoids a dead unused variable ahead of real consumers
- [Phase ?]: [Phase 04-03]: ClientesPorEtapaChart's fetch-on-mount effect mirrors EditableListTab's react-hooks/set-state-in-effect pattern (synchronous setState in effect body + cancelled guard + reloadKey retry counter) instead of a useCallback loader
- [Phase 04-04]: GanhosPerdidosCards always renders its 3 tiles once fetched (never a full-row empty banner) - Taxa de conversao renders an em dash via taxaConversao's null guard when ganho+perdido is 0, matching the plan's reachable-guarded-branch acceptance criterion
- [Phase 04-04]: DashboardClient now computes periodo via useMemo(resolvePeriodo(preset, customRange)) - first real consumer of resolvePeriodo, exactly where 04-03 flagged it would land; also fixed two leftover 04-03 placeholder comments that mis-pointed Desempenho por vendedor/Prospeccao at plan 04-04 instead of 04-05
- [Phase ?]: [Phase 04-05]: DesempenhoVendedorChart and ProspeccaoChart stayed as two separate components (data shapes differ) - ProspeccaoChart itself is the reusable one, parameterized by title/caption/action, powering both produto and categoria
- [Phase ?]: [Phase 04-05]: Variable-row-count chart sizing implemented as an uncapped-height ChartContainer inside a max-height:480px overflow-y-auto wrapper, so long lists actually scroll instead of Recharts auto-squeezing bars into a fixed height
- [Phase ?]: [Phase 04-05]: Human checkpoint (Task 3) was performed directly by the project coordinator in the browser; found and fixed 2 pre-existing bugs during verification (commit 0da3d13) - PeriodoFilter Select missing base-ui items prop, ClientesPorEtapaChart silently dropping 2 of 7 X-axis labels to Recharts collision handling
- [Phase ?]: [Phase 05-02]: NextResponse body must be new Uint8Array(workbook), not the raw Buffer -- TypeScript's BodyInit type doesn't structurally accept Buffer<ArrayBufferLike> even though Buffer extends Uint8Array at runtime
- [Phase ?]: [Phase 05-02]: Exportar button placed at the top of KanbanBoard's own returned layout (not in page.tsx next to Novo cliente) -- reconciles D-04's placement request with D-05's requirement that the button know the client-side filtered set, which only exists inside KanbanBoard
- [Phase ?]: papaparse@5.5.4 + @types/papaparse@5.5.2 approved via blocking human-verify checkpoint (official mholt/PapaParse repo, MIT, millions of weekly downloads, versions match STACK.md v1.1 Addendum)
- [Phase ?]: SYSTEM_FIELDS (lib/importacao/types.ts) holds 14 fields, 7 required matching createClienteSchema's minimum rules exactly; funnel-stage intentionally absent since every imported row lands in Aguardando contato
- [Phase ?]: modelo.ts does not sanitize cell values (Pitfall A4 guard) since the model is system-generated, not user input; sanitization belongs to whoever reads user-supplied cells in 06-02
- [Phase ?]: [Phase 06-03]: jsdom instalado como devDependency para viabilizar os primeiros testes de render de componente (@testing-library/react ja estava instalado mas vitest.config.ts nao tinha ambiente DOM); vitest.config.ts agora usa environmentMatchGlobs para restringir jsdom a tests/**/*.test.tsx
- [Phase ?]: [Phase 06-03]: importar-guard.spec.ts usa timeout de 20s no login (cold-start de signInWithPassword + primeiro compile do Next dev passam do default de 5s do Playwright); ambos os cenarios (Vendedor redirecionado, Supervisor ve o wizard) foram provados individualmente devido ao rate-limit conhecido do Supabase Auth no projeto de teste ao vivo
- [Phase ?]: [Phase 07-01]: importar_clientes_lote's RETURNS TABLE(razao_social,...) shadowed razao_social as a PL/pgSQL OUT variable, making ON CONFLICT (razao_social) ambiguous (SQLSTATE 42702) - fixed with the #variable_conflict use_column pragma (migration 0005)
- [Phase ?]: [Phase 07-01]: chaining the clientes and cliente_produtos inserts as two data-modifying CTEs in one WITH statement broke cliente_produtos' parent-EXISTS RLS check (same-command-snapshot visibility gap) - fixed by splitting into two sequential set-based statements, ids passed via plpgsql arrays (migration 0006)
- [Phase ?]: confirmarLoteImportacao re-runs D-02 dedup only over 'ok' candidate rows; explicit supervisor 'importar' overrides on duplicado rows are never re-excluded
- [Phase 07-03]: ImportSummary derives puladasCount internally from puladas.reduce(...) rather than accepting a separate prop, keeping its props limited to the { importadosCount, puladas } shape 07-02's confirmarLoteImportacao result already provides
- [Phase 07-03]: Kept decisions/onDecisionChange typed inline in both ImportPreviewTable and ImportWizard rather than exporting a shared type, avoiding a circular import between the two components
- [Phase 08]: ScrollColumnShell (Phase 08): fixed-height column shell keeps droppable boundary (setNodeRef) separate from the internal overflow-y-auto scroll div, with MeasuringStrategy.Always on DndContext, per dnd-kit Pitfall 12 for correct auto-scroll during drag
- [Phase 08]: Live physical drag-and-drop verification for KAN-01/KAN-02 was code-reviewed (setNodeRef placement + measuring Always) rather than mouse-tested, due to a browser-pane rendering limitation in the verification session — flagged as a residual gap for a future normal-use spot-check

### Pending Todos

None yet.

### Blockers/Concerns

- REQUIREMENTS.md's own "Coverage" note said "28 total" but the actual v1 requirement list (AUTH/CLI/FUN/ADM/DSH) contains 32 items. Roadmap creation used the actual 32-item list as ground truth and corrected the count in REQUIREMENTS.md traceability. Worth a quick sanity check with the user if the number 28 came from somewhere specific.
- Research flags two areas needing deeper research at plan time, not now: Phase 3 (fractional card-position strategy, mover_card_funil RPC validation, touch/mobile drag ergonomics) and Phase 5 (security_invoker view syntax/index strategy — LOW confidence sources in STACK.md).
- REQUIREMENTS.md shows AUTH-02 (Supervisor invites Vendedor) already checked off as Complete, but the invite Edge Function + gerenciar-equipe screen that actually deliver it are still planned for 01-04 (not yet built) — pre-existing inconsistency, not introduced by 01-03; worth a quick correction pass before shipping the phase.
- **RESOLVED 2026-07-20 — 01-05 Task 4 (real email round-trip verification):** hit the same free-tier 2/hour mailer rate limit a third time (correctly surfaced this time — confirms the earlier 01-04 fix still works). Rather than defer again, split the check into (a) the token/session/UI code path, verified via `supabase.auth.admin.generateLink()` to bypass the mailer entirely — both password-reset and invite-accept round-trips confirmed working end-to-end against the real hosted project — and (b) raw inbox deliverability, not independently re-observed this session but indirectly confirmed since the rate-limit response only fires after GoTrue attempts a real send. AUTH-01/AUTH-02 approved by the project owner 2026-07-20. See `01-05-SUMMARY.md`'s "Open Item: Task 4 — RESOLVED" section.
- **v1.1 research pitfalls to carry into planning (see .planning/research/PITFALLS.md):** A1 fragile razão_social dedup (no CNPJ) → Phase 6; A2 pt-BR CSV delimiter (semicolon), A3 UTF-8 BOM on first header → Phase 6 parse; A4 CSV injection on export → Phase 5; A5 serverless timeout on large batches, A6 partial-import inconsistency → Phase 7 (batch inserts inside one RPC transaction); A7 file-upload security (size cap + magic bytes) → Phase 6. Research also flags a security-audit gate before Phase 7 ships.
- **v1.2 research flags to carry into phase planning (see research/SUMMARY.md + PITFALLS.md v1.2):** Phase 10 (Desativação) — two-step cross-service atomicity: `profiles.ativo=false` é o controle primário; se a chamada da Auth Admin API (`ban_duration`) falhar depois, documentar a janela residual do JWT (~1h) na mensagem de erro; confirmar o formato de `ban_duration`. Phase 11 (Funil) — a média de tempo por etapa inclui cards ainda parados (usa `now()`), confirmar índice/estratégia da query de reconstrução sobre `historico` via window functions. Phase 12 (Comparativo) — precisa de teste automatizado do isolamento por papel (Vendedor não acessa a tabela).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260722-gbz | Implement sidebar nav (sketch 001 winner B) and Dashboard KPI accent-bar treatment (sketch 002 winner C) | 2026-07-22 | 1ff1d00 | [260722-gbz-implement-sidebar-nav-sketch-001-winner-](./quick/260722-gbz-implement-sidebar-nav-sketch-001-winner-/) |
| 260722-hpe | Kanban card polish: light-red Incompleto badge, wrap long column titles, 3-color task-status left border | 2026-07-22 | 0f2b7d2 | [260722-hpe-kanban-card-polish-light-red-incompleto-](./quick/260722-hpe-kanban-card-polish-light-red-incompleto-/) |

### Roadmap Evolution

- Marco v1.2 roteirizado (2026-07-25): 5 fases novas (8 Rolagem Kanban / KAN, 9 Filtros Estado-Cidade / LOC, 10 Desativação de Membro / EQP, 11 Funil Detalhado / FNL, 12 Comparativo por Vendedor / VEND) derivadas dos 14 requisitos do marco, numeração continuando de v1.1 (última = Fase 7). Ordem pela build-order da research: 8 e 9 independentes/paralelizáveis primeiro; 10 antes de 12 (dependência de schema `profiles.ativo`); 11 antes de 12 (reuso da lógica de duração). 14/14 requisitos mapeados, sem órfãos. Fases 8-12 marcadas "Not started".
- Marco v1.1 roteirizado (2026-07-22): 3 fases novas (5 Exportação, 6 Importação preview, 7 Importação commit) derivadas dos 13 requisitos IMP/EXP, numeração continuando de v1.0 (última = Fase 4). Ordem por risco crescente conforme research/SUMMARY.md. Fases 5-7 marcadas "Not started".
- Phase 2 edited: merged old Phase 3 (Funil de Vendas/Kanban) into Phase 2 (Cadastro), at owner's request, so cadastro+funil ship as one vertical slice; Admin and Dashboard phases renumbered 4->3, 5->4 accordingly

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Manual verification | 01-05 Task 4 — real password-reset + invite-accept email round-trips (see STATE.md Blockers/Concerns and 01-05-SUMMARY.md "Open Item: Task 4") | Resolved 2026-07-20 (code path verified via admin-generated links; see summary) | 2026-07-16, end of 01-05 execution |

## Session Continuity

Last session: 2026-07-26T01:20:53.253Z
Stopped at: Completed 08-01-PLAN.md
Resume file:
None

## Operator Next Steps

- Planejar a primeira fase do marco v1.2 com `/gsd-plan-phase 8` (Rolagem por Coluna no Kanban)
- Fases 8 e 9 são independentes e podem ser planejadas/executadas em paralelo; 10 antes de 12; 11 antes de 12
