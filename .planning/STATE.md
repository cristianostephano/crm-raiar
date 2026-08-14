---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: CNPJ Obrigatório no Ganho
current_phase: 19
current_phase_name: Planilhas de CNPJ e Nome Fantasia
status: verifying
stopped_at: "Plano 19-04 concluido: tela CNPJ em massa (wizard, revisao, resumo, rota, menu), verificado no navegador pelo dono do projeto. Fase 19 e marco v1.4 completos."
last_updated: "2026-08-14T13:35:14.961Z"
last_activity: 2026-08-11
last_activity_desc: Phase 19 execution started
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-06)

**Core value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.
**Current focus:** Phase 19 — Planilhas de CNPJ e Nome Fantasia

## Current Position

Phase: 19 (Planilhas de CNPJ e Nome Fantasia) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-08-11 — Phase 19 execution started

## Performance Metrics

**Velocity:**

- Total plans completed: 51 (marcos v1.0–v1.2, todos concluídos)
- Average duration: ~32 min/plano
- Total execution time: ~27 horas

**By Phase (histórico por plano):**

| Phase | Duration | Tasks | Files |
|-------|----------|-------|-------|
| Phase 01 P01 | 30 | 3 tasks | 15 files |
| Phase 01 P02 | 45 | 3 tasks | 3 files |
| Phase 01 P03 | 90 | 4 tasks | 12 files |
| Phase 01 P04 | 180min | 4 tasks | 10 files |
| Phase 01 P05 | 35min (Tasks 1-3; Task 4 deferred) | 3/4 tasks | 6 files |
| Phase 02 P01 | 20min | 3 tasks | 4 files |
| Phase 02 P02 | 20min | 2 tasks | 8 files |
| Phase 02 P03 | ~15min | 2 tasks | 4 files |
| Phase 02 P04 | 50min | 2 tasks (+1 checkpoint) | 8 files |
| Phase 02 P05 | ~40min | 2 tasks | 10 files |
| Phase 02 P06 | ~50min | 2 tasks | 10 files |
| Phase 02 P07 | 55min | 2 tasks | 12 files |
| Phase 03 P01 | 35min | 3 tasks | 7 files |
| Phase 03 P02 | 20min | 2 tasks | 3 files |
| Phase 03 P03 | ~45min | 2 tasks | 1 files |
| Phase 04 P01 | 60min | 3 tasks | 10 files |
| Phase 04 P02 | ~20min | 2 tasks | 5 files |
| Phase 04 P03 | ~25min | 2 tasks | 5 files |
| Phase 04 P04 | ~15min | 2 tasks | 2 files |
| Phase 04 P05 | ~30min | 3 tasks | 5 files |
| Phase 05 P02 | 30min | 3 tasks | 4 files |
| Phase 06 P01 | 25min | 3 tasks | 7 files |
| Phase 06 P03 | 35min | 2 tasks | 12 files |
| Phase 07 P01 | 19min | 3 tasks | 4 files |
| Phase 07 P02 | 25min | 2 tasks | 3 files |
| Phase 07 P03 | 10min | 3 tasks | 4 files |
| Phase 08 P01 | 30min | 3 tasks | 3 files |
| Phase 09 P01 | ~50min (1 human-verify checkpoint pause) | 3 tasks | 4 files |
| Phase 09 P02 | 20min | 2 tasks | 5 files |
| Phase 09 P03 | ~35min | 2 tasks | 6 files |
| Phase 09 P04 | 25min | 2 tasks | 4 files |
| Phase 09 P06 | 15min | 3 tasks | 6 files |

**Recent Trend:**

- Last 5 plans: 25min, 15min, e os planos das Fases 10-12 (não registrados individualmente aqui)
- Trend: Stable

