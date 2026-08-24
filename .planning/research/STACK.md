# Stack Research

**Domain:** Bulk spreadsheet import variant + fixed-anchor recurring date scheduling (PL/pgSQL) for an existing Next.js 16 + Supabase CRM
**Researched:** 2026-08-24
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

No new core technologies. Both v1.6 features are extensions of patterns already proven in this codebase across v1.1, v1.3, v1.4, and v1.7 migrations — the correct "stack decision" here is **reuse, not addition**.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router, Server Actions) | 16.2.10 (already in `package.json`) | UI + write path for both features | Every import variant to date (`importacao.ts`, `importacaoCnpj.ts`, `importacaoFrequencia.ts`) is a Server Action calling an RPC; feature (a) is a 4th sibling in that same file/folder shape |
| Supabase Postgres (PL/pgSQL functions, no ORM) | project's current Supabase project | Server-side computation for both features | Feature (b) is pure server-side date math — exactly what `proxima_data_visita()` already is (immutable SQL function, single authority, called from `mover_card_funil`/`concluir_visita`/`agenda_do_vendedor`). No query builder or migration-generation library is used anywhere in this project; hand-written `.sql` files in `supabase/migrations/` is the established convention (see `supabase-conventions` skill) |

### Supporting Libraries

None to add. The two libraries this milestone touches are **already installed** and already do the job:

