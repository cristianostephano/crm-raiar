---
phase: 31-agenda-2-visitas-manuais-na-lista
verified: 2026-10-01T15:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 1
override_note: "Dono do projeto decidiu explicitamente publicar em produção sem rodar o teste manual ponta-a-ponta no navegador (sessão de 2026-10-01) — não conseguiu criar uma conta de vendedor de teste no momento. A decisão de prazo de guarda (LGPD) foi obtida e registrada (1 ano / 365 dias) em 31-UAT.md, mas o descarte automático correspondente AINDA NÃO foi implementado no código — fica como trabalho pendente separado."
human_verification:
  - test: "Como vendedor de teste: abrir 'Agenda 2' no menu (logo abaixo de 'Agenda'), adicionar uma visita para hoje, corrigir o bairro, marcar como concluída, desmarcar, apagar (confirmando). Tentar um nome com número de telefone/CPF. Depois entrar como Supervisor e abrir 'Agenda 2'."
    expected: "Vendedor: o item aparece em 'Hoje'; a correção aparece na hora; concluído fica riscado e continua na lista; desmarcar volta ao normal; apagar pede confirmação e some; nome com telefone é recusado com a mensagem de documento; o selo do menu acompanha o número de pendentes. Supervisor: vê os itens do time com o nome do vendedor, filtro 'Vendedor' em 'Todos os vendedores', nenhum botão de adicionar/editar/apagar/concluir, selo da Agenda 2 dele sem número. A tela 'Agenda' continua exatamente como antes."
    why_human: "Fluxo visual e de interação ponta a ponta com o banco real (riscado, selo do menu, calendário do formulário, recusa de documento) — os testes automatizados usam Server Actions e cliente Supabase mockados; este item foi deliberadamente adiado para o fim da fase pelo próprio 31-08-PLAN.md (bloco human-check da Tarefa 2) e o 31-08-SUMMARY.md e o STATE.md confirmam que ainda não foi executado (\"pendente verificação humana e envio para staging\")."
  - test: "Confirmar com o dono do projeto uma política de prazo de guarda (retenção) para os itens da Agenda 2, antes de uso real continuado em produção."
    expected: "Decisão registrada (ex.: apagar tudo se a Agenda 2 for descartada; ou descarte automático após N dias, no espírito dos 35 dias já usados no registro de uso da v1.7)."
    why_human: "Decisão de negócio/LGPD que só o controlador do dado (dono do projeto) pode tomar — já sinalizada como pendência explícita pelo 31-01-PLAN.md/31-03-PLAN.md e por todos os SUMMARYs da fase; não é um defeito de implementação, é uma decisão em aberto reconhecida desde o planejamento."
---

# Phase 31: Agenda 2 — Visitas Manuais na Lista — Verification Report

**Phase Goal:** O vendedor passa a ter uma segunda agenda, própria e manual, onde anota quem vai visitar em cada dia (nome do cliente + bairro + data), corrige ou apaga o que anotou e marca o que já fez — e o Supervisor acompanha a Agenda 2 de todo o time, filtrando por vendedor. A Agenda atual não muda em nada nesta fase.