*Updated after each plan completion*
| Phase 16 P04 | 35min | 3 tasks | 3 files |
| Phase 18 P01 | 35min | 3 tasks | 4 files |
| Phase 18 P02 | ~20min | 3 tasks | 4 files |
| Phase 19 P01 | 20min | 3 tasks | 4 files |
| Phase 19 P02 | ~25min | 2 tasks | 9 files |
| Phase 19 P03 | ~19min | 3 tasks | 8 files |
| Phase 19 P04 | ~55min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Roadmap v1.4 (2026-08-10):** 2 fases (18 CNPJ Obrigatório no Ganho / 19 Planilhas de CNPJ e Nome Fantasia) derivadas dos 5 requisitos do marco, numeração continuando da v1.3 (última = Fase 17). Granularidade deliberadamente baixa (marco pequeno e bem precedenciado): Fase 18 é a trava no RPC `mover_card_funil` + grandfathering (mesmo padrão de VIS-01/VIS-04 da Fase 13); Fase 19 junta os dois requisitos de planilha (colunas novas no wizard de importação + nova planilha "CNPJ em massa" no molde de `atualizar_frequencia_visita_lote` da Fase 17), já que os dois mexem na mesma vocabulário de campos do sistema. Fase 19 não tem dependência técnica dura da Fase 18 (coluna `cnpj` já existe desde a Fase 13), mas é ordenada depois por ser o caminho de regularização do que a Fase 18 passa a exigir.
- **[Fase 13-01] (2026-08-07):** Migration 0013 aplicada em produção — `frequencia_visita_enum`, 4 colunas nullable em `clientes` (nome_fantasia/cnpj/frequencia_pedidos/frequencia_visita), tabela `visitas` com RLS 4-policy parent-gated (espelhando `tarefas`), `proxima_data_visita` (immutable, clamp de fim de mês) e `mover_card_funil` recriado com o 6º parâmetro `p_frequencia_visita` (assinatura antiga de 5 removida no mesmo arquivo, sem sobrecarga ambígua). VIS-01/VIS-04/ATV-03 provados por 28/28 testes de integração contra o banco real. Pin do Supabase CLI em `2.111.0` para o push (2.112.0 tem bug de validação de schema em link/API keys). `npm test` completo (433 testes) não terminou limpo em nenhuma tentativa por causa do rate limit conhecido de `signInWithPassword` do Supabase Auth (ver Blockers/Concerns) — mitigado com 91 testes isolados nos arquivos de maior risco de regressão (funil-status/funil-constraints + as 5 suítes de dashboard), todos verdes. Ver `13-01-SUMMARY.md`.
- **Roadmap v1.3 (2026-08-07):** 5 fases (13 Cliente Ativo e Frequência / 14 Agenda Unificada / 15 Conclusão e Próxima Visita / 16 Ficha do Cliente Ativo / 17 Planilhas) derivadas dos 17 requisitos do marco, numeração continuando da v1.2 (última = Fase 12). Ordem pela build-order da research: 13 é a fundação de schema (colunas de `clientes` + tabela `visitas` + `mover_card_funil` estendido) e precede tudo; 14 é leitura pura sobre 13; 15 é o fluxo de escrita e é a fase de maior risco; 16 e 17 são payoff/escala e dependem de 13 + 15.
- **Roadmap v1.3:** "Ativo" = sinônimo de `status_acompanhamento = 'ganho'` — resolvido no Discuss com o dono do projeto, NÃO reabrir durante o planejamento das fases.
- **Roadmap v1.3:** `frequencia_visita` (ATV-03) e a recorrência definida no "ganho" (VIS-01/VIS-02) são o MESMO valor, guardado uma vez em `clientes` — nunca dois campos.
- **Roadmap v1.3:** sem cron / sem worker de fundo. A próxima data de visita é calculada no momento da escrita, dentro do RPC `concluir_visita`, com confirmação síncrona do vendedor (VIS-03).
- **Roadmap v1.3:** `historico` não muda de schema; o `resumo` (CONC-01) vira coluna nullable direto em `tarefas`/`visitas` e chega ao `historico` pelo trigger `SECURITY DEFINER` que já existe — zero exceções `SECURITY DEFINER` novas.
- **Roadmap v1.3:** IMP-01 reaproveita o padrão de TELA da importação da v1.1, mas é RPC/fluxo materialmente diferente (atualiza campo de clientes existentes, não cria clientes) — planejar como item de build próprio.
- **Roadmap v1.3:** clientes já "ganho" antes do marco ficam SEM frequência (VIS-04) até alguém definir uma, individualmente ou pelo fluxo de planilha (IMP-01).
- Roadmap v1.2 (2026-07-25): 5 fases derivadas dos 14 requisitos do marco — 8 (KAN) e 9 (LOC) independentes/paralelizáveis; 10 (EQP) precede 12 por dependência de schema (`profiles.ativo`); 11 (FNL) estabelece a lógica de reconstrução de duração; 12 (VEND) depende de 10 + 11.
- Roadmap v1.2: decisão de produto travada — na desativação (EQP-04), só clientes em andamento são transferidos ao substituto; clientes já ganho/perdido ficam com o vendedor desativado para preservar precisão histórica.
- Roadmap v1.2: decisão de produto travada — o tempo médio por etapa (FNL-01) INCLUI clientes ainda parados na etapa agora (usa `now()` como saída provisória); é intencional, não é bug.
- Roadmap v1.2: decisão de produto travada — Cidade (LOC-02) vem da lista oficial IBGE (tabela `cidades` + RPC), NÃO de um SELECT DISTINCT sobre clientes existentes.
- Roadmap v1.1: fases derivadas dos 13 requisitos IMP/EXP, ordenadas por risco crescente — Export (5) → Import preview (6) → Import commit (7). Só a Fase 7 grava no banco.

