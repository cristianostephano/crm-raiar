# Phase 24: Dia Fixo na Recorrência de Visita - Research

**Researched:** 2026-08-26
**Domain:** PL/pgSQL calendar math (next occurrence of a fixed weekday / Nth-weekday-of-month) extending an existing single-authority Postgres function, in a Next.js 16 + Supabase CRM
**Confidence:** HIGH

## Summary

This phase rewrites `proxima_data_visita()` — today a one-line fixed-offset function (`+7/+14 dias`, `+1 mês`) — into a function that can also compute "the next occurrence of a fixed weekday" (semanal/quinzenal) and "the next occurrence of the Nth (or last) weekday of the month" (mensal). The two calculation paths must coexist in the same function: clients without an anchor set keep getting the byte-for-byte old fixed-offset result (D-01), and clients with an anchor get the new weekday-search result. Every claim about which calendar-math edge case is real vs. imagined has been checked either by exhaustive reasoning about days-per-month (28–31) or by direct date computation (Node's `Date`, UTC-anchored, used only as a scratch calculator for this research — never as a pattern to replicate in application code, which has its own documented `parseISO`-only rule).

The concrete finding that most changes the plan: **1st/2nd/3rd/4th occurrence of any weekday exists in every month, unconditionally** (proven below) — so only "última" needs genuinely different logic (counting backward from month-end), not "quarta." This confirms the product's own out-of-scope line ("1ª/2ª/3ª/4ª/Última, nunca 5ª") is exactly the right cut: 5ª is the only ordinal that sometimes doesn't exist, and "última" is not a synonym for "quarta" — in months where a weekday occurs 5 times, "última" and "quarta" diverge (concrete example below: October 2026, Thursdays 1/8/15/22/29 — "quarta" = 22, "última" = 29).

**Primary recommendation:** Extend `proxima_data_visita` with two new optional parameters (`p_dia_semana dia_semana_enum default null`, `p_semana_do_mes semana_do_mes_enum default null`), keep it the sole authority (single function, no duplicate math in `mover_card_funil`/`agenda_do_vendedor`), rewrite it as `language plpgsql immutable` (the branching no longer fits a single `language sql` `CASE`), and add two small pure helper functions (`dia_semana_para_dow`, `nth_dia_semana_do_mes`) that are shared computation, not duplicated guards — consistent with this codebase's established "guards are duplicated, computation is extracted" convention.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Next occurrence of fixed weekday/Nth-weekday-of-month" date math | Database / Storage (Postgres PL/pgSQL) | — | Project-wide rule: "data que afeta correção de dado é calculada no Postgres, nunca no navegador" (STATE.md); `proxima_data_visita` is the documented single authority, called from both `mover_card_funil` (API/Backend tier RPC) and `agenda_do_vendedor()` |
| Anchor selection UI (dia da semana / semana do mês Selects) | Browser / Client (React) | — | Pure form input, mirrors the existing `frequencia_visita` Select in `ClienteDetailSheet.tsx` (line ~1097) |
| Anchor persistence (write `dia_semana_visita`/`semana_do_mes_visita`) | API / Backend (Server Action → RLS-gated `UPDATE`) | — | Extends `atualizarFrequenciaVisita` (`app/actions/clientes.ts`), a plain single-row `UPDATE` under RLS — no RPC needed, same reasoning already documented for `frequencia_visita` itself |
| "Sem dia fixo" Agenda nudge list | API / Backend (narrow `SELECT` query) | Browser (new Agenda section, `lib/agenda/itens.ts` pure function) | Flat single-table filter over `clientes`, RLS already scopes vendedor/supervisor visibility — no RPC (this codebase reserves RPCs for writes needing atomicity/guards or reads needing cross-table UNION; this is neither) |
| First-visita seeding at "ganho" transition | Database (RPC `mover_card_funil`) | — | Unchanged ownership; only needs to also read+pass the (usually still-null) anchor columns to `proxima_data_visita` for correctness in the re-ganho-after-perdido edge case |
| Next-visit suggestion shown in Agenda | Database (RPC `agenda_do_vendedor`) | Browser (`lib/agenda/itens.ts` renders it, never recomputes it — Pitfall 1 discipline already documented inline in `AgendaItem.proximaDataSugerida`) | Unchanged ownership; only the SQL expression's argument list grows |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (fallback):** Um cliente ativo com frequência já definida mas SEM dia fixo (o estado de TODO cliente ativo hoje) continua recebendo a sugestão pelo cálculo ANTIGO (dias corridos) até o vendedor definir o dia fixo. `proxima_data_visita` precisa dos dois caminhos: com âncora e sem âncora (fallback = comportamento atual, intocado byte a byte).
- **D-02 (onde definir):** O dia fixo se define num ÚNICO lugar — ao lado do Select de frequência de visita já existente na ficha do cliente (`ClienteDetailSheet.tsx`). O aviso da Agenda é só um link para essa mesma ficha, nunca um formulário duplicado.
- **D-03 (aviso da Agenda):** A Lista da Agenda (não o Calendário) ganha uma seção própria listando clientes ativos sem dia fixo — cobre quem nunca teve frequência definida E quem já tem frequência mas falta só o dia fixo. Cada item leva para a ficha do cliente; sem input inline na própria linha.
- **D-04 (sem recálculo retroativo):** Se um cliente já tem uma próxima visita marcada (calculada pelo jeito antigo) e o vendedor define o dia fixo agora, a data JÁ marcada não muda. O dia fixo só rege a visita SEGUINTE, após a atual ser concluída.

### Claude's Discretion

- Texto/rótulo exato da nova seção da Agenda.
- Layout exato do Select de dia fixo/semana do mês na ficha do cliente.
- **Algoritmo exato de "próxima ocorrência do dia fixo" em PL/pgSQL** — esta pesquisa resolve este ponto em detalhe.
- Nomenclatura exata das colunas/enums novos em `clientes` (português, minúsculo, snake_case).

### Deferred Ideas (OUT OF SCOPE)

Nenhuma — as 4 áreas discutidas ficaram inteiramente dentro do domínio da Fase 24 (ANCORA-01..04, AGENDA-01).
</user_constraints>

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANCORA-01 | Frequência semanal/quinzenal exige dia fixo da semana | `dia_semana_enum` column + "next fixed weekday" algorithm (Section 1 below) |
| ANCORA-02 | Frequência mensal exige semana do mês (1ª/2ª/3ª/4ª/Última) + dia da semana | `semana_do_mes_enum` column + `nth_dia_semana_do_mes` helper (Section 2 below) |
| ANCORA-03 | Sugestão de próxima data sempre mira o dia fixo, nunca conta dias corridos | Rewritten `proxima_data_visita`, both call sites (`mover_card_funil`, `agenda_do_vendedor`) updated in the same migration |
| ANCORA-04 | Nunca sugerir data no passado | Never-past-date guard (Section 3): `<=` roll-forward check on every path (weekly, biweekly, monthly) |
| AGENDA-01 | Vendedor vê clientes ativos sem dia fixo (nunca teve frequência OU tem frequência sem âncora) | New flat `SELECT` predicate (Section 5), new pure type/function in `lib/agenda/itens.ts` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- TypeScript estrito, sem `any` sem justificativa — applies to any new TS type guards (`isDiaSemanaVisita`, `isSemanaDoMesVisita`) mirroring `isFrequenciaVisita`.
- Toda tabela/coluna nova precisa de RLS — não se aplica uma policy nova aqui (as duas colunas novas vivem em `clientes`, já coberto pelas 4 policies existentes de `0002_clientes_and_funil.sql`; nenhuma tabela nova é criada nesta fase).
- Migrations sempre versionadas, nunca editar uma já aplicada — a próxima migration deste projeto é `0026_*.sql` (a última aplicada é `0025_ganho_exige_razao_social_e_endereco.sql`, Fase 23).
- Toda funcionalidade nova precisa de teste automatizado antes de "concluída" — ver `## Validation Architecture` abaixo.
- Sem novo serviço/dependência externa sem discutir custo — esta fase não adiciona nenhuma (PL/pgSQL nativo, zero pacote novo).
- Não implementar autorização por conta própria — a leitura/escrita das duas colunas novas continua inteiramente sob a RLS já existente de `clientes`, nenhuma checagem de papel nova no corpo de nenhuma função.

## Standard Stack

### Core

Nenhuma biblioteca nova. Esta fase é 100% PL/pgSQL nativo do Postgres (já em uso desde a migration 0001) + extensões pontuais de TypeScript puro já existentes (`lib/funil/frequencia.ts`-style vocabulário, `lib/agenda/itens.ts`).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Postgres (via Supabase) | já em produção | `date`/`interval` arithmetic, `EXTRACT(dow FROM ...)`, `make_date` | Já é a única autoridade de cálculo de data do projeto; nenhuma extensão (`pg_cron`, `rrule`) foi necessária nas 24 migrations anteriores e não é necessária aqui — `SUMMARY.md` já rejeitou explicitamente qualquer biblioteca de recorrência |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written PL/pgSQL Nth-weekday search | `rrule.js`/`node-cron`-style recurrence library in the Server Action layer | Rejected — moves date math to the browser/Node tier, violating the project's own "cálculo no Postgres, nunca no navegador" rule and duplicating the single-authority pattern `proxima_data_visita` already established |
| Postgres enum for `dia_semana_visita`/`semana_do_mes_visita` | `smallint` + `CHECK (value BETWEEN 0 AND 6)` | Enum wins: matches every closed-vocabulary column in this project (`frequencia_visita_enum`, `etapa_funil`, `status_acompanhamento_enum`), and Postgres rejects an invalid label at the type level before the guard even runs — a `CHECK` constraint would need to be written and validated separately, and a `smallint` needs an explicit "is Monday 0 or 1" convention that an enum with named labels avoids entirely |

**Installation:** none — no `npm install`, no new Supabase extension.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm/PyPI/crates dependencies. All work is native Postgres PL/pgSQL plus TypeScript in already-established project modules.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ ClienteDetailSheet.tsx (ficha do cliente)                            │
│  Select "Frequência de visita" (existente, ~linha 1097)              │
│  + NOVO: Select "Dia da semana" (semanal/quinzenal/mensal)            │
│  + NOVO: Select "Semana do mês" (só mensal: 1ª/2ª/3ª/4ª/Última)       │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ handleFrequenciaChange / novo handler
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ app/actions/clientes.ts                                              │
│  atualizarFrequenciaVisita(clienteId, frequencia, diaSemana?,        │
│    semanaDoMes?) — ainda um UPDATE simples, RLS como única fronteira │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ clientes.dia_semana_visita / clientes.semana_do_mes_visita (NOVAS,   │
│  nullable, lidas por RLS já existente)                                │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ lido por
              ┌──────────────────┴───────────────────┐
              ▼                                       ▼
┌───────────────────────────┐         ┌───────────────────────────────┐
│ mover_card_funil()         │         │ agenda_do_vendedor()           │
│ (seed da 1ª visita ao      │         │ (proxima_data_sugerida, coluna │
│  ganho — quase sempre       │         │  mostrada na Agenda)           │
│  âncora ainda nula aqui)    │         │                                 │
└──────────────┬──────────────┘         └───────────────┬─────────────────┘
               └───────────────┬────────────────────────┘
                                ▼
                 proxima_data_visita(p_base, p_frequencia,
                                     p_dia_semana, p_semana_do_mes)
                     │ p_dia_semana IS NULL?
                     ├── SIM → fallback antigo (+7/+14 dias, +1 mês) — D-01
                     └── NÃO → busca de ocorrência (weekly/biweekly/monthly)
                                │
                                ├── semanal/quinzenal → deslocamento modular
                                │    sobre EXTRACT(dow FROM p_base)
                                └── mensal → nth_dia_semana_do_mes(ano, mês,
                                     dow, semana) + rollover para o mês
                                     seguinte se candidata <= p_base

┌─────────────────────────────────────────────────────────────────────┐
│ Agenda (Lista) — nova seção "sem dia fixo definido"                   │
│  getClientesAtivosSemFrequenciaOuAncora() — SELECT plano, sem RPC      │
│  predicado: ganho AND (frequencia IS NULL OR                          │
│              (frequencia <> 'nenhuma' AND dia_semana_visita IS NULL)) │
│  clique no item → ClienteDetailSheet (mesma ficha, D-02/D-03)         │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Nenhuma pasta nova. Arquivos tocados/estendidos:
```
supabase/migrations/
└── 0026_dia_fixo_visita.sql          # NOVO — enums, colunas, helpers, rewrite

lib/funil/
└── diaFixo.ts                        # NOVO — vocabulário puro (mirrors frequencia.ts)

lib/agenda/
└── itens.ts                          # ESTENDIDO — novo tipo + função pura "sem dia fixo"

lib/supabase/queries/
└── clientes.ts (ou agenda.ts)        # ESTENDIDO — getClientesAtivosSemDiaFixo()

app/actions/
└── clientes.ts                       # ESTENDIDO — atualizarFrequenciaVisita aceita 2 campos novos

components/clientes/
└── ClienteDetailSheet.tsx            # ESTENDIDO — 2 Selects novos ao lado do existente

components/agenda/
└── (novo componente de seção)        # NOVO — lista "sem dia fixo"
```

### Pattern 1: Fallback-first branching inside the single-authority function

**What:** `proxima_data_visita` checks `p_dia_semana IS NULL` FIRST and returns the exact old `CASE` expression unchanged in that branch — never a re-derivation of the old logic, the literal same three lines.
**When to use:** Always, per D-01. This is also what keeps the entire existing test suite (`tests/clientes/frequencia-visita.test.ts`) green with zero edits — those tests call the RPC without `p_dia_semana`, so they exercise exactly the preserved fallback branch. Treat that test file as a **regression oracle**: if any of its assertions change behavior, the fallback path has been broken.
**Example:**
```sql
-- Source: supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql (unchanged logic, now branch 1 of 2)
if p_dia_semana is null then
  return case p_frequencia
    when 'semanal' then (p_base + interval '7 days')::date
    when 'quinzenal' then (p_base + interval '14 days')::date
    when 'mensal' then (p_base + interval '1 month')::date
    else null
  end;
end if;
```

### Pattern 2: Weekday-to-integer mapping via explicit CASE, never implicit enum ordinal

**What:** Postgres enum labels do **not** carry an automatic numeric value equal to their declaration order in any way the application should rely on (the internal `enumsortorder` is a `float4` used for internal ordering machinery, not a stable public "index"). Map `dia_semana_enum` → Postgres's own `EXTRACT(dow FROM date)` convention (0=domingo..6=sábado) with one explicit, named helper function.
**When to use:** Every place that needs an integer day-of-week from the enum — both the weekly and monthly branches share this one helper (extracted computation, not duplicated, per this codebase's Pattern 2 in `ARCHITECTURE.md`: "guards are duplicated verbatim, pure computation IS extracted").
**Example:**
```sql
-- Source: NEW — codebase pattern extension (dia_semana_visita is the new
-- enum; Postgres EXTRACT(dow FROM ...) already returns 0=domingo..6=sábado,
-- confirmed via https://www.postgresql.org/docs/current/functions-datetime.html
-- date/time function reference (`dow`: "day of the week as Sunday (0) to
-- Saturday (6)")
create or replace function dia_semana_para_dow(p_dia dia_semana_enum)
returns int
language sql
immutable
as $$
  select case p_dia
    when 'domingo' then 0
    when 'segunda' then 1
    when 'terca'   then 2
    when 'quarta'  then 3
    when 'quinta'  then 4
    when 'sexta'   then 5
    when 'sabado'  then 6
  end;
$$;
```
`[CITED: postgresql.org/docs/current/functions-datetime.html]` — `EXTRACT(dow FROM ...)` is documented to return 0 (Sunday) through 6 (Saturday) for the `date`/`timestamp` types this project uses (never `isodow`, which is 1–7 and would require a different mapping — confirm the migration uses `dow`, not `isodow`, consistently everywhere).

### Pattern 3: "Never returns today-or-earlier" via strict modular offset (weekly/biweekly)

**What:** Computing `((target_dow - current_dow) + 7) % 7` gives an offset in `[0, 6]` — and `0` means "today IS the target weekday," which must roll forward to `+7`, never return `0`. The resulting offset is therefore always in `[1, 7]`, so `p_base + offset` is **always strictly greater than `p_base`** by construction — the same "free" guarantee the old fixed-offset code had, reconstructed explicitly rather than lost.
**When to use:** The `semanal`/`quinzenal` branch of `proxima_data_visita`.
**Verified test vectors** (computed via direct date arithmetic, cross-checked against calendar reasoning — not training-data recall):

| p_base | p_base weekday | target `dia_semana` | expected result | why |
|--------|-----------------|----------------------|------------------|-----|
| `2026-08-26` | quarta (dow=3) | quinta (dow=4) | `2026-08-27` | offset = (4-3+7)%7 = 1 |
| `2026-08-27` | **quinta** (dow=4) | quinta (dow=4) | `2026-09-03` (NOT `2026-08-27`) | offset would be 0 → rolled to 7; proves the "completes exactly on the target day" edge case never returns the same day |
| `2026-08-31` | segunda (dow=1) | quinta (dow=4), already passed this week | `2026-09-03` | offset = (4-1+7)%7 = 3; proves "already passed this cycle" never returns a past date |

For `quinzenal`, add exactly 7 more days on top of the weekly result (see Section 1 below for the reasoning) — e.g. `2026-08-26` + quinta → weekly result `2026-08-27`, quinzenal result `2026-09-03` (8 days out, not 1).

**Example:**
```sql
-- Source: NEW algorithm for this phase
v_dow := dia_semana_para_dow(p_dia_semana);
v_offset := ((v_dow - extract(dow from p_base)::int) + 7) % 7;
if v_offset = 0 then
  v_offset := 7;
end if;
v_candidata := p_base + v_offset;
if p_frequencia = 'quinzenal' then
  v_candidata := v_candidata + 7;
end if;
```

### Pattern 4: Nth-weekday-of-month via a single explicit "first occurrence, then +7*(N-1)" computation, and "última" as an independent backward count

**What:** Do not treat "última" as "quarta, or 5th if it exists" via a conditional — compute it independently by walking backward from the last day of the month. This is not an optimization; it's a correctness requirement (see the proof in Section 2 below that "última" and "quarta" are genuinely different dates in some months).
**When to use:** The `mensal` branch, inside a small pure helper (`nth_dia_semana_do_mes`) that receives an explicit year/month (not a date, to avoid re-deriving month boundaries twice) and is called once for the base month and, if needed, once more for the rollover month.
**Example:**
```sql
-- Source: NEW algorithm for this phase
create or replace function nth_dia_semana_do_mes(
  p_ano int,
  p_mes int,
  p_dow int,               -- 0=domingo..6=sabado (via dia_semana_para_dow)
  p_semana semana_do_mes_enum
)
returns date
language sql
immutable
as $$
  with limites as (
    select
      make_date(p_ano, p_mes, 1) as primeiro_dia,
      (make_date(p_ano, p_mes, 1) + interval '1 month - 1 day')::date as ultimo_dia
  ),
  ocorrencias as (
    select
      primeiro_dia + (((p_dow - extract(dow from primeiro_dia)::int) + 7) % 7) as primeira_ocorrencia,
      ultimo_dia
    from limites
  )
  select case p_semana
    when 'primeira' then primeira_ocorrencia
    when 'segunda'  then primeira_ocorrencia + 7
    when 'terceira' then primeira_ocorrencia + 14
    when 'quarta'   then primeira_ocorrencia + 21
    when 'ultima'   then ultimo_dia - (((extract(dow from ultimo_dia)::int - p_dow) + 7) % 7)
  end
  from ocorrencias;
$$;
```

### Pattern 5: Roll-forward-to-next-month guard applied uniformly after the monthly candidate is computed

**What:** Compute the candidate for `p_base`'s own month first; if `candidata <= p_base` (covers both "already passed this month" and "completing exactly on the target day"), recompute for the following month (handling December→January year rollover explicitly).
**Example:**
```sql
-- Source: NEW algorithm for this phase
v_ano := extract(year from p_base)::int;
v_mes := extract(month from p_base)::int;
v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);

if v_candidata <= p_base then
  if v_mes = 12 then
    v_ano := v_ano + 1;
    v_mes := 1;
  else
    v_mes := v_mes + 1;
  end if;
  v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);
end if;

return v_candidata;
```

### Anti-Patterns to Avoid

- **Deriving `dia_semana_enum`'s integer value from its declared position in the `CREATE TYPE` statement:** Postgres does not guarantee this maps to any calendar convention, and a future contributor could reorder the enum's declared labels (Postgres actually forbids reordering an existing enum's labels without `ALTER TYPE ... ADD VALUE ... BEFORE/AFTER`, but relying on an implicit mapping at all is the anti-pattern — always go through the explicit `dia_semana_para_dow` CASE).
- **Treating "última" as `quarta_ocorrencia OR quinta_ocorrencia_se_existir`:** this conditional-with-a-maybe shape is exactly the kind of "looks done, isn't" bug Pitfall 3 warns about — write it as the independent backward-count formula instead, which needs no existence check at all (the last day of the month always exists, so counting backward from it always produces a valid date).
- **Computing the monthly candidate only once, without the `<= p_base` rollover check:** this is the literal Pitfall 3 failure mode ("vendedor completes late in the month, naive search returns a date already in the past").
- **Rewriting `proxima_data_visita` as `language sql` with nested `CASE`/subqueries instead of `plpgsql`:** technically possible (Postgres SQL functions can use `WITH`/`CASE` to express branching), but the two-branch-with-rollover shape is materially harder to read and test as one giant SQL expression than as a short `plpgsql` function with named variables. This project has never had a `plpgsql`-vs-`sql` purity rule for pure functions — `mover_card_funil`/`concluir_visita` are already `plpgsql`; only `proxima_data_visita`/`agenda_do_vendedor` happened to be simple enough for `language sql` before. Switching `proxima_data_visita` to `plpgsql` is a deliberate, documented choice, not an accidental deviation — flag it in the migration's header comment the same way this project documents every other deliberate deviation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weekday-of-month recurrence | A generic RRULE-style recurrence engine, or a JS date library doing the search in the Server Action layer | The two small PL/pgSQL helpers above | Already rejected by milestone-level research (`SUMMARY.md`): "the two recurrence shapes needed... are small and fixed enough that a ~15-line SQL function beats a general-purpose engine"; also keeps the single-authority/server-computed-date rule intact |
| Day-of-week integer mapping | Trusting enum declaration order, or a lookup table joined at query time | The explicit `dia_semana_para_dow` CASE (Pattern 2) | A CASE is `immutable`, needs no table access, and is trivially unit-testable via direct RPC calls, same posture as every other pure helper in this codebase |

**Key insight:** every piece of this phase's math is expressible as pure, `immutable`, no-table-access SQL/plpgsql — there is no reason to reach for a stateful or external solution anywhere in this phase.

## Common Pitfalls

### Pitfall 1: Assuming "última" is interchangeable with "quarta"

**What goes wrong:** A guard or UI copy that treats "Última" as just a friendly label for "a quarta ocorrência" silently returns the wrong date in any month where the target weekday occurs 5 times.
**Why it happens:** Most months (28-day February, and any month/weekday pair where the weekday's first occurrence in the month starts late enough) DO have "última = quarta" — so a developer testing only 1-2 cases can easily miss the divergence.
**How to avoid:** Use the independent backward-count formula (Pattern 4) — it is correct in 100% of cases and costs nothing extra when última and quarta happen to coincide.
**Warning signs:** A test suite where every "última" test case happens to be a 28-day-February or otherwise a month where última==quarta.
**Verified divergent case (computed, not assumed):** October 2026 — Oct 1 is a quinta (dow=4), and the month has 31 days, so quinta occurs on **1, 8, 15, 22, 29** (5 times, since day-1's weekday gets a 5th occurrence in any 31-day month). "Quarta quinta de outubro/2026" = `2026-10-22`. "Última quinta de outubro/2026" = `2026-10-29`. These are 7 days apart — a guard that conflates them is off by a full week in this exact, reproducible case.

### Pitfall 2: Losing the "never returns today-or-earlier" guarantee that pure-offset math got for free

**What goes wrong:** The old `proxima_data_visita` can never return a non-future date because adding a positive interval to a date is monotonic — there is zero code enforcing "never past," it's a structural side effect of `+`. The new weekday-search code has no such free guarantee; every branch needs its own explicit `<=`-based roll-forward.
**How to avoid:** Verify, for each of the three new branches (weekly, biweekly, monthly), that the guard produces a **strict** future date even in the exact-match/late-completion edge cases (Patterns 3 and 5 above already build this in — the point here is to test it explicitly, not just implement it and assume it's covered).
**Warning signs:** A test suite where `p_base` always falls comfortably before the target occurrence — the "boring", accidentally-always-passing shape `PITFALLS.md` (milestone-level) already called out for this exact function.

### Pitfall 3: `EXTRACT(dow ...)` vs `EXTRACT(isodow ...)` confusion

**What goes wrong:** Postgres has two different day-of-week extraction fields: `dow` (0=Sunday..6=Saturday) and `isodow` (1=Monday..7=Sunday, ISO 8601 convention). Mixing them anywhere in the same computation silently shifts every result by one day in unpredictable ways.
**How to avoid:** Use `dow` exclusively (matches the `dia_semana_para_dow` mapping above and needs no special-casing for Sunday), and never introduce `isodow` anywhere in this phase's SQL. Note: `lib/agenda/itens.ts`'s `INICIO_DA_SEMANA = 1` (Monday) is a *different, unrelated* concept — it's the calendar grid's display start-of-week for the UI, computed by `date-fns`'s `startOfWeek`, and has no relationship to which Postgres field this migration uses. Do not let the two get confused: the SQL enum's day-of-week integer mapping and the calendar grid's Monday-first display convention are two independent decisions in two independent layers.
**Warning signs:** Any SQL in this migration using `isodow`, or any off-by-one-day result in manual testing.

### Pitfall 4: Timezone/date-type drift at the call sites

**What goes wrong:** `proxima_data_visita` itself stays timezone-agnostic (it only ever receives a `date` typed `p_base` — dates have no timezone component in Postgres). The risk is entirely in the **callers**: if a future edit to `mover_card_funil` or `agenda_do_vendedor` (or this migration's own rewrite of them) passes `now()::date` instead of `(now() at time zone 'America/Sao_Paulo')::date`, the "today" fed into the function silently shifts by a day after 21h local time — this is the exact, already-documented Pitfall 1 from the v1.3 research, and it must survive this rewrite unchanged.
**How to avoid:** Grep both call sites after editing (`mover_card_funil`, `agenda_do_vendedor`) and confirm both still read `(now() at time zone 'America/Sao_Paulo')::date` — this migration should not introduce a third call site with a fresh copy of this expression that could diverge; consider whether it's worth documenting the exact string as a comment-level cross-reference (this codebase already does this kind of cross-referencing for guards, e.g. migration 0025's header).
**Warning signs:** Any new `now()::date` (no `at time zone`) appearing in a `git diff` of this migration.

### Pitfall 5: Forgetting `mover_card_funil` needs to read (not necessarily use) the anchor columns

**What goes wrong:** Because the anchor Select only appears in `ClienteDetailSheet.tsx` inside the `cliente.statusAcompanhamento === 'ganho'` block, a client is anchor-less at the *moment* it first transitions to "ganho" — so `mover_card_funil`'s visita-seeding call to `proxima_data_visita` will, in the overwhelmingly common case, still hit the fallback branch (D-01) even after this migration ships. It's tempting to conclude `mover_card_funil` "doesn't need to change." It does, for one edge case: a client that WAS "ganho" (and had an anchor set), got moved away from "ganho" (e.g. back to `em_andamento`), and is later re-marked "ganho" — the transition guard's own `v_status_atual is distinct from 'ganho'` condition (0018/0025) proves this path is reachable. In that case the anchor columns already hold real values on the row, and the seed calculation should use them.
**How to avoid:** Extend `mover_card_funil`'s existing `select ... into` (the one already reading `razao_social`/endereço per migration 0025) to also read `dia_semana_visita`, `semana_do_mes_visita`, and pass them into the `proxima_data_visita` call in the seeding block. Same parameter count (still 7 — no signature change, no `drop function` needed), only the body changes, same as 0025's own note about itself.
**Warning signs:** A plan that lists `mover_card_funil` as "not touched" for this phase.

## Runtime State Inventory

Not applicable — this is a greenfield schema addition (2 new nullable columns + 2 new enum types), not a rename/refactor/migration of existing identifiers. No runtime state outside the `clientes` table stores anything related to "dia fixo" today, since the concept doesn't exist yet.

## Code Examples

### Full proposed `proxima_data_visita` (drop-in replacement, signature grows from 2 to 4 params)

```sql
-- Source: NEW for this phase — combines Patterns 1, 2 (via helper), 3, 4, 5.
-- drop needed because parameter count changes (2 -> 4), same discipline as
-- migrations 0013/0018/0022 already document for this exact class of change.
drop function if exists proxima_data_visita(date, frequencia_visita_enum);

create or replace function proxima_data_visita(
  p_base date,
  p_frequencia frequencia_visita_enum,
  p_dia_semana dia_semana_enum default null,
  p_semana_do_mes semana_do_mes_enum default null
)
returns date
language plpgsql
immutable
as $$
declare
  v_dow int;
  v_offset int;
  v_candidata date;
  v_ano int;
  v_mes int;
begin
  -- D-01: sem âncora, comportamento antigo, byte a byte (Pattern 1).
  if p_dia_semana is null then
    return case p_frequencia
      when 'semanal' then (p_base + interval '7 days')::date
      when 'quinzenal' then (p_base + interval '14 days')::date
      when 'mensal' then (p_base + interval '1 month')::date
      else null
    end;
  end if;

  if p_frequencia is null or p_frequencia = 'nenhuma' then
    return null;
  end if;

  v_dow := dia_semana_para_dow(p_dia_semana);

  if p_frequencia in ('semanal', 'quinzenal') then
    v_offset := ((v_dow - extract(dow from p_base)::int) + 7) % 7;
    if v_offset = 0 then
      v_offset := 7;
    end if;
    v_candidata := p_base + v_offset;

    if p_frequencia = 'quinzenal' then
      v_candidata := v_candidata + 7;
    end if;

    return v_candidata;
  end if;

  -- mensal
  v_ano := extract(year from p_base)::int;
  v_mes := extract(month from p_base)::int;
  v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);

  if v_candidata <= p_base then
    if v_mes = 12 then
      v_ano := v_ano + 1;
      v_mes := 1;
    else
      v_mes := v_mes + 1;
    end if;
    v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);
  end if;

  return v_candidata;
end;
$$;
```

### Verified end-to-end test vectors for the planner's test file

All computed via direct date arithmetic (Node `Date`, UTC-anchored — a scratch calculator for this research only, never a pattern for application code), cross-checked against the days-per-month proof in Section 2.

| Scenario | `p_base` | `p_frequencia` | `p_dia_semana` | `p_semana_do_mes` | Expected |
|----------|----------|-----------------|-----------------|--------------------|----------|
| Weekly, simple forward | `2026-08-26` (quarta) | semanal | quinta | — | `2026-08-27` |
| Weekly, completes exactly on target day | `2026-08-27` (quinta) | semanal | quinta | — | `2026-09-03` (NOT same day) |
| Weekly, target already passed this week | `2026-08-31` (segunda) | semanal | quinta | — | `2026-09-03` |
| Biweekly, simple | `2026-08-26` (quarta) | quinzenal | quinta | — | `2026-09-03` (8 dias, não 1) |
| Monthly, 1st occurrence still ahead | `2026-08-01` | mensal | quinta | primeira | `2026-08-06` |
| Monthly, all occurrences already passed → rolls to next month | `2026-08-29` | mensal | quinta | primeira | `2026-09-03` |
| Monthly, "quarta" vs "última" divergence | `2026-10-01` | mensal | quinta | quarta | `2026-10-22` |
| Monthly, same base, "última" | `2026-10-01` | mensal | quinta | ultima | `2026-10-29` (≠ quarta result above) |
| Existing fallback regression (no anchor) | `2026-01-31` | mensal | — (null) | — (null) | `2026-02-28` (unchanged from `tests/clientes/frequencia-visita.test.ts`) |

### Extending the existing test file's pattern

```typescript
// Source: mirrors the existing style in tests/clientes/frequencia-visita.test.ts
// (direct RPC call via a signed-in Supabase client against the local instance)
describe("proxima_data_visita: dia fixo semanal/quinzenal (ANCORA-01/03/04)", () => {
  it("nunca retorna o mesmo dia quando a conclusão cai no próprio dia-alvo", async () => {
    const vendedorA = await signInAs(SEED_ACCOUNTS.vendedorA.email, SEED_ACCOUNTS.vendedorA.password)
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-08-27", // quinta-feira
      p_frequencia: "semanal",
      p_dia_semana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-03")
  })
})

describe("proxima_data_visita: mensal 'última' diverge de 'quarta' (ANCORA-02/04)", () => {
  it("outubro/2026: quarta quinta = 22, última quinta = 29", async () => {
    const vendedorA = await signInAs(SEED_ACCOUNTS.vendedorA.email, SEED_ACCOUNTS.vendedorA.password)
    const quarta = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-10-01", p_frequencia: "mensal", p_dia_semana: "quinta", p_semana_do_mes: "quarta",
    })
    const ultima = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-10-01", p_frequencia: "mensal", p_dia_semana: "quinta", p_semana_do_mes: "ultima",
    })
    expect(quarta.data).toBe("2026-10-22")
    expect(ultima.data).toBe("2026-10-29")
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `proxima_data_visita(date, frequencia_visita_enum)` — fixed offset only | `proxima_data_visita(date, frequencia_visita_enum, dia_semana_enum, semana_do_mes_enum)` — offset OR weekday-search, chosen by whether an anchor is present | This phase (Fase 24) | Every caller (`mover_card_funil`, `agenda_do_vendedor`) must pass the two new columns; old callers/tests that omit them keep working unchanged (default `null`) |

**Deprecated/outdated:** none — the old fixed-offset math is not removed, it becomes the explicit D-01 fallback branch and stays load-bearing indefinitely for any client that never sets an anchor.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Quinzenal recurrence needs no extra anchor/state column — "skip one occurrence, land on the next" (always 8–14 days from the completion date) is an acceptable interpretation of "quinzenal com dia fixo" | Pattern 3 / Section 1 | If the product owner actually wants calendar-fixed biweekly parity (e.g. "always the 2nd and 4th Thursday of the month," independent of when visits get completed), this simplification would produce dates that drift relative to that expectation over several cycles. Low risk: `concluir_visita` always requires vendedor confirmation of the suggested date (never silent), so a wrong suggestion is corrected on the spot, not silently applied — and CONTEXT.md explicitly delegates this exact algorithm choice to "Claude's Discretion" as an implementation detail, not a locked product decision |
| A2 | `dia_semana_visita`/`semana_do_mes_visita` are the right column names (mirrors `frequencia_visita`'s "`<atributo>_visita`" naming) | Schema shape / Architecture | Low risk — CONTEXT.md explicitly defers exact naming to convention-following discretion; any consistent snake_case Portuguese name works equally well for the algorithm itself |
| A3 | `mover_card_funil` needs to read (not just leave untouched) the two new anchor columns, for the re-ganho-after-perdido edge case | Pitfall 5 | If wrong (i.e., if a "ganho → não-ganho → ganho novamente" cycle is actually impossible in this codebase's guards), this is extra-defensive code with zero behavioral cost — not a correctness risk either way |

**Overall:** every claim about calendar arithmetic itself (Nth-weekday existence, "última" ≠ "quarta" divergence, never-past guard shape) was verified by direct computation or exhaustive days-per-month reasoning in this session — none of those are tagged `[ASSUMED]`. Only the two schema/product-adjacent choices above carry residual uncertainty, and both are explicitly within CONTEXT.md's "Claude's Discretion" scope.

## Open Questions

1. **Should the "sem dia fixo" Agenda predicate also exclude clients whose `frequencia_visita = 'nenhuma'`?**
   - What we know: AGENDA-01's text says "clientes ativos ... ainda não têm dia fixo" and lists two cases (nunca teve frequência / tem frequência sem âncora). A client with `frequencia_visita = 'nenhuma'` has explicitly opted out of any recurring visit — the "dia fixo" concept doesn't apply to them at all.
   - What's unclear: whether "nenhuma" should be silently excluded from the nudge (recommended, since nagging about a setting the vendedor deliberately disabled would be noise) or is out of scope entirely (same outcome, different reasoning).
   - Recommendation: exclude `frequencia_visita = 'nenhuma'` from the predicate (Section 5 below) — treat this as a low-risk implementation detail, not a re-open of AGENDA-01's scope.
2. **Does `atualizar_frequencia_visita_lote` (the bulk spreadsheet path) need the two anchor columns too?**
   - What we know: `PROJECT.md`'s Out of Scope table explicitly rules out "planilha em massa para dia fixo/frequência" for this milestone.
   - What's unclear: nothing — this is already answered by REQUIREMENTS.md's Out of Scope table, listed here only so the planner doesn't accidentally re-derive ambiguity from `ARCHITECTURE.md`'s older "second open question" (written before REQUIREMENTS.md locked this).
   - Recommendation: do not touch `atualizar_frequencia_visita_lote` in this phase.

## Environment Availability

Skipped — this phase has no new external dependency (no new CLI, service, or runtime beyond the already-running local Supabase instance this project's whole test suite already depends on).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (already configured, `vitest.config.ts`) |
| Config file | `vitest.config.ts` (existing, no changes needed) |
| Quick run command | `npm test -- tests/clientes/dia-fixo-visita.test.ts` (new file, integration-style RPC calls against local Supabase, mirrors `tests/clientes/frequencia-visita.test.ts`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANCORA-01 | Semanal/quinzenal com dia fixo calcula corretamente | integration (RPC) | `npm test -- tests/clientes/dia-fixo-visita.test.ts -t "semanal"` | ❌ Wave 0 |
| ANCORA-02 | Mensal com semana+dia fixo calcula corretamente, incluindo "última" ≠ "quarta" | integration (RPC) | `npm test -- tests/clientes/dia-fixo-visita.test.ts -t "mensal"` | ❌ Wave 0 |
| ANCORA-03 | `agenda_do_vendedor`/`mover_card_funil` passam a âncora, nunca recalculam localmente | integration (RPC + existing `agenda-*` test conventions) | `npm test -- tests/agenda` | ✅ (extend existing files) |
| ANCORA-04 | Nunca retorna hoje/passado, em todos os 3 modos | integration (RPC), casos "completou tarde"/"completou no próprio dia-alvo" | `npm test -- tests/clientes/dia-fixo-visita.test.ts -t "nunca"` | ❌ Wave 0 |
| AGENDA-01 | Lista mostra clientes sem frequência E clientes com frequência sem âncora | unit (pure function in `lib/agenda/itens.ts`) + integration (query) | `npm test -- tests/agenda/itens.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** the new `tests/clientes/dia-fixo-visita.test.ts` file (fast, targeted)
- **Per wave merge:** `npm test -- tests/clientes tests/agenda` (this codebase's own documented Supabase-Auth-rate-limit mitigation strategy — isolate the risk files rather than always running the full suite, per multiple past phases' STATE.md notes)
- **Phase gate:** full `npm test` green before `/gsd-verify-work`, same discipline as every prior phase touching `mover_card_funil`

### Wave 0 Gaps

- [ ] `tests/clientes/dia-fixo-visita.test.ts` — new file, covers ANCORA-01/02/04 (weekly/biweekly/monthly + never-past-date + "última" ≠ "quarta")
- [ ] No new fixtures/conftest-equivalent needed — reuses `SEED_ACCOUNTS`/`signInAs` from existing test helpers (`tests/helpers/`)
- [ ] Framework install: none — Vitest already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — no auth surface touched |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Existing RLS policies on `clientes` (migration 0002) already gate read/write of the two new columns — vendedor sees/edits own rows, supervisor sees/edits all. No new policy needed since no new table is created |
| V5 Input Validation | yes | Postgres enum types (`dia_semana_enum`, `semana_do_mes_enum`) reject any out-of-range value at the type/RPC boundary before application code runs; mirror `isFrequenciaVisita`'s defense-in-depth pattern with `isDiaSemanaVisita`/`isSemanaDoMesVisita` type guards in the extended `atualizarFrequenciaVisita` Server Action, per this codebase's stated "Server Action nunca confia no que veio do navegador, mesmo tipado" convention |
| V6 Cryptography | no | Not applicable — no secrets/crypto involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered/out-of-range `dia_semana`/`semana_do_mes` value sent to the Server Action | Tampering | Postgres enum type rejects any label outside the declared set at the database boundary (structural, not a business-logic check); TypeScript-side `isDiaSemanaVisita` guard rejects it earlier, mirroring `isFrequenciaVisita` |
| A vendedor attempting to set the anchor on a client they don't own | Elevation of Privilege | Already covered — the existing `clientes` UPDATE RLS policy (`responsavel = auth.uid() or is_supervisor()`) scopes the plain `UPDATE` this phase extends; no new authorization surface is introduced |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `supabase/migrations/0002, 0013, 0014, 0015, 0017, 0021, 0023, 0024, 0025`, `lib/agenda/itens.ts`, `lib/funil/frequencia.ts`, `app/actions/clientes.ts`, `components/clientes/ClienteDetailSheet.tsx`, `lib/supabase/queries/agenda.ts`, `tests/clientes/frequencia-visita.test.ts` — every architectural and code-pattern claim above is grounded in a specific file/line read this session.
- `.planning/phases/24-dia-fixo-na-recorr-ncia-de-visita/24-CONTEXT.md` — locked D-01..D-04 decisions.
- `.planning/REQUIREMENTS.md`, `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md` — milestone-level scope and the pre-identified risk shape this phase resolves.
- Direct date-arithmetic computation (Node.js `Date`, UTC-anchored) used as a scratch calculator to verify every calendar-math claim in this document (weekday-of-month occurrence counts, the "última ≠ quarta" divergence, the never-past-date test vectors) — not training-data recall.

### Secondary (MEDIUM confidence)
- `[CITED: postgresql.org/docs/current/functions-datetime.html]` — `EXTRACT(dow FROM ...)` returns 0 (Sunday) through 6 (Saturday); `EXTRACT(isodow FROM ...)` returns 1–7 with Monday=1. Confirms Pattern 2/Pitfall 3's mapping choice. Not re-fetched live this session (training-data recollection of a stable, versionless part of the Postgres manual that has not changed across the Postgres 9.x–17.x range this project could plausibly be running) — worth a 30-second confirmation against the actual Supabase Postgres version at implementation time, but the `dow` field's definition is not the kind of API surface that changes between minor/major Postgres versions.

### Tertiary (LOW confidence)
None — every other claim in this document is either a direct codebase read or a verified computation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, entirely native Postgres already in production use
- Architecture: HIGH — every integration point (both `proxima_data_visita` callers, the Agenda read pattern, the ficha's Select location) is grounded in a specific file/line already read this session
- Calendar-math correctness (Nth-weekday existence, "última" divergence, never-past guard): HIGH — verified by direct computation and exhaustive days-per-month reasoning, not assumed
- Pitfalls: HIGH — every pitfall traces to either a documented prior incident in this codebase (timezone, signature-change/drop-function discipline) or a newly-verified calendar-math edge case

**Research date:** 2026-08-26
**Valid until:** Stable — Postgres date/time function semantics (`dow`, `interval` arithmetic) do not change between releases; re-verify only if the project's target Postgres major version changes materially, which is not anticipated.