**Verified:** 2026-10-01
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 1-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Agenda 2" aparece no menu logo abaixo de "Agenda"; vendedor adiciona item (nome livre, bairro, data) e ele aparece na lista do dia | ✓ VERIFIED | `components/layout/AppSidebar.tsx:91` inserts `{ href: "/agenda-2", label: "Agenda 2", icon: NotebookPen }` immediately after `/agenda` in `PRINCIPAL_SECTION.links`; `components/agenda2/Agenda2ItemForm.tsx` + `app/actions/agenda2.ts#criarAgenda2Item` create items with free-text `nomeCliente`; `tests/agenda2/agenda2-list.test.tsx#agrupa-secoes` and `#adicionar-pelo-cabecalho` pass; verified by independently re-running `npx vitest run tests/agenda2/` (all pass) |
| 2 | Vendedor corrige nome/bairro/data e apaga um item próprio; lista atualiza na hora | ✓ VERIFIED | `atualizarAgenda2Item`/`apagarAgenda2Item` in `app/actions/agenda2.ts`, both trigger `revalidatePath("/agenda-2")`; `Agenda2List.tsx` bumps `reloadKey` on success; `tests/agenda2/agenda2-list.test.tsx#apagar-com-confirmacao`, `#editar-concluido` pass; RLS integration test `tests/agenda2/rls-agenda2.test.ts#vendedor-edita-proprio`/`#vendedor-apaga-proprio` pass against real production DB (independently re-ran: 33/33 passed) |
| 3 | Item concluído continua visível na lista do dia, riscado, sem exigir resumo/motivo | ✓ VERIFIED | `Agenda2ItemRow.tsx` renders `line-through`+`text-muted-foreground` title + "Concluído" badge when `concluido`; `concluirAgenda2Item`/`desmarcarAgenda2Item` only ever write `{ concluido }` — no resumo/motivo field exists anywhere in the schema (`lib/validations/agenda2.ts` has only nomeCliente/bairro/data); `tests/agenda2/agenda2-item-row.test.tsx#concluido-riscado`, `#concluido-editavel` pass |
| 4 | Vendedor só vê/altera os próprios itens, nunca os de outro (garantido pelo banco, não só pela tela); Supervisor vê o time e filtra | ✓ VERIFIED | Migration `0048_agenda2_itens.sql` has 4 RLS policies: SELECT (dono OR `is_supervisor()`), INSERT/UPDATE/DELETE (dono AND `role='vendedor' AND ativo=true`, never `is_supervisor()`). Independently re-ran `tests/agenda2/rls-agenda2.test.ts` (20 integration cases) against the real hosted Supabase project: **33/33 passed**, including `supervisor-nao-cria`, `supervisor-nao-edita`, `supervisor-nao-apaga`, `vendedor-nao-edita-alheio`, `vendedor-nao-apaga-alheio`, `anonimo-sem-acesso`. `getAgenda2PendentesCount()` explicitly filters `.eq("vendedor_id", user.id)` so the Supervisor's own badge never shows the team total. `Agenda2List.tsx` renders the "Vendedor" filter (Select) only when `isSupervisor`, defaulting to "Todos os vendedores" |
| 5 | Agenda atual continua exatamente como hoje (mesmas tarefas, mesmo contador); nenhum item da Agenda 2 aparece nela | ✓ VERIFIED | Independently re-ran `git diff --name-only 071871f -- components/agenda lib/agenda "app/(app)/agenda"` → **empty output** (confirmed myself, not just trusting SUMMARY). Also confirmed `git status --porcelain` for the same paths plus `lib/supabase/queries/agenda.ts`/`app/actions/agenda.ts` is empty. Re-ran `tests/agenda/` + `tests/layout`: 30/37 test files pass; the 7 failing files (`agenda-rpc`, `concluir-rpc`, `conclusao-remota-rpc`, `proxima-data`, `rls-agenda`, `rls-conclusao`) fail with `Invalid login credentials` against deleted legacy seed accounts (`vendedor.a+test@raiar.local`) — a pre-existing, independently-documented issue in `.planning/STATE.md` line 407 ("Contas seed de teste apagadas... ~49 arquivos de teste falham") unrelated to and pre-dating Phase 31; none of these 7 files are in any Phase 31 plan's `files_modified` |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0048_agenda2_itens.sql` | agenda2_itens table, 8 columns, RLS, triggers | ✓ VERIFIED | Confirmed exists, read in full — exactly 8 columns, 4 constraints (`chk_agenda2_*`), 4 RLS policies, `agenda2_itens_carimbos()` trigger with no `security definer` clause |
| `lib/agenda2/itens.ts` | pure functions (sections, visibility, filter, duplicate check) | ✓ VERIFIED | Exists; imports `bucketDoItem`/`filtrarPorVendedor` from `lib/agenda/itens.ts` (never duplicates date logic) |
| `lib/validations/agenda2.ts` | shared Zod schema | ✓ VERIFIED | Exists; `AGENDA2_NOME_MAX`/`AGENDA2_BAIRRO_MAX`/digit-sequence refusal mirrored by `tests/agenda2/limites-sincronizados.test.ts` against the live migration text |
| `lib/supabase/queries/agenda2.ts` | `getAgenda2`, `getAgenda2PendentesCount` | ✓ VERIFIED | Read in full; no dono filter on list read (RLS decides, AGD2-07), explicit dono filter on count (D-13) |
| `app/actions/agenda2.ts` | 6 Server Actions | ✓ VERIFIED | Exists, `"use server"`; no RPC calls; dono always from `user.id` |
| `components/agenda2/Agenda2ItemRow.tsx` | row presentation | ✓ VERIFIED | Exists; strikethrough+badge on concluído; Editar/Apagar never hidden by concluído state |
| `components/agenda2/Agenda2ApagarDialog.tsx` | delete confirmation | ✓ VERIFIED | Exists |
| `components/agenda2/Agenda2ItemForm.tsx` | create/edit dialog | ✓ VERIFIED | Exists; LGPD hint present; duplicate-warning non-blocking |
| `components/agenda2/Agenda2List.tsx` | screen composition | ✓ VERIFIED | Exists; composes 31-02/31-04/31-05/31-07; Supervisor branch renders no write components |
| `app/(app)/agenda-2/page.tsx` | `/agenda-2` route | ✓ VERIFIED | Exists; session guard; reads only own `role` |
| `components/layout/AppSidebar.tsx` | menu entry | ✓ VERIFIED | Entry present at the correct position with independent `agenda2Count` prop |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `0048_agenda2_itens.sql` | RLS enforcement | 4 policies, `enable row level security` | ✓ WIRED | Confirmed by reading file; confirmed live by 33/33 passing integration tests against the real hosted DB |
| `app/actions/agenda2.ts` | `lib/validations/agenda2.ts#agenda2ItemSchema` | server-side re-validation | ✓ WIRED | `criarAgenda2Item`/`atualizarAgenda2Item` call `.safeParse` before any DB write |
| `lib/supabase/queries/agenda2.ts#getAgenda2PendentesCount` | `app/(app)/layout.tsx` | independent try/catch, passed to `AppSidebar` | ✓ WIRED | `app/(app)/layout.tsx` has its own try/catch block (confirmed by grep) distinct from the Agenda's |
| `components/layout/AppSidebar.tsx` | `app/(app)/agenda-2/page.tsx` | `href: "/agenda-2"` | ✓ WIRED | Route exists and resolves (confirmed by production build: `/agenda-2` listed as dynamic route) |
| `components/agenda2/Agenda2List.tsx` | `app/actions/agenda2.ts` | `getAgenda2Action`, mutation actions + `reloadKey` | ✓ WIRED | Confirmed by reading `Agenda2List.tsx` imports and grep for `isSupervisor`/`podeAlterar`/dialog usage |