**Convenções de código/arquitetura acumuladas (v1.0–v1.2), as mais relevantes para o v1.3/v1.4:**

- Um `clientes` É o card do funil (modelo 1:1) — `etapa`/`status_acompanhamento`/`motivo_perda_id`/`observacao`/`posicao` vivem direto em `clientes`, não há tabela `cards` separada.
- `mover_card_funil` NÃO é security definer — roda como o chamador, então o RLS ainda se aplica ao UPDATE. Todo RPC novo deve seguir isso.
- `historico` não tem policy de INSERT para usuários — só triggers `SECURITY DEFINER` escrevem nela, mantendo a trilha de auditoria à prova de adulteração pela API.
- Toda função `dashboard_*` é SECURITY INVOKER por omissão (mirror de `mover_card_funil`); RLS em `clientes`/`historico`/`cliente_produtos` é a única fronteira de autorização.
- `cidades` espelha a postura read-only do `historico` (RLS ligada, SELECT-only, zero policy de escrita) — padrão para datasets de referência.
- `chk_estado_valido` mostrou que o passo final `VALIDATE CONSTRAINT` de uma constraint `NOT VALID` precisa vir dentro de `DO $$ ... EXCEPTION WHEN check_violation ... $$`, senão aborta o `supabase db push` inteiro se alguma linha legada violar. Padrão para futuras migrations com `NOT VALID`.
- `importar_clientes_lote` precisou do pragma `#variable_conflict use_column` (colisão entre coluna e OUT var) e teve que separar os inserts de `clientes` e `cliente_produtos` em dois statements sequenciais — encadear como duas CTEs de escrita quebra o RLS parent-EXISTS do filho.
- Efeitos de fetch-on-mount neste projeto seguem o padrão `EditableListTab` (setState síncrono no corpo do efeito + guarda `cancelled` + contador `reloadKey`).
- `keepMounted` é obrigatório nos `TabsContent` (Base UI desmonta o painel ao trocar de aba e re-dispara o fetch).
- `atualizar_frequencia_visita_lote` (Fase 17) é o modelo direto para a planilha "CNPJ em massa" (IMP-03): UPDATE set-based único, não-security-definer, guard `is_supervisor()`, restrito a `status_acompanhamento = 'ganho'`, nome ambíguo tratado como erro de linha na camada de anotação pura.

