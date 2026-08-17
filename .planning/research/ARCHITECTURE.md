# Architecture Research — v1.5 (Calendário na Agenda e Conclusão Remota)

**Domain:** Extending an existing Next.js 16 App Router + Supabase (Postgres/Auth/RLS) sales CRM — Agenda screen (read layer `agenda_do_vendedor()`) and completion RPCs (`concluir_tarefa_prospeccao`/`concluir_visita`)
**Researched:** 2026-08-17
**Confidence:** HIGH (all findings sourced directly from the actual migrations/components listed below, cross-checked against 4 prior milestones' worth of the identical "add a 6th field / extend an RPC" pattern — this is the 6th time this exact move has been made in this codebase)

## Standard Architecture

### System Overview (current, pre-v1.5)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Client Component layer                                                   │
│  AgendaList.tsx (owns fetch + vendedor filter + section split + dialogs)  │
│    ├─ AgendaItemRow.tsx (presentational card, "Concluir" button)          │
│    ├─ ConcluirItemDialog.tsx (resumo + próxima-data picker, one dialog    │
│    │    parametrized by `origem`, shared by tarefa/visita)                │
│    └─ ClienteDetailSheet.tsx (opened from a row)                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Server Action layer — app/actions/agenda.ts                              │
│    getAgendaAction() → lib/supabase/queries/agenda.ts → RPC               │
│    concluirTarefaProspeccao() / concluirVisita() → RPC (re-validates      │
│      resumo client-side as defense-in-depth, never trusts the browser)    │
├──────────────────────────────────────────────────────────────────────────┤
│  Pure logic layer — lib/agenda/itens.ts (NO next/*, NO supabase import)   │
│    bucketDoItem/agruparAgenda (atrasado/hoje/próximos), filtrarPorVendedor,│
│    vendedoresDaAgenda — single authority for every date-bucket decision   │
├──────────────────────────────────────────────────────────────────────────┤
│  Postgres — SECURITY INVOKER only, RLS is the ONLY authorization boundary │
│    agenda_do_vendedor() — union of pending tarefas + pending visitas      │
│    concluir_tarefa_prospeccao(p_tarefa_id, p_resumo)                      │
│    concluir_visita(p_visita_id, p_resumo, p_proxima_data default null)   │
│    tarefas_before_update_historico() / visitas_after_update_historico()   │
│      — the ONLY 2 functions in the project allowed to write `historico`,  │
│      both SECURITY DEFINER TRIGGERS (a separate, already-blessed bucket,  │
│      NOT counted against the 4 documented SECURITY DEFINER RPC exceptions)│
└──────────────────────────────────────────────────────────────────────────┘
```

### v1.5 additions overlaid on the same diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NEW: AgendaCalendar family (month/week/day grid) — pure presentational,  │
│  consumes the SAME AgendaItem[] the List already fetches. No new fetch.   │
├──────────────────────────────────────────────────────────────────────────┤
│  MODIFIED: ConcluirItemDialog.tsx gains a "Não foi presencial" checkbox   │
│  + motivo Select (fetched via a NEW active-only lookup, same shape as     │
│  getMotivosPerdaAtivos)                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  MODIFIED (append-only, drop+create per project convention):              │
│    concluir_tarefa_prospeccao(..., p_motivo_conclusao_remota_id default null) │
│    concluir_visita(..., p_motivo_conclusao_remota_id default null)       │
│      — "next visit date" block is UNTOUCHED, physically unreachable from  │
│      the new parameter (see Data Flow below)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  NEW table: motivos_conclusao_remota (6th editable list, literal copy of  │
│  motivos_perda's shape) + 1 nullable FK column on EACH of tarefas/visitas │
│  NO new SECURITY DEFINER RPC. agenda_do_vendedor() is UNCHANGED.          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component/Function | Status | Responsibility |
|---|---|---|
| `agenda_do_vendedor()` (`supabase/migrations/0014_agenda_do_vendedor.sql`, extended in `0015`) | **UNCHANGED** | Returns pending tarefas ∪ pending visitas, RLS-scoped, one row per item, `data` is a pure `date` column (no time-of-day) |
| `lib/agenda/itens.ts` | **EXTENDED** (new pure function only) | Add `agruparPorData` (or `agrupaPorMes`/`agrupaPorSemana`), same posture as `agruparAgenda`/`bucketDoItem` — single authority for date→grid-cell mapping, still zero `next/*`/`supabase` imports |
| `AgendaList.tsx` | **REFACTORED** (light) | Currently owns fetch + filter + render in one file. Needs to become the fetch/filter *owner* only, handing `itensFiltrados` down to whichever view (List/Calendar) is active, instead of also being the renderer |
| `AgendaCalendar*.tsx` (new: month/week/day) | **NEW** | Pure presentational, props-in (`AgendaItem[]`, `modo`, current date, `onDiaClick`/`onOpen`/`onConcluir` callbacks) — reuses `AgendaItemRow`'s existing gray/blue badge convention (Prospecção = `variant="outline"`, Visita = `variant="secondary"`) for the month-grid chips |
| `ConcluirItemDialog.tsx` | **EXTENDED** | Adds "Não foi presencial" checkbox + conditional motivo `Select`, sourced from a new active-only lookup; still the single dialog shared by tarefa/visita completion (no new component) |
| `motivos_conclusao_remota` table | **NEW** | 6th Supervisor-editable reference list, literal structural copy of `motivos_perda` (`id`/`nome`/`ativo`/`created_at`) |
| `tarefas.motivo_conclusao_remota_id`, `visitas.motivo_conclusao_remota_id` | **NEW columns** | Nullable FK to the new table. Presence of a non-null value IS the "foi remoto" signal — no separate boolean column |
| `concluir_tarefa_prospeccao`, `concluir_visita` | **EXTENDED** (new trailing optional param, drop+create) | Same atomic-completion contract; the new param is written into the same `UPDATE` that already writes `resumo`/`concluida`/`data_realizada` |
| `tarefas_before_update_historico`, `visitas_after_update_historico` | **UNCHANGED (recommended)**, optionally extended | Already the only writers of `historico`; see "Open design point" below for the one place this milestone could touch them |

## Answering the two architecture questions directly

### A) Calendar view — no new RPC

**Reuse `agenda_do_vendedor()`'s existing output, grouped client-side by date.** Reasoning, grounded in the actual code:

1. `agenda_do_vendedor()` already returns **every pending item, unbounded by date** — there is no `WHERE data BETWEEN ...` clause in either half of the `UNION ALL` (`supabase/migrations/0015_conclusao_com_resumo.sql`, section 7). `AgendaList.tsx` already fetches this full set once per mount via `getAgendaAction()`. Whatever date range the calendar needs to render (a specific month, week, or day) is **already sitting in the browser** the moment `AgendaList`'s data-owning ancestor mounts — there is nothing to fetch that the List doesn't already have.
2. This project already has the exact precedent for "take the one already-fetched item list and derive a client-side view of it via a pure function": `agruparAgenda`/`bucketDoItem`/`filtrarPorVendedor`/`vendedoresDaAgenda` in `lib/agenda/itens.ts` do precisely this for the List's 3 sections. The calendar needs the same kind of function — group by ISO date string, cap the month-grid preview at 3 + `"+N"` — living in the same file (or a sibling `lib/agenda/calendario.ts` if it grows large), with the same "pure, no `next/*`, no `@/lib/supabase/*`" discipline so it stays importable from the Client Component tree.
3. Scale check: `STACK.md`'s own reasoning for `@tanstack/react-table`'s client-side sort/filter/paginate ("free-tier data volumes — hundreds, not tens of thousands") applies identically here — a single sales team's pending-item count is small enough that grouping the full set into day/week/month buckets in the browser is cheap, and doing it server-side would just move the same amount of work into a second RPC round-trip for no benefit.
4. **Scope boundary to flag explicitly**: because `agenda_do_vendedor()` only returns items that are still *pending* (`t.concluida = false` / `v.data_realizada is null`), the calendar will only ever show pending work — navigating to a past month does **not** turn it into a historical activity log; a completed item disappears from the feed the moment it's concluded, same as it already does in the List today. That's a feature, not a bug (the Diário already owns the historical view), but it's worth confirming explicitly with the non-technical owner during Discuss so "click a day in the past" isn't expected to show what happened that day.

**Implication for `AgendaList.tsx`**: today it's a single component that both *owns the fetch/filter state* and *renders the list*. Adding a List↔Calendar toggle means splitting those two responsibilities — the fetch/filter/dialog-open state (the `useEffect` fetch, `reloadKey`, `vendedorFiltroId`, `concluirItem`/`concluirDialogOpen`, `ClienteDetailSheet` wiring) needs to live one level above wherever the toggle lives, so both the List body and the new Calendar body consume the same `itensFiltrados` and share the same completion dialog instance. This is a refactor of an existing file, not a new data layer.

### B) Conclusão remota + motivo — minimal schema change

**New table, literal copy of `motivos_perda`'s shape** (not `frequencias_pedido`'s — that one deliberately stores a plain string on `clientes.frequencia_pedidos` because the decision D2 in `supabase/migrations/0016_frequencias_pedido.sql` was explicitly "avoid an `ALTER TABLE` on `clientes`, which already has real data." That constraint doesn't apply here — `tarefas`/`visitas` already grew a nullable `resumo` column in migration `0015` with zero drama, so a second nullable column is the established move, and the milestone context explicitly asks for the `motivos_perda` FK pattern):

```sql
create table motivos_conclusao_remota (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
-- RLS: literal copy of frequencias_pedido's 4 policies (0016) —
-- select open to `authenticated`, insert/update/delete gated by is_supervisor().

alter table tarefas add column motivo_conclusao_remota_id uuid references motivos_conclusao_remota(id);
alter table visitas add column motivo_conclusao_remota_id uuid references motivos_conclusao_remota(id);
```

**No separate `remoto boolean` column.** The project has a standing bias against two fields that can drift out of sync (see `PROJECT.md` Key Decisions: `"Ativo" é sinônimo de status_acompanhamento = 'ganho' — sem um segundo campo/estado`, and `frequencia_visita é um valor só ... Nunca dessincroniza`). `motivo_perda_id` already sets the precedent of using "is the FK populated?" as the boolean itself (`chk_perdido_exige_motivo` in `0002_clientes_and_funil.sql` checks `motivo_perda_id is not null` as the entire enforcement, no separate flag). Mirroring that: `motivo_conclusao_remota_id IS NOT NULL` *is* "foi remoto" — structurally impossible to have "marked remote but no reason," which is exactly the kind of guarantee this project prefers to get "for free" from the shape of the SQL rather than from screen discipline (see the `atualizar_frequencia_visita_lote` Key Decision: *"Torna estruturalmente impossível... garantido pela forma do SQL, não por disciplina de tela"*).

**RPC extension — append a new trailing optional parameter, using this project's established drop-before-create pattern**, never a bare `create or replace`:

```sql
-- concluir_tarefa_prospeccao: 2 params → 3 params
drop function if exists concluir_tarefa_prospeccao(uuid, text);

create function concluir_tarefa_prospeccao(
  p_tarefa_id uuid,
  p_resumo text,
  p_motivo_conclusao_remota_id uuid default null
) returns void language plpgsql as $$ ... $$;
-- body: same guard + same UPDATE, with
--   motivo_conclusao_remota_id = p_motivo_conclusao_remota_id
-- added to the SET clause. Nothing else changes.

-- concluir_visita: 3 params → 4 params
drop function if exists concluir_visita(uuid, text, date);

create function concluir_visita(
  p_visita_id uuid,
  p_resumo text,
  p_proxima_data date default null,
  p_motivo_conclusao_remota_id uuid default null
) returns void language plpgsql as $$ ... $$;
```

This is not a style preference — it's the exact convention this codebase has used every one of the 3 prior times an RPC grew a parameter (`mover_card_funil` 5→6 params in `0013`, 6→7 in `0018`; `agenda_do_vendedor` gained 2 output columns via explicit `drop function if exists agenda_do_vendedor();` before `create function` in `0015`). The migration comments in `0018_cnpj_obrigatorio_no_ganho.sql` spell out why: `CREATE OR REPLACE FUNCTION` with a different parameter count doesn't replace the old signature, it creates an ambiguous overload, and "toda chamada existente do app ... passa a falhar por ambiguidade no PostgREST." The Supabase calls in `app/actions/agenda.ts` already use named-arg JSON (`supabase.rpc("concluir_visita", { p_visita_id, p_resumo, p_proxima_data })`), so adding `p_motivo_conclusao_remota_id` doesn't require touching any existing call site's argument order — but the migration itself must still do the explicit drop.

**Why the "next visit date" computation is untouched, provably.** In `concluir_visita` (`0015_conclusao_com_resumo.sql`, section 6), the block that computes/inserts the next `visitas` row reads `v_frequencia` from `clientes.frequencia_visita` (looked up fresh inside the function, never trusting the caller) and branches only on `v_frequencia` and `p_proxima_data`. It has **zero reference** to `resumo` or (after this change) to `p_motivo_conclusao_remota_id` — the new parameter only ever reaches the earlier `UPDATE visitas SET ...` statement, several lines before that block even starts. There is no code path in which adding a new nullable field to the `SET` clause changes what the next-visit block sees or does. This directly satisfies the milestone's requirement that a remote completion "ainda sugere a próxima data pela frequência" — it does, automatically, because that logic was never conditioned on how the visit was concluded in the first place.

**Frontend**: `ConcluirItemDialog.tsx` gets a new conditional section (checkbox + `Select`), same structural slot as the existing "próxima visita sugerida" section that already only renders `when origem === "visita" && temCadencia"`. The motivo options come from a **new active-only lookup**, copying the existing `getMotivosPerdaAtivos()` (`lib/supabase/queries/clientes.ts`) → `getMotivosPerda()` (`app/actions/funil.ts`) → `PerdaMotivoDialog.tsx` chain verbatim: add `getMotivosConclusaoRemotaAtivos()` next to `getMotivosPerdaAtivos()`, wrap it in a thin auth-checked Server Action in `app/actions/agenda.ts` (where `concluirTarefaProspeccao`/`concluirVisita` already live), and fetch it on dialog open the same way `PerdaMotivoDialog` fetches motivos on open. The Supervisor-CRUD side is **free**: add `"motivos_conclusao_remota"` to the `ListaTabela` union in `app/actions/listas.ts` and one more tab in `components/configuracoes/ConfiguracoesTabs.tsx` — `EditableListTab`/`getListaValores`/`createListaValor`/`updateListaValor`/`setListaValorAtivo` are already fully generic over the table name and need zero new code, exactly the same "N+1" cost the project already paid going from 4 to 5 lists in `0016_frequencias_pedido.sql`.

**Client-side defense-in-depth to replicate**: `concluirVisita` (Server Action) already pre-validates "cadência real + no confirmed date → reject before hitting the server" (`app/actions/agenda.ts`, `precisaDeData`/`data_nao_confirmada`). The same shape applies here: if the checkbox is checked, require a motivo before calling the RPC (mirrors the existing `temCadencia && !proximaData` guard in `ConcluirItemDialog.tsx`'s `confirmDisabled`) — pure UX courtesy, since the FK constraint is the only *real* boundary (an invalid/missing id simply fails the insert), same posture as every other required-selection dialog in this project (`PerdaMotivoDialog`'s disabled-until-selected button, explicitly commented as "the real enforcement is the DB, this dialog is a UX courtesy").

### Open design point to raise in Discuss (not an architecture blocker)

`DiarioTimeline.tsx`/`getDiario()` (`lib/supabase/queries/clientes.ts`) read **only** `historico.descricao`/`tipo`/`criado_em`/autor — `historico` has no column linking a row back to the specific `tarefas`/`visitas` row that produced it, so **the Diário cannot show "this was a remote completion + motivo" without a product decision**, options:
1. **Do nothing** (lowest risk): `motivo_conclusao_remota_id` lives on `tarefas`/`visitas` for reporting/future use, but the Diário entry looks identical to an in-person completion — satisfies the literal requirement ("entra no diário do cliente") without touching the two SECURITY DEFINER trigger functions.
2. **Prefix the trigger-written `descricao`** with the motivo's name when present (`tarefas_before_update_historico`/`visitas_after_update_historico` would each need one extra lookup `select nome into v_motivo_nome from motivos_conclusao_remota where id = new.motivo_conclusao_remota_id`, then branch the `case` that already exists). This is a **modification of an already-blessed SECURITY DEFINER trigger**, not a new exception — the project's own migration comments explicitly separate "RPC-level SECURITY DEFINER exceptions" (4, documented) from "audit-trigger SECURITY DEFINER functions" (2, already exist, not counted). Touching them is precedented (the `0015` migration itself modified `tarefas_before_update_historico`'s body to branch on `resumo`).

Recommend **option 2** if the non-technical owner wants the motivo visible in the diário (likely, since "motivo é a categoria, resumo é o texto livre" implies both matter as a record) — flag this explicitly at Discuss rather than deciding silently during planning, since it's a product/UX call, not a technical constraint.

## SECURITY DEFINER audit (quality gate)

**Zero new SECURITY DEFINER RPCs required or recommended for v1.5.** Every function this milestone touches or adds runs as the caller:

- `agenda_do_vendedor()` — unchanged, still SECURITY INVOKER.
- `concluir_tarefa_prospeccao`/`concluir_visita` — extended, still SECURITY INVOKER; RLS on `tarefas`/`visitas` remains the only authorization boundary, same as every RPC since `mover_card_funil` in `0002`.
- The new `motivos_conclusao_remota` table's writes are gated by the existing `is_supervisor()` function (already one of the 4 documented exceptions, not a new one) via ordinary RLS policies — no new elevated-privilege function.
- The only functions that could plausibly need a body edit are the 2 pre-existing SECURITY DEFINER audit triggers (see "Open design point" above), and only if the product decision favors surfacing the motivo in the Diário text. That is a **modification**, not an addition — the project stays at exactly 4 documented RPC-level exceptions (`is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe`, `cidades_com_clientes_por_estado`) plus the 2 already-existing audit triggers, same count as today.

If a future need arose to aggregate `motivo_conclusao_remota` usage across the whole team for a dashboard (not in this milestone's scope), that would follow the existing `dashboard_*` SECURITY INVOKER pattern, not a new elevated-privilege function — flagging only because the quality gate asks to flag anything that looks unavoidable, and nothing here does.

## Data Flow

### A) Calendar render flow

```
AgendaList's fetch owner (mount / reloadKey bump)
    ↓ getAgendaAction() [UNCHANGED]
    ↓ lib/supabase/queries/agenda.ts → supabase.rpc("agenda_do_vendedor") [UNCHANGED]
AgendaItem[] (already in browser state)
    ↓ filtrarPorVendedor (existing, unchanged)
    ↓ NEW: agruparPorData / agrupaPorMes (lib/agenda/itens.ts) — pure, client-side
Calendar grid cells (day → item[] with 3-chip cap + "+N")
    ↓ click a day → reuse existing per-item click handlers
    (onOpen → ClienteDetailSheet, onConcluir → ConcluirItemDialog) — UNCHANGED
```

### B) Conclusão remota write flow

```
ConcluirItemDialog (checkbox checked + motivo selected)
    ↓ onConfirm(resumo, proximaData, motivoConclusaoRemotaId)  [signature grows by 1]
app/actions/agenda.ts: concluirTarefaProspeccao / concluirVisita
    ↓ re-validate resumo (unchanged) + "motivo required if remoto" (new, UX courtesy)
    ↓ supabase.rpc(..., { ..., p_motivo_conclusao_remota_id })
Postgres RPC (SECURITY INVOKER — RLS on tarefas/visitas is the real gate)
    ↓ UPDATE tarefas/visitas SET resumo=, concluida/data_realizada=, motivo_conclusao_remota_id=
    ↓ trigger fires (tarefas_before_update_historico / visitas_after_update_historico)
    ↓ INSERT INTO historico (unchanged shape, optionally motivo-prefixed — see open design point)
    ↓ [concluir_visita only] read clientes.frequencia_visita fresh, branch on it +
      p_proxima_data — completely independent of the new parameter — insert next
      `visitas` row exactly as it does today
revalidatePath("/agenda"), revalidatePath("/clientes")  [unchanged]
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: A second RPC for the calendar's date range
**What people might do:** build `agenda_do_vendedor_por_periodo(data_inicio, data_fim)` to "only fetch what the visible month needs."
**Why it's wrong:** `agenda_do_vendedor()` already returns the full pending set with no date bound, and `AgendaList` already fetches it once per mount. A second RPC duplicates the RLS-scoped union logic in a second place (this project's Anti-Pattern 4 from the original v1.3 research, cited directly in `0014`'s migration header: "duas buscas mescladas no navegador duplicariam a lógica de ordenação e dobrariam o tráfego" — the same argument applies to duplicating the RPC itself) and creates a second surface that could drift from the List's RLS/ordering guarantees.
**Do this instead:** one fetch, one pure grouping function, shared by both views.

### Anti-Pattern 2: A `remoto boolean` column alongside the FK
**What people might do:** add both `remoto boolean not null default false` and `motivo_conclusao_remota_id uuid` so the UI can "just check the boolean."
**Why it's wrong:** two fields that must always agree is exactly the "duas fontes de verdade" pattern this project's own Key Decisions table repeatedly rejects (`frequencia_visita`, `"ativo"` state). A row with `remoto = true, motivo_conclusao_remota_id = null` (or the reverse) becomes representable and has to be defended against forever.
**Do this instead:** `motivo_conclusao_remota_id IS NOT NULL` is the only signal needed.

### Anti-Pattern 3: `create or replace function` when adding the new RPC parameter
**What people might do:** just add the parameter and re-run `create or replace function concluir_visita(...)`.
**Why it's wrong:** Postgres treats a different parameter list as a distinct signature; without an explicit `drop function if exists <old signature>` first, the old 3-parameter version keeps existing alongside the new 4-parameter one, and PostgREST starts rejecting every existing call as ambiguous — this is the exact failure mode `0018`'s migration header documents by name.
**Do this instead:** explicit `drop function if exists concluir_visita(uuid, text, date);` before `create function concluir_visita(uuid, text, date, uuid)`, same transaction, no window where the function doesn't exist.

### Anti-Pattern 4: Gating the "next visit date" logic on whether the completion was remote
**What people might do:** add an `if p_motivo_conclusao_remota_id is not null then ... end if` branch around the next-visit block, on the theory that a remote completion is "different."
**Why it's wrong:** the milestone explicitly requires the next date to still be suggested for remote completions of active clients — the existing block already does this for free by construction (it never reads `resumo` or anything else about *how* the visit was concluded, only `frequencia_visita` + `p_proxima_data`). Adding a branch here would be net-new behavior nobody asked for, and risks silently breaking VIS-03 for the remote path.
**Do this instead:** leave the next-visit block exactly as-is; only add the new column to the earlier `UPDATE`.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Calendar views ↔ `lib/agenda/itens.ts` | Direct pure-function call, no fetch | Calendar never talks to Supabase directly — same rule the List already follows (`AgendaItem` flows in as props) |
| `ConcluirItemDialog` ↔ new motivo lookup | Server Action (`app/actions/agenda.ts`, new export mirroring `getMotivosPerda()`) | Same "fetch on dialog open" effect shape already used for the próxima-data seeding effect |
| `EditableListTab`/`ConfiguracoesTabs` ↔ `motivos_conclusao_remota` | Existing generic `ListaTabela` union + `getListaValores`/`createListaValor`/`updateListaValor`/`setListaValorAtivo` | Zero new code beyond adding the table name to the union and one tab — same as the 4→5 list migration in Phase 16 |
| `concluir_tarefa_prospeccao`/`concluir_visita` ↔ `historico` | Unchanged trigger path (`tarefas_before_update_historico`/`visitas_after_update_historico`), optionally extended per the open design point | Regra absoluta unchanged: no new INSERT policy on `historico`, ever |
| `agenda_do_vendedor()` ↔ Calendar | **No new boundary** — same RPC, same RLS, same output shape | This is the core simplification this milestone gets "for free" |

### External Services

None. No new third-party service, no new Edge Function — everything above is Postgres RLS/RPC + Next.js Server Actions/Client Components, consistent with `CLAUDE.md`'s "não existe backend Node.js separado" and the zero-infra-cost constraint.

## Suggested Build Order

Following this project's own established convention (schema/RPC layer lands before the UI layer that depends on it — see every prior phase pairing: `13` schema before `14`/`15` UI, `18` RPC guard before `19` UI):

1. **Schema + RPC layer for B (conclusão remota)** — `motivos_conclusao_remota` table + RLS, 2 nullable FK columns, `concluir_tarefa_prospeccao`/`concluir_visita` drop+recreate with the new trailing parameter. Zero UI dependency, provably doesn't touch the next-visit logic — safe to land and test against the real database first, same posture as every prior "-01" schema plan in this project.
2. **Admin CRUD for the 6th list** — trivial once the table exists (`ListaTabela` union + one tab), can land in the same phase as step 1 or immediately after; no new component code.
3. **`ConcluirItemDialog` extension (B, frontend)** — checkbox + motivo Select + new lookup + Server Action wiring, once step 1 is live to test against.
4. **Calendar view (A)** — entirely independent of steps 1–3 (no schema dependency at all), could in principle be built in parallel with B, but sequencing it after B lets the calendar be verified against real data that includes both in-person and remote completions disappearing from the pending feed identically. Internally: (a) the `agruparPorData` pure function + tests first (mirrors `bucketDoItem`/`agruparAgenda`'s own test-first precedent), (b) the `AgendaList` fetch/filter-state extraction refactor, (c) month view, (d) week/day views (day view is stated to reuse the existing card, so it's mostly wiring), (e) the Lista↔Calendário toggle itself.

Given A and B touch almost entirely disjoint files (A: `lib/agenda/itens.ts` + new `AgendaCalendar*` components + `AgendaList.tsx` refactor; B: migrations + `ConcluirItemDialog.tsx` + `listas.ts`/`ConfiguracoesTabs.tsx`), they are strong candidates for **two independent phases run in either order or in parallel**, unlike most of this project's prior milestones where phases were hard-sequenced by schema dependency. The one soft coupling: if `AgendaList.tsx` is refactored for A's toggle before B's dialog changes land, B's `ConcluirItemDialog` wiring only needs to happen once wherever the dialog instance ends up living post-refactor — worth sequencing A's refactor first specifically to avoid B having to touch that wiring twice.

## Sources

- `supabase/migrations/0014_agenda_do_vendedor.sql` — `agenda_do_vendedor()` current body, SECURITY INVOKER rationale, union structure, `data` as pure `date`
- `supabase/migrations/0015_conclusao_com_resumo.sql` — `concluir_tarefa_prospeccao`/`concluir_visita` full bodies, resumo `NOT VALID`+`VALIDATE CONSTRAINT` pattern, trigger functions, `agenda_do_vendedor()` drop-before-recreate precedent
- `supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql` — `visitas` table shape, RLS parent-gate policies, `frequencia_visita_enum`
- `supabase/migrations/0016_frequencias_pedido.sql` — 5th editable list precedent, RLS policy shape, and the D2 rationale for why frequência de pedidos deliberately does NOT use an FK (contrast case)
- `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql` — explicit documentation of the drop-before-create requirement when an RPC's parameter count changes, `mover_card_funil` 6→7 params as the literal precedent
- `supabase/migrations/0002_clientes_and_funil.sql` — `motivos_perda`/`tarefas`/`historico` original shapes, `chk_perdido_exige_motivo` (FK-presence-as-boolean precedent)
- `lib/agenda/itens.ts` — `AgendaItem`/`AgendaOrigem` types, `bucketDoItem`/`agruparAgenda`/`filtrarPorVendedor` pure-function conventions
- `lib/supabase/queries/agenda.ts` — single-read-path convention (`getAgenda()`), row mapping
- `app/actions/agenda.ts` — `concluirTarefaProspeccao`/`concluirVisita` Server Actions, client-side revalidation-as-defense-in-depth pattern
- `components/agenda/AgendaList.tsx`, `AgendaItemRow.tsx`, `ConcluirItemDialog.tsx` — current fetch/filter/render coupling, badge conventions (Prospecção=`outline`, Visita=`secondary`), próxima-data seeding effect
- `components/clientes/PerdaMotivoDialog.tsx` + `lib/supabase/queries/clientes.ts` (`getMotivosPerdaAtivos`) + `app/actions/funil.ts` (`getMotivosPerda`) — the exact lookup-fetch-on-dialog-open chain to replicate for the new motivo
- `app/actions/listas.ts` + `components/configuracoes/EditableListTab.tsx`/`ConfiguracoesTabs.tsx` — generic 5-list CRUD, confirmed zero new code needed beyond a union entry + tab for a 6th list
- `lib/funil/frequencia.ts` — pure-module convention (`geraProximaVisita` as single authority) mirrored by the recommended `agruparPorData`
- `.planning/PROJECT.md`, `.planning/STATE.md` — milestone target features, SECURITY DEFINER exception count/history, accumulated architecture conventions

---
*Architecture research for: CRM Raiar v1.5 (Calendário na Agenda e Conclusão Remota)*
*Researched: 2026-08-17*
