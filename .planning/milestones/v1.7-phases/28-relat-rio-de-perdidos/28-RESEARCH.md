# Phase 28: Relatório de Perdidos - Research

**Researched:** 2026-09-25
**Domain:** Next.js Server Components/Actions + Supabase (Postgres RPC + RLS) — new read path over existing `clientes`/`historico` data, no new external stack
**Confidence:** HIGH (every claim below is grounded in this repo's own code/migrations, read directly this session — no third-party library research was needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Item novo no menu principal (`PRINCIPAL_SECTION` de `components/layout/AppSidebar.tsx`), no mesmo nível de Agenda/Clientes/Dashboard — não uma aba dentro de Clientes.
- **D-02:** O item do menu mostra só o rótulo "Perdidos", **sem contador** (diferente do padrão da Agenda, que mostra contagem de pendências) — decisão explícita do dono: perdido não é uma pendência urgente, um número ali soaria como alarme à toa.
- **D-03 (Claude's Discretion):** Ícone do menu — escolher um `lucide-react` já usado no projeto que não colida com os já usados (`ListChecks` Agenda, `Users` Clientes, `LayoutDashboard` Dashboard, `UsersRound`/`Settings`/`FileUp`/`BadgeCheck` na seção Administração). Sugestão: `Archive` ou `XCircle` — confirmar durante o planejamento pela leitura do conjunto de ícones já importado no arquivo.
- **D-04:** Lista simples, uma linha por cliente — reaproveitar o estilo visual já estabelecido em `components/agenda/AgendaSemDiaFixo.tsx`/`AgendaItemRow.tsx` (mesmo `Card size="sm"`, mesmo espaçamento), NÃO o card do Kanban. Cada linha mostra: nome do cliente (via `nomeExibicaoCliente()`, mesma regra de fallback pro Nome Fantasia), motivo da perda, data em que foi perdido, vendedor responsável (só quando `showResponsavel`, mesmo padrão do resto do sistema), e um botão "Reabrir" de toque simples (mesmo tamanho/formato dos botões de ação rápida já usados no `ClienteCard`, `size-11`).
- **D-05:** Reabrir aplica na hora, sem diálogo de confirmação — mesmo padrão de UX já usado nas setas de etapa (quick task 260921-n0a) e no restante do projeto: ações reversíveis não pedem confirmação.
- **D-06:** `lib/funil/prospeccao.ts` precisa mudar de "um status só" (`STATUS_FORA_DA_PROSPECCAO = "ganho"`) para um CONJUNTO de dois status (`"ganho"` e `"perdido"`) que saem das 7 colunas. Isso muda a assinatura de `apareceNaProspeccao()` de comparação simples para checagem de pertencimento num Set/array. O comentário de cabeçalho do módulo ("Cliente perdido continua aparecendo normalmente") precisa ser atualizado/corrigido nesta fase. Mesmo espírito da migração já feita pra "ganho" (quick task 260915-ls7): regra de EXIBIÇÃO no Kanban, nunca de autorização (RLS continua a fronteira real).
- **D-07:** A mesma armadilha de exportação que a 260915-ls7 resolveu com a flag `escopoTudo` precisa ser respeitada aqui: "Exportar todos" não pode silenciosamente parar de trazer os clientes perdidos só porque eles saíram do Kanban visualmente.
- **D-08:** Reabrir muda `status_acompanhamento` de volta para `"em_andamento"`, usando o mesmo mecanismo de escrita que já existe (`marcarStatus`/`mover_card_funil` — nunca uma lógica paralela, mesmo princípio D-04 da Fase 27). Isso automaticamente faz o cliente voltar a aparecer no Kanban, na etapa em que ele já estava quando foi perdido (etapa não muda ao reabrir, só o status).
- **D-09 (Claude's Discretion):** Após reabrir, a linha some da tela de Perdidos — comportamento natural da própria consulta ser refeita, sem necessidade de lógica extra de remoção de linha.
- **D-10:** Vendedor vê só os próprios clientes perdidos; Supervisor vê os de todo o time — mesma regra de RLS já usada em todo o resto do sistema (Kanban, Agenda), sem exceção nova.
- **D-11:** Filtro por período = data em que o cliente foi marcado como perdido (`etapa_alterada_em` ou equivalente já usado pelo histórico — confirmar durante planejamento/pesquisa qual coluna already registra essa data com precisão, possivelmente via `historico`). **Resolvido nesta pesquisa — ver seção "Onde mora a data de perda" abaixo: `etapa_alterada_em` NÃO serve; a fonte é `historico`.**

### Claude's Discretion

- Layout exato da página (título, posição do filtro de período, se tem busca por nome também).
- Se o filtro de período tem um padrão (ex: "últimos 90 dias") ou mostra tudo por padrão — decidir durante planejamento, sem nova pergunta ao usuário.
- D-03 (ícone) e D-09 (comportamento pós-reabrir), listados acima, também são discricionários.

### Deferred Ideas (OUT OF SCOPE)

Nenhuma — a discussão ficou dentro do escopo da fase (PERD-01..05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERD-01 | Cliente marcado como "Perdido" sai das 7 colunas do funil (mesmo padrão do "Ganho") | `lib/funil/prospeccao.ts` refactor (single status → Set of 2), verified against its sole consumer `getClientesAgrupadosPorEtapa` — see Architecture Patterns / Code Examples |
| PERD-02 | Tela "Perdidos" mostra motivo, data e vendedor responsável | New `clientes_perdidos()` RPC (mirrors `dashboard_ganhos_perdidos`'s historico-based date resolution) — see Code Examples |
| PERD-03 | Vendedor vê só os próprios; Supervisor vê todos | Zero new RLS policy needed — RPC is `SECURITY INVOKER`, existing `clientes`/`historico`/`motivos_perda`/`profiles` SELECT policies already scope correctly — see Security Domain |
| PERD-04 | Filtro por período (data em que foi marcado perdido) | RPC takes nullable `p_inicio`/`p_fim`; date basis is `historico.criado_em`, NOT `clientes.etapa_alterada_em` — see "Onde mora a data de perda" |
| PERD-05 | Reabrir com toque simples, volta para "Em andamento" | Zero new mutation needed — existing `marcarStatus(clienteId, "em_andamento")` from `app/actions/funil.ts` already supports this transition safely (verified against all `mover_card_funil` guards) — see Common Pitfalls / Code Examples |
</phase_requirements>

## Summary

This phase is almost entirely a **new read path** over data that already exists — no new tables, no new stack, no new npm packages. The three things genuinely new are: (1) a Postgres RPC that resolves "when was this client marked perdido" reliably (it is **not** a column on `clientes` — it must come from `historico`, exactly like the Dashboard's existing "ganhos/perdidos" chart already does), (2) a one-line-per-client Client Component list styled after `AgendaSemDiaFixo`, and (3) a two-status Set in `lib/funil/prospeccao.ts` replacing today's single-status equality check. The "reopen" action requires **zero new mutation code** — the existing `marcarStatus(clienteId, "em_andamento")` Server Action already does exactly what's needed and was verified line-by-line against every `mover_card_funil` guard (CNPJ, razão social, endereço, frequência de visita) to confirm none of them fire on a transition to `"em_andamento"`.

The riskiest part of this phase is **not** the RLS scoping (that's free, same pattern reused everywhere) — it's getting the "date lost" query right. `clientes.etapa_alterada_em` only updates when `etapa` changes, and marking a client as perdido does **not** change its `etapa` (it stays in whatever Kanban column it was in). The correct, already-established pattern in this codebase is `historico.criado_em` from the row the `clientes_after_update_historico` trigger writes on every `status_acompanhamento` change — this is documented, tested, and already used by `dashboard_ganhos_perdidos()` (migration 0003) for the exact same "when did this status change happen" question.

**Primary recommendation:** Add one new SQL-language, `SECURITY INVOKER` RPC (`clientes_perdidos`, new migration `0034_clientes_perdidos.sql`) that joins a `distinct on (cliente_id)` CTE over `historico` (filtered to the most recent `status_acompanhamento` row whose `descricao` matches `"perdido"`) to `clientes`/`motivos_perda`/`profiles`, cross-checked against `clientes.status_acompanhamento = 'perdido'` today (this is also what makes D-09's "row disappears after reopening" work for free). Read it from a new `lib/supabase/queries/perdidos.ts`, wrapped in `buscarPaginado` (same >1000-row precedent as `getClientesSemDiaFixo`/`getClientesAgrupadosPorEtapa`, since this list only ever grows). Render it in a new Client Component (`PerdidosList.tsx`) that fetches via a Server Action and uses the `reloadKey` refetch pattern already established by `AgendaList.tsx` — this sidesteps any `revalidatePath` cache concern entirely, because the existing `marcarStatus` action's `revalidatePath("/clientes")` call does **not** know about a new `/perdidos` route.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Sai do Kanban" visibility rule (PERD-01) | API / Backend (SQL filter in `getClientesAgrupadosPorEtapa`) | Browser (defense-in-depth loop guard in the same function) | Display-only rule, explicitly never an RLS/authorization concern (module's own docstring) — lives in the query layer that already owns this filter |
| Perdidos list read, scoped by role (PERD-02/03/04) | Database / Storage (Postgres RPC + RLS) | API / Backend (thin typed reader wrapping the RPC) | RLS is this project's only authorization boundary (CLAUDE.md, supabase-conventions skill) — the RPC does the heavy join/date logic, TypeScript only shapes the response |
| Period filter (PERD-04) | Browser / Client (Select + optional date-range popover, client state) | Database (RPC's nullable `p_inicio`/`p_fim` params) | Filter state is UI-local like the Dashboard's `PeriodoFilter`; the actual date comparison happens in SQL against `historico.criado_em` |
| Reabrir (PERD-05) | API / Backend (existing `marcarStatus` Server Action → `mover_card_funil` RPC) | Database (existing CHECK constraints as backstop) | Explicitly reuses the established write path (D-08) — no new tier introduced |
| Menu entry (D-01/D-02/D-03) | Frontend Server / Client (`AppSidebar.tsx`, a Client Component) | — | Pure navigation, no data dependency |

## Standard Stack

No new libraries. This phase is 100% additive on top of the already-approved stack (Next.js Server Actions, `@supabase/supabase-js`, shadcn/ui, `date-fns` for any date formatting on the row). See project `.claude/CLAUDE.md`'s Technology Stack table — nothing there needs to change for this phase.

### Installation

Nothing to install.

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** No `npm install` step exists in this phase's scope; the Package Legitimacy Gate does not apply.

## Onde mora a data de perda (resolves D-11)

Read directly from `supabase/migrations/0002_clientes_and_funil.sql` and `0003_dashboard_aggregates.sql` `[VERIFIED: supabase/migrations/0002_clientes_and_funil.sql, 0003_dashboard_aggregates.sql]`:

1. `clientes.etapa_alterada_em` is set by the `clientes_before_update()` trigger **only when `new.etapa is distinct from old.etapa`**. Marking a client "perdido" via `marcarStatus`/`mover_card_funil` calls the RPC with `p_nova_etapa` = the client's **current, unchanged** etapa (the client stays in whatever Kanban column it was in) — so `etapa_alterada_em` is **never** touched by this transition. It is not usable for "date marked as perdido."
2. Every `status_acompanhamento` change (in either direction) **does** write a `historico` row via `clientes_after_update_historico()`, with `tipo = 'status_acompanhamento'` and `descricao = format('Status alterado para "%s"', new.status_acompanhamento::text)` — i.e. always exactly `Status alterado para "perdido"` or `Status alterado para "em_andamento"` etc. `criado_em` on that row is the authoritative timestamp.
3. This is not a new discovery — it's already this project's established convention, called out explicitly in `.planning/STATE.md`'s Phase 04-01 decision log: *"Ganhos/perdidos and desempenho-por-vendedor source their date basis from `historico.criado_em` (status-change event), never `clientes.etapa_alterada_em`/`criado_em`"* `[VERIFIED: .planning/STATE.md Phase 04-01 decision]`. The existing `dashboard_ganhos_perdidos(p_inicio, p_fim)` RPC (migration `0003_dashboard_aggregates.sql`) is the direct, working, tested precedent to copy for this phase's new RPC.
4. A supporting index already exists for this exact query shape: `idx_historico_tipo_criado on historico (tipo, criado_em)` `[VERIFIED: supabase/migrations/0003_dashboard_aggregates.sql]`.

**Conclusion:** the new query must use `historico`, filtered to `tipo = 'status_acompanhamento'` and `descricao ilike '%"perdido"%'`, taking the most recent (`distinct on (cliente_id) ... order by criado_em desc`) matching row per client, cross-checked against `clientes.status_acompanhamento = 'perdido'` **today** — this cross-check is also what makes D-09 (row disappears after reopening) work automatically, with zero extra code: a reopened client's most-recent-`perdido`-historico-row still exists, but the cross-check `c.status_acompanhamento = 'perdido'` now fails, so it's excluded.

## Architecture Patterns

### System Architecture Diagram

```
Vendedor/Supervisor clicks "Perdidos" in AppSidebar
        │
        ▼
app/(app)/perdidos/page.tsx  (Server Component — auth guard already
        │                     enforced by app/(app)/layout.tsx; reads
        │                     `isSupervisor` only, to decide showResponsavel)
        ▼
components/perdidos/PerdidosList.tsx  (Client Component)
        │  - holds period-filter state (preset | custom range | "todos")
        │  - holds reloadKey (bumped after a successful "Reabrir")
        │  - on mount / filter change / reloadKey change:
        ▼
app/actions/perdidos.ts → getClientesPerdidosAction(periodo?)  (Server Action)
        │  - auth.getUser() check (mirrors getMotivosPerda/getHistoricoAction)
        ▼
lib/supabase/queries/perdidos.ts → getClientesPerdidos(periodo?)
        │  - buscarPaginado() loop, .range() per page
        ▼
supabase.rpc("clientes_perdidos", { p_inicio, p_fim })
        │
        ▼
Postgres: clientes_perdidos() RPC  (SECURITY INVOKER — runs as caller)
        │  1. CTE over historico: distinct on (cliente_id), latest row
        │     where tipo='status_acompanhamento' and descricao ilike '%"perdido"%'
        │  2. JOIN clientes  ◄── RLS applies HERE (vendedor sees own only,
        │                        supervisor sees all) — the only auth boundary
        │  3. WHERE c.status_acompanhamento = 'perdido' (cross-check)
        │  4. LEFT JOIN motivos_perda, LEFT JOIN profiles (responsavel)
        │  5. period filter: p_inicio/p_fim applied to historico.criado_em
        ▼
Rows: {cliente_id, razao_social, nome_fantasia, motivo_perda_nome,
       perdido_em, responsavel, responsavel_nome}
        │
        ▼
PerdidosList renders one PerdidosItemRow per client (D-04 shape)
        │
        ▼
Vendedor clicks "Reabrir" (size-11 button, no confirm dialog — D-05)
        │
        ▼
app/actions/funil.ts → marcarStatus(clienteId, "em_andamento")   ◄── ALREADY EXISTS
        │  (reuses mover_card_funil RPC — same write path as every other
        │   status change in this codebase; zero new mutation code)
        ▼
On success: PerdidosList bumps reloadKey → refetches → row disappears
            (client's current status_acompanhamento no longer 'perdido',
             so the cross-check above excludes it — D-09, no extra code)
            Client also now passes apareceNaProspeccao() again → reappears
            in the Kanban, in its original etapa (D-08)
```

### Recommended Project Structure

```
supabase/migrations/
└── 0034_clientes_perdidos.sql       # NEW — clientes_perdidos() RPC

lib/
├── funil/
│   └── prospeccao.ts                # MODIFIED (D-06) — Set of 2 statuses
└── supabase/queries/
    └── perdidos.ts                  # NEW — getClientesPerdidos(periodo?), paginated

app/
├── actions/
│   └── perdidos.ts                  # NEW — getClientesPerdidosAction() Server Action wrapper
│       (reopen itself reuses app/actions/funil.ts's existing marcarStatus — no new action)
└── (app)/perdidos/
    └── page.tsx                     # NEW — thin Server Component (isSupervisor only)

components/
├── layout/
│   └── AppSidebar.tsx               # MODIFIED (D-01/D-02/D-03) — new NavLink, no badgeCount
└── perdidos/
    ├── PerdidosList.tsx              # NEW — Client Component, reloadKey fetch pattern
    └── PerdidosItemRow.tsx           # NEW — presentational row (D-04)

tests/
├── clientes/
│   └── prospeccao.test.ts           # MODIFIED — existing assertions assume single-status;
│                                      #   will FAIL against the D-06 Set-based refactor unless updated
└── funil/ (or clientes/)
    └── perdidos-rpc.test.ts         # NEW — RLS + date-resolution + reopen-disappears behavior
```

### Pattern 1: Historico-derived "status changed to X on date Y" (the core pattern of this phase)
**What:** Resolve the authoritative date of a status transition from the audit trail (`historico`), never from a mutable column on the parent row.
**When to use:** Any time a report needs "when did this record enter state X," where the entity can toggle between states more than once.
**Example (mirrors `dashboard_ganhos_perdidos`, migration `0003_dashboard_aggregates.sql`, adapted for a single status and full row payload):**
```sql
-- Source: supabase/migrations/0003_dashboard_aggregates.sql (dashboard_ganhos_perdidos),
-- this is the same pattern applied to "perdido" only, returning full rows instead of a count.
create or replace function clientes_perdidos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  motivo_perda_nome text,
  perdido_em timestamptz,
  responsavel uuid,
  responsavel_nome text
)
language sql
stable
as $$
  with ultimo_perdido as (
    select distinct on (h.cliente_id)
      h.cliente_id,
      h.criado_em
    from historico h
    where h.tipo = 'status_acompanhamento'
      and h.descricao ilike '%"perdido"%'
    order by h.cliente_id, h.criado_em desc
  )
  select
    c.id as cliente_id,
    c.razao_social,
    c.nome_fantasia,
    mp.nome as motivo_perda_nome,
    u.criado_em as perdido_em,
    c.responsavel,
    (p.nome || ' ' || p.sobrenome) as responsavel_nome
  from ultimo_perdido u
  join clientes c on c.id = u.cliente_id             -- RLS on clientes applies here
  left join motivos_perda mp on mp.id = c.motivo_perda_id
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'perdido'           -- excludes reopened clients (D-09)
    and (p_inicio is null or u.criado_em >= p_inicio)
    and (p_fim is null or u.criado_em < p_fim)
  order by u.criado_em desc, c.id asc;                -- stable tie-break for pagination
$$;
```
`[VERIFIED: supabase/migrations/0003_dashboard_aggregates.sql — same distinct-on/cross-check shape, confirmed working and tested via tests/dashboard/*.test.ts]`. **No `security definer` clause** — this must stay `SECURITY INVOKER` (the implicit default when the clause is omitted), matching every `dashboard_*` function and `mover_card_funil` in this project (`.planning/STATE.md`: *"Toda função `dashboard_*` é SECURITY INVOKER por omissão... RLS ... é a única fronteira de autorização"*). Note the generic `security definer` example in `.claude/skills/Supabase-conventions/SKILL.md` is an illustrative template for a **different** case (business-rule RPCs that need to bypass RLS on purpose, like `historico`'s write triggers) — it does not apply here; a read RPC over already-RLS-protected tables must stay invoker.

### Pattern 2: Single-source-of-truth Set for a display-only filter (D-06)
**What:** `lib/funil/prospeccao.ts` currently exports one constant + an equality check. It needs to become an array/Set consumed by BOTH the SQL filter and the JS guard, exactly like today — never let the two drift.
**Minimal-diff implementation:**
```typescript
// Source: lib/funil/prospeccao.ts (current file, to be modified)
import type { StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

/** Valores enviados ao Postgres no filtro da leitura do Kanban — também a
 * fonte única consumida por apareceNaProspeccao() abaixo. Array (não Set)
 * porque também alimenta a string do filtro `.not(...)` do PostgREST, que
 * precisa de algo iterável/joinável. */
export const STATUS_FORA_DA_PROSPECCAO_LISTA = [
  "ganho",
  "perdido",
] as const satisfies readonly StatusAcompanhamento[]

const STATUS_FORA_DA_PROSPECCAO_SET: ReadonlySet<StatusAcompanhamento> =
  new Set(STATUS_FORA_DA_PROSPECCAO_LISTA)

export function apareceNaProspeccao(status: StatusAcompanhamento): boolean {
  return !STATUS_FORA_DA_PROSPECCAO_SET.has(status)
}
```
Consumer change in `lib/supabase/queries/clientes.ts`'s `getClientesAgrupadosPorEtapa`:
```typescript
// BEFORE:
.neq("status_acompanhamento", STATUS_FORA_DA_PROSPECCAO)

// AFTER — same single source, now excludes both values:
.not(
  "status_acompanhamento",
  "in",
  `(${STATUS_FORA_DA_PROSPECCAO_LISTA.join(",")})`
)
```
`[CITED: supabase.com/docs/reference/javascript/not]` — supabase-js's `.not(column, operator, value)` accepts raw PostgREST filter syntax; `in` expects a parenthesized, comma-separated list (`(ganho,perdido)`). Confidence MEDIUM (official docs page confirmed to exist and describe this exact form; the parenthesized-list example for `.not(..., "in", ...)` specifically was not quoted verbatim in the search snippet — **verify with one live query during Task 1** before relying on it, e.g. a quick `console.log` of the generated request or a Vitest assertion against a real Supabase project, same as this codebase already does for every RPC). The loop guard inside the same function (`if (!apareceNaProspeccao(row.status_acompanhamento)) continue`) needs **no change** — it already calls the single-source function.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Reopening a perdido client | A new RPC / new Server Action for "reabrir" | `marcarStatus(clienteId, "em_andamento")` — already exported from `app/actions/funil.ts` | Verified against every `mover_card_funil` guard (CNPJ-01/02, GANHO-01/02, frequência de visita) — none of them fire on `p_novo_status = 'em_andamento'`, all are gated on `p_novo_status = 'ganho'` specifically. A parallel write path would duplicate `chk_perdido_exige_motivo`/`chk_ganho_somente_etapa_final` enforcement logic that already lives in one place |
| "Date this client was lost" | A new column, or reading `etapa_alterada_em` | `historico.criado_em`, mirroring `dashboard_ganhos_perdidos` | `etapa_alterada_em` only tracks `etapa` changes, not `status_acompanhamento` changes — confirmed by reading the `clientes_before_update()` trigger body directly |
| Role-based visibility (vendedor vs supervisor) | A manual `if (isSupervisor) ... else ...` filter in the query or the RPC | RLS on `clientes` (already exists, migration `0002`) | Every other reader in this codebase (`getClientesAgrupadosPorEtapa`, `getClientesSemDiaFixo`, all `dashboard_*` RPCs) gets this for free by staying `SECURITY INVOKER`; adding a manual check risks it drifting from the real policy |
| Post-reopen list refresh | `revalidatePath("/perdidos")` bolted onto the shared `marcarStatus` action, or a full page reload | Client-side `reloadKey` refetch pattern (`AgendaList.tsx`'s established convention) | `marcarStatus`'s `revalidatePath("/clientes")` call has no reason to know about a new route; teaching it to would couple an unrelated action to this phase's UI. The reloadKey pattern is already this project's answer to "refresh a client-fetched list after a mutation elsewhere" |

**Key insight:** this phase's entire risk surface is in getting the **read** query right (date resolution + pagination); every **write** path it needs already exists and is already battle-tested by four prior phases (18, 22, 23, 27) that extended the same `mover_card_funil` RPC.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this phase adds a new read path and extends a display-only filter; it does not rename, rebrand, or move any existing entity, string, or identifier.

- **Stored data:** None — no existing data needs correction or migration. The new RPC only reads.
- **Live service config:** None — no external service config (n8n, Datadog, etc.) references anything this phase touches.
- **OS-registered state:** None — no scheduled tasks, no process managers involved.
- **Secrets/env vars:** None — no new secret or env var is introduced.
- **Build artifacts / installed packages:** None — no new package, no renamed package.

## Common Pitfalls

### Pitfall 1: Reusing `etapa_alterada_em` for "date marked as perdido"
**What goes wrong:** The column looks like exactly what's needed ("last time this card's state changed") and is already selected in `getClientesAgrupadosPorEtapa`'s row shape — easy to reach for by pattern-matching on existing code.
**Why it happens:** It genuinely does track *etapa* changes reliably; the trap is that a status-only change (perdido/ganho/em_andamento) does not touch it.
**How to avoid:** Use `historico.criado_em` per the "Onde mora a data de perda" section above — this is not a judgment call, it's a verified fact about this specific trigger.
**Warning signs:** If a manual test marks a client perdido and the date shown is the date the card *first entered its current Kanban column* rather than today, this pitfall has been hit.

### Pitfall 2: PostgREST's 1000-row page cap silently truncating the Perdidos list
**What goes wrong:** `clientes` already has 2000+ rows and both `getClientesAgrupadosPorEtapa` and `getClientesSemDiaFixo` had to be retrofitted with `buscarPaginado` after this bug shipped once already (quick task `260914-ng5`). An RPC call goes through the same PostgREST resource layer and is subject to the same default page size.
**Why it happens:** Supabase-js/PostgREST return at most 1000 rows per request without an explicit `.range()`; a table-returning RPC is not exempt.
**How to avoid:** Wrap `clientes_perdidos()` in `buscarPaginado()` from day one (`lib/supabase/queries/paginacao.ts`), same as `getClientesSemDiaFixo`. The RPC's own `order by u.criado_em desc, c.id asc` already provides the required stable tie-break for `.range()` pagination to be safe across pages.
**Warning signs:** A "Perdidos" count in the UI that doesn't match a manual count in the Supabase dashboard, especially once the list crosses ~1000 rows (won't be immediate, but this list only ever grows — unlike the Kanban, nothing removes a client from "ever having been perdido").

### Pitfall 3: `tests/clientes/prospeccao.test.ts` breaking silently after the D-06 refactor
**What goes wrong:** This existing test file asserts today's single-status behavior verbatim: `expect(apareceNaProspeccao("perdido")).toBe(true)` and `expect(STATUS_FORA_DA_PROSPECCAO).toBe("ganho")`. Both assertions are now **wrong** under D-06 and must be updated as part of this phase's own task list, not left for a future "fix failing test" surprise.
**Why it happens:** The refactor changes the shape of the exported constant (single string → array) and the behavior of one already-tested branch.
**How to avoid:** Include updating this test file explicitly as a task (not an afterthought) — flip the "perdido continua aparecendo" assertion to `false`, change the constant-shape assertion to check the array/Set, and update the "exatamente um dos três" case to expect `["perdido", "ganho"]` (both now hidden).
**Warning signs:** `npm test` failing on this specific file right after the `prospeccao.ts` edit — expected, and should be fixed in the same commit/task, not a separate one.

### Pitfall 4: Treating `getClientesParaExportacao` as something this phase needs to touch
**What goes wrong:** D-07 reads as a warning to "preserve" export behavior, which can be misread as needing a code change in the export path.
**Why it happens:** The sibling change (quick task `260915-ls7`, "ganho" leaving the Kanban) *did* require the `escopoTudo` fix in `app/api/clientes/exportar/route.ts` at the time — but that fix already exists and already covers this case.
**How to avoid:** Confirmed by direct read: `getClientesParaExportacao` (`lib/supabase/queries/clientes.ts`) has **no** `.neq`/`.not` filter on `status_acompanhamento` at all, and does not import `lib/funil/prospeccao.ts` — it is RLS-scoped only. D-07 is a **regression-test requirement** (add/extend a test asserting perdidos still appear in the export), not an implementation requirement. No code change needed here.
**Warning signs:** A task in the plan proposing to edit `app/api/clientes/exportar/route.ts` or `getClientesParaExportacao` — that would be unnecessary scope creep for this phase.

## Code Examples

### Reader wrapping the new RPC (mirrors `lib/supabase/queries/dashboard.ts`'s `getGanhosPerdidos` + `lib/supabase/queries/agenda.ts`'s `getClientesSemDiaFixo` pagination)
```typescript
// Source: pattern composed from lib/supabase/queries/dashboard.ts (RPC reader
// shape) + lib/supabase/queries/agenda.ts's getClientesSemDiaFixo (buscarPaginado
// wrapping an RPC/query call) — both already in this codebase.
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"

export type ClientePerdido = {
  clienteId: string
  razaoSocial: string | null
  nomeFantasia: string | null
  motivoPerdaNome: string | null
  perdidoEm: string
  responsavel: string
  responsavelNome: string | null
}

type ClientePerdidoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  motivo_perda_nome: string | null
  perdido_em: string
  responsavel: string
  responsavel_nome: string | null
}

export async function getClientesPerdidos(
  periodo?: { inicio: Date; fim: Date }
): Promise<ClientePerdido[]> {
  const supabase = await createClient()

  const rows = await buscarPaginado<ClientePerdidoRow>(async (inicio, fim) => {
    const { data, error } = await supabase
      .rpc("clientes_perdidos", {
        p_inicio: periodo?.inicio.toISOString() ?? null,
        p_fim: periodo?.fim.toISOString() ?? null,
      })
      .range(inicio, fim)

    return { data: data as unknown as ClientePerdidoRow[] | null, error }
  })

  if (rows === null) {
    throw new Error(`Falha ao carregar clientes perdidos: leitura paginada incompleta`)
  }

  return rows.map((row) => ({
    clienteId: row.cliente_id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    motivoPerdaNome: row.motivo_perda_nome,
    perdidoEm: row.perdido_em,
    responsavel: row.responsavel,
    responsavelNome: row.responsavel_nome,
  }))
}
```

### Reopen wiring — reusing the existing action, no new mutation
```typescript
// In the new PerdidosItemRow.tsx / PerdidosList.tsx — calls the EXISTING
// Server Action, exactly as ClienteCard.tsx's status Select already does.
import { marcarStatus } from "@/app/actions/funil"

async function handleReabrir(clienteId: string) {
  const result = await marcarStatus(clienteId, "em_andamento")
  if (!result.error) {
    setReloadKey((key) => key + 1) // AgendaList.tsx's established refetch pattern
  }
  return result
}
```

## State of the Art

Not applicable — this is a project-internal pattern extension, not an area with external "current vs deprecated" library churn to track. The only "old approach" being replaced is this project's own prior single-status prospecção rule (quick task 260915-ls7, ~10 days before this research), now extended by D-06.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.not("status_acompanhamento", "in", "(ganho,perdido)")` is valid supabase-js/PostgREST syntax for excluding both values in one filter | Architecture Patterns / Pattern 2 | Low — if the exact string form is wrong, the two-`.neq()`-chained fallback (`.neq("status_acompanhamento", "ganho").neq("status_acompanhamento", "perdido")`, PostgREST ANDs chained filters) achieves the identical result with zero new syntax risk; either verify with a quick manual query at Task 1 or default straight to the two-`.neq()` form, which is unambiguously already proven to work in this exact function today |
| A2 | Default period-filter behavior recommended as "show all, no filter, by default" (rather than a rolling preset like Dashboard's "últimos 30 dias") | Summary / Architecture Patterns | Low — explicitly marked Claude's Discretion in CONTEXT.md; either choice satisfies PERD-04, this is a UX call, not a correctness risk |
| A3 | `Archive` recommended as the sidebar icon (over `XCircle`) | User Constraints (D-03) | Low — explicitly Claude's Discretion; `XCircle`'s "error/stop" connotation risks contradicting D-02's explicit "not an alarm" tone, `Archive` (records put away) fits better, but either choice is reversible with a one-line change |
| A4 | New migration numbered `0034_clientes_perdidos.sql` | Recommended Project Structure | Low — current head is `0033_fix_classificacao_ativos_autocolisao.sql`; verify no other in-flight phase has already claimed `0034` before creating this migration |

## Open Questions

1. **Does the reopen action need a distinct Server Action name, or is calling `marcarStatus` directly from the new component acceptable?**
   - What we know: `marcarStatus` is already exported from `app/actions/funil.ts` and is a generic, reusable status-setter used today by the Kanban card's status Select.
   - What's unclear: Whether the planner prefers a thin `reabrirCliente(clienteId)` wrapper in a new `app/actions/perdidos.ts` purely for naming clarity/discoverability (no behavior difference).
   - Recommendation: Import `marcarStatus` directly — this project's own convention already reuses `marcarStatus` as the generic status-setter everywhere (Kanban, ficha) rather than wrapping it per-caller; a wrapper adds a file with zero new logic.

2. **Should `PerdidosList`'s initial load be a Server Component read (like `AgendaSemDiaFixo`'s data, fetched inside `page.tsx`) instead of a client-fetched Server Action (like `AgendaList`'s pendentes)?**
   - What we know: Both patterns coexist in this codebase today. `AgendaList` chose client-fetch specifically because "the component needs to refetch it after a mutation elsewhere" (its own docstring) — the exact same requirement this phase has (D-09, refetch after Reabrir).
   - What's unclear: Whether the planner wants an initial server-rendered first paint (avoids a loading flash) with a client-fetch-based refresh mechanism layered on top, vs. the simpler all-client-fetch `AgendaList` shape.
   - Recommendation: Match `AgendaList`'s all-client-fetch shape for simplicity and consistency (one less pattern in the codebase) — the loading-flash tradeoff is the same one `AgendaList` already accepted project-wide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase db push`) | New migration `0034` | Same as rest of project (already in use for 33 prior migrations) | Pinned per STATE.md note (`2.111.0` was pinned for a past push bug) — verify current pin before pushing | — |
| Local/linked Postgres via Supabase | RLS-backed integration tests for the new RPC | Same as rest of project's `tests/**/*.test.ts` suite | — | — |

No new external dependency is introduced by this phase — this table exists only to confirm no NEW audit is needed beyond what every other phase already relies on.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest.config.ts`, `environment: "node"` for `*.test.ts`, `jsdom` for `*.test.tsx`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/clientes/prospeccao.test.ts` (or the new RPC test file directly) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERD-01 | Cliente perdido não aparece nas 7 colunas do Kanban | unit + integration | `npx vitest run tests/clientes/prospeccao.test.ts` (unit, update existing assertions) + extend `getClientesAgrupadosPorEtapa`'s own test coverage if present | ✅ (unit file exists, needs updates) / ❌ Wave 0 for the grouped-etapa integration assertion if not already covered |
| PERD-02 | Tela mostra motivo/data/vendedor | integration (RPC against real Supabase) | `npx vitest run tests/funil/perdidos-rpc.test.ts` | ❌ Wave 0 — new file, mirrors `tests/dashboard/prospeccao.test.ts`'s RPC-call shape |
| PERD-03 | Vendedor só vê os próprios; Supervisor vê todos | integration (RLS negative case) | same file as above, mirrors `tests/dashboard/rls-dashboard.test.ts`'s cross-vendedor pattern (sign in as Vendedor A, assert Vendedor B's perdido is absent) | ❌ Wave 0 |
| PERD-04 | Filtro por período usa a data de perda | integration | same file — assert a client lost outside `[p_inicio, p_fim)` is excluded, one lost inside is included | ❌ Wave 0 |
| PERD-05 | Reabrir volta pra "Em andamento", some da lista | integration | same file — call `clientes_perdidos()` before/after invoking `marcarStatus(id, "em_andamento")` via a signed-in test client, assert the row disappears | ❌ Wave 0 |
| D-07 (export regression guard) | "Exportar todos" continua trazendo perdidos | integration | extend whatever existing test covers `getClientesParaExportacao`/`/api/clientes/exportar` (search `tests/` for `exportar`/`exportacao` before assuming none exists) | Confirm during planning — not verified this session |

### Sampling Rate
- **Per task commit:** `npx vitest run <file just touched>`
- **Per wave merge:** `npm test` (full suite) — note this project's own documented Supabase Auth rate-limit caveat on `signInWithPassword` (STATE.md Phase 13-01 note): a full clean run may need retries/isolation, same as every prior phase.
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/funil/perdidos-rpc.test.ts` (or `tests/clientes/perdidos-rpc.test.ts`) — covers PERD-02/03/04/05, mirrors `tests/dashboard/rls-dashboard.test.ts` + `tests/dashboard/prospeccao.test.ts` shape (seed via service role/signed-in client, assert as a different signed-in role, never as service-role for the positive assertions)
- [ ] `tests/clientes/prospeccao.test.ts` — needs its existing 5 assertions updated to match the D-06 Set-based behavior (not a net-new file, but a required edit before the suite is green again)
- [ ] Confirm whether an export-regression test already exists (search before writing a new one) covering "perdidos still export"

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | Existing Supabase Auth session, enforced by `app/(app)/layout.tsx` |
| V3 Session Management | No (unchanged) | — |
| V4 Access Control | **Yes** | RLS on `clientes`/`historico`/`motivos_perda`/`profiles` — zero new policy needed; the new RPC's `SECURITY INVOKER` status (no `security definer` clause) is the control that must be preserved |
| V5 Input Validation | Yes (minor) | `p_inicio`/`p_fim` are `timestamptz` parameters bound via `supabase.rpc(...)` (parameterized, no string concatenation) — no SQL injection surface. The `.not(..., "in", ...)` filter string interpolates only two fixed enum literals from `STATUS_FORA_DA_PROSPECCAO_LISTA` (never user input), so no injection surface there either |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A new RPC accidentally marked `security definer`, bypassing RLS and letting a Vendedor read every cliente's perdidos | Elevation of Privilege | Explicit code review checklist item: the RPC definition must have **no** `security definer` clause (grep the new migration file for the string before merging) — this is exactly the failure mode `tests/dashboard/rls-dashboard.test.ts`'s own docstring calls out ("fails loudly if any function ever accidentally gains a `security definer` clause") |
| Cross-vendedor "Reabrir" (a Vendedor reopening another vendedor's perdido client by guessing/tampering with a `clienteId`) | Tampering / Elevation of Privilege | Already covered — `marcarStatus`'s own pre-check SELECT is scoped by the same RLS `UPDATE` policy; a non-owned `clienteId` returns `cliente_nao_encontrado` before the RPC is ever called (existing code, unchanged by this phase) |
| Leaking cliente contact fields (`contato`/`telefone`/`email`) through the Perdidos list | Information Disclosure | The new RPC's `returns table(...)` must **not** select `contato`/`telefone`/`email` — success criterion 2 explicitly requires these stay confined to the ficha. Enforce by keeping the RPC's column list minimal (only what's in the Code Examples section above) |

### LGPD / dados pessoais — alerta obrigatório (política da organização)

Esta fase cria uma tela nova que lista, por cliente perdido: nome do cliente, motivo da perda, data, e o **nome do vendedor responsável**. Clientes são PJ, mas:
- O campo `responsavel` identifica um **funcionário** (dado pessoal do vendedor) atrelado a um evento potencialmente sensível ("perdeu este cliente, motivo: X") — isso é um registro de desempenho individual, ainda que indireto.
- O success criterion 2 já é explícito em **não** expor `contato`/`telefone`/`email` (dados de uma pessoa física de contato na PJ) nesta tela nova — isso já é privacy-by-default bem aplicado pelo próprio desenho da fase, e a pesquisa acima reforça isso como requisito técnico do RPC (não selecionar essas colunas).
- Recomendação: ao planejar/implementar, mantenha essa minimização de campos como está desenhada (só nome/motivo/data/vendedor) e não adicione campos extras "por conveniência" (ex.: telefone do cliente para facilitar contato) sem antes confirmar com o dono do projeto se isso muda o escopo de dados pessoais expostos nesta tela — meu papel aqui é alertar, a decisão de escopo de dados é do dono do projeto.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0002_clientes_and_funil.sql` — `clientes_before_update()`/`clientes_after_update_historico()` trigger bodies, RLS policies, CHECK constraints
- `supabase/migrations/0003_dashboard_aggregates.sql` — `dashboard_ganhos_perdidos()`, the direct precedent for the new RPC's date-resolution logic
- `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql` / `0025_ganho_exige_razao_social_e_endereco.sql` — confirmed every `mover_card_funil` guard is gated on `p_novo_status = 'ganho'` specifically, never fires on `'em_andamento'`
- `lib/funil/prospeccao.ts`, `lib/supabase/queries/clientes.ts`, `lib/supabase/queries/agenda.ts`, `lib/supabase/queries/paginacao.ts`, `app/actions/funil.ts`, `app/api/clientes/exportar/route.ts`, `components/clientes/KanbanBoard.tsx`, `components/agenda/AgendaSemDiaFixo.tsx`, `components/agenda/AgendaList.tsx`, `components/layout/AppSidebar.tsx`, `components/clientes/ClienteCard.tsx`, `components/clientes/PerdaMotivoDialog.tsx`, `lib/clientes/nomeExibicao.ts`, `lib/dashboard/periodo.ts`, `components/dashboard/PeriodoFilter.tsx` — all read directly this session
- `.planning/STATE.md` — Phase 04-01 decision log entry on `historico.criado_em` as the date basis; "SECURITY INVOKER by default" convention statement
- `tests/clientes/prospeccao.test.ts`, `tests/dashboard/rls-dashboard.test.ts`, `vitest.config.ts`, `package.json` scripts — test conventions and commands

### Secondary (MEDIUM confidence)
- `[CITED: supabase.com/docs/reference/javascript/not]` — WebSearch confirmed this official docs page exists and describes `.not(column, operator, value)` with raw PostgREST syntax; the exact parenthesized-list example for the `in` operator specifically was not directly quoted in the fetched snippet — flagged in Assumptions Log (A1) with a zero-risk fallback already identified

### Tertiary (LOW confidence)
None — every other claim in this document was verified directly against this repository's own code/migrations/tests, not against external/general knowledge.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new stack introduced
- Date-of-loss resolution (historico vs etapa_alterada_em): HIGH — verified against trigger source code + an already-shipped, tested sibling RPC
- RLS/authorization boundary: HIGH — verified against existing policies + the project's own documented SECURITY INVOKER convention
- Reopen-action safety (no guard fires on em_andamento): HIGH — verified line-by-line against both migrations that added guards to `mover_card_funil`
- UI component structure/reuse: HIGH — verified against the closest existing analog (`AgendaSemDiaFixo`/`AgendaList`)
- `.not(..., "in", ...)` exact syntax: MEDIUM — officially documented feature, exact string form not independently re-verified against a live query this session; safe fallback identified

**Research date:** 2026-09-25
**Valid until:** No external dependency to expire — valid until the next migration/refactor touches `historico`'s trigger shape, `mover_card_funil`'s guard set, or `lib/funil/prospeccao.ts` again (all internal, so no calendar-based expiry applies)