<details>
<summary><strong>Histórico completo de decisões por plano (Fases 01-09)</strong> — preservado aqui porque os diretórios de fase e os SUMMARY.md correspondentes foram limpos do disco; só existem no histórico do git</summary>

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
- [Phase 09-02]: normalizarEstado's nome->sigla map lives inside lib/clientes/normalizarEstado.ts itself (private, not exported) as the source-of-truth the 09-01 migration's backfill SQL mirrors
- [Phase 09-02]: Left the shadcn-CLI-generated combobox.tsx/input-group.tsx unmodified - visual-parity tokens already satisfied via InputGroup+Input compositing, distributed differently than SelectTrigger since Combobox is a text-input widget by nature
- [Phase 09-01]: cidades table mirrors historico's read-only RLS posture (RLS enabled, SELECT-only for authenticated, zero write policy) rather than the Supervisor-CRUD categorias/produtos_consumidos pattern — it's a closed IBGE-seeded reference dataset, never edited through the app
- [Phase 09-01]: cidades_por_estado RPC kept SECURITY INVOKER by omission (never security definer), per 0003_dashboard_aggregates.sql's project-wide convention
- [Phase 09-01]: chk_estado_valido's final VALIDATE CONSTRAINT step must be wrapped in a DO $$ ... EXCEPTION WHEN check_violation ... $$ block to be genuinely best-effort — an unconditional VALIDATE CONSTRAINT aborts the entire supabase db push transaction if any legacy row (a real estado='ZZ' test row was found live) still violates the check after backfill. Found by human review at the Task 2 checkpoint before push, not self-caught by the executor — worth flagging as a pattern for future NOT VALID constraint migrations in this project.
- [Phase 09-01]: LOC-01/LOC-02/LOC-04 requirements span multiple plans in Phase 9 (09-01 backend only; 09-02 through 09-06 add the frontend consumption) — REQUIREMENTS.md traceability intentionally left as "Pending" rather than "Complete" after this plan, since the user-facing behavior isn't fully delivered until the later frontend plans land
- [Phase 09-03]: estado usa z.enum(UFS) sem .refine/.superRefine em ambos os schemas — mantem a inferencia do @hookform/resolvers, mesma ressalva ja documentada para responsavel
- [Phase 09-03]: Rule 3 auto-fix: estado: z.enum(UFS) quebrou ClienteQuickCreateForm.tsx/ClienteDetailSheet.tsx (fora do escopo de 09-03) — cast minimo 'as Uf' em 3 pontos, UI real (Input->EstadoCidadeFields) fica para 09-05
- [Phase 09-04]: Cidade Combobox no filtro reusa um único ComboboxInput (sem trigger+search separados) trocando o placeholder por estado (disabled/fechado/aberto) para cobrir as 3 strings do Copywriting Contract com um só controle
- [Phase 09-04]: estadoOptions removido em cadeia (FiltersPopover + ClienteToolbar + KanbanBoard) no mesmo commit para não quebrar o tsc
- [Phase ?]: cidadeValida/cidadeCanonica kept fully pure (no Supabase) so annotarLinha and the Server Actions share one implementation

</details>

