# Architecture Research — v1.6 Integration

**Domain:** Existing Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) CRM — integration of 4 new capabilities into established patterns
**Researched:** 2026-08-24
**Confidence:** HIGH (based entirely on direct reading of this repo's migrations, Server Actions, and `lib/` modules — no external sources needed; this is first-party codebase research, not ecosystem research)

## Standard Architecture (as it exists today)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UI (Client/Server Components)                                            │
│  components/importacao/*   components/agenda/*   components/funil/*      │
│  app/(app)/clientes/{importar,importar-cnpj,importar-frequencias}/       │
├──────────────────────────────────────────────────────────────────────────┤
│ Server Actions (app/actions/*.ts) — "use server", auth check first       │
│  importacao.ts   funil.ts   agenda.ts   clientes.ts                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Pure lib/ modules (no next/*, no @/lib/supabase/* — unit-testable)       │
│  lib/importacao/{types,annotarLinha,confirmar,dedupe,modelo}[.ts|*Cnpj*| │
│    *Frequencia*]     lib/agenda/itens.ts     lib/funil/{frequencia,...}  │
├──────────────────────────────────────────────────────────────────────────┤
│ Supabase RPCs (supabase/migrations/*.sql) — SECURITY INVOKER unless      │
│ documented as one of the 4 exceptions                                    │
│  mover_card_funil()          importar_clientes_lote()                   │
│  atualizar_frequencia_visita_lote()   atualizar_cnpj_lote()             │
│  concluir_tarefa_prospeccao() / concluir_visita()                       │
│  agenda_do_vendedor() / agenda_concluidos_do_vendedor()                 │
│  proxima_data_visita() — pure SQL, single authority for date math       │
├──────────────────────────────────────────────────────────────────────────┤
│ Postgres tables, RLS-gated                                               │
│  clientes  visitas  tarefas  historico  cliente_produtos                │
│  categorias / produtos_consumidos / tipos_tarefa / motivos_perda /      │
│    frequencias_pedido / motivos_conclusao_remota  (6 editable lists)    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation in this repo |
|-----------|----------------|------------------------|
| `lib/importacao/types*.ts` | Canonical `SystemField` vocabulary per import type | `SYSTEM_FIELDS` array, parameterized `SystemFieldDefinition<K>` so a second vocabulary (`typesFrequencia.ts`, `typesCnpj.ts`) never duplicates the interface |
| `lib/importacao/annotarLinha*.ts` | Pure per-row resolution against RLS-scoped lookups | One file per import type (`annotarLinha.ts`, `annotarLinhaCnpj.ts`, `annotarLinhaFrequencia.ts`) — no shared "generic annotator," each type owns its own required-field rules |
| `lib/importacao/confirmar*.ts` | Shapes reviewed rows into the RPC's snake_case insert/update payload | One file per import type, same split |
| `lib/importacao/dedupe.ts`, `parseArquivo.ts`, `mapping.ts`, `preview.ts` | Genuinely shared, type-agnostic utilities | Reused verbatim by every import type |
| `app/actions/importacao.ts` | Server Action: auth/role gate, orchestrates lookups, calls RPC | `is_supervisor` app-layer check is UX-only; the RPC's own `is_supervisor()` raise is the real backstop |
| RPC `importar_clientes_lote` | Single set-based INSERT + join-table insert, CREATE-only | No `SECURITY DEFINER`; feature gate via `is_supervisor()` raise; `ON CONFLICT (razao_social) DO NOTHING` |
| RPC `atualizar_*_lote` (frequência, CNPJ) | Single set-based UPDATE, structurally incapable of creating a row | Exactly one UPDATE statement in the whole function body, `status_acompanhamento = 'ganho'` clause as the literal enforcement mechanism |
| RPC `mover_card_funil` | All funil-transition guards (ganho, perdido, CNPJ) | Guards are small `if ... raise exception` blocks, copy-pasted verbatim between migrations rather than extracted into a shared helper (documented practice, e.g. 0018's comment: "copiado literalmente da 0013, sem mudar uma vírgula") |
| RPC `proxima_data_visita` | Sole authority for "what's the next visit date" math | `language sql immutable`, no table access, called from `mover_card_funil` (seed), `agenda_do_vendedor` (suggestion) — never re-implemented client-side (Pitfall 1) |
| `lib/agenda/itens.ts` | Sole authority for how agenda items are bucketed/grouped/dated | One file, explicitly documented as "the ONLY file that decides this" |

## Recommended Integration — What's Genuinely NEW vs What's an EXTENSION

### Capability 1 — "Importar Clientes Ativos" (new bulk-import flow)

**Verdict: NEW RPC + NEW parallel file set. Do not parameterize `importar_clientes_lote`.**

Reasoning, from precedent in this exact codebase:
- Every time a bulk operation needed a materially different shape, the project added a **new RPC**, never a mode flag on an existing one: `atualizar_frequencia_visita_lote` (0017) and `atualizar_cnpj_lote` (0020) are UPDATE-only siblings of each other, each "structurally incapable of creating a row" by having exactly one UPDATE statement and nothing else — that's the actual enforcement mechanism, and it only works because the function has no branching.
- "Importar Clientes Ativos" is a CREATE operation (like `importar_clientes_lote`) but with a fundamentally different required-field contract (razão social + CNPJ + endereço completo + responsável required; only frequência excluded) and a different resulting state (`status_acompanhamento = 'ganho'`, `etapa = 'primeira_venda'`, not the default `aguardando_contato'`). Bolting a `p_modo` flag onto `importar_clientes_lote` would force conditional required-field logic inside a function that today has **zero** DB-level required-field guards (required-ness is enforced entirely in the app-layer Zod schema, `createImportRowSchema`) — that's a new kind of branching this RPC family has never had, and it fights the "one instruction, one purpose" discipline visible in every `*_lote` RPC in this codebase.
- **New parallel file set**, mirroring the CNPJ/Frequência precedent exactly:
  - `lib/importacao/typesAtivo.ts` (own `SystemFieldDefinition[]`, required flags on razaoSocial/cnpj/cep/rua/numero/cidade/estado/responsavel — everything the widened ganho guard, Capability 2, will also require)
  - `lib/importacao/annotarLinhaAtivo.ts`, `lib/importacao/confirmarAtivo.ts`, `lib/importacao/modeloAtivo.ts`
  - Reuses `dedupe.ts`, `parseArquivo.ts`, `mapping.ts`, `preview.ts` unchanged
  - New Server Actions (own file, e.g. `app/actions/importacaoAtivo.ts`, following the CNPJ/Frequência precedent of a dedicated action module per import type rather than growing `app/actions/importacao.ts` indefinitely — confirm this against how `importar-cnpj`/`importar-frequencias` structured their actions before locking it in)
  - New route `app/(app)/clientes/importar-ativos/page.tsx` + `ImportAtivoWizard.tsx`/`AtivoPreviewTable.tsx`/`AtivoImportSummary.tsx` components (mirrors `Cnpj*`/`Frequencia*` naming)
- **New RPC `importar_clientes_ativos_lote`**: single set-based INSERT (mirrors `importar_clientes_lote`'s CTE shape byte-for-byte, including the two-statement split documented in 0006 as the RLS-visibility fix — do not re-merge that into one CTE), writing `status_acompanhamento = 'ganho'`, `etapa = 'primeira_venda'`, `cnpj`/`nome_fantasia`/full endereço, and explicitly **not** writing `frequencia_visita` (column stays NULL, which is exactly what Capability 4's Agenda section is built to surface). No `SECURITY DEFINER`; `is_supervisor()` raise as the feature gate, same as every sibling RPC.

**Critical integration risk to flag for planning:** this RPC creates clients that are **already `ganho` without ever passing through `mover_card_funil`**. The v1.4 CNPJ guard and the Capability-2 widened guard both live *inside* `mover_card_funil`'s transition check — a direct INSERT never executes that code path. If `importar_clientes_ativos_lote` doesn't independently enforce "razão social + CNPJ + endereço completo present," it becomes a second, ungated door to the exact invariant the widened guard exists to protect (a `ganho` client without CNPJ/endereço/razão social). Recommend the new RPC's guard block be a **verbatim copy** of whatever guard Capability 2 adds to `mover_card_funil` (same copy-paste-not-extract convention already used for the frequência guard between 0013→0018) — not a shared helper function, which this codebase doesn't use for guards (it *does* use a shared helper for pure computation, e.g. `proxima_data_visita` — the distinction matters: guards get duplicated, math gets a single authority).

### Capability 2 — Widen the "ganho" transition guard in `mover_card_funil`

**Verdict: EXTENSION of the existing 3-condition transition-guard pattern. Simpler than prior extensions — likely does NOT need a new parameter.**

The CNPJ guard (0018) already establishes the exact template to copy:
```sql
if p_novo_status = 'ganho'
   and v_encontrado
   and v_status_atual is distinct from 'ganho'
   and v_cnpj_efetivo is null then
  raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
end if;
```
Widening to razão social + endereço completo is the same 3-ANDed-conditions shape (new-state-requested + old-state-not-that-state + field-empty), added as **additional guard blocks**, not a rewrite of the existing one — same discipline as how the frequência guard (0013) and CNPJ guard (0018) coexist today as separate `if` blocks with their own messages, never merged into one compound condition.

**Key simplification vs. precedent:** CNPJ needed a new `p_cnpj` parameter because the ganho dialog offers a "type it right now" affordance (a vendedor without CNPJ on file can type it at the moment of marking ganho). Razão social and endereço completo have **no equivalent affordance today** — they're cadastro-time fields, edited only via `ClienteDetailSheet`, never collected in a ganho-time dialog. Two options, and this is a real Discuss-phase decision, not something to assume:
- **(a) Read persisted columns only** (`clientes.razao_social`, `clientes.cep/rua/numero/cidade/estado`), block with an error naming the missing field(s), direct the vendedor to complete the ficha first. **No new parameters → no signature change → no `drop function` dance.** This is the first guard-widening in this project's history that wouldn't need the drop-before-create overload-avoidance ritual (documented lesson from both the v1.3 and v1.4 extensions) — just `create or replace function mover_card_funil(...)` with the same 7 params, changed body.
- **(b) Mirror CNPJ exactly**: add new `p_razao_social`/endereço params, widen `GanhoFrequenciaDialog` to collect them inline. Needs the full drop-then-create-with-8+-params treatment, plus UI work in the ganho dialog.

Given `CLAUDE.md`'s "mínimo de fricção" principle and that razão social is already required at every cadastro path except the about-to-be-relaxed prospecção import (Capability 1's sibling change), option (a) is the lower-risk, lower-scope choice — but confirm with the project owner before locking the plan, since it changes the failure UX (a supervisor dragging a card to "1ª venda concluída" gets blocked and must go edit the ficha in a separate step, rather than filling everything in one dialog).

### Capability 3 — Day-of-week / Nth-weekday-of-month anchor for frequência de visita

**Verdict: NEW columns on `clientes` (not a new table), NEW enum types, and a materially NEW algorithm inside `proxima_data_visita` — this is the highest-risk piece of the milestone.**

**Where it lives:** Two new nullable columns directly on `clientes`, mirroring how `frequencia_visita`/`frequencia_pedidos` were added in 0013 (opcional, nullable, no retroactive constraint — Pitfall 3 pattern still applies: the table already has `ganho` rows in production).
- A new enum `dia_semana_enum` (domingo..sábado) — matches this project's established convention of a Postgres enum per closed vocabulary (`frequencia_visita_enum`, `status_acompanhamento_enum`, `etapa_funil`) rather than a raw smallint, avoiding an implicit "is Monday 0 or 1" convention that client and server code could silently disagree on.
- A new enum `semana_do_mes_enum` (primeira/segunda/terceira/quarta/última) for the mensal case, paired with `dia_semana_enum` to pin "2ª terça-feira do mês."
- **Not a separate table.** `frequencia_visita` and `frequencia_pedidos` both live as scalar columns on `clientes`, not lookup tables — this anchor is 1:1 with a single client's cadence, not a multi-valued or supervisor-editable-CRUD concept (it is NOT a 7th editable list; it's structural scheduling data, same tier as the enums above). A separate table would be over-engineering relative to this project's stated "menos complexidade" preference and would need its own RLS policy set for no real benefit.

**`proxima_data_visita` changes from "N days from base" to "next occurrence of a fixed anchor" — genuinely new logic, not a parameter tweak.** Today it's a one-line `CASE` over intervals. The anchor version needs real calendar math: find the target month, find the first occurrence of the weekday, offset by the week-ordinal (handling "última" specially — not simply "4th," since some months have a 5th occurrence), and decide whether to roll to the next month if the computed date falls on/before the base date. This is squarely in the territory this project already treats with extreme care (Pitfall 1 — timezone/date-math bugs are called out repeatedly; the existing `interval '1 month'` end-of-month clamp behavior is explicitly pinned in a test). Recommend this function get its own isolated migration/plan, tested exhaustively for month-boundary and "última semana" edge cases against a local Supabase instance (per `CLAUDE.md`'s testing stack) before anything downstream depends on it.

**Signature change → same drop-before-create discipline as every prior extension.** `proxima_data_visita(date, frequencia_visita_enum)` becomes `proxima_data_visita(date, frequencia_visita_enum, dia_semana_enum, semana_do_mes_enum)` (or reads the anchor from the row instead of parameters — same shape question as Capability 2). Either way, this is a `language sql immutable` function whose parameter list changes, so it needs `drop function if exists proxima_data_visita(date, frequencia_visita_enum);` before the new `create function`, in the same migration — this exact lesson is already documented three times in this codebase (`mover_card_funil` at 0013 and 0018, `concluir_tarefa_prospeccao`/`concluir_visita` at 0022).

**Every caller must be touched in the same migration:**
- `mover_card_funil`'s semeadura-da-primeira-visita call (needs the anchor sourced from somewhere — see the ganho-dialog-widening question below)
- `agenda_do_vendedor()`'s `proxima_data_sugerida` expression (drop-then-recreate again, same as 0015's own precedent for adding columns to this function's return type)
- `concluir_visita` itself does **not** need to change — it already takes `p_proxima_data` as an input the vendedor confirms (never auto-computed inside the RPC); only the *suggestion* fed to the vendedor (computed by `agenda_do_vendedor`) needs the new algorithm. This is good news: `concluir_visita`'s signature and "always require explicit confirmation, never silent reschedule" guarantee are untouched.

**Open design question to resolve before planning (flag for Discuss phase, don't assume):** Capability 1's ativos-import explicitly excludes frequência (and therefore the anchor) from required fields, and Capability 4 is specifically about surfacing clients missing this configuration via the Agenda. That strongly implies the anchor is meant to be completable *after* ganho, via the new Agenda section — not necessarily inline in `GanhoFrequenciaDialog` at kanban-ganho time. But if `GanhoFrequenciaDialog` keeps collecting only frequência (unchanged) while the anchor becomes mandatory for the "next date" math to work, a client can end up in a **third state** the milestone text doesn't explicitly name: "has a frequência ≠ nenhuma but no anchor yet." `proxima_data_visita` and `agenda_do_vendedor`'s suggestion column must handle a NULL anchor gracefully (return NULL / no suggestion) rather than error, and Capability 4's filter predicate needs to catch this state too (see below) — it's broader than a literal `frequencia_visita IS NULL` check.

### Capability 4 — Agenda section: "clientes ativos sem frequência definida"

**Verdict: mostly an EXTENSION — a new narrow read query, NOT a new RPC, NOT a change to `agenda_do_vendedor()` — plus one genuinely new UI section and one extended (not new) write action.**

- **Read side:** a single-table `SELECT` on `clientes` with RLS already doing the scoping (vendedor sees own, supervisor sees all — same as every other `clientes` list read in this codebase, e.g. `getClientesParaExportacao`). This project reserves RPCs for (a) writes needing atomicity/guards or (b) reads needing cross-table UNION logic (`agenda_do_vendedor` unions `tarefas` + `visitas`). A flat filter over one table fits neither — recommend a plain query function (e.g. `getClientesAtivosSemFrequencia()` in `lib/supabase/queries/clientes.ts` or a new addition to `lib/supabase/queries/agenda.ts`), narrow `select()`, no RPC, no migration needed for the read itself.
- **Correct predicate is broader than the milestone context's stated simplification.** Given Capability 3's anchor, "needs attention" is not just `status_acompanhamento = 'ganho' AND frequencia_visita IS NULL` — it should also catch `frequencia_visita IS NOT NULL AND frequencia_visita <> 'nenhuma' AND dia_semana_visita IS NULL` (a client with a cadence chosen but no anchor yet, including every pre-v1.6 `ganho` client once this ships — the same grandfathering shape as `frequencia_visita`'s own 0013 rollout and CNPJ's 0018 rollout, both of which left existing rows in a "not yet configured" state on purpose rather than blocking retroactively). This section is, in effect, the intended backfill mechanism for that grandfathered gap — worth calling out explicitly in planning so it isn't scoped as "only for brand-new ativos imports."
- **UI placement — new section, not a bucket inside the existing three.** `lib/agenda/itens.ts` is explicitly documented as "the ONLY file that decides bucketing" and `bucketDoItem`/`agruparAgenda` only operate on items that carry a `data` (due date) — a client missing its frequência/anchor configuration has no due date, it's a *setting* that's missing, not a task that's late. Forcing it into `AgendaItem`/`AgendaBucket` (e.g. inventing a 4th bucket or an `origem: "sem_frequencia"`) would break the "item has a date, gets bucketed atrasado/hoje/próximos" invariant every other item in that file honors. Recommend a **separate type and a separate pure function** added to `lib/agenda/itens.ts` (keeping the "one file, one authority for agenda organization" discipline) rather than reusing `AgendaItem`.
- **Write side ("definir a frequência inclui escolher um dia fixo") is an EXTENSION, not new.** `atualizarFrequenciaVisita` (`app/actions/clientes.ts`) already does a plain `.update({ frequencia_visita })` through RLS — no RPC, because it's a single-row, single-user-scoped write (RLS alone is a sufficient authorization boundary; RPCs in this codebase are reserved for bulk/atomic/cross-table needs). Extending this Server Action's payload to also set `dia_semana_visita`/`semana_do_mes_visita` is a straightforward additive change to an existing plain-update action, not new architecture.
- **Second open question for planning:** should the bulk planilha path (`atualizar_frequencia_visita_lote`) also gain the two anchor columns for parity with the individual-edit path, or does bulk stay frequência-only and the anchor stays Agenda/ficha-only? Both are internally consistent with existing precedent (bulk vs. individual edit paths have diverged before — e.g. CNPJ has both `atualizar_cnpj_lote` and ficha-level edit); this is a scope call for Discuss, not an architecture constraint.

## A Third Genuinely-New Finding (surfaced during this research, not explicitly asked about but blocks Capability 1)

PROJECT.md's v1.6 target features state: "'Importar clientes' renomeada para 'Importar Clientes em Prospecção': obrigatório passa a ser só Nome Fantasia + Responsável; **razão social e o resto ficam opcionais**." Today, `clientes.razao_social` is `text not null unique` at the **table level** (migration 0002, unchanged by the 260819-m8q quick task, which only relaxed the 5 endereço columns — its own comment explicitly scopes out razão social). Making razão social optional is therefore not just an `annotarLinha`/Zod change (like the endereço relaxation was) — it needs its own new migration (`alter table clientes alter column razao_social drop not null`, following the exact 0023 pattern), and it ripples further than endereço did:
- `ON CONFLICT (razao_social)` in `importar_clientes_lote` still works correctly with NULLs (Postgres never treats two NULLs as conflicting in a UNIQUE constraint), so **no RPC change needed** there — but this is worth confirming explicitly rather than assuming, since it's a subtle Postgres behavior.
- `lib/importacao/dedupe.ts`'s `normalizeRazaoSocial`/`findDuplicates` compares razão social values directly — if the required field moves to `nomeFantasia`, multiple genuinely-different rows with **blank** razão social would all normalize to the same empty string and incorrectly flag each other as duplicates unless this is special-cased (skip dedupe comparison when the value is blank, or dedupe on `nomeFantasia` as a fallback key for prospecção-imported rows).
- Any UI that displays `razao_social` as the primary client identity/title (kanban cards, `ClienteDetailSheet` header, exports, the funil board) currently assumes it's always present. This needs a fallback-to-`nome_fantasia` display rule wherever that assumption exists — recommend a grep across the codebase for `.razao_social`/`razaoSocial` display usage during planning rather than assuming full coverage here.

This finding belongs in Capability 1's plan (it's the schema prerequisite for the "Importar Clientes em Prospecção" rename/relaxation half of the milestone, distinct from the new "Importar Clientes Ativos" flow itself), but it was not explicitly named in the research prompt, so flagging it here to avoid it being missed at planning time.

## Architectural Patterns to Follow

### Pattern 1: One RPC, one instruction, one purpose (bulk operations)

**What:** Every `*_lote` RPC in this codebase does exactly one INSERT or exactly one UPDATE — never both, never conditional branching between "create or update." The single statement *is* the enforcement mechanism for what the function can and can't do (e.g., `atualizar_cnpj_lote` cannot create a client because there is no INSERT statement in its body — not because of a check, because of its shape).
**When to use:** Every new bulk RPC in this milestone (`importar_clientes_ativos_lote`).
**Trade-off:** More RPCs to maintain than a parameterized one, but each is trivially auditable for "can this possibly create a client" / "can this possibly touch a client the caller shouldn't see" — valuable in a project with no separate backend and RLS as the only authorization layer.

### Pattern 2: Guards are duplicated verbatim, not extracted into shared helpers; pure computation IS extracted

**What:** Validation/guard logic (`if ... raise exception`) gets copy-pasted between RPC versions, explicitly documented as intentional ("copiado literalmente da 0013, sem mudar uma vírgula"). Pure computation with no side effects (`proxima_data_visita`) is the one thing that *is* factored into a shared function, called from multiple RPCs.
**When to use:** Copy the CNPJ/frequência-required guard shape verbatim into both `mover_card_funil`'s widened guard and `importar_clientes_ativos_lote`'s own guard (Capability 1's critical risk, above). Extend `proxima_data_visita` in one place only (Capability 3).
**Trade-off:** Guard duplication risks drift between the two copies over time — worth a code-review checklist item when Capability 1 and Capability 2 land, ideally in the same phase so they're reviewed together.

### Pattern 3: Signature changes to already-pushed functions require `drop function if exists <old signature>` before `create function <new signature>`, same migration

**What:** `create or replace function` in Postgres does **not** replace a function when the parameter list/count changes — it creates an ambiguous overload, and every existing PostgREST call starts failing. This project has hit this three times (`mover_card_funil` twice, `concluir_tarefa_prospeccao`/`concluir_visita` once) and documents it every time.
**When to use:** Any RPC whose parameter list changes in this milestone (`proxima_data_visita` almost certainly; `mover_card_funil` only if option (b) — new params — is chosen for Capability 2/3's anchor collection; `agenda_do_vendedor` for its new return columns).
**Trade-off:** None — this is a correctness requirement, not a stylistic choice.

### Pattern 4: Migrations are never edited once pushed; corrections are new files that recreate the function/alter the table again

**What:** Every fix in this project's history (0005/0006 fixing 0004; 0010 fixing 0009; 0019/0020/0023 extending 0013/0002) is a brand-new migration file, never an edit to an already-applied one.
**When to use:** All new SQL in this milestone — no exceptions, per `CLAUDE.md`.

### Pattern 5: Grandfathering via nullable columns + transition guards, never retroactive NOT NULL/CHECK

**What:** New required-ness is enforced at the moment of a specific *transition* (RPC guard), never as a table constraint that would reject rows already in production. `frequencia_visita`, `cnpj`, and the endereço columns all followed this shape.
**When to use:** The two new anchor columns (Capability 3) must stay nullable; the widened ganho guard (Capability 2) must keep the "old status ≠ ganho" condition that makes it a transition guard, not a state guard — removing that condition would retroactively break every existing `ganho` client.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Parameterizing `importar_clientes_lote` with a "mode" flag instead of a new RPC

**What people might do:** Add `p_modo text default 'prospeccao'` to the existing RPC and branch internally between prospecção-shaped and ativo-shaped inserts, to "avoid duplicating the INSERT."
**Why it's wrong:** Breaks the one-instruction-one-purpose invariant every `*_lote` RPC currently has, makes the required-field contract conditional and harder to audit, and complicates the `ON CONFLICT`/RLS-visibility split that 0006 already had to work around once for this exact function.
**Do this instead:** New sibling RPC (`importar_clientes_ativos_lote`), same pattern as `atualizar_cnpj_lote` being a sibling of `atualizar_frequencia_visita_lote`.

### Anti-Pattern 2: Forcing the "clientes ativos sem frequência" list through `AgendaItem`/`agruparAgenda`

**What people might do:** Give these clients a synthetic `data` (e.g. today's date) so they fall into the "hoje" bucket and can reuse `AgendaItemRow`/`bucketDoItem` unchanged.
**Why it's wrong:** These aren't due-dated tasks; a synthetic date would make them silently "atrasado" the next day for no real reason, and would corrupt `agruparAgenda`'s "partition equals input size" guarantee with items that don't semantically belong to any bucket.
**Do this instead:** A separate, purpose-built type and section, still living in `lib/agenda/itens.ts` for the "one file owns agenda organization" discipline, but not reusing `AgendaBucket`.

### Anti-Pattern 3: Extracting a shared `verificar_campos_completos_ganho()` helper function for the widened guard

**What people might do:** DRY up the guard logic between `mover_card_funil` and `importar_clientes_ativos_lote` into one shared PL/pgSQL function both call.
**Why it's wrong:** No guard in this codebase is factored this way today — every guard is a small, self-contained, copy-pasted `if/raise` block, explicitly done that way even when it meant repeating a comment verbatim across migrations. Introducing the first shared-guard abstraction here is a bigger architectural change than the milestone calls for, and adds an indirection future readers of either RPC have to chase.
**Do this instead:** Duplicate the guard block, same as every other guard in this project's history.

## Suggested Build Order

Consistent with this project's established discipline of separating "schema/RPC that could touch production data" phases from "UI wiring" phases (visible in how v1.3/v1.4/v1.5 each split a `-01-PLAN` database-foundation phase from later UI phases):

**Phase A — Schema + RPC foundation (production-data-sensitive, plan/review carefully, smallest blast radius first):**
1. `alter table clientes alter column razao_social drop not null` (new migration) — prerequisite for the prospecção-import relaxation; isolate first since it's the one change touching an existing NOT NULL constraint on a column with live data, and audit `dedupe.ts` + display call sites in the same phase (see "Third Genuinely-New Finding" above).
2. New enum types `dia_semana_enum`/`semana_do_mes_enum` + two new nullable columns on `clientes` — pure additive schema, safe, no guard logic yet.
3. Rewrite `proxima_data_visita` (drop + create with new signature/algorithm) in its own plan, tested exhaustively for month-boundary/"última semana" edge cases before any caller depends on it — the highest date-math risk in the milestone.
4. Widen `mover_card_funil`'s ganho guard (razão social + endereço completo) — resolve the "read persisted columns vs. new params" design question first (Discuss phase), then implement; touch `agenda_do_vendedor()` in the same phase if its return shape needs the new anchor columns.
5. New RPC `importar_clientes_ativos_lote`, guard block copied verbatim from step 4.
6. Extend `atualizarFrequenciaVisita` (plain update, no RPC) to accept the two anchor columns; decide and implement whether `atualizar_frequencia_visita_lote` also gains them.

**Phase B — Import module + wizard UI (non-production-sensitive, standard patterns, low research risk):**
7. `lib/importacao/{typesAtivo,annotarLinhaAtivo,confirmarAtivo,modeloAtivo}.ts` + Server Actions + `app/(app)/clientes/importar-ativos/page.tsx` + wizard components, mirroring the CNPJ/Frequência precedent file-for-file.
8. Prospecção-import relaxation: flip `required: true` from `razaoSocial` to `nomeFantasia` in `SYSTEM_FIELDS`/`createImportRowSchema`, update `annotarLinha.ts`'s dedupe-blank-handling per the Third Finding above.
9. Remove "Importar CNPJ"/"Importar frequências" from `AppSidebar.tsx` (and decide whether to delete or just unlink the now-redundant routes/components — likely a separate, lower-risk cleanup step since the milestone description frames them as "saem do menu," not necessarily deleted from the codebase).

**Phase C — Agenda UI:**
10. New read query (`getClientesAtivosSemFrequencia` or equivalent, broader predicate per Capability 4 above), new pure type/function in `lib/agenda/itens.ts`, new Agenda section component, wired to the extended `atualizarFrequenciaVisita` action from step 6.

Phase A must land before Phase C (the anchor columns and widened `proxima_data_visita` are read by the Agenda section) and before Phase B step 7 (the new import RPC depends on the widened guard existing to copy). Phase B step 8 (prospecção relaxation) only depends on Phase A step 1, not on the rest of Phase A — it could ship independently/earlier if sequencing needs to be split further.

## Sources

- Direct reading of this repository: `supabase/migrations/0002, 0004, 0013, 0015, 0017-0023`, `lib/importacao/*`, `lib/agenda/itens.ts`, `lib/funil/frequencia.ts`, `app/actions/importacao.ts`, `app/actions/clientes.ts` (grep), `components/importacao/*`, `components/agenda/*`, `components/layout/AppSidebar.tsx` (grep), `.planning/PROJECT.md`. No external documentation lookup was needed or performed — this research is entirely first-party codebase analysis. Confidence is HIGH because every claim above is grounded in a specific file/line read during this session, not inferred from general Supabase/Next.js knowledge.

---
*Architecture research for: CRM Raiar v1.6 milestone integration*
*Researched: 2026-08-24*
