# Project Research Summary

**Project:** CRM Raiar — v1.6 "Importação de Clientes Ativos e Prospecção Separadas"
**Domain:** Extension of an existing Next.js 16 + Supabase sales CRM — bulk-import differentiation (prospect vs. active/won client) + fixed-anchor recurring visit scheduling
**Researched:** 2026-08-24
**Confidence:** HIGH

## Executive Summary

This milestone is pure extension work on a mature, well-established codebase — no new product category, no new core technology. It adds two capabilities: (1) splitting the single "Importar clientes" spreadsheet into a minimal-fields "Importar Clientes em Prospecção" and a full-data "Importar Clientes Ativos" that lands rows already at "ganho," and (2) replacing interval-based visit-frequency suggestions ("+7/+14/+30 days") with fixed-anchor recurrence ("every Monday," "2nd Thursday of the month"). Every researcher independently converged on the same conclusion: build both features by mirroring patterns this codebase has already used 3-5 times (per-import-type sibling files, one-RPC-one-purpose bulk writes, transition-only grandfathering guards, single-authority pure SQL date functions) rather than introducing abstractions, libraries, or generalized frameworks the project has never needed.

The dominant risk is not technology, it's guard/logic drift across parallel code paths that already exist in this codebase's history: this project has already been bitten once (v1.4, `importar_clientes_lote`'s `jsonb_to_recordset` silently dropping new columns) by a bulk-write RPC not staying in lockstep with `mover_card_funil`'s guards. This milestone reproduces that exact risk shape twice — the new "Importar Clientes Ativos" RPC creates already-"ganho" rows via a raw INSERT that never passes through `mover_card_funil`, so it must independently duplicate (not inherit) every ganho guard; and the widened ganho guard itself grows from a 1-field (CNPJ) to a 5-column (endereço) + 1-field (razão social) check, which breaks the single-coalesce-expression shape the existing grandfathering test suite validates and needs deliberate redesign, not copy-paste. A second real risk is the "dia fixo" date math itself (Nth-weekday-of-month, non-existent-ordinal fallback, never-suggest-a-past-date) — genuinely new calendar logic this project has never needed before, requiring its own dedicated migration and test file.

Recommended approach: treat this as a sequenced set of phases — schema/RPC foundation touching production data first (razão social nullability, new enum columns, `proxima_data_visita` rewrite, widened ganho guard, new import RPC — all reviewed carefully, smallest-blast-radius-first), then import wizard UI (low-risk, mirrors existing CNPJ/frequência import wiring file-for-file), then menu cleanup (only after the replacement flow is proven), then Agenda UI (a narrow new read query plus one new pure function in the existing `lib/agenda/itens.ts` single-authority file). No new npm packages, no new services, zero change to the zero-infra-cost constraint.

## Key Findings

### Recommended Stack

No new core technologies or libraries — this is the standout finding across all four research files. Both v1.6 features are extensions of patterns already proven in the codebase (v1.1, v1.3, v1.4, v1.5 migrations): reuse, not addition, is the correct stack decision.

**Core technologies (all already installed and running in production):**
- Next.js 16.2.10 (App Router, Server Actions) — the write path for both features; every prior import variant is already a Server Action → RPC pair
- Supabase Postgres (hand-written PL/pgSQL, no ORM/query-builder) — server-side computation for fixed-anchor date math, following `proxima_data_visita()`'s existing single-authority pattern
- `@e965/xlsx` + `papaparse` — spreadsheet parsing, already generic across 3 import variants, reused unchanged
- `date-fns` — display-only formatting; actual date computation stays in Postgres per the project's own established rule ("cálculo de data feito no Postgres, nunca no navegador")

Explicitly rejected: any RRULE/recurrence library (`rrule.js`, `pg_cron`), any new spreadsheet-parsing package, and any generic "import wizard" or "recurrence builder" abstraction — the two recurrence shapes needed (weekly-on-weekday, Nth-weekday-monthly) are small and fixed enough that a ~15-line SQL function beats a general-purpose engine.

### Expected Features

**Must have (table stakes, all P1, scoped exactly to `.planning/PROJECT.md`):**
- Two distinct bulk-import entry points (prospect-minimal vs. active-full), mirroring the industry-standard Salesforce Lead-vs-Contact field split
- Active-import clients land directly at "ganho" (not stage 1), enforcing the SAME required-field gate `mover_card_funil` enforces on manual ganho transitions
- Frequência de visita explicitly excluded from Active import, surfaced instead via a new Agenda nudge list — this is the direct dependency link between import and cadence features
- Duplicate detection reused unchanged from the existing import pipeline
- Fixed-day recurrence definition (weekday for weekly/biweekly; Nth-weekday-of-month for monthly) — matches the Google Calendar/Outlook mental model, avoiding cadence drift from pure interval math

**Should have (differentiators):**
- "Clientes ativos sem frequência definida" Agenda section — turns a silent data gap into a discoverable, non-blocking to-do, same pattern already proven for "cards parados/atrasados"
- Next-visit suggestion targeting the fixed anchor day rather than days-since-completion

**Explicitly rejected as anti-features (would violate standing project decisions):**
- Import-as-upsert (already out of scope since v1.1)
- Blocking cadence definition at ganho time (contradicts VIS-04's "never force frequency retroactively")
- Free-text cadence description (repeats the `frequencia_pedidos` inconsistency this project already avoided once)
- Silent auto-rescheduling (directly contradicts a standing decision requiring vendor confirmation)
- Route optimization/geographic clustering (explicitly out of scope since v1.3)

### Architecture Approach

Entirely first-party codebase research (HIGH confidence, no external sources needed) — every recommendation is grounded in a specific file/line already in this repo. The layered shape (UI → Server Actions → pure `lib/` modules → RPCs → RLS-gated tables) stays unchanged; this milestone adds new siblings at each layer rather than new layers.

**Major components:**
1. **New RPC `importar_clientes_ativos_lote`** — a NEW set-based INSERT RPC (never a `p_modo` flag on the existing `importar_clientes_lote`), mirroring how `atualizar_cnpj_lote`/`atualizar_frequencia_visita_lote` are structural siblings, not parameterized variants of one function
2. **Widened `mover_card_funil` ganho guard** — an EXTENSION adding razão-social + endereço-completo checks alongside the existing CNPJ guard, as additional `if/raise` blocks (never merged into one compound condition, never extracted into a shared helper — guards are duplicated verbatim in this codebase, only pure computation is shared)
3. **Rewritten `proxima_data_visita`** — from a one-line fixed-offset `CASE` to genuine Nth-weekday-of-month search logic; stays the sole authority for "next visit date" math, called from both `mover_card_funil` and `agenda_do_vendedor()`
4. **New Agenda read query + pure function in `lib/agenda/itens.ts`** — a plain SELECT (not an RPC — no bulk write, no cross-table UNION need), with a genuinely new type/section rather than forcing "missing cadence" clients into the existing due-date bucket logic

### Critical Pitfalls

1. **Import-to-ganho bypasses `mover_card_funil`'s guards entirely** — the new RPC is a raw INSERT with no shared call path to the guard logic; every ganho guard (present and future) must be hand-duplicated into it, with an explicit cross-referencing comment, or it becomes a silent backdoor for incomplete "ganho" clients.
2. **Widening the 1-field CNPJ guard to a 5-column address + razão-social check breaks the single-coalesce-expression pattern** the existing grandfathering test suite depends on — treat "endereço completo" as one derived boolean computed from a single row-read, and add a new "legado sem razão social/endereço" test case, since today's fixtures can't catch a guard that's 4-of-5 fields correct.
3. **"Dia fixo" date math needs genuinely new calendar logic with two failure modes this codebase has never had to handle**: non-existent ordinals (e.g. "5th Monday" doesn't exist most months) and the loss of the "never returns a past date" guarantee that pure-offset math gets for free — both need explicit roll-forward logic and dedicated tests.
4. **Required-ness for imports is already split across two independently-maintained sources of truth** (`SYSTEM_FIELDS[].required` drives the UI, `createImportRowSchema` — a separately hand-maintained Zod schema — drives actual row acceptance) that happen to agree today only by convention; adding a second required-ness profile risks the UI correctly nagging while the actual write path silently still enforces the old rule.
5. **Removing the two now-redundant import menu items is tested at two independent layers** (`AppSidebar.test.tsx` DOM/label assertions, and Playwright specs that navigate directly to the retiring routes by URL) — both must be explicitly updated/deleted together, not just the menu link.

## Implications for Roadmap

Based on research, suggested phase structure (mirrors Architecture research's "Suggested Build Order," itself grounded in this project's own established practice of separating schema/RPC-foundation phases from UI-wiring phases):

### Phase 1: Schema & RPC Foundation
**Rationale:** Every downstream feature (import RPC, Agenda section, widened guard) depends on schema decisions made here; this is the production-data-sensitive, highest-review-priority phase, and must be sequenced first.
**Delivers:** `razao_social` made nullable (new migration, scoped narrowly since it's the one change touching an existing NOT NULL constraint on live data); new `dia_semana_enum`/`semana_do_mes_enum` + two nullable anchor columns on `clientes`; rewritten `proxima_data_visita` with Nth-weekday-of-month search + never-past-date guard, tested exhaustively for month-boundary and "5th occurrence" edge cases; widened `mover_card_funil` ganho guard (razão social + endereço, transition-only, grandfathered); new RPC `importar_clientes_ativos_lote` with the guard duplicated verbatim from `mover_card_funil`.
**Addresses:** Table-stakes "full-data-required import for active customers," "client lands directly at won stage," differentiator "next-visit suggestion targets fixed anchor."
**Avoids:** Pitfalls 1, 2, 3 (guard drift, grandfathering-pattern breakage, date-math edge cases).

### Phase 2: Import Vocabulary & Wizard UI
**Rationale:** Depends on Phase 1's schema decisions (razão-social nullability, widened guard shape to mirror); the actual wizard UI work is low-risk and mirrors an established 3-times-repeated pattern (CNPJ import, frequência import), but the underlying required-ness vocabulary refactor (Pitfall 4) must be resolved first since it's shared infrastructure, not per-wizard code.
**Delivers:** Unified required-ness-by-profile mechanism spanning the mapping UI, `annotarLinha`, and `createImportRowSchema` (not three independently-forked copies); "Importar Clientes Ativos" wizard (`typesAtivo.ts`, `annotarLinhaAtivo.ts`, `confirmarAtivo.ts`, new route/components mirroring the CNPJ/Frequência precedent file-for-file); "Importar clientes" renamed/relaxed to "Importar Clientes em Prospecção"; blank-razão-social dedup fallback key.
**Addresses:** Table-stakes "two distinct bulk-import entry points," "minimal-required-fields import for prospects," "duplicate detection on the new import flow."
**Avoids:** Pitfall 4 (required-ness profile divergence across mapping UI / Zod schema / dedup / DB constraint).

### Phase 3: Menu Cleanup
**Rationale:** Must be sequenced explicitly AFTER Phase 2's Active-import flow is proven — removing the CNPJ/frequência backfill spreadsheets before their replacement covers the same use case leaves Supervisors with no way to regularize existing incomplete "ganho" clients.
**Delivers:** Removal (or explicit unlinking, decided up front) of "Importar CNPJ"/"Importar frequências" menu entries and their routes, with both `AppSidebar.test.tsx` and the corresponding Playwright E2E specs updated in the same commit.
**Addresses:** Milestone goal of removing import redundancy.
**Avoids:** Pitfall 5 (menu removal silently breaking two independent test layers).

### Phase 4: Agenda "Sem Frequência" Section
**Rationale:** Depends on Phase 1's anchor columns and rewritten `proxima_data_visita` (the section's predicate and any linked edit flow read/write those columns); this is the feature that makes the Active-import's frequência omission actually safe in practice, so it closes the loop opened in Phase 1/2.
**Delivers:** New narrow read query (plain SELECT, no RPC) with a predicate that catches both "no frequência" and "frequência set but no anchor yet" (the grandfathered pre-v1.6 gap); new pure type/function in `lib/agenda/itens.ts` (not forced into the existing due-date bucket logic); extended `atualizarFrequenciaVisita` Server Action to accept the two anchor columns.
**Addresses:** Differentiator "clientes ativos sem frequência definida" nudge list.
**Avoids:** Forcing non-due-dated items into `AgendaItem`/`agruparAgenda`'s bucket logic via a synthetic date.

### Phase Ordering Rationale

- Phase 1 must land before Phase 4 (anchor columns/rewritten date function are read there) and before Phase 2's wizard work (the new import RPC copies the widened guard's final shape).
- Phase 2's prospecção-relaxation half depends only on Phase 1's razão-social nullability step, not the rest of Phase 1 — it could ship independently/earlier if sequencing pressure requires splitting further.
- Phase 3 is deliberately last among the "shippable independently" phases because it retires a user-facing backfill mechanism that Phase 2 must first prove replaces.
- This ordering directly follows this project's own established discipline (visible in v1.3/v1.4/v1.5 history) of separating schema/RPC-foundation phases from later UI-wiring phases.

### Research Flags

Needs research during planning (`/gsd-plan-phase --research-phase <N>`):
- **Phase 1** — the Nth-weekday-of-month PL/pgSQL algorithm (non-existent-ordinal fallback, timezone discipline) is genuinely new calendar math this codebase has never implemented; also needs an explicit product decision (not a stack decision) on whether the ganho-time UX collects missing fields inline (dialog grows) or blocks and redirects to the existing ficha screen.
- **Phase 2** — the required-ness-by-profile refactor touches three independently-maintained surfaces (mapping UI, Zod schema, dedup) with no existing precedent in this codebase for a shared multi-profile shape.

Phases with standard, well-documented patterns (skip research-phase, plan directly from precedent):
- **Phase 3** — pure mechanical removal following an already-documented test-per-item pattern.
- **Phase 4**'s wizard/UI wiring portions — direct mirror of 3 prior import-flow implementations already in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new packages; all recommendations grounded in already-running, already-pinned `package.json` versions and direct codebase precedent across 5 prior milestones |
| Features | MEDIUM | Core feature patterns (import splitting, calendar-app recurrence model) cross-checked against multiple independent sources (Salesforce, Google/Outlook, Microsoft Graph docs); the field-sales-specific "missing cadence nudge" UX pattern is inferred from this project's own prior conventions, not directly confirmed in named competitor tools (Badger Maps/SPOTIO/Repsly) |
| Architecture | HIGH | Entirely first-party codebase research — every claim grounded in a specific file/line read from this repo's migrations, Server Actions, and `lib/` modules; no external sources needed |
| Pitfalls | HIGH | Every pitfall is a concrete, cited collision with an already-shipped convention in this exact codebase (specific migration numbers, specific test files); no web synthesis used |

**Overall confidence:** HIGH

### Gaps to Address

- **Ganho-time UX for the widened guard (Phase 1):** whether missing razão-social/endereço fields are collected inline in `GanhoFrequenciaDialog` (requires growing it into a larger form + new RPC parameters) or must already be on the row before ganho is attempted (keeps the dialog small, but changes failure UX to a redirect) — flagged by both Architecture and Pitfalls research as a product decision for Discuss-phase, not a default to assume during planning.
- **Whether imported "Ativo" clients need a seeded first `visita` when their frequência is later filled in** — the import RPC bypasses `mover_card_funil`'s visita-seeding block entirely by design, and `atualizar_frequencia_visita_lote` deliberately doesn't seed either; confirm which UI path (individual ficha edit vs. a future bulk flow) is expected to close this gap.
- **Whether "dia fixo" retroactively applies to pre-v1.6 clients who already have a frequência set** — the milestone text only mentions a nudge for clients "sem frequência definida" entirely, which reads as scoped narrower than backfilling every existing ganho client's anchor; confirm scope explicitly before Phase 4 planning.
- **Whether the bulk "frequências em massa" spreadsheet should also gain the two anchor columns**, or stay frequência-only with anchor-setting confined to the individual ficha/Agenda flow — both are internally consistent with existing precedent; deferred to a scope call in planning.
- **Field-sales "missing cadence" nudge UX pattern (Features research)** — not directly confirmed in named competitor tools; low risk since it's grounded in this project's own already-proven "cards parados/atrasados" pattern rather than external inspiration.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `supabase/migrations/0002, 0004, 0013, 0015, 0017-0023`, `lib/importacao/*`, `lib/agenda/itens.ts`, `lib/funil/frequencia.ts`, `lib/clientes/completude.ts`, `app/actions/importacao.ts`, `app/actions/clientes.ts`, `components/importacao/*`, `components/agenda/*`, `components/clientes/GanhoFrequenciaDialog.tsx`, `components/layout/AppSidebar.tsx`, `tests/clientes/cnpj-ganho.test.ts`, `tests/importacao/AppSidebar.test.tsx`, `tests/e2e/importar-frequencias-guard.spec.ts`, `tests/e2e/importar-guard.spec.ts`, `package.json`
- `.planning/PROJECT.md` — Key Decisions table and Out of Scope history (CNPJ-02 grandfathering, transition-only guard rationale, Supervisor-only import restriction, "sem cron/worker" constraint, server-side-date-math rule)

### Secondary (MEDIUM confidence)
- WebSearch: "CRM bulk import prospects vs active customers different required fields" — Salesforce Lead-vs-Contact split, cross-checked against Outreach/Zoho/Sage docs
- WebSearch: "recurring event day of week / Nth weekday scheduling UI pattern" — Microsoft Graph (Outlook), Google Calendar, MUI Scheduler docs, consistent across independent sources on the "Weekly on [day]" / "Monthly on the [Nth] [weekday]" model

### Tertiary (LOW confidence)
- WebSearch: "PostgreSQL PL/pgSQL calculate next occurrence Nth weekday of month" — community mailing-list threads converging on the `date_trunc` + modulo idiom; treat as a starting point to test, not copy verbatim
- WebSearch: "SPOTIO Badger Maps Repsly account visit frequency reminder list" — no direct confirmation of a "missing cadence" nudge feature in named field-sales tools; the Agenda differentiator is inferred from this project's own conventions, not verified externally

---
*Research completed: 2026-08-24*
*Ready for roadmap: yes*