### Behavioral Spot-Checks / Integration Proof

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RLS enforced against real production DB (not mocked) | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/migracao-agenda2.test.ts` | 33/33 passed | ✓ PASS |
| Agenda 2 full component/unit suite | `npx vitest run tests/agenda2/` | all files pass | ✓ PASS |
| Agenda atual regression (excluding pre-existing seed-account failures) | `npx vitest run tests/agenda/ tests/layout` | 30/37 files pass; 7 fail on deleted legacy seed accounts (pre-existing, documented, unrelated to Phase 31) | ✓ PASS (with known pre-existing issue) |
| TypeScript | `npx tsc --noEmit` | clean | ✓ PASS |
| ESLint (all phase 31 files) | `npx eslint ...` | clean (1 expected warning on .sql file, not a code issue) | ✓ PASS |
| Production build | `npm run build` | clean, `/agenda-2` listed as dynamic route | ✓ PASS |
| Agenda atual untouched since phase start | `git diff --name-only 071871f -- components/agenda lib/agenda "app/(app)/agenda"` | empty output (independently re-run, not trusting SUMMARY) | ✓ PASS |
| Anti-pattern scan (TODO/FIXME/XXX/placeholder/stub) | grep across `components/agenda2`, `lib/agenda2`, `app/actions/agenda2.ts`, `0048_*.sql` | no debt markers found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGD2-01 | 31-01, 31-02, 31-03, 31-04, 31-07, 31-08 | Vendedor cria item manual (nome livre, bairro, data) | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete; code + RLS integration tests confirm |
| AGD2-03 | 31-01, 31-03, 31-04, 31-05, 31-07, 31-08 | Vendedor edita item próprio | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete; `atualizarAgenda2Item` + RLS test `vendedor-edita-proprio` |
| AGD2-04 | 31-01, 31-03, 31-04, 31-05, 31-08 | Vendedor apaga item próprio | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete; `apagarAgenda2Item` + confirmation dialog + RLS test |
| AGD2-05 | 31-01, 31-02, 31-03, 31-04, 31-05, 31-08 | Vendedor marca concluído, item continua visível riscado | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete |
| AGD2-06 | 31-04, 31-06 | Agenda 2 no menu, logo abaixo de Agenda | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete; confirmed in `AppSidebar.tsx` |
| AGD2-07 | 31-01, 31-02, 31-03, 31-04, 31-05, 31-08 | Supervisor vê time + filtro; vendedor só os próprios | ✓ SATISFIED | `REQUIREMENTS.md` marked `[x]`/Complete; RLS tests `supervisor-le-o-time`, `vendedor-le-so-os-proprios` |
| AGD2-02 | — (Phase 32) | Repetição semanal | N/A — correctly deferred | `REQUIREMENTS.md` maps to Phase 32, status Pending — not claimed by Phase 31, no orphan |
| AGD2-08 | — (Phase 32) | Visão de calendário | N/A — correctly deferred | `REQUIREMENTS.md` maps to Phase 32, status Pending — not claimed by Phase 31, no orphan |

No orphaned requirements found: every ID mapped to Phase 31 in `REQUIREMENTS.md` (AGD2-01/03/04/05/06/07) is present in at least one plan's `requirements:` frontmatter field, and every plan's declared requirements are a subset of what `REQUIREMENTS.md` assigns to Phase 31.

### Anti-Patterns Found

None. Scanned all production files created/modified in this phase (`components/agenda2/*`, `lib/agenda2/*`, `lib/validations/agenda2.ts`, `lib/supabase/queries/agenda2.ts`, `app/actions/agenda2.ts`, `app/(app)/agenda-2/page.tsx`, `components/layout/AppSidebar.tsx`, `app/(app)/layout.tsx`, `supabase/migrations/0048_agenda2_itens.sql`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented`. No debt markers found; the few string matches on "placeholder" are legitimate `<Select>` placeholder props, not stub code.

### Human Verification Required

#### 1. End-to-end UAT with real browser (vendedor + Supervisor roles)

**Test:** Como vendedor de teste, abrir "Agenda 2" no menu, adicionar uma visita para hoje, corrigir o bairro, marcar como concluída, desmarcar, apagar (confirmando). Tentar um nome com número de telefone/CPF. Depois entrar como Supervisor e abrir "Agenda 2".
**Expected:** Comportamento descrito no bloco `human-check` do 31-08-PLAN.md (ver frontmatter acima) — riscado/selo/calendário/recusa de documento funcionando com o banco real; Agenda atual inalterada.
**Why human:** This is an interactive UI flow against the real hosted database (strikethrough rendering, menu badge, calendar widget, document-sequence rejection message) that automated component tests cannot exercise because they mock the Server Actions. This was the explicit `<human-check>` block deferred to end-of-phase in `31-08-PLAN.md`, and both `31-08-SUMMARY.md` and `.planning/STATE.md` (line 8: "pendente verificação humana e envio para staging") confirm it has not yet been performed.

#### 2. LGPD data-retention policy decision

**Test:** Confirmar com o dono do projeto uma política de retenção/descarte para os itens da Agenda 2.
**Expected:** Decisão registrada (ex.: apagar tudo ao final do piloto se a Agenda 2 for descartada, ou descarte automático após N dias).
**Why human:** This is a data-controller decision (LGPD), not a code defect — explicitly flagged as deferred by the project owner across 31-01/31-02/31-03/31-04/31-05/31-07/31-08 SUMMARYs. It does not block the phase's functional goal (the table/RLS/UI are built to the minimization spec already approved), but it remains an open compliance item that should not be forgotten before continued production use.

### Gaps Summary

No functional gaps found. All 5 ROADMAP success criteria for Phase 31 are independently verified against the actual codebase (not just SUMMARY.md claims):

- Re-ran the git-diff proof myself (`git diff --name-only 071871f -- components/agenda lib/agenda "app/(app)/agenda"` → empty) rather than trusting the SUMMARY's claim.
- Re-ran all 8 plans' key automated tests, including the 33 RLS integration tests against the **real hosted production Supabase project** (not a mock) — these prove the authorization boundary (vendedor isolation, Supervisor read-only, LGPD column minimization) actually holds in the database, not just in test doubles.
- Re-ran `tsc`, `eslint`, and `npm run build` — all clean, `/agenda-2` compiles as a route.
- Confirmed all 6 requirement IDs assigned to Phase 31 (AGD2-01/03/04/05/06/07) are marked Complete in `REQUIREMENTS.md`, with no orphans and no scope creep into AGD2-02/08 (correctly deferred to Phase 32).
- Scanned all phase-31 production files for debt markers/stub patterns — none found.

The only open items are two **human-required** items, both already known and explicitly flagged by the executor itself (not discovered gaps): (1) the end-to-end browser UAT that the plan deliberately deferred to end-of-phase and which `.planning/STATE.md` confirms has not yet run, and (2) the LGPD retention-policy decision that the project owner has knowingly deferred since 31-01. Neither represents a failure of implementation — they are the standard "last mile" checkpoint this project's GSD workflow and CLAUDE.md deploy flow require before shipping to `staging`/`master`. The 7 failing pre-existing test files in `tests/agenda/` are an unrelated, independently-documented infrastructure issue (deleted seed accounts, `.planning/STATE.md` line 407) that predates and is untouched by Phase 31.

---

_Verified: 2026-10-01_
_Verifier: Claude (gsd-verifier)_
