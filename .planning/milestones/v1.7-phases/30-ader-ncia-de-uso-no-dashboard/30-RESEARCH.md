# Phase 30: Aderência de Uso no Dashboard - Research

**Researched:** 2026-09-27
**Domain:** Supabase Postgres (RLS + PL/pgSQL RPC) + Next.js App Router middleware/Server Actions — usage-tracking mechanism and a rolling-window aggregate, zero new npm dependencies
**Confidence:** MEDIUM-HIGH (every claim below is grounded directly in this repo's own migrations/components, read and quoted in this session — no external library research was needed since the phase is 100% internal architecture)

## Summary

This phase has no new external dependency to evaluate — it is entirely a Supabase schema/RPC design problem plus a small Next.js middleware/Server Action wiring problem, using tools already in the project (`@supabase/ssr`, existing migrations conventions, existing `dashboard_*` RPC pattern). The central technical gaps CONTEXT.md flagged (D-04, D-05, D-07) are now confirmed against the actual code, not assumed:

1. **D-04 (daily "opened the system" signal)** — confirmed there is genuinely no history of this today; only `auth.users.last_sign_in_at` (overwritten). The correct interception point is `lib/supabase/middleware.ts`'s `updateSession()`, which already runs a network call (`supabase.auth.getUser()`) on every authenticated request — adding one more idempotent RPC call, gated by a cheap cookie check (not a DB check) to avoid doing it on every request, is a direct, low-risk extension of an existing pattern, not a new architectural precedent.
2. **D-02/D-05 (cadastro/edição de cliente)** — confirmed by reading `0002_clientes_and_funil.sql`'s trigger bodies directly: `clientes_after_update_historico` only fires on `etapa`/`status_acompanhamento` changes, and there is no `AFTER INSERT` trigger on `clientes` at all. Recommendation: do **not** extend the `historico` trigger. Call the same new `registrar_acesso_diario()` RPC directly from `createCliente`/`updateCliente` (`app/actions/clientes.ts`) after a successful write. This reuses the one new minimal-data mechanism instead of teaching `historico` (a customer-facing audit trail) to also carry an unrelated "employee used the tool today" signal.
3. **D-07 (deactivation timestamp)** — confirmed `profiles.ativo` (migration 0008) has no companion timestamp anywhere; `desativar_membro_equipe`/`reativar_membro_equipe` only ever `update profiles set ativo = ...`. A new nullable `profiles.desativado_em timestamptz` column, set by `desativar_membro_equipe` and **deliberately left untouched** by `reativar_membro_equipe`, is the minimal-diff fix — with one known, acceptable limitation documented below (Open Questions).
4. **Vercel's ~10s limit** — the aggregate is one `language sql stable` RPC (no loop), same shape/cost class as `dashboard_comparativo_vendedor()`, safely within budget for ~15-20 vendedores.
5. **D-11 (retention without cron)** — the same `registrar_acesso_diario()` RPC piggybacks a `delete ... where dia < hoje - 35 dias` scoped to the caller's own rows (RLS-safe, no elevated privilege), naturally running once per vendor per day — no `pg_cron`, no Edge Function, no new infrastructure.

**Primary recommendation:** One new table (`acessos_diarios`, 2 non-PII columns), one new RPC (`registrar_acesso_diario()`, called from middleware + from `createCliente`/`updateCliente`), one new column (`profiles.desativado_em`), and one new read-only aggregate RPC (`dashboard_aderencia_uso()`, kept **separate** from `dashboard_comparativo_vendedor()` — do not touch that already-shipped function). Merge the two RPCs' results client-side (or in the query layer) by `responsavel` id before rendering the existing table's new column.

> **LGPD flag (organizational compliance, not a CONTEXT.md item):** this phase creates a system that records, per identified employee (vendedor), which calendar days they used a work tool — this is personal data about an identifiable natural person under LGPD, even though CONTEXT.md's own D-10/D-11 already push hard toward minimization (no timestamp/IP/device, ~35-day retention) and the dashboard-facing side is Supervisor-only. This is flagged explicitly here per this session's compliance instructions; D-12 (informing the sales team) is already correctly scoped by the project owner as out-of-code-scope, and nothing in this research recommends collecting anything beyond `(usuario_id, dia)`. Recommend the plan/discuss step re-confirm the 35-day retention number and the Supervisor-only read boundary as locked, non-negotiable constraints before implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Contar como "abriu alguma tela do sistema naquele dia" — não login literal do Supabase Auth.
- **D-02:** Conta também qualquer ação real já registrada em `historico` (mover etapa, concluir tarefa/visita) **e** cadastro/edição de cliente (hoje não registrado em `historico`).
- **D-03:** União (OR), não interseção — qualquer uma das condições basta.
- **D-04:** Mecanismo de registro de "abriu o sistema hoje" ainda sem solução pronta — candidatos: middleware com tabela nova de upsert idempotente, ou extensão do Supabase Auth. Não pode ser caro (não gravar em toda requisição).
- **D-05:** Mesma tabela nova é candidata natural para "cadastrou/editou cliente" — decidir na pesquisa entre estender o gatilho de `historico` ou usar a tabela de eventos nova.
- **D-06:** "Dia útil" = segunda a sexta, sem excluir feriados nacionais. "Últimos 28 dias" = janela de calendário corrida, com só os dias de semana entrando no denominador.
- **D-07:** Vendedor admitido/desativado no meio da janela conta só os dias efetivamente ativo. Achado técnico a resolver: `profiles.ativo` não tem data de mudança — confirmar se existe fonte alternativa ou se é necessário `desativado_em` novo. `created_at` já cobre admissão.
- **D-08 (travado desde a definição do marco):** Só Supervisor vê a coluna nova; nem a coluna nem os dados aparecem para Vendedor. Nova coluna na tabela comparativa existente (`ComparativoVendedorTable.tsx` / RPC `dashboard_comparativo_vendedor()`, migration 0011).
- **D-09:** Enquanto a janela de 28 dias não está completa, o Dashboard precisa deixar isso claro em vez de mostrar % artificialmente baixo — texto/indicador exato a decidir no planejamento.
- **D-10:** Registro guarda só quem e qual dia — nunca horário, IP, aparelho, localização. Dia carimbado pelo servidor, nunca aceito cru do navegador.
- **D-11:** Prazo de guarda ~35 dias, descarte automático do resto. Mecanismo de limpeza sem cron/worker de fundo — mesma restrição de custo zero já respeitada no projeto inteiro.
- **D-12 (fora do escopo de código):** Avisar o time de vendas que o uso é medido é decisão de comunicação do dono do projeto, não uma tarefa de implementação desta fase — não criar nenhum aviso/banner no sistema para isso a menos que pedido explicitamente depois.

### Claude's Discretion
- Nome exato da tabela/mecanismo de registro de acesso diário.
- Texto exato do indicador "janela ainda incompleta" (D-09).
- Se o cadastro/edição de cliente é registrado estendendo o gatilho de `historico` existente ou via a tabela nova de acesso — decisão técnica sem impacto de produto, resolvida nesta pesquisa (ver Summary, ponto 2 — recomendação: tabela nova, não o gatilho).

### Deferred Ideas (OUT OF SCOPE)
- Comunicação ao time sobre a métrica de uso (D-12) — fora do escopo de código, responsabilidade do dono do projeto.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADER-01 | Supervisor visualiza, na tabela comparativa por vendedor do Dashboard, um percentual de aderência de uso de cada vendedor | New `dashboard_aderencia_uso()` RPC (SECURITY INVOKER, Supervisor-only via RLS on `acessos_diarios`), merged into `ComparativoVendedorTable.tsx`'s existing row set — see Architecture Patterns |
| ADER-02 | Um dia conta como "usado" quando o vendedor faz login OU realiza qualquer ação real no funil (mover etapa, completar tarefa/visita, cadastrar/editar cliente) naquele dia | Union of `acessos_diarios` (login/open-app signal + cliente create/edit signal, both written via `registrar_acesso_diario()`) with `historico` rows of `tipo in ('etapa','status_acompanhamento','tarefa_concluida','visita_concluida')` — see Code Examples |
| ADER-03 | A métrica de aderência é uma média móvel dos últimos 28 dias, contando dias usados sobre dias úteis do período | `generate_series` + `extract(isodow from dia) < 6` inside `dashboard_aderencia_uso()`, prorated per vendedor via `profiles.created_at`/new `profiles.desativado_em` — see Code Examples and Common Pitfalls |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recording "opened the system today" | API/Backend (Postgres RPC) | Frontend Server (Next.js middleware, interception point only) | The actual write, idempotency guarantee, and server-authoritative date all live in Postgres (RLS + `now() at time zone`); middleware only decides *when* to call it (cheap cookie gate), never computes or trusts a date itself |
| Recording "cadastrou/editou cliente" | API/Backend (Postgres RPC, called from Server Action) | Frontend Server (Server Action orchestration) | Same RPC as above, called from an existing Server Action right after a successful DB write — no new client-side logic |
| Deactivation/admission proration | Database / Storage (`profiles` columns) | API/Backend (RPC reads them) | `created_at` (existing) and new `desativado_em` are schema facts; the aggregate RPC is the only place that interprets them |
| 28-day / dias úteis aggregation | API/Backend (single `language sql stable` RPC) | — | Same tier as every other `dashboard_*` function; no loop-per-vendedor needed at this team size (~15-20) |
| "Window not yet complete" indicator | API/Backend (RPC returns a scalar) | Browser/Client (`ComparativoVendedorTable.tsx` renders it) | The RPC is the only place that knows the earliest tracked day; the component only formats what it receives, mirroring `formatConversao`'s null-guard convention |
| Retention/cleanup (~35 days) | API/Backend (same write-path RPC) | — | No cron/worker exists in this project (established since Phase 13) — cleanup must piggyback an already-happening write |
| Read-authorization (Supervisor-only) | Database / Storage (RLS policy) | — | Matches every other table in this project — RLS is the only authorization boundary, never an app-level role check |

## Standard Stack

No new library is required for this phase. Every piece is either already in `package.json` or a native Postgres/Next.js capability already used elsewhere in this codebase.

### Core (already installed, reused as-is)
| Library | Version | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `^0.12.3` (confirmed in `package.json`) | Cookie-based session in `middleware.ts` — the interception point for D-04 | Already the only mechanism this project uses to read/refresh the session per request; no new package needed to also set one extra cookie |
| `@supabase/supabase-js` | `^2.110.5` (confirmed in `package.json`) | `.rpc()` calls from Server Actions and middleware | Same client already used by every other `dashboard_*`/`mover_card_funil` call in the codebase |
| PostgreSQL `generate_series` | built-in (Supabase-hosted Postgres, no extension) | Building the 28-day calendar and the "dias úteis" subset inside `dashboard_aderencia_uso()` | Native SQL, zero dependency; this project has no existing precedent for it but it's standard, well-documented core Postgres functionality — same trust level as the `left join lateral` pattern already used in `clientes_perdidos`/`clientes_encerrados` |

### Supporting
None. No `date-fns` helper is needed for the actual aggregation (kept 100% in Postgres, per this project's own established convention — see `concluir_visita`'s comment: "O dia-base do carimbo... nunca a data crua do servidor... o banco roda em UTC"). `date-fns` may optionally format the "Coletando dados desde X" label client-side, reusing the import already present in `lib/dashboard/periodo.ts`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `acessos_diarios` table + RPC | Supabase Auth's `last_sign_in_at` alone | Rejected outright by D-01/D-04 itself: a persistent-session app almost never re-triggers a real Auth login, so this would drastically undercount daily active vendors — already investigated and rejected in CONTEXT.md, not re-opened here |
| Cookie-gated middleware call | A dedicated Edge Function invoked from the client on every page load | Adds a second network hop and a second surface to secure for zero benefit — middleware already runs on every request and already makes one Supabase network call; extending it is strictly cheaper |
| Piggyback `DELETE` in `registrar_acesso_diario()` | Supabase's pg_cron / a scheduled Edge Function | This project has zero cron/background workers by explicit architectural decision since Phase 13 (`STATE.md`) — introducing pg_cron here would be a new precedent requiring its own discussion, not a drop-in fix, and Supabase's pg_cron needs the extension enabled and (on some tiers) is billed separately; piggybacking on an already-frequent write is free |
| Separate `dashboard_aderencia_uso()` RPC | Extending `dashboard_comparativo_vendedor()` in place | `dashboard_comparativo_vendedor()` (migration 0011) is explicitly "desde sempre... NO date recorte" (D-01/D-02 of that phase) — its whole design assumes no date window. ADER's 28-day rolling window with business-day denominator and per-vendedor proration is a materially different query shape; forcing both into one function risks regressing the already-shipped, already-tested VEND-01 behavior for zero reuse benefit |

**Installation:** none — no `npm install` needed for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new npm/PyPI/crates packages. No package legitimacy check was run because there is nothing to check — confirmed by reading `package.json` in full during this research session and cross-checking against every capability this phase needs (all satisfied by Postgres built-ins + already-installed `@supabase/ssr`/`@supabase/supabase-js`).

## Architecture Patterns

### System Architecture Diagram

```
[Vendedor's browser]
   │  (every authenticated request)
   ▼
[middleware.ts → updateSession()]
   │  1. supabase.auth.getUser()               (existing, unchanged)
   │  2. read cookie "aderencia_marcador"
   │     ├─ cookie fresh (< ~12h old)  → skip, do nothing new
   │     └─ cookie missing/stale       → call RPC registrar_acesso_diario()
   │                                       (idempotent insert + own-row cleanup)
   │                                     → refresh cookie
   ▼
[Postgres: registrar_acesso_diario()]
   │  insert into acessos_diarios (usuario_id, dia)
   │    values (auth.uid(), (now() at time zone 'America/Sao_Paulo')::date)
   │    on conflict (usuario_id, dia) do nothing
   │  delete from acessos_diarios
   │    where usuario_id = auth.uid() and dia < hoje - 35   (own rows only, RLS-scoped)
   ▼
[acessos_diarios table]  ←── ALSO written by ──┐
                                                │
[app/actions/clientes.ts: createCliente/updateCliente]
   │  after successful insert/update:
   │  supabase.rpc('registrar_acesso_diario')   (same RPC, same idempotency)

────────────────────────────────────────────────────────────────

[Supervisor views Dashboard]
   ▼
[ComparativoVendedorTable.tsx] → getComparativoVendedorAction()
   ▼
[lib/supabase/queries/dashboard.ts]
   │  Promise.all([
   │    dashboard_comparativo_vendedor()   (existing, UNCHANGED)
   │    dashboard_aderencia_uso()          (new)
   │  ])
   │  merge both result sets by `responsavel` id
   ▼
[dashboard_aderencia_uso() RPC]
   │  reads: acessos_diarios (login + cliente edit signal)
   │       UNION historico (tipo in etapa/status_acompanhamento/
   │                          tarefa_concluida/visita_concluida)
   │  denominator: generate_series(hoje-27, hoje) filtered to isodow < 6,
   │               clamped per-vendedor to created_at / desativado_em
   ▼
[one row per vendedor ativo: aderencia_pct, dias_usados, dias_uteis_periodo,
 dias_rastreados]
   ▼
[ComparativoVendedorTable.tsx renders new column]
   │  dias_rastreados < 28  → "Coletando dados desde <data>"
   │  dias_rastreados >= 28 → "XX,X%" (same Intl.NumberFormat pattern as
   │                           formatConversao/formatDias)
```

### Recommended Project Structure
```
supabase/migrations/
├── 0038_acessos_diarios.sql          # new table + RLS + registrar_acesso_diario() RPC
├── 0039_profiles_desativado_em.sql   # nullable column + recreate the 2 EQP RPCs (same signature)
└── 0040_dashboard_aderencia_uso.sql  # new read-only aggregate RPC (SECURITY INVOKER)

lib/supabase/
├── middleware.ts                     # extend updateSession() with the cookie-gated RPC call
└── queries/dashboard.ts              # new getAderenciaUso() reader + a merge helper

app/actions/
├── clientes.ts                       # createCliente/updateCliente call registrar_acesso_diario() after success
└── dashboard.ts                      # getComparativoVendedorAction() (or a new sibling action) returns the merged shape

components/dashboard/
└── ComparativoVendedorTable.tsx      # new column + formatAderencia() helper
```

### Pattern 1: Cookie-gated idempotent daily marker (D-04)
**What:** Middleware checks a lightweight cookie before ever calling the database; the database call itself is *also* idempotent (`on conflict do nothing`), so the cookie only needs to be an optimization, never a correctness guarantee.
**When to use:** Any "at most once per day per user" signal in an app with persistent sessions and no server-side per-user cache.
**Example:**
```typescript
// Source: this project's existing lib/supabase/middleware.ts (pattern extended,
// not yet written — illustrative shape for the plan/build phase)
const MARCADOR_COOKIE = "aderencia_marcador"
const MARCADOR_MAX_AGE_SECONDS = 60 * 60 * 12 // 12h: guarantees at most 2 calls/day/user, never 0

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(/* ...existing args unchanged... */)

  const { data: { user } } = await supabase.auth.getUser()

  if (user && !request.cookies.get(MARCADOR_COOKIE)) {
    // Fire-and-forget is NOT safe in Edge middleware (no background execution
    // guarantee) — await it, same as the existing auth.getUser() call above.
    await supabase.rpc("registrar_acesso_diario")
    response.cookies.set(MARCADOR_COOKIE, "1", { maxAge: MARCADOR_MAX_AGE_SECONDS })
  }

  return response
}
```
**Why this is safe without a timezone library:** the cookie only decides *whether* to call the RPC, never *what date* to write — that's computed authoritatively inside Postgres via `(now() at time zone 'America/Sao_Paulo')::date`, per D-10's "carimbado pelo servidor" requirement and this project's own existing convention (`concluir_visita`, `proxima_data_visita`).

### Pattern 2: Reusing one write-path RPC from two call sites (D-02/D-05)
**What:** `registrar_acesso_diario()` is called both from middleware (login/open-app signal) and from `createCliente`/`updateCliente` (cadastro/edição signal) — same RPC, same table, same idempotency, zero duplication.
**When to use:** Whenever two different user actions should count as the same underlying signal ("used the system today").
**Example:**
```typescript
// Source: app/actions/clientes.ts pattern, extended (illustrative)
// ...after the existing insert:
const { data: inserted, error } = await supabase.from("clientes").insert({...}).select("id").single()
if (error) { /* existing error handling, unchanged */ }

// New: best-effort, never blocks the user-facing success path on this call.
// A failure here must not turn a successful cliente creation into an error.
void supabase.rpc("registrar_acesso_diario").catch(() => {})

revalidatePath("/clientes")
return { data: { id: inserted!.id } }
```
**Why NOT extend the `historico` trigger instead:** `clientes_after_update_historico` (0002) only exists as an `AFTER UPDATE` trigger comparing `OLD`/`NEW` on two specific columns; there is no `AFTER INSERT` trigger on `clientes` at all today. Making it fire on *every* column edit (not just etapa/status) would (a) require a new trigger function plus changes to an already-fragile, already-tested trigger, (b) start writing "cliente editado" noise into the customer-facing `historico`/diário UI that no requirement asked for, and (c) still need a *separate* write for `acessos_diarios` anyway since D-10 forbids storing `cliente_id` in the usage-tracking table. Calling the same minimal RPC from the Server Action is strictly simpler and touches zero already-shipped trigger code.

### Pattern 3: Single aggregate RPC for a rolling business-day window
**What:** One `language sql stable` function computing a 28-day calendar, filtering to business days, unioning two data sources, and grouping per vendedor — no loop, no per-vendedor round trip.
**When to use:** Any per-team-member rolling-window percentage at this data scale (~15-20 rows).
**Example:**
```sql
-- Source: illustrative sketch for supabase/migrations/0040_dashboard_aderencia_uso.sql
-- (to be finalized at plan/build time — mirrors dashboard_comparativo_vendedor()'s
-- SECURITY INVOKER / no-role-check convention from migration 0011)
create or replace function dashboard_aderencia_uso()
returns table (
  responsavel uuid,
  aderencia_pct numeric,
  dias_usados int,
  dias_uteis_periodo int,
  dias_rastreados int
)
language sql
stable
as $$
  with parametros as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      (now() at time zone 'America/Sao_Paulo')::date - 27 as inicio_janela
  ),
  vendedores_ativos as (
    select p.id, p.created_at, p.desativado_em
    from profiles p
    where p.role = 'vendedor' and p.ativo = true
  ),
  calendario_util as (
    select gs::date as dia
    from parametros, generate_series(inicio_janela, hoje, interval '1 day') gs
    -- isodow: 1=segunda ... 7=domingo. < 6 mantém só segunda a sexta (D-06).
    where extract(isodow from gs) < 6
  ),
  uniao_eventos as (
    select a.usuario_id, a.dia
    from acessos_diarios a, parametros pm
    where a.dia between pm.inicio_janela and pm.hoje
    union
    select h.autor_id as usuario_id, (h.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from historico h, parametros pm
    where h.tipo in ('etapa', 'status_acompanhamento', 'tarefa_concluida', 'visita_concluida')
      and h.autor_id is not null
      and (h.criado_em at time zone 'America/Sao_Paulo')::date between pm.inicio_janela and pm.hoje
  ),
  por_vendedor as (
    select
      v.id as responsavel,
      -- D-07: efetivo_inicio nunca é antes do início da janela, nem antes da
      -- admissão, nem antes da mais recente desativação conhecida.
      greatest(pm.inicio_janela, v.created_at::date, coalesce(v.desativado_em::date, pm.inicio_janela))
        as efetivo_inicio,
      pm.hoje
    from vendedores_ativos v, parametros pm
  ),
  denominador as (
    select pv.responsavel, count(*) as dias_uteis_periodo
    from por_vendedor pv
    join calendario_util cu on cu.dia >= pv.efetivo_inicio
    group by pv.responsavel
  ),
  numerador as (
    select pv.responsavel, count(distinct ue.dia) as dias_usados
    from por_vendedor pv
    join uniao_eventos ue
      on ue.usuario_id = pv.responsavel and ue.dia >= pv.efetivo_inicio
    group by pv.responsavel
  )
  select
    pv.responsavel,
    case when d.dias_uteis_periodo = 0 then null
         else round(coalesce(n.dias_usados, 0)::numeric / d.dias_uteis_periodo * 100, 1)
    end as aderencia_pct,
    coalesce(n.dias_usados, 0) as dias_usados,
    coalesce(d.dias_uteis_periodo, 0) as dias_uteis_periodo,
    least(28, greatest(0, (pm.hoje - (select min(dia) from acessos_diarios)) + 1)) as dias_rastreados
  from por_vendedor pv
  left join denominador d on d.responsavel = pv.responsavel
  left join numerador n on n.responsavel = pv.responsavel
  cross join parametros pm;
$$;
-- No `security definer` — do not add one. Mirrors dashboard_comparativo_vendedor().
```
**Cost check:** ~15-20 vendedores × 28-day calendar × a bounded `historico`/`acessos_diarios` scan — orders of magnitude below Vercel's ~10s Server Action limit and Supabase free-tier compute; same complexity class as `dashboard_funil_detalhado()`, already proven in production.

### Anti-Patterns to Avoid
- **Computing "today" in JavaScript (middleware or Server Action) for the actual stored `dia` value:** this project has an established, hard-won rule (`concluir_visita`'s own comment) that date-sensitive writes must use `(now() at time zone 'America/Sao_Paulo')::date` computed *inside Postgres* — a JS `new Date()` in Vercel's Edge runtime defaults to UTC and would misattribute a 9pm BRT action to the next calendar day.
- **Extending `dashboard_comparativo_vendedor()` in place:** risks regressing an already-shipped, already-tested VEND-01 metric for an unrelated concern with a different date-window shape. Keep them as two functions merged at the query layer.
- **Adding `security definer` to any new function in this phase:** every `dashboard_*` function and every `mover_card_funil`-style RPC in this codebase is deliberately `SECURITY INVOKER` by omission — RLS is the only authorization boundary. `registrar_acesso_diario()` does not need elevated privilege either: give `acessos_diarios` a normal `with check (usuario_id = (select auth.uid()))` INSERT policy, exactly like `tarefas`/`cliente_produtos`'s parent-gated policies, not a `historico`-style no-insert-policy-plus-SECURITY-DEFINER-trigger pattern (that pattern exists specifically because `historico` is written *as a side effect* of another table's change, which is not the case here — the vendor is directly asserting their own action).
- **Clearing `desativado_em` on reactivation:** would silently lose the very data D-07 needs. Leave it set to the most recent deactivation timestamp indefinitely (see Open Questions for the known limitation this implies).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Business-day counting over a date range | A JS loop iterating 28 dates checking `getDay()` | Postgres `generate_series(...) + extract(isodow from ...)` inside the RPC | Keeps the single source of truth for date math in Postgres, per this project's own established convention; avoids a second, JS-side reimplementation of the same rule that could drift |
| "Once per day per user" write throttling | A custom in-memory rate limiter, a Redis-backed lock, or a new dependency | Cookie-gated middleware call + DB-side `on conflict do nothing` (belt-and-suspenders, not either/or) | The DB unique constraint is the actual correctness guarantee; the cookie is a pure cost optimization. No new infrastructure needed for either half |
| Scheduled data retention | `pg_cron`, a Vercel Cron Job, a Supabase Edge Function on a schedule | A `DELETE` piggybacked on the existing high-frequency write path (`registrar_acesso_diario()`) | This project has zero cron/background workers by explicit, repeated architectural decision (Phase 13 onward); every prior phase's cleanup-style need (none existed before this one) would have hit the same constraint |

**Key insight:** every mechanism this phase needs already has a close precedent somewhere in this same codebase (idempotent `on conflict do nothing` in `importar_clientes_lote`/lookup seeds, Postgres-side timezone-aware date math in `concluir_visita`, RLS-only authorization in every `dashboard_*` function, a 4-policy RLS shape in every editable-list table). The work here is recombination, not invention — treat any solution that reaches for a new dependency or a new privileged-execution pattern as a signal to re-check against this codebase's existing conventions first.

## Common Pitfalls

### Pitfall 1: UTC/BRT day-boundary mismatch
**What goes wrong:** A vendor working at 9-11pm BRT gets their access/action attributed to the *next* calendar day, silently shifting their adherence numbers.
**Why it happens:** Supabase-hosted Postgres runs in UTC by default; `current_date`/`now()::date` without an explicit `at time zone` conversion uses UTC, not Brazil time.
**How to avoid:** Every date computed in this phase — the `dia` written by `registrar_acesso_diario()`, the `dia` derived from `historico.criado_em` inside `dashboard_aderencia_uso()`, and the calendar window itself — must use `(now() at time zone 'America/Sao_Paulo')::date` / `(coluna at time zone 'America/Sao_Paulo')::date`, exactly like `concluir_visita`/`proxima_data_visita` already do.
**Warning signs:** A vendor's adherence recording a used-day one calendar date off from what they'd report; test assertions written assuming `now()::date` without the `at time zone` clause.

### Pitfall 2: `historico.autor_id` can be `null`
**What goes wrong:** `count(distinct ue.dia)` in the aggregate silently drops or misattributes events if `autor_id` is null and the join still matches some vendedor by accident.
**Why it happens:** `clientes_after_update_historico`/`tarefas_before_update_historico`/`visitas_after_update_historico` all stamp `autor_id` via `(select auth.uid())` — this is safe for any normal end-user-triggered request (Server Action or RLS-scoped `.update()`), but would be `null` if a row were ever written by a service-role context with no authenticated user.
**How to avoid:** The sketch above already filters `h.autor_id is not null` before joining — keep that filter; do not remove it as a "simplification" at build time.
**Warning signs:** A vendedor's `dias_usados` count including days no one actually recorded, or a test fixture inserting `historico` via `serviceClient()` without ever setting `autor_id` explicitly.

### Pitfall 3: `profiles.desativado_em` cannot express more than one deactivation/reactivation cycle inside a single 28-day window
**What goes wrong:** A vendedor deactivated, then reactivated, then deactivated again — all within the same 28-day window — would have their *second* deactivation timestamp overwrite the first, silently losing the first cycle's exclusion window.
**Why it happens:** A single nullable timestamp column can only ever represent the *most recent* toggle-to-false event, never a full history of toggles.
**How to avoid:** Accept this as a known, documented limitation for this phase (team size ~15-20, double-toggle-within-28-days is an edge case, not a common flow) rather than building a full `profiles_ativo_historico` audit table for it — flagged explicitly in Open Questions below for the discuss/plan step to confirm as acceptable.
**Warning signs:** A vendedor who was toggled off/on twice in one month showing an adherence percentage that looks too generous (their first, shorter deactivation gap silently stops counting against them once the second one overwrites `desativado_em`).

### Pitfall 4: Cookie-gate skew does not equal DB-write skew
**What goes wrong:** Assuming the cookie's `maxAge` value directly determines "how often the DB is hit" with calendar precision.
**Why it happens:** A 12-hour cookie can straddle a midnight boundary in either direction — worst case, ~2 calls in the same calendar day, or (rarely) a missed call right at a boundary that a *subsequent* request within the same day still catches (since the RPC call is unconditional whenever the cookie is absent/expired, and the write itself is idempotent regardless).
**How to avoid:** Do not try to make the cookie window exactly "once per calendar day" — that requires timezone-aware JS date math this design deliberately avoids (Pitfall 1). The DB-side `(usuario_id, dia)` primary key is the actual correctness guarantee; the cookie only bounds cost to "at most ~2 extra idempotent no-op calls per user per day," which is cheap.
**Warning signs:** Spending implementation effort trying to make the cookie logic timezone-exact — that effort belongs in the RPC's date computation, not in middleware.

### Pitfall 5: Forgetting the "not found" branch when a vendedor was never captured by `vendedores_ativos`
**What goes wrong:** A vendedor row appears in `dashboard_comparativo_vendedor()`'s output but not in `dashboard_aderencia_uso()`'s (or vice versa) if the two CTEs' `where` clauses on `profiles` ever drift apart.
**Why it happens:** Both functions independently filter `role = 'vendedor' and ativo = true` — copy-paste drift between two files is easy.
**How to avoid:** When merging the two RPC results at the query layer, use a `LEFT JOIN`-equivalent merge keyed by `responsavel`, defaulting missing adherence fields to `null`/`0` rather than assuming every id from one result set exists in the other. Write a test asserting both RPCs return the exact same set of `responsavel` ids for a given fixture.
**Warning signs:** A vendedor silently missing the new column's value in the UI with no visible error.

## Code Examples

### Table + RLS + write RPC (new migration, sketch — planner/executor finalizes exact SQL)
```sql
-- Source: this session's synthesis of migration 0001 (profiles' zero-write-
-- policy-for-regular-users precedent) + migration 0002 (tarefas' parent-
-- gated 4-policy shape, adapted here to "own row" instead of "own cliente")
create table acessos_diarios (
  usuario_id uuid not null references profiles(id) on delete cascade,
  dia date not null,
  primary key (usuario_id, dia)
);

alter table acessos_diarios enable row level security;

-- D-08: só Supervisor lê — nem o próprio vendedor lê seu registro bruto.
create policy "somente supervisor le acessos_diarios"
on acessos_diarios for select to authenticated
using (is_supervisor());

-- D-10 (parte 2 do critério 4): vendedor só grava a própria linha, nunca a
-- de outro. auth.uid() nunca vem do corpo da chamada.
create policy "usuario grava o proprio acesso diario"
on acessos_diarios for insert to authenticated
with check (usuario_id = (select auth.uid()));

-- Necessário para o DELETE de retenção (D-11) rodar sem privilégio elevado.
create policy "usuario apaga o proprio acesso diario antigo"
on acessos_diarios for delete to authenticated
using (usuario_id = (select auth.uid()));

create or replace function registrar_acesso_diario()
returns void
language plpgsql
as $$
begin
  insert into acessos_diarios (usuario_id, dia)
  values ((select auth.uid()), (now() at time zone 'America/Sao_Paulo')::date)
  on conflict (usuario_id, dia) do nothing;

  -- D-11: melhor esforço, roda dentro da mesma chamada de quem já está
  -- gravando — nunca apaga linha de outro usuário (RLS acima já garante).
  delete from acessos_diarios
  where usuario_id = (select auth.uid())
    and dia < (now() at time zone 'America/Sao_Paulo')::date - interval '35 days';
end;
$$;
-- No `security definer` — RLS above is the only authorization boundary.
```

### `profiles.desativado_em` migration (sketch)
```sql
-- Source: this session's read of 0008_desativacao_membro_equipe.sql — same
-- 2 function signatures, `create or replace` is sufficient (no param count
-- change), so no `drop function` ritual is needed here (unlike mover_card_funil).
alter table profiles add column if not exists desativado_em timestamptz;

create or replace function desativar_membro_equipe(
  p_profile_id uuid,
  p_novo_responsavel_id uuid
)
returns table(clientes_reatribuidos bigint)
language plpgsql
security definer
set search_path = public
as $$
-- ...body identical to 0008's, plus one line before the final
-- `update profiles set ativo = false where id = p_profile_id;`:
--   update profiles set ativo = false, desativado_em = now() where id = p_profile_id;
$$;

-- reativar_membro_equipe stays UNCHANGED — deliberately does NOT clear
-- desativado_em (Pitfall 3 above documents why, and what this trades off).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `auth.users.last_sign_in_at` as the only access signal | Dedicated `acessos_diarios` table, decoupled from Supabase Auth's session lifecycle | This phase | Correctly measures daily active use for a persistent-session app, where Auth's own "login" event essentially never re-fires |
| Single-purpose `dashboard_*` RPCs, one per metric | Same pattern continues — `dashboard_aderencia_uso()` joins the list rather than growing an existing function | Established since migration 0003, reaffirmed by this research | Keeps `dashboard_comparativo_vendedor()` (already shipped, VEND-01) untouched and low-risk |

**Deprecated/outdated:** none specific to this phase — no library versions are in play.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A 12-hour cookie `maxAge` is an acceptable balance between "cheap" (D-04's requirement) and "not miscounting" — the actual correctness guarantee is the DB unique constraint, not the cookie window | Architecture Patterns / Pitfall 4 | Low — even if the exact duration is wrong, worst case is a handful of extra idempotent no-op RPC calls per user per day, never a data-correctness bug |
| A2 | Treating a single, non-cleared `desativado_em` timestamp as "good enough" for D-07's proration, accepting the double-toggle-within-28-days edge case as out of scope | Common Pitfalls (Pitfall 3) | Medium for correctness of a rare edge case, zero for the common case (single hire or single deactivation inside the window); worth an explicit confirmation from the project owner in discuss-phase given it's a people-metric |
| A3 | `dashboard_aderencia_uso()` should be a separate RPC merged at the query layer, rather than extending `dashboard_comparativo_vendedor()` in place | Architecture Patterns / Alternatives Considered | Low-medium — if the planner instead prefers a single combined RPC for one fewer round trip, that's a valid alternative, but it must not regress the already-tested VEND-01 date-window semantics (D-01/D-02 of migration 0011) |
| A4 | The exact "window not yet complete" copy/behavior (D-09, explicitly Claude's Discretion) — this research proposes replacing the percentage with a "Coletando dados desde X" text when `dias_rastreados < 28`, mirroring `formatConversao`'s null-guard convention, but the exact wording is not locked | Architecture Patterns (diagram) / Summary | Low — purely a copy decision, easy to adjust post-hoc, explicitly flagged as discretion in CONTEXT.md |

**None of the above rise to the level of a compliance risk** — the LGPD-relevant facts (what columns exist, who can read them, the retention window) are all directly specified by CONTEXT.md's own locked decisions (D-10/D-11), not by any assumption in this research.

## Open Questions

1. **Should `dashboard_aderencia_uso()`'s per-vendedor denominator ever go to zero (a vendedor admitted *today*, before any business day has passed)?**
   - What we know: the sketch above already guards `dias_uteis_periodo = 0` by returning `aderencia_pct = null` rather than dividing by zero.
   - What's unclear: whether the UI should render that as "—" (matching `formatConversao`/`formatDias`'s existing null convention) or as the same "Coletando dados" text used for D-09's incomplete-window case.
   - Recommendation: treat it identically to the incomplete-window case in the UI (same message), since from the Supervisor's point of view both mean "not enough data yet" — confirm in plan/discuss.

2. **Does the double-deactivation-within-28-days edge case (Pitfall 3 / Assumption A2) need a real fix in this phase, or is it acceptable to defer?**
   - What we know: at ~15-20 vendedores and typical team-management cadence, two deactivate/reactivate cycles for the same person inside one 28-day window is very unlikely.
   - What's unclear: whether the project owner considers this metric precise enough to matter for a rare edge case, versus treating it as a known, documented simplification (same spirit as D-06's "sem excluir feriados" simplicity choice).
   - Recommendation: confirm as an accepted limitation during discuss-phase rather than building a full `profiles` audit-history table for it now; revisit only if it actually happens in practice.

3. **Exact retention duration and copy for D-09/D-11 — both already marked "Claude's Discretion" in CONTEXT.md.**
   - What we know: D-11 says "~35 dias" (a margin over the 28 needed); D-09 leaves the exact indicator text open.
   - What's unclear: nothing blocking — these are genuinely open by design.
   - Recommendation: lock both concrete values (35 days; "Coletando dados desde {data}") during plan-phase, not deferred further, since they're simple to decide once and don't need more research.

## Environment Availability

Skipped — this phase adds no new external dependency or service. The only "environment" requirement is the already-configured Supabase project (used by every other phase) and the existing Next.js/Vercel deployment, both already verified working by every prior shipped phase in this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (confirmed in `package.json`) |
| Config file | `vitest.config.ts` — `environment: "node"`, `fileParallelism: false` (deliberate, to avoid races against the shared live Supabase project), loads `.env`/`.env.local` for real credentials |
| Quick run command | `npm test -- tests/dashboard/aderencia-uso.test.ts` (new file, mirrors `tests/dashboard/comparativo-vendedor.test.ts`'s structure) |
| Full suite command | `npm test` |

This project's own convention (confirmed by reading `tests/dashboard/comparativo-vendedor.test.ts` and `tests/equipe/rls-desativar-membro.test.ts` directly) is **integration tests against the real, live Supabase project** — no mocking of RLS or RPC behavior. Every RLS-sensitive assertion is run through `signInAs()` (never `serviceClient()`, which bypasses RLS and would make the assertion vacuous), and any test that needs a disposable team member uses `createTestMember`/`deleteTestMember` rather than the shared `SEED_ACCOUNTS` identities, since this phase's fixtures need controlled `created_at`/`desativado_em` values.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADER-01 | Supervisor sees the new column; a Vendedor's call to `dashboard_aderencia_uso()` never returns another vendedor's row/percentage | integration (RLS) | `npm test -- tests/dashboard/rls-aderencia-uso.test.ts` | ❌ Wave 0 |
| ADER-02 | A day with only a `historico` tarefa/visita conclusion (no `acessos_diarios` row) still counts as used; a day with only an `acessos_diarios` row (no funnel action) also counts | integration | `npm test -- tests/dashboard/aderencia-uso.test.ts` | ❌ Wave 0 |
| ADER-02 | `createCliente`/`updateCliente` write an `acessos_diarios` row on success | integration | `npm test -- tests/clientes/registrar-acesso-diario.test.ts` | ❌ Wave 0 |
| ADER-03 | 28-day window correctly counts only Mon-Fri; a vendedor admitted mid-window has a smaller denominator; a vendedor with `desativado_em` inside the window has a smaller denominator | integration | `npm test -- tests/dashboard/aderencia-uso.test.ts` | ❌ Wave 0 |
| D-04 | `registrar_acesso_diario()` is idempotent — calling it twice in the same day writes exactly one row | integration | `npm test -- tests/dashboard/registrar-acesso-diario.test.ts` | ❌ Wave 0 |
| D-10 | A vendedor cannot insert a row with `usuario_id` other than their own; a vendedor cannot `select` from `acessos_diarios` at all | integration (RLS) | `npm test -- tests/dashboard/rls-acessos-diarios.test.ts` | ❌ Wave 0 |
| D-11 | Rows older than 35 days are deleted as a side effect of `registrar_acesso_diario()` | integration | `npm test -- tests/dashboard/registrar-acesso-diario.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new test file(s) touched by that task (e.g. `npm test -- tests/dashboard/aderencia-uso.test.ts`)
- **Per wave merge:** `npm test` (full suite — this project's `fileParallelism: false` setting means this already serializes against the shared live database, matching every prior phase's practice)
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard/rls-acessos-diarios.test.ts` — covers D-10 (own-row insert/delete only, Supervisor-only select)
- [ ] `tests/dashboard/registrar-acesso-diario.test.ts` — covers D-04/D-11 (idempotency, timezone-correct `dia`, retention delete)
- [ ] `tests/dashboard/aderencia-uso.test.ts` — covers ADER-02/ADER-03 (union of both signal sources, business-day denominator, proration)
- [ ] `tests/dashboard/rls-aderencia-uso.test.ts` — covers ADER-01 (Supervisor-only visibility of the aggregate)
- [ ] `tests/clientes/registrar-acesso-diario.test.ts` — covers ADER-02's cliente cadastro/edição signal specifically
- [ ] No new framework/config install needed — Vitest is already fully configured for this exact integration-test style.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth flow; relies entirely on the existing Supabase Auth session already validated by `updateSession()` |
| V3 Session Management | no | No new session state beyond one non-sensitive cookie (a boolean-ish marker, no PII, no token) |
| V4 Access Control | yes | RLS policies on `acessos_diarios` (Supervisor-only SELECT, own-row-only INSERT/DELETE) as the sole authorization boundary — no app-level role check, matching every other table in this project |
| V5 Input Validation | yes | The only "input" this phase accepts from a client is an authenticated identity (`auth.uid()`, never a client-supplied user id or date) — the `dia` value is always server/DB-computed, never parsed from a request body |
| V6 Cryptography | no | No secrets or cryptographic material introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A vendedor inserting a fabricated "I used the system" row for a day they didn't work, to inflate their own metric | Tampering | RLS `with check (usuario_id = (select auth.uid()))` + the `dia` value is never accepted from the client, always `(now() at time zone 'America/Sao_Paulo')::date` computed inside the RPC — a client cannot backdate or forward-date a row even if they call the RPC directly |
| A vendedor reading another vendedor's (or their own) daily access pattern via the API | Information Disclosure | RLS `using (is_supervisor())` on SELECT — D-08's "nem os dados aparecem para um Vendedor" enforced at the database level, not just hidden in the UI |
| A vendedor deleting another vendedor's historical rows to erase evidence of non-use | Tampering / Repudiation | RLS `using (usuario_id = (select auth.uid()))` on DELETE — the retention cleanup can only ever remove the caller's own rows |
| Middleware silently failing to record access (network hiccup calling the RPC) blocking the user's actual request | Denial of Service (self-inflicted) | The RPC call inside `updateSession()` must be wrapped so a failure never blocks/redirects the request — mirror `app/(app)/layout.tsx`'s existing `try { ... } catch { agendaCount = 0 }` "never take down the whole authenticated area for a decorative metric" posture |

**LGPD-specific note (beyond standard ASVS, per this session's compliance mandate):** the `acessos_diarios` table stores personal data about identified employees (which days they used a work system). The design in this research already enforces data minimization (2 columns, no timestamp/IP/device per D-10) and a bounded retention window (D-11), both already locked in CONTEXT.md. Recommend the plan/discuss step explicitly re-confirm these two numbers (columns stored; 35-day retention) as non-negotiable before build, and that the project owner's own D-12 communication to the sales team happens before or at the same time this phase ships to production — not after.

## Sources

### Primary (HIGH confidence — direct codebase reads in this session)
- `supabase/migrations/0001_profiles_and_roles.sql` — `profiles` table shape, `is_supervisor()`, zero-write-policy-for-regular-users precedent
- `supabase/migrations/0002_clientes_and_funil.sql` — confirms `historico` triggers fire ONLY on etapa/status_acompanhamento changes and tarefa completion; no `AFTER INSERT` trigger on `clientes`
- `supabase/migrations/0008_desativacao_membro_equipe.sql` — confirms `profiles.ativo` has no companion timestamp; full body of `desativar_membro_equipe`/`reativar_membro_equipe`
- `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` — exact `SECURITY INVOKER`/no-date-recorte convention for `dashboard_*` functions, the function this phase's new column attaches next to
- `supabase/migrations/0015_conclusao_com_resumo.sql` — confirms `tarefa_concluida`/`visita_concluida` `historico` rows exist with `autor_id`/`criado_em`, and this project's established `at time zone 'America/Sao_Paulo'` convention for date-sensitive writes
- `supabase/migrations/0034_clientes_perdidos.sql`, `0036_encerrar_cliente_ativo.sql` — most recent precedent for new read-only reporting RPCs and for extending `mover_card_funil`'s parameter count safely
- `lib/supabase/middleware.ts`, `middleware.ts` — confirmed exact interception point and its existing per-request Supabase network call
- `app/(app)/layout.tsx` — confirmed Server Components cannot set cookies; confirmed the "never let a decorative metric take down the app" `try/catch` precedent
- `app/actions/clientes.ts` — confirmed `createCliente`/`updateCliente`'s exact structure and where a new RPC call would attach
- `components/dashboard/ComparativoVendedorTable.tsx`, `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts` — confirmed the row shape, fetch pattern, and format-helper convention (`formatConversao`/`formatDias`) the new column must match
- `tests/dashboard/comparativo-vendedor.test.ts`, `tests/equipe/rls-desativar-membro.test.ts`, `tests/helpers/supabase-test-clients.ts`, `vitest.config.ts` — confirmed this project's integration-test-against-live-Supabase convention
- `package.json` — confirmed no new dependency is needed anywhere in this phase
- `.planning/STATE.md` (Roadmap v1.3 decisions) — confirmed "sem cron / sem worker de fundo" as a standing, explicit architectural decision since Phase 13, directly informing the D-11 retention mechanism recommendation

### Secondary (MEDIUM confidence)
None — no external documentation was consulted; every claim above is grounded in a direct read of this repository's own files during this session.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every capability confirmed already present in `package.json`/Postgres built-ins
- Architecture: HIGH — every pattern proposed is a direct extension of an already-shipped, already-read pattern in this same codebase (not inferred from training data)
- Pitfalls: HIGH for timezone/RLS-authorization pitfalls (directly precedented in this codebase's own comments); MEDIUM for the double-deactivation edge case (a genuinely new scenario this project hasn't faced before, flagged as an open question rather than asserted as solved)

**Research date:** 2026-09-27
**Valid until:** No external library version dependency — this research does not go stale on the usual 30-day cycle. Re-validate only if `profiles`/`historico`/`clientes` schema changes again before this phase is planned, or if `dashboard_comparativo_vendedor()` (migration 0011) is modified by an intervening phase.