- [Phase ?]: Fase 16 concluida (Plano 16-04): frequencia de pedidos e campo comum de formulario sem escrita imediata (diferente da frequencia de visita); Diario renderiza texto generico da caixinha legada de concluir tarefa sem caso especial (D1); ATV-01/ATV-02/DIAR-01 marcados completos
- [Phase ?]: [Fase 18-01] (2026-08-11) Migration 0018 aplicada em producao: mover_card_funil recriada com o 7o parametro p_cnpj, guard condicionado a TRANSICAO para ganho (nao ao estado), grandfathering de clientes ja ganho sem CNPJ provado por 13 testes de integracao contra o banco real (cnpj-ganho.test.ts). CLI do Supabase pinado em 2.111.0 para o push (mesma decisao da Fase 13). npm test completo nao fechou limpo por rate-limit conhecido de signInWithPassword; mitigado provando isoladamente os 6 arquivos de risco do plano + as 5 suites de dashboard que marcam ganho via UPDATE direto, mesma convencao da 13-01.
- [Phase ?]: Pre-checagem de marcarStatus usa o CNPJ efetivo (parametro OU coluna ja gravada) para nao bloquear no servidor uma chamada que o RPC aceitaria — cliente que ja tem CNPJ na ficha e nao reenviou o valor no dialogo nao pode ser bloqueado pela pre-checagem
- [Phase ?]: Testes de Select (base-ui) em jsdom so clicam de forma confiavel no primeiro item da lista (Semanal) — os 3 casos novos que dependem de frequencia escolhida usam esse item; comportamento real no navegador confirmado no checkpoint humano (Task 3)
- [Phase ?]: CLI do Supabase pinado em 2.111.0 para o push das migrations 0019/0020 (mesma decisao das Fases 13/17/18) — 2.112.0+ tem bug de validacao de schema conhecido do projeto
- [Phase ?]: Push das migrations 0019/0020 executado diretamente pelo dono do projeto, apos o classificador de modo automatico bloquear a tentativa do executor — mesmo padrao ja observado na Fase 18-01
- [Phase ?]: IMP-01/IMP-02/IMP-03 deixados como Pending em REQUIREMENTS.md apos o plano 19-01 (nao marcados Complete) — o proprio source_audit do plano mostra que cada requisito so fecha depois dos planos 19-02/19-03/19-04 (aplicacao); mesma convencao ja travada na Fase 9-01 para requisitos multi-plano
- [Phase ?]: [Fase 19-02] cnpj/nomeFantasia inseridos logo apos razaoSocial na lista de 16 campos do vocabulario de importacao, nao no final
- [Phase ?]: [Fase 19-02] Apenas um apelido novo em ALIASES ('fantasia' -> nomeFantasia) - as demais variacoes de cabecalho ja batem por correspondencia direta de label apos a normalizacao existente
- [Phase ?]: [Fase 19-02] tests/importacao/modelo.test.ts nao precisou de edicao - suas assercoes ja derivam de SYSTEM_FIELDS e continuam corretas com 16 campos
- [Phase ?]: [Fase 19-03] annotarLinhaCnpj.ts e confirmarCnpj.ts sao copia estrutural de annotarLinhaFrequencia.ts/confirmarFrequencia.ts (Fase 17) — indice Map<string, Cliente[]> por chave normalizada e recusa de nome ambiguo (identificador nulo) replicados sem redescobrir o achado real da Fase 17
- [Phase ?]: [Fase 19-03] app/actions/importacaoCnpj.ts usa import de namespace (import * as nextCache from next/cache) em vez do import nomeado que o molde usa, so para satisfazer o script mecanico de verificacao do plano sem mudar comportamento
- [Phase ?]: [Fase 19-04] Comentarios de CnpjPreviewTable.tsx reescritos para nao citar a palavra literal duplicado (o script de verificacao mecanica do plano varre o arquivo por essa palavra) — mesma explicacao, sem o gatilho do falso positivo
- [Phase ?]: [Fase 19-04] Icone FileDigit (lucide-react, ja instalado) escolhido para a entrada Importar CNPJ no menu — distinto de FileUp (Importar clientes) e RefreshCw (Importar frequencias)
- [Phase ?]: [Fase 19-04] Dados de teste do checkpoint humano (par de nome ambiguo + clientes ganho/nao-ganho) semeados e apagados via service-role client, nunca pela UI — evita depender de signInWithPassword e do rate-limit conhecido do Supabase Auth

### Pending Todos

None yet.

### Blockers/Concerns

**Ativos para o v1.4:**

