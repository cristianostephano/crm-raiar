# Project Research Summary

**Project:** CRM Raiar v1.3 "Agenda do Vendedor"
**Domain:** B2B field-sales CRM — recurring post-sale visit scheduling + unified task/agenda
**Researched:** 2026-08-07
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.3 "Agenda do Vendedor" extends the existing Supabase/Postgres schema with recurring-visit scheduling and a unified task/visit list. Architecture reuses established patterns with **zero new external dependencies** — all required libraries are already in package.json. Critical risk surface is narrow: date-timezone handling, multi-table write atomicity, and "ativo" state ambiguity. Research recommends **not introducing a background scheduler** — the "suggest and confirm" pattern (compute at write time, let vendor adjust, seed next row atomically) sidesteps complexity and preserves free-tier egress constraints.

## Key Findings

### Recommended Stack

No new dependencies. Core: Next.js 16, React 19 (useOptimistic), Supabase Postgres/RLS, date-fns 4.4.0, react-hook-form, zod, shadcn/ui, Vitest, Playwright.

### Expected Features

**Table stakes:** Unified agenda list, overdue highlighting, mark-done with resumo, per-client diary, frequência de visita, suggested next date, RLS visibility, "ativo"-gated fields

**Should-have:** Quick filters, supervisor per-vendor filter, nav count badge

**Defer:** Weekly calendar, single-occurrence reschedule, full-text search

### Architecture Approach

Extends proven patterns: SECURITY INVOKER RPCs for reads/writes, SECURITY DEFINER triggers for historico. New `visitas` table (sibling to `tarefas`), extended `mover_card_funil`, new `concluir_visita`/`concluir_tarefa_prospeccao`/`agenda_do_vendedor` RPCs. No new authorization exceptions needed.

### Critical Pitfalls & Prevention

**1. Timezone/date-math off-by-one** — Compute in Postgres (not browser), store as plain date, test Jan 31 + mensal

**2. 3-table write atomicity** — One atomic RPC for all writes; extend existing trigger pattern; test rollback

**3. Graduated fields fail on populated table** — Add as nullable; enforce in RPC guard; resolve "ativo" definition first

**4. Auto-generate via scheduler** — Compute at write time, "overdue" at read time; no scheduled job

**5. Client-side merge instead of UNION ALL** — One SECURITY INVOKER RPC with pagination in SQL; add date indexes

## Roadmap Implications

**Phase 1:** Schema Foundation — Resolve "ativo", add graduated fields, extend mover_card_funil. **Avoids Pitfall 3.**

**Phase 2:** Recurrence Engine — Build RPCs, create visitas table, extend historico triggers, heavy testing. **Avoids Pitfalls 1, 2, 4.**

**Phase 3:** Agenda Read View — Build agenda_do_vendedor RPC, indexes, AgendaList component. **Avoids Pitfall 5.**

**Phase 4:** Mark-Done Dialog — ConcluirItemDialog with React 19 useOptimistic, zod validation.

**Phase 5:** Diary + Ativo Fields Display — Extend ClienteDetailSheet.

**Phase 6:** Polish — Nav badge, filters, export (optional).

**Ordering:** Phase 1 resolves "ativo"; Phase 2 builds core wiring; Phase 3 data layer; Phase 4 UI consumption; Phase 5 payoff; Phase 6 polish.

### Research Flags

**Need research:** Phase 1 (Discuss "ativo" definition), Phase 2 (plan with `/gsd-plan-phase --research-phase 2`)

**Standard patterns:** Phases 3, 4, 5, 6 (skip research)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified in package.json; @tanstack/react-query NOT installed |
| Features | MEDIUM-HIGH | High for project patterns; medium for general CRM research |
| Architecture | HIGH | Grounded in actual migrations and established patterns |
| Pitfalls | MEDIUM-HIGH | Verified across recurring-task systems; not yet on this project |
| Overall | MEDIUM-HIGH | Sound architecture; narrow, documented risk surface |

### Gaps to Address

- **"Ativo" definition:** Synonym for 'ganho' or new lifecycle state? Resolve in Discuss.
- **Frequência_visita values:** Confirm semanal/quinzenal/mensal/nenhuma only.
- **Resumo field:** "Short text" — 200 chars or unbounded?
- **Historical backfill:** Default cadence or NULL for legacy "ganho" clients?

## Sources

**Primary (HIGH):** Codebase inspection (package.json, migrations 0001–0012, 2026-08-07), PROJECT.md, supabase-conventions skill, SEED-001, CLAUDE.md

**Secondary (MEDIUM):** npm registry checks, WebSearch (date-fns, React 19, recurring-task patterns, Postgres migration patterns)

---

*Researched: 2026-08-07*
*Synthesized by: gsd-synthesize*
*Ready for roadmap: yes*
