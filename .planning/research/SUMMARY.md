# Research Summary — v1.2 Gestão de Equipe, Análises de Funil e Filtros

**Milestone:** v1.2 — Team Deactivation, Funnel Analytics, Kanban Layout, Location Filters
**Project:** CRM Raiar — Acompanhamento de Vendas
**Domain:** B2B sales CRM (kanban funnel + role-based analytics) on Supabase
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

Milestone v1.2 adds six targeted capabilities: team member soft-deactivation with forced reassignment, per-stage funnel conversion/duration metrics, per-salesperson performance comparison, kanban column fixed-height scroll, and Estado/Cidade cascading location filters. **Zero new npm dependencies needed.** All features layer onto existing RLS/RPC/historico without schema restructuring — deactivation adds one column (`profiles.ativo`), funnel metrics parse existing `historico` text via window functions, location filter introduces one lookup table.

**Critical cross-feature dependency:** Team deactivation's reassignment scope (open-only vs. all clientes) affects leaderboard historical accuracy. This decision must be locked before leaderboard is planned in detail. **Recommendation: reassign only open clientes.**

**Build order:** Kanban scroll + location filter (no deps) → deactivation (enables leaderboard schema) → funnel metrics (establishes duration math) → leaderboard (reuses both).

## Key Findings

### Recommended Stack

**Zero new npm packages.** All features use existing core stack (Next.js 16, React 19, Supabase, `@dnd-kit`, shadcn/ui), native PostgreSQL (window functions, string parsing), and Supabase Auth Admin API (already in `@supabase/supabase-js`). Minor addition: server-only admin client (`lib/supabase/admin.ts`) using `service_role` key (`.env.local`, never `NEXT_PUBLIC_`).

### Expected Features

**Six features, all P1 (committed scope):**

| # | Feature | Dependency |
|---|---------|------------|
| 1 | Deactivate + reassign + last-Supervisor guard | Precedes leaderboard |
| 2 | Funnel chart (conversion %/dropout/time-in-stage) | Shared duration math |
| 3 | Days-to-win/loss KPIs | Extends chart query |
| 4 | Vendedor leaderboard | Depends on item 1 scope |
| 5 | Kanban column scroll | Independent |
| 6 | Estado/Cidade cascading | Independent |

**Open decision (Item 1→4):** Reassign all clientes or open-only? Recommendation: **open-only** to preserve leaderboard historical accuracy.

### Architecture Approach

**Deactivation:** Two-step cross-service flow. RPC (`desativar_membro_equipe`) enforces last-Supervisor guard, reassigns clientes, flips `profiles.ativo = false`. Separate Server Action calls Auth Admin API (`ban_duration: '87600h'`) to block sign-in (service_role key). If step 2 fails after step 1, `ativo=false` already enforced; residual risk (still-valid JWT ~1h) documented.

**Funnel analytics:** Reconstructs history from existing `historico` rows — no schema change. Fixed-format `descricao` (`'Etapa alterada para "%s"'`) parsed via window functions to pair entry/exit timestamps per stage.

**Leaderboard:** Extended `dashboard_desempenho_vendedor` RPC via `create or replace`, adds `negocios_iniciados`, `ciclo_medio_dias`, `ativo` columns. Same `SECURITY INVOKER` pattern as existing dashboard.

**Location filters:** New `cidades` table (IBGE-seeded, read-only), new `cidades_por_estado()` RPC. Estado (27 UF) is frontend constant. Avoids perpetuating free-text inconsistencies.

**Kanban scroll:** Pure CSS/Tailwind — bounded `max-h` + `overflow-y-auto` on card-list, header outside scroll region.

### Critical Pitfalls

1. **Two-step deactivation atomicity:** GoTrue separate from Postgres; if step 2 fails, `ativo=false` already enforced but Auth ban pending. **Prevention:** Document that `ativo=false` is primary control.

2. **Cidade dropdown from existing clientes:** Perpetuates inconsistency, blocks first-ever city entry. **Prevention:** Use `cidades` table + RPC.

3. **Structured columns for historico:** Backfill gap, zero benefit. **Prevention:** Parse existing `descricao` via window functions.

## Implications for Roadmap

### Phase 1: Kanban Scroll (Fixed-Height Layout)
Rationale: Zero deps, pure CSS, UX win. Delivers bounded-height columns, pinned headers.

### Phase 2: Estado/Cidade Filters
Rationale: Independent, unblocks all forms. Delivers `cidades` table + RPC, cascading dropdown.

### Phase 3: Team Deactivation
Rationale: Highest risk, must precede leaderboard schema. **MUST lock reassignment scope.** Delivers `profiles.ativo`, modified `is_supervisor()`, `desativar_membro_equipe()` RPC, deactivation UI.

### Phase 4: Funnel Metrics
Rationale: Establishes duration math leaderboard reuses. Delivers `dashboard_tempo_por_etapa()`, `dashboard_dias_ate_ganho_perdido()`, funnel visualization.

### Phase 5: Vendedor Leaderboard
Rationale: Depends on phase 3 (`ativo` column) + phase 4 (duration logic). Delivers extended dashboard with per-vendedor metrics (no money columns).

### Phase Ordering
- Phases 1&2: Parallel OK, no cross-deps
- Phase 3: Must precede 5 (schema dependency)
- Phase 4: Should precede 5 (code reuse)
- Phase 5: Last (depends on 3&4)

### Research Flags

Needing research:
- **Phase 3:** Confirm Auth Admin API `ban_duration` format, JWT expiry window
- **Phase 4:** Confirm whether in-progress duration included in avg (survivorship bias vs. clean data)
- **Phase 5:** Automated test for per-role query isolation

Standard patterns (skip research):
- **Phases 1&2:** Established patterns, standard research sufficient

## Confidence Assessment

| Area | Confidence |
|------|-----------|
| Stack | HIGH — all packages in codebase, no new deps |
| Features | MEDIUM-HIGH — well-scoped, reassignment scope needs user input |
| Architecture | HIGH — traced to live migrations (0001-0003 precedent) |
| Pitfalls | MEDIUM — three v1.2-specific pitfalls, general v1.0 pitfalls still apply |

**Overall:** MEDIUM-HIGH

### Gaps to Address

1. **Reassignment scope:** MUST lock before phase 3 planning. Default: open-only. If all-clientes, document leaderboard corruption risk.
2. **Current-stage duration:** Confirm if in-progress cards included (survivorship-bias avoidance) or excluded (clean data only).
3. **Auth ban latency:** Confirm JWT expiry (~1h typical), document residual window in error messages.
4. **Historico format-string:** Trigger maintains `'Etapa alterada para "%s"'`. If future trigger changes to structured fields, parsing becomes unnecessary — note as refactor opportunity.

## Sources

**Primary (HIGH):** Live migrations (0001-0003), `.planning/PROJECT.md`, Supabase JS API reference
**Secondary (MEDIUM):** STACK/FEATURES/ARCHITECTURE v1.2 research, codebase verification
**Tertiary (LOW):** WebSearch patterns (Postgres window functions, CRM deactivation, Brazil UF/city forms)

---

*Research completed: 2026-07-25 — Ready for roadmap*