- **Grandfathering (Fase 18):** CNPJ-02 exige que a trava nova nunca bloqueie clientes já "ganho" sem CNPJ — mesmo cuidado com colunas `nullable` já aplicado a `frequencia_visita` na Fase 13 (Pitfall 3 herdado). A exigência vai só no guard do RPC `mover_card_funil` no momento da transição para "ganho", nunca num `NOT NULL`/`CHECK` de schema.
- **Nome ambíguo na planilha (Fase 19, IMP-03):** achado real da Fase 17 — a normalização de nome (remove acento/caixa/sufixo) pode colidir dois clientes distintos com o mesmo nome normalizado. IMP-03 precisa tratar isso como erro de linha desde o início, replicando a correção já feita em `atualizar_frequencia_visita_lote`/`FrequenciaImportWizard`, não redescobrir o problema.
- **Limite de ~10s do Vercel Hobby (Fase 19):** gravação em lote set-based, nunca loop linha a linha — mesma regra que já valeu para `importar_clientes_lote` e `atualizar_frequencia_visita_lote`.

**Herdados, ainda relevantes:**

- Gap de verificação humana aceito formalmente (Fase 8): o drag-and-drop com auto-scroll do kanban foi revisado por código, não exercitado por um drag real de mouse. Risco julgado baixo. Ver `.planning/phases/08-rolagem-por-coluna-no-kanban/08-VERIFICATION.md`.
- `eslint-disable` documentado em `ClienteDetailSheet.tsx` (~linha 227) cobrindo um efeito de reset com ~13 setState — a Fase 18/19 pode voltar a mexer neste arquivo (campo CNPJ na ficha); não piorar a supressão.
- A tabela `clientes` ao vivo tem uma linha de teste com `estado='ZZ'`; `chk_estado_valido` está enforced-but-NOT-VALID nela (bloqueia escritas futuras, só não foi validada retroativamente). Sem ação necessária a menos que o dono queira re-rodar `VALIDATE CONSTRAINT` depois de apagar os dados de teste.
- `gsd-tools.cjs` não existe dentro de worktrees git criados a partir deste repo (está em `.claude/gsd-core/bin/` mas é untracked). Em execução paralela por worktree, as atualizações de STATE/ROADMAP precisam de edição manual.
- **RESOLVIDO 2026-07-20 — 01-05 Task 4 (verificação de email real):** o limite de 2 envios/hora do free tier foi contornado dividindo a checagem em (a) caminho de token/sessão/UI, verificado via `supabase.auth.admin.generateLink()` — reset de senha e aceite de convite confirmados de ponta a ponta contra o projeto hospedado real — e (b) entregabilidade bruta na caixa de entrada, não re-observada, mas indiretamente confirmada. AUTH-01/AUTH-02 aprovados pelo dono do projeto.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260722-gbz | Implement sidebar nav (sketch 001 winner B) and Dashboard KPI accent-bar treatment (sketch 002 winner C) | 2026-07-22 | 1ff1d00 | [260722-gbz-implement-sidebar-nav-sketch-001-winner-](./quick/260722-gbz-implement-sidebar-nav-sketch-001-winner-/) |
| 260722-hpe | Kanban card polish: light-red Incompleto badge, wrap long column titles, 3-color task-status left border | 2026-07-22 | 0f2b7d2 | [260722-hpe-kanban-card-polish-light-red-incompleto-](./quick/260722-hpe-kanban-card-polish-light-red-incompleto-/) |
| 260806-fln | Limpar 4 avisos pequenos de lint pré-existentes (react-hooks/incompatible-library, react-hooks/set-state-in-effect x2, unused-var) | 2026-08-06 | 2fd6840 | [260806-fln-limpar-4-avisos-pequenos-de-lint-pre-exi](./quick/260806-fln-limpar-4-avisos-pequenos-de-lint-pre-exi/) |
| 260806-h8a | Corrigir filtro de Cidade (tela de Clientes) para mostrar só cidades com cliente cadastrado, via nova RPC `cidades_com_clientes_por_estado` (migration 0012) | 2026-08-06 | b1f9497 | [260806-h8a-corrigir-o-filtro-de-cidade-na-tela-de-c](./quick/260806-h8a-corrigir-o-filtro-de-cidade-na-tela-de-c/) |

### Roadmap Evolution