| Library | Version (already installed) | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@e965/xlsx` | ^0.20.3 | Parses `.xlsx` uploads in `lib/importacao/parseArquivo.ts` | Reuse as-is for "Importar Clientes Ativos" — `parseArquivo.ts` is already generic (consumed by 3 existing import variants: clientes, CNPJ em massa, frequências em massa), not tied to a specific column set |
| `papaparse` | ^5.5.4 | Parses `.csv` uploads, same file | Same reuse — no variant-specific parsing code exists today; column mapping happens downstream in `mapping.ts`/`annotarLinha*.ts`, which is where the 4th variant's own file goes |
| `date-fns` | ^4.4.0 | Client-side date formatting/display only | Already used for the Agenda calendar (`startOfWeek`/`endOfWeek`). **Not** the tool for feature (b)'s actual computation — that must happen in Postgres per the project's own established rule (Key Decision, v1.3: "Cálculo de data feito no Postgres... nunca `new Date(string)` no navegador"). `date-fns` may still be used client-side to *render* a human label like "toda 1ª quinta-feira do mês" from the stored day-of-week/week-of-month integers, which is a display concern, not a computation concern |

### Development Tools

No change. `Vitest` (unit tests for the new PL/pgSQL date function's pure-SQL twin/logic and for the new import row-validation module) and `Playwright` (E2E for the new import wizard flow and the new Agenda "sem frequência" section) are already configured and are the same tools every prior phase in this project used.

## Installation

```bash
# Nothing to install. Zero new npm packages for v1.6.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hand-written PL/pgSQL function extending `proxima_data_visita()` (or a sibling `proxima_data_visita_fixa()`) for "next Nth weekday of month" | A cron-scheduling/RRULE library (e.g. `rrule.js`, or a Postgres extension like `pg_cron` combined with iCal RRULE parsing) | Only if the product ever needs arbitrary recurrence rules (every 3rd Tuesday, every other Friday except holidays, etc.) computed and *stored as a schedule object*. This milestone's rule set is exactly two shapes — "weekday X, every N weeks" and "the Nth weekday-X of the month" — small and fixed enough that a ~15-line SQL function is simpler, has zero new dependency/cost surface, and matches the project's zero-infra-cost constraint. Introducing an RRULE engine would be solving a more general problem than the one asked for |
| Extending `parseArquivo.ts` + a new `annotarLinhaAtivo.ts`/`confirmarAtivo.ts` pair, mirroring `importacaoCnpj.ts`/`importacaoFrequencia.ts` | A generic/config-driven "import wizard" abstraction that takes a field-schema and produces all 4 variants from one component | Only if a 5th or 6th import variant is requested later and the duplication across `annotarLinha*.ts` files becomes a real maintenance cost. Right now there are 3 variants with independent, deliberately-duplicated validation (per the project's existing pattern — each file is small and independently readable by future non-technical-adjacent maintainers). Premature abstraction here would trade simplicity for flexibility nobody asked for yet |
| Postgres `EXTRACT(dow FROM date)` + `date_trunc('month', ...)` arithmetic for "Nth weekday of month" | `to_char(date, 'W')` + `rank()` window function approach (also found in community solutions) | The `EXTRACT(dow ...)` + `date_trunc` approach is simpler to read and test as a single deterministic expression (no window function, no ranking over a generated series); prefer it unless a future requirement needs "the Nth occurrence counting from the end of the month" (e.g. "last Friday"), which the modulo-based version handles more directly than the `rank()` version |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Any new npm package for spreadsheet parsing (e.g. `xlsx` from SheetJS's own CDN channel, `exceljs`, `read-excel-file`) | `@e965/xlsx` + `papaparse` already parse every column shape this project has needed across 3 import variants; a 4th variant is a new column *mapping*, not a new file format | Reuse `lib/importacao/parseArquivo.ts` unchanged |
| Any recurrence/scheduling library (`rrule`, `node-cron`, `later.js`) or a Postgres cron extension (`pg_cron`) | This is a **computed suggestion**, not a **background schedule** — same reasoning the project already applied to v1.3 visit frequency ("Sem cron/worker de fundo — a próxima data de visita é calculada no momento da escrita... com confirmação síncrona do vendedor"). Feature (b) computes one candidate date synchronously inside `agenda_do_vendedor()`/`concluir_visita()`, exactly like today; nothing needs to "fire" on a schedule | Extend the existing pure SQL function pattern (`proxima_data_visita`) |
| `moment.js` / any new date library, client or server | Already excluded project-wide (`CLAUDE.md` "What NOT to Use"); doubly irrelevant here since the actual date math must live in Postgres, not JS, per the v1.3 Key Decision | `date-fns` for display only; PL/pgSQL for computation |
| Storing the recurring-day rule as free text (e.g. `"toda quinta-feira"` or `"1ª quinta"`) | Would reintroduce exactly the problem this project has repeatedly avoided with enums (`frequencia_pedidos`' cautionary tale is the opposite direction, but the same lesson applies): a rule needs to be *computed over*, and free text can't be `EXTRACT(dow FROM ...)`-compared. It would also block the "next Nth weekday" SQL function from having typed inputs | Small integer/enum columns (day-of-week 0–6, and for monthly, an ordinal 1–4/"last") that the SQL function consumes directly — this is a schema decision for the planning phase, not a library choice, but it directly determines whether the "no new library" recommendation above holds |
| A generic "recurrence builder" UI abstraction pulled from a component library (e.g. an RRULE picker component) | No such component is in the shadcn/ui ecosystem, and the actual UI need here is narrow: a weekday selector for weekly/biweekly, and a "week-of-month + weekday" selector for monthly — both are small, composed directly from existing shadcn/ui primitives (`Select`, `ToggleGroup`) already used for `frequencia_visita`'s 4-option UI | Compose from existing shadcn/ui primitives already installed, same as every prior enum-picker in this project |

## Stack Patterns by Variant

**For the second import spreadsheet ("Importar Clientes Ativos"):**
- Reuse `lib/importacao/parseArquivo.ts` unchanged (file-format parsing is already generic across `.xlsx`/`.csv`)
- Add a sibling module set mirroring `importacaoCnpj.ts`/`importacaoFrequencia.ts`: a new `annotarLinhaAtivo.ts` (row-level validation — this variant's twist is *more* required fields, not fewer, since it must satisfy the same completeness bar the "ganho" guard will require), a new `confirmarAtivo.ts` (Server Action), and a new RPC (e.g. `importar_clientes_ativos_lote`) that mirrors `importar_clientes_lote`'s set-based `INSERT ... ON CONFLICT DO NOTHING` shape but writes `status_acompanhamento = 'ganho'`/`etapa = 'primeira_venda'` directly and requires the same fields the "ganho" transition guard in `mover_card_funil` requires (per the v1.6 goal: razão social + endereço completo + CNPJ), leaving only frequência out
- Because this RPC creates rows that start life already "ganho," it should decide up front whether it also needs to seed a first `visitas` row the way `mover_card_funil` does on transition — likely **not**, since frequência is explicitly excluded from this import (VIS-01's "frequência obrigatória ao ganho" guard cannot fire without a frequência value); confirm this as a planning-phase question, not a stack question
- No new library for the "which column maps to which field" UI step — `lib/importacao/mapping.ts` already generalizes this

**For fixed-anchor recurring visit scheduling:**
- Extend, don't replace, `proxima_data_visita()` — either add parameters (day-of-week / week-of-month) to the existing function or add a sibling function it delegates to for the two "fixed anchor" frequencies, keeping it the single authority for all next-visit-date math (the project's own Pitfall 1 lesson from v1.3: "escolher uma autoridade e nunca duplicar a matemática no cliente")
- Compute "next occurrence of weekday X on/after date D" with `D + ((X - EXTRACT(dow FROM D)::int + 7) % 7)` — the standard PL/pgSQL idiom for this (no Postgres built-in equivalent to Oracle's `NEXT_DAY` exists), confirmed as the community-standard approach across multiple independent postgresql.org mailing-list threads and reference implementations
- Compute "Nth weekday of month" with `date_trunc('month', D) + (((X - EXTRACT(dow FROM date_trunc('month', D))::int + 7) % 7) + (N-1)*7) * interval '1 day'` — same idiom, offset by week-count; this needs a unit test (Vitest, calling the function through a local Supabase instance per the project's existing testing convention) for edge cases: month whose 1st Nth-weekday would fall in a 5-week span, and months where the target weekday's Nth occurrence doesn't exist (e.g. "5th Thursday of February") — decide and document the fallback (clamp to last occurrence, vs. no suggestion) as a planning-phase product decision, not a stack question
- Keep the same fuso-horário discipline already established: base date is always `(now() at time zone 'America/Sao_Paulo')::date`, never raw `now()` — this is the project's Pitfall 1 from v1.3 and applies identically here
- Keep the same "suggest, never auto-write" discipline: the fixed-anchor function feeds `agenda_do_vendedor()`'s `proxima_data_sugerida` column and/or a new "Agenda: clientes ativos sem frequência" query — `concluir_visita()` still takes the confirmed date as a parameter and never recomputes over the vendor's choice (v1.3 Key Decision, unchanged in v1.6)

## Version Compatibility

No new compatibility surface introduced. All packages involved (`@e965/xlsx@^0.20.3`, `papaparse@^5.5.4`, `date-fns@^4.4.0`, `next@16.2.10`, `@supabase/supabase-js@^2.110.5`) are already pinned and working together in this codebase across 5 prior milestones; this milestone adds Postgres functions and Server Actions/components following the same shapes, not new package versions to reconcile.

## Sources

- Direct codebase inspection (HIGH confidence — primary source): `supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql` (`proxima_data_visita()`, `mover_card_funil` guard pattern), `0015_conclusao_com_resumo.sql` (`concluir_visita()`, "suggest never auto-write" discipline, fuso horário discipline), `0019_importar_clientes_lote_cnpj_nome_fantasia.sql` (set-based import RPC shape), `package.json` (confirms `@e965/xlsx` + `papaparse` already installed), `lib/importacao/` and `app/actions/importacao*.ts` (confirms the 3-variant sibling-file pattern to mirror for a 4th)
- `.planning/PROJECT.md` Key Decisions table (HIGH confidence — primary source): confirms "sem cron/worker," "cálculo no Postgres nunca no navegador," "concluir é RPC atômica," and "planilha em massa nunca cria cliente novo fora do padrão UPDATE-only" precedents that bound this milestone's design space
- WebSearch: "PostgreSQL PL/pgSQL calculate next occurrence Nth weekday of month recurrence date_trunc" — multiple independent postgresql.org mailing-list threads and community reference implementations (`nth_dow_of_month`/`first_dow_of_month` pattern, `to_char(...,'W')` + `rank()` alternative) converging on the same `date_trunc` + modulo-arithmetic idiom, with no Postgres built-in equivalent to Oracle's `NEXT_DAY`. Confidence: LOW per the project's raw-websearch classification tier, though cross-checked across independent sources converging on the same idiom — treat the exact SQL expression as a starting point to test, not copy verbatim
- npm registry (implicit, via already-committed `package.json`) — version numbers for reused packages. Confidence: HIGH (already running in production across 5 milestones)

---
*Stack research for: bulk-import variant + fixed-anchor recurring scheduling (CRM Raiar v1.6)*
*Researched: 2026-08-24*