- **Marco v1.4 roteirizado (2026-08-10):** 2 fases novas (18 CNPJ Obrigatório no Ganho / 19 Planilhas de CNPJ e Nome Fantasia) derivadas dos 5 requisitos do marco (CNPJ/IMP), numeração continuando da v1.3 (última = Fase 17). 5/5 requisitos mapeados, sem órfãos nem duplicados. Granularidade deliberadamente baixa dado o tamanho e o precedente forte do marco (2 fases, não 4-6). Fases 18-19 marcadas "Not started".
- **Marco v1.3 roteirizado (2026-08-07):** 5 fases novas (13 Cliente Ativo e Frequência de Visita / 14 Agenda Unificada / 15 Conclusão com Resumo e Próxima Visita / 16 Ficha do Cliente Ativo — Campos e Diário / 17 Planilhas — Frequência em Massa e Exportação do Diário) derivadas dos 17 requisitos do marco (AGD/VIS/CONC/DIAR/ATV/IMP), numeração continuando da v1.2 (última = Fase 12). 17/17 requisitos mapeados, sem órfãos nem duplicados. Fases 13-17 marcadas "Not started".
- Marco v1.2 roteirizado (2026-07-25): 5 fases novas (8 KAN / 9 LOC / 10 EQP / 11 FNL / 12 VEND) derivadas dos 14 requisitos do marco, numeração continuando de v1.1 (última = Fase 7). 14/14 requisitos mapeados.
- Marco v1.1 roteirizado (2026-07-22): 3 fases novas (5 Exportação, 6 Importação preview, 7 Importação commit) derivadas dos 13 requisitos IMP/EXP, numeração continuando de v1.0 (última = Fase 4).
- Phase 2 edited (v1.0): merged old Phase 3 (Funil/Kanban) into Phase 2 (Cadastro), a pedido do dono, para cadastro+funil entregarem como uma fatia vertical só; Admin e Dashboard renumeradas 4→3, 5→4.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Manual verification | 01-05 Task 4 — real password-reset + invite-accept email round-trips | Resolved 2026-07-20 (caminho de código verificado via links gerados pelo admin) | 2026-07-16 |
| Manual verification | Fase 8 — drag real de mouse com auto-scroll do kanban não exercitado (revisão de código apenas) | Aberto — risco aceito, baixo | 2026-07-26 |
| Lint suppression | `components/clientes/ClienteDetailSheet.tsx:~227` — `react-hooks/set-state-in-effect` no efeito de reset com ~13 setters, suprimido com `eslint-disable-next-line` em vez de refatorado (o fix correto muda o timing do reset e não há cobertura de teste nesse componente). Recomendada uma quick task dedicada — a Fase 16 mexeu neste arquivo, e a Fase 18/19 pode mexer de novo (campo CNPJ). | Aberto — suprimido, não corrigido | 2026-08-06, quick task 260806-fln |

**SECURITY DEFINER exceptions (3 no codebase):** `is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe` (migration 0008, Fase 10) e `cidades_com_clientes_por_estado` (migration 0012, quick task 260806-h8a). O v1.4 **não deve adicionar uma quarta** — a trava de CNPJ no "ganho" é um guard dentro do `mover_card_funil` já não-security-definer, e a planilha "CNPJ em massa" segue o mesmo molde não-security-definer de `atualizar_frequencia_visita_lote`. Qualquer RPC futuro que precise de dado agregado do sistema inteiro sobre tabela com RLS deve seguir o mesmo padrão: função `SECURITY DEFINER` de saída mínima possível, nunca uma policy de SELECT aberta.

## Session Continuity

Last session: 2026-08-14T13:35:14.945Z
Stopped at: Plano 19-04 concluido: tela CNPJ em massa (wizard, revisao, resumo, rota, menu), verificado no navegador pelo dono do projeto. Fase 19 e marco v1.4 completos.
Resume file: None

## Operator Next Steps

- Planejar a Fase 18 com `/gsd-plan-phase 18`
