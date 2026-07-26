# Phase 9: Filtros de Estado e Cidade Estruturados - Research

**Researched:** 2026-07-26
**Domain:** Postgres reference-data seeding (IBGE municipalities) + cascading structured form fields (Base UI Combobox) on an existing Next.js/Supabase CRM
**Confidence:** MEDIUM (schema/RLS/RPC pattern is HIGH — directly traced to this project's live migrations and its own milestone-level research; the IBGE data-sourcing mechanics are MEDIUM — official government API confirmed directly, but the "how big should the seed migration file be" mechanics are this document's own synthesis, not separately fetched)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Dados já cadastrados:** Os clientes hoje no sistema são todos de teste e serão apagados pelo dono do projeto de qualquer forma — a migração/normalização de registros antigos com Estado em formato inconsistente (nome por extenso, digitação diferente) deve usar a abordagem mais simples possível (ex: normalização por correspondência exata/case-insensitive), sem investir em correspondência aproximada (fuzzy match) ou fluxo de revisão manual. Não é uma prioridade de qualidade de dados nesta fase.

**D-02 — Cidade antes de Estado (Claude's Discretion, decidido pelo agente dado o baixo risco):** O campo Cidade fica desabilitado até o Estado ser escolhido — padrão comum de filtro em cascata, evita uma lista de 5000+ municípios aparecer sem contexto.

### Claude's Discretion

- Comportamento exato de registros legados cujo Estado não corresponde a nenhuma das 27 siglas após a normalização simples (D-01) — como são dados de teste que serão apagados, tratar da forma mais simples tecnicamente (ex: deixar o valor como está até o usuário reabrir/salvar o registro, sem bloquear acesso).
- Componente de UI exato para a busca de Cidade (mais de 5000 municípios) — precisa ser pesquisável (combobox com filtro por digitação), não um `<select>` simples de rolagem longa.
- Fonte exata dos dados de municípios do IBGE e formato de carregamento (tabela `cidades` seedada via migration, conforme sugerido pela pesquisa do marco).

### Deferred Ideas (OUT OF SCOPE)

Nenhuma — discussão ficou dentro do escopo da fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOC-01 | Campo Estado (cadastro/edição, filtro, importação) usa lista fixa das 27 siglas de UF, não texto livre | Frontend TS constant `UFS` + `z.enum()` validation (Standard Stack, Code Examples); `chk_estado_valido` CHECK constraint added `NOT VALID` on `clientes.estado` (Architecture Patterns, Pitfall 1 below) |
| LOC-02 | Campo Cidade usa lista completa/oficial de municípios (IBGE), filtrada pelo Estado escolhido | New `cidades` table seeded from the official IBGE localities API + `cidades_por_estado()` RPC (Architecture Patterns, Code Examples) |
| LOC-03 | No filtro de clientes, Estado aparece antes de Cidade | `FiltersPopover.tsx` field-order fix + cascade wiring (Code Context / Existing Code Insights below) |
| LOC-04 | Clientes já cadastrados com Estado inconsistente são migrados/normalizados para a sigla correta, sem perder dados nem travar acesso | Backfill-then-`NOT VALID` migration pattern (Architecture Patterns, Pitfall 1); simple exact/case-insensitive normalization only, per D-01 |
</phase_requirements>

## Summary

This phase has one genuinely new piece of infrastructure (a `cidades` reference table seeded once from IBGE's official municipality data, plus a `cidades_por_estado()` RPC) and three consumers of it that are pure refactors of existing free-text fields into structured pickers (cadastro, edição, filtro, importação). No new npm dependency is needed — the searchable Cidade picker is a `shadcn add combobox` file copy onto this project's already-installed `@base-ui/react` primitive layer (confirmed by `.planning/research/STACK.md`'s v1.2 addendum and cross-checked directly against this repo's `components.json`/`package.json`), and Estado is a plain frontend TypeScript constant (26 states + DF = 27), never a database table, exactly as `.planning/research/ARCHITECTURE.md`'s Pattern 10 already concluded.

The one substantive open technical question this research resolves is **how to get ~5,570 municipality rows into Postgres via a versioned migration file without violating the zero-infra-cost/no-runtime-external-service constraint**. The answer: IBGE's official `servicodados.ibge.gov.br` REST API is queried exactly once, offline, at authoring time (not at runtime, not by the deployed app) to generate a plain `INSERT INTO cidades (...) VALUES (...), (...), ...;` statement that is then committed as an ordinary versioned SQL migration file — no `COPY FROM` (requires filesystem access on the Postgres server, which a hosted Supabase project's migration pipeline does not expose), no `\copy` (a `psql`-only meta-command that does not survive `supabase db push`'s plain-SQL execution path), and no live API call from the running app (which would violate "no external service dependency at runtime"). A single `INSERT` with ~5,570 `VALUES` tuples has no practical Postgres row-count ceiling and is a well-established static-seed-migration pattern.

The second finding worth flagging early: LOC-04's Estado migration must follow the `NOT VALID` → backfill → (optional) `VALIDATE CONSTRAINT` sequence already documented in this project's own `.planning/research/PITFALLS.md` (v1.2 addendum, Pitfall 9) — adding a hard `CHECK`/`enum` constraint directly against `clientes.estado` would synchronously validate every existing row and can fail the whole migration on the very typos this phase exists to clean up. Combined with D-01 (test data, simplest normalization only, no fuzzy matching) and the phase's own discretion note (don't block access for rows that still don't match after normalization), the correct sequence is: simple case/whitespace-insensitive backfill UPDATE → add the UF-list CHECK constraint as `NOT VALID` (enforced for all new writes immediately, zero cost to add) → attempt `VALIDATE CONSTRAINT` as a best-effort final step, accepting it may stay un-validated if stray rows remain (this does not block access — `NOT VALID` only blocks *future* writes that violate it, never blocks reads or already-stored rows).

**Primary recommendation:** Add `cidades` (IBGE-seeded, read-only, RLS-enabled-no-write-policy) + `cidades_por_estado(uf)` RPC in one new migration; keep Estado as a frontend `UFS` constant + `NOT VALID` CHECK constraint (never a table); reuse the existing lookup-list pattern (`categorias`/`produtos_consumidos`) for how `annotarLinha.ts` and the cadastro/edit forms consume both; fix `FiltersPopover.tsx`'s field order (Cidade currently renders *before* Estado in the JSX) and wire the Base UI `Combobox` for Cidade with Estado-gated enablement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Estado (27 UF) list source of truth | Frontend Server (shared TS constant, imported by both client forms and Server Actions) | — | Closed, decades-static set; no DB round trip needed to render or validate it. Matches `ARCHITECTURE.md` Pattern 10 exactly |
| Estado validity enforcement on write | API / Backend (Postgres `CHECK` constraint + Zod re-validation in Server Actions) | Browser / Client (Zod on the form, UX-only) | `CLAUDE.md`: Server Actions must never trust client input; the DB constraint is the real backstop, matching this project's "RLS/constraint is the boundary, UI is a nicety" convention |
| Cidade options (~5,570 municipalities, Estado-scoped) | Database / Storage (`cidades` table, IBGE-seeded once) | API / Backend (`cidades_por_estado()` RPC, SECURITY INVOKER) | High-cardinality, must not be reconstructed from unreliable existing `clientes.cidade` data (Anti-Pattern 7 in `ARCHITECTURE.md`); a closed reference dataset, not a Supervisor-editable enum |
| Cidade picker UX (search-as-you-type, Estado-cascaded) | Browser / Client (`Combobox` calling `cidades_por_estado` directly via the RLS-scoped browser Supabase client) | — | Read-open RPC to every `authenticated` user, no Server Action indirection needed — same shape as the existing lookup-table reads (`categorias`, `produtos_consumidos`) |
| Estado/Cidade filter ordering + cascade gating | Browser / Client (`FiltersPopover.tsx` local component state) | — | Pure UI-state concern (D-02's "disabled until Estado chosen"); no new backend surface |
| Import-time Estado/Cidade validation | API / Backend (`validarLoteImportacao` Server Action + `annotarLinha.ts` pure function) | — | Must reuse the *same* structured lists as the manual forms, not a parallel free-text check, per this project's existing double-validation convention |

## Standard Stack

### Core

No new core technologies. Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) unchanged.

### Supporting

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` (already installed) | `^1.6.0`, confirmed matches current npm `latest` (`.planning/research/STACK.md` v1.2 addendum, verified 2026-07-25 against this repo's own `package.json`/`select.tsx`) | Native `Combobox` primitive for the Cidade picker | This project's shadcn style is `base-nova` (confirmed in `components.json:3`), built on Base UI, not Radix/`cmdk` — the generic "shadcn combobox" tutorial recipe (built on `cmdk`) does not apply here |
| shadcn CLI `combobox` component (file copy, not an npm package) | Pulled via `npx shadcn@latest add combobox` | Cidade search UI | `combobox.json`'s only npm dependency is `@base-ui/react` (already installed); brings `input-group` as a second file-copy dependency (not yet present in `components/ui/`) |

**Version verification:** `@base-ui/react@1.6.0` confirmed already installed and matching npm `latest` per `STACK.md`'s own 2026-07-25 registry check — no re-verification needed for this phase since no version changed. `[VERIFIED: this repo's package.json]`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Base UI `Combobox` (via `shadcn add combobox`) | `cmdk` + Radix `Popover` ("classic" shadcn combobox recipe) | Never for this project — would introduce a second, inconsistent primitive library alongside the already-adopted Base UI (`STACK.md` v1.2, "What NOT to Use") |
| `cidades` Postgres table seeded from IBGE | `SELECT DISTINCT cidade FROM clientes WHERE estado = :uf` | Rejected by the milestone's own architecture research (Anti-Pattern 7): perpetuates existing inconsistency and structurally blocks registering the first client in a genuinely new city |
| A single static `INSERT ... VALUES (...)` seed migration | A runtime fetch to the IBGE API on first app boot / on demand | Violates "no external service dependency at runtime" and adds a live third-party call to a feature (address entry) that must work even if `servicodados.ibge.gov.br` is briefly unavailable |
| A single static `INSERT ... VALUES (...)` seed migration | `COPY cidades FROM '/path/to/municipios.csv'` inside the migration | `COPY FROM <path>` requires the path to exist on the **Postgres server's own filesystem** — not available for a hosted Supabase project applied via `supabase db push` |

**Installation:**
```bash
# No npm install needed for this phase.
npx shadcn@latest add combobox
```

## Package Legitimacy Audit

**No new npm packages are installed by this phase.** The only new artifact pulled in is a shadcn registry **file copy** (`components/ui/combobox.tsx` + `components/ui/input-group.tsx`), whose sole npm-level dependency (`@base-ui/react`) is already installed, already verified, and already in production use elsewhere in this codebase (`components/ui/select.tsx`). The Package Legitimacy Gate protocol is therefore not applicable to this phase — there is no `npm install` for the planner to gate behind a `checkpoint:human-verify`.

**Packages removed due to [SLOP] verdict:** none (no packages evaluated — none installed).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────── BROWSER (Next.js Client) ─────────────────────────────┐
│                                                                                      │
│  Cadastro/Edição form          Filtro de clientes           Importação (preview)   │
│  (react-hook-form + zod)       (FiltersPopover.tsx)         (client-side parse)    │
│       │                              │                              │              │
│       │ Estado: <Select> from        │ Estado: <Select> from        │ (no UI here — │
│       │   frontend UFS constant      │   frontend UFS constant      │  validated    │
│       │   (no DB call)               │   (no DB call)               │  server-side) │
│       ▼                              ▼                              │              │
│  Cidade: <Combobox> ── calls cidades_por_estado(uf) via browser Supabase client ───┤
│   (disabled until Estado chosen, D-02)   (RLS read-open, no Server Action needed)   │
└──────────────────────┬───────────────────────────────────────────────┬─────────────┘
                        │ createCliente / updateCliente                 │ validarLoteImportacao
                        │ Server Action (Zod re-validate estado         │ Server Action
                        │ against UFS; re-validate cidade against       │ (annotarLinha.ts, reuses
                        │ cidades_por_estado(estado) server-side)       │  the same cidades lookup)
                        ▼                                               ▼
┌──────────────────────────────── SUPABASE (Postgres) ───────────────────────────────┐
│  clientes.estado (text, chk_estado_valido CHECK … NOT VALID)                        │
│  clientes.cidade (text, unchanged — still free text, now UI-constrained not FK'd)   │
│  cidades (NEW: id, nome, uf, unique(nome,uf)) — RLS enabled, SELECT-only policy      │
│  cidades_por_estado(p_uf text) RPC — language sql stable, SECURITY INVOKER          │
│  (no security definer — same convention as every 0003 dashboard function)           │
└──────────────────────────────────────────────────────────────────────────────────--┘
```

### Recommended Project Structure

```
supabase/
├── migrations/
│   └── 0007_cidades_e_estado_valido.sql   # NEW — cidades table + seed + RPC + clientes.estado backfill/constraint
lib/
├── clientes/
│   └── ufs.ts                              # NEW — the 27-UF frontend constant (shared by forms, filter, Zod schema)
├── validations/
│   └── cliente.ts                          # EDIT — estado: z.enum(UFS), cidade validation note (see Pitfall 2 below)
components/
├── ui/
│   ├── combobox.tsx                        # NEW — shadcn base-nova file copy
│   └── input-group.tsx                     # NEW — combobox's own file dependency
├── clientes/
│   ├── EstadoCidadeFields.tsx              # NEW (recommended) — shared cascading Estado+Cidade field pair,
│   │                                        #   used by both ClienteQuickCreateForm and ClienteDetailSheet
│   │                                        #   instead of duplicating the cascade wiring twice
│   ├── FiltersPopover.tsx                  # EDIT — swap Cidade/Estado order (LOC-03), Cidade → Combobox,
│   │                                        #   cascade-disable Cidade until Estado picked (D-02)
│   ├── ClienteQuickCreateForm.tsx          # EDIT — cidade/estado <Input> → EstadoCidadeFields
│   └── ClienteDetailSheet.tsx              # EDIT — same
lib/importacao/
└── annotarLinha.ts                         # EDIT — validate estado against UFS, cidade against the cidades lookup
```

### Pattern 1: `cidades` as a closed, seeded, read-only reference table (not a Supervisor-editable enum)

**What:** Unlike `categorias`/`produtos_consumidos`/`tipos_tarefa`/`motivos_perda` (which have full Supervisor CRUD, per `0002_clientes_and_funil.sql`), `cidades` gets exactly one RLS policy — `SELECT` open to `authenticated` — and **no INSERT/UPDATE/DELETE policy at all**, mirroring `historico`'s existing "no user insert policy, only written by trusted server-side code" precedent. The table is populated exactly once, by the migration's own `INSERT` statements, and never mutated afterward through the app.
**When to use:** Any reference dataset that is populated from an authoritative external source and never needs runtime CRUD.
**Example:**
```sql
-- Source: pattern precedent = supabase/migrations/0002_clientes_and_funil.sql's
-- "historico — read-only via parent gate; deliberately NO user insert policy"

create table cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf text not null,
  constraint uq_cidades_nome_uf unique (nome, uf)
);

alter table cidades enable row level security;

create policy "usuarios autenticados leem cidades"
on cidades for select to authenticated using (true);

-- No insert/update/delete policy — table is seed-only, same posture as historico.

create index idx_cidades_uf on cidades (uf);

create or replace function cidades_por_estado(p_uf text)
returns table(nome text)
language sql
stable
as $$
  select c.nome
  from cidades c
  where c.uf = p_uf
  order by c.nome;
$$;
-- Deliberately NOT security definer — SECURITY INVOKER by omission, same rule
-- 0003_dashboard_aggregates.sql's header comment states explicitly for every
-- dashboard function in this project. RLS on `cidades` is read-open anyway,
-- so this is defense-in-depth/consistency, not a functional requirement here.

-- Then: one INSERT with ~5,570 VALUES tuples, generated once offline from
-- the official IBGE API (see Pattern 2), e.g.:
insert into cidades (nome, uf) values
  ('Adamantina', 'SP'),
  ('Adolfo', 'SP'),
  -- ... ~5,568 more rows, one per Brazilian municipality ...
  ('Xinguara', 'PA');
```
`[CITED: this project's own 0002/0003 migration conventions]`

### Pattern 2: Generate the seed `INSERT` offline from IBGE's official localities API — never fetched at runtime

**What:** `servicodados.ibge.gov.br` is IBGE's (Brazil's federal statistics agency) own public REST API. `GET https://servicodados.ibge.gov.br/api/v1/localidades/municipios` returns all ~5,570 municipalities in one call; each item's shape is:
```json
{
  "id": 3500105,
  "nome": "Adamantina",
  "microrregiao": {
    "mesorregiao": {
      "UF": { "id": 35, "sigla": "SP", "nome": "São Paulo", ... }
    }
  }
}
```
confirmed directly against the live endpoint for a single UF (`/api/v1/localidades/estados/35/municipios`) during this research session. `[CITED: servicodados.ibge.gov.br — official IBGE government API, fetched directly 2026-07-26]`
**When to use:** Exactly once, offline (a throwaway Node script run locally, not committed as app code, not deployed), to produce the `INSERT` statement's `VALUES` list. The generated SQL — not the fetch script — is what becomes the versioned migration file. This keeps the deployed app's runtime footprint at zero external calls for this feature, satisfying `CLAUDE.md`'s zero-infra-cost / no-new-external-service constraint (the IBGE API is free, but more importantly it is **not called by the running app at all**, only by a one-time authoring-time step).
**Trade-offs:** The generated migration file will be a few hundred KB of `INSERT` text (~5,570 rows × ~20 bytes/row) — large for a diff but not a problem for git, and Postgres has no meaningful row-count ceiling for a single `INSERT ... VALUES (...), (...), ...` statement (this is the standard "static data seed migration" pattern; batching into multiple smaller `INSERT`s is a readability choice, not a requirement — commonly done in chunks of ~500-1000 rows per statement purely for file readability, per general Postgres bulk-load guidance). `[CITED: general Postgres bulk-insert guidance, cross-checked across multiple sources this session]`

**Do NOT** use `COPY cidades FROM '/local/path/municipios.csv'` inside the migration file itself — `COPY FROM <filesystem path>` requires the path to exist on the **Postgres server's** filesystem, which is not accessible when a migration is applied to a hosted Supabase project via `supabase db push`. `\copy` (the `psql` client-side meta-command that *would* work with a local file) is a `psql` feature, not plain SQL, and does not survive execution through the Supabase CLI's direct-connection migration runner. `[MEDIUM confidence — general Postgres/Supabase tooling behavior, cross-checked via WebSearch this session, not separately verified against Supabase CLI's exact migration-execution internals]`

### Pattern 3: Estado — a frontend constant + `NOT VALID` CHECK constraint, never a lookup table

**What:** Continuing `ARCHITECTURE.md` Pattern 10 exactly: Estado is a plain, shared TypeScript array, imported by the Zod schema, the cadastro/edit form's `<Select>`, and `FiltersPopover.tsx`. On the database side, `clientes.estado` stays `text` (not converted to a Postgres `enum` type or FK'd to a table) but gets a `CHECK` constraint enforcing the same 27 values, added `NOT VALID` so it does not synchronously scan/block on the exact inconsistent legacy data this phase is migrating (see Pitfall 1 below).
**Example:**
```typescript
// lib/clientes/ufs.ts — Source: IBGE official UF list (26 states + DF),
// alphabetical by sigla. [CITED: IBGE — stable, decades-static government
// reference data, not separately re-verified this session beyond common
// knowledge cross-checked against the IBGE API's own UF nesting confirmed
// in Pattern 2 above]
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export type Uf = (typeof UFS)[number]
```
```typescript
// lib/validations/cliente.ts — replaces estado: z.string().min(1, ...)
import { UFS } from "@/lib/clientes/ufs"

estado: z.enum(UFS, { message: "Selecione um estado válido." }),
```
```sql
-- Same migration as Pattern 1 (0007_cidades_e_estado_valido.sql)
alter table clientes
  add constraint chk_estado_valido
  check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT',
                     'MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO',
                     'RR','SC','SP','SE','TO'))
  not valid;
-- Enforced for every NEW insert/update starting now. Does NOT scan/block on
-- existing rows (Pitfall 1). Attempt validate constraint chk_estado_valido;
-- as a final step of the same migration or a follow-up one — if any legacy
-- row still doesn't match after the D-01 backfill, this statement fails and
-- the constraint simply stays NOT VALID (still fully enforced for new
-- writes); it does not roll back the backfill or block access to those rows.
```
`[VERIFIED: this repo's own migration files use this exact naming/constraint-style convention (chk_ganho_somente_etapa_final, chk_perdido_exige_motivo in 0002)]`

### Anti-Patterns to Avoid

- **Converting `clientes.cidade`/`clientes.estado` to `uuid` FKs against `cidades`:** Out of scope per `ARCHITECTURE.md` Pattern 10 — would require backfilling/matching every existing free-text value including legacy typos, disproportionate to this phase's actual requirement ("make the filter/picker reliable going forward," not "guarantee referential integrity retroactively").
- **Deriving Cidade options from `SELECT DISTINCT cidade FROM clientes`:** Explicitly the anti-pattern this whole feature exists to replace (Anti-Pattern 7 in `ARCHITECTURE.md`) — perpetuates existing inconsistency and blocks registering a client in a brand-new city.
- **Hard `CHECK`/`enum` constraint on `clientes.estado` added directly (not `NOT VALID`):** Synchronously validates every existing row; with known-inconsistent legacy data, this either fails the deploy outright or forces a rushed, risky bulk-fix under deploy pressure (Pitfall 1).
- **`cidades_por_estado()` marked `security definer`:** No functional reason to (RLS on `cidades` is already read-open to every authenticated user) — would only add an inconsistent exception to this project's "every dashboard/lookup function is SECURITY INVOKER by omission" rule (`0003_dashboard_aggregates.sql`'s own header-comment rule), inviting confusion later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable dropdown for 5,570+ cities | A custom filtered-`<select>`/typeahead component | Base UI's native `Combobox` (via `shadcn add combobox`) | Already the project's chosen primitive layer; hand-rolling would duplicate accessibility/keyboard behavior Base UI already ships |
| Fuzzy-matching legacy Estado values ("São Paulo" vs "SP" vs typos) to the correct UF | A fuzzy-match/similarity library or algorithm (`pg_trgm`, `fuse.js`, Levenshtein) | Simple exact/case-insensitive/whitespace-normalized matching only | Explicitly overridden by D-01 — this is disposable test data and the owner does not want investment in approximate matching for this phase |
| Sourcing the full Brazilian municipality list | Hand-typing or manually curating a city list | IBGE's official `servicodados.ibge.gov.br` localities API, fetched once offline | IBGE is the canonical, free, authoritative source for this exact dataset — no reason to approximate it |
| Cascading Estado→Cidade fetch-on-select | A custom `useEffect` + manual `supabase.from('cidades').select()` filter-and-sort in each form component | The single `cidades_por_estado(uf)` RPC, called identically from every one of the four touchpoints (cadastro, edição, filtro, importação-preview) | One function, one place the "how do we look up cities for a UF" logic lives — matches this project's existing "one dashboard function per metric, reused everywhere" convention |

**Key insight:** Every piece of this phase that looks like it needs custom logic (fuzzy Estado matching, a bespoke searchable dropdown, hand-curating cities) is explicitly ruled out by either an existing project convention (Base UI via shadcn) or an explicit user decision (D-01). The only genuinely new code is the seed-generation script (run once, not deployed) and the RPC/constraint pair.

## Runtime State Inventory

> Phase involves migrating/normalizing existing `clientes.estado` data (LOC-04) — inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `clientes.estado` (free text, `not null`, known to contain full state names, abbreviations, and typos per `PITFALLS.md` v1.2 Pitfall 9) — the only stored data this phase touches. `clientes.cidade` (free text) is **not** being backfilled/normalized this phase (only future writes get UI-constrained) | Data migration: simple exact/case-insensitive-normalization `UPDATE` on `clientes.estado` (D-01), before adding the `NOT VALID` constraint. No migration needed for `clientes.cidade` values already stored |
| Live service config | None — no external service stores Estado/Cidade configuration outside this repo's own Postgres | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new secret/env var needed (`cidades_por_estado` is read-open, callable with the existing anon/authenticated key, no service-role key involved) | None |
| Build artifacts | None — this is a new table + new frontend constant, not a rename of any existing identifier/package/build output | None |

**Nothing found in "Live service config", "OS-registered state", "Secrets/env vars", "Build artifacts":** confirmed by direct review of this phase's scope (new table + new RPC + new frontend constant + four existing-component edits) — none of these touch anything outside this repo's own Postgres schema and Next.js source.

## Common Pitfalls

This phase is directly covered by two pitfalls already documented in this project's own milestone research (`.planning/research/PITFALLS.md`, v1.2 addendum) — summarized here with this phase's specific application; full text/sources at the citation below.

### Pitfall 1: Hard Estado constraint added directly can fail the deploy or silently corrupt data
**What goes wrong:** Adding `check (estado in (<27 UFs>))` (or converting to a Postgres `enum`) directly validates every existing row synchronously — any unmapped legacy value (typo, full name not yet normalized, blank) makes the migration fail outright and block deploy. The opposite mistake — silently defaulting unmapped values to `NULL` or a guessed UF "to make the constraint pass" — hides or corrupts real client data with no visibility to the Supervisor.
**Why it happens:** Both approaches make the migration "just work" in the moment; the cost surfaces later as either a deploy blocker under time pressure or silently wrong data nobody is told about.
**How to avoid:** Backfill first (D-01's simple exact/case-insensitive normalization) → add the constraint as `not valid` (enforced for all new writes immediately, zero scan cost) → attempt `validate constraint` as a final best-effort step, accepting it may remain un-validated if stray rows persist. Never default an unmapped row to a guessed UF — per this phase's own discretion note, leave it as-is and let the user fix it next time they open/save that record, rather than blocking access or guessing.
**Warning signs:** Migration fails on `ALTER TABLE ... VALIDATE`/`CHECK` naming specific row values; client-count-under-a-specific-Estado-filter drops after migration with no corresponding drop in total client count.
**Phase to address:** This phase (Feature 6 in the milestone research's numbering). `[CITED: .planning/research/PITFALLS.md, v1.2 addendum, Pitfall 9 — HIGH confidence, cross-checked against Postgres's own documented NOT VALID/VALIDATE CONSTRAINT behavior]`

### Pitfall 2: Cidade dropdown built against un-normalized Estado, or with no escape hatch for a genuinely new city
**What goes wrong:** If the Cidade-options source is ever queried against `clientes.estado` groupings **before** Pitfall 1's normalization completes, cities split across "São Paulo" and "SP" variants would be inconsistent — but this phase avoids that entirely by sourcing Cidade from the new `cidades` table (never from `clientes` at all), so this specific failure mode does not apply here. The second half of the pitfall still applies: because Cidade options come from a **closed, IBGE-seeded** list (not derived from existing client data), every real Brazilian municipality is already covered — IBGE's own dataset (5,570 municipalities) is complete by construction, so there is no "genuinely new city" gap the way there would be with a data-derived list. No escape hatch/free-text fallback is needed for Cidade for this reason (unlike the original pitfall's concern, which was written against the now-rejected `SELECT DISTINCT` approach).
**Why it happens / relevance to this phase:** Worth stating explicitly in planning so the "add a free-text fallback for unlisted cities" idea from the original pitfall write-up is deliberately *not* carried into this phase's task list — it was written against a different (rejected) sourcing strategy.
**How to avoid:** No action needed beyond confirming the `cidades` seed genuinely covers all 5,570 official municipalities (a post-seed row-count check: `select count(*) from cidades;` should equal the IBGE dataset's known total).
**Phase to address:** This phase — verification step only (row-count sanity check after seeding). `[CITED: .planning/research/PITFALLS.md, v1.2 addendum, Pitfall 10 — reinterpreted here since this phase's Cidade source (IBGE-seeded table) differs from the pitfall's original assumption (derived-from-clientes source)]`

### Pitfall 3: `FiltersPopover.tsx`'s existing field order already violates LOC-03
**What goes wrong:** The current implementation renders the Cidade `<Input>` (lines ~255-265) **before** the Estado `<Select>` (lines ~267-290) — the opposite of what LOC-03 requires. If the phase's tasks only "add a Combobox for Cidade" without also reordering these two blocks, LOC-03 silently fails even though the feature looks otherwise complete.
**Why it happens:** Easy to miss because the visual result (two fields, close together) looks fine at a glance without re-checking against the explicit requirement.
**How to avoid:** Explicit task-level verification: after implementation, the popover's JSX (and the on-screen tab order) must show Estado's `<Select>` immediately above Cidade's `<Combobox>`, and Cidade's `Combobox` must start `disabled` until `draft.estado` has a value (D-02).
**Warning signs:** A code review that only checks "is Cidade now a Combobox" without checking JSX ordering.
**Phase to address:** This phase. `[VERIFIED: read directly from components/clientes/FiltersPopover.tsx:255-290 this session]`

### Pitfall 4: Cidade's exact-match filter logic silently breaks once Cidade becomes a controlled Combobox value
**What goes wrong:** `clienteAtendeFiltros` (`FiltersPopover.tsx:85-88`) currently does a **substring** match (`cliente.cidade.toLowerCase().includes(cidadeFiltro)`) because Cidade is free text today. Once Cidade becomes a value picked from a fixed Combobox list, a substring match is both unnecessary and subtly wrong (e.g., filtering by "Santo André" would also match "Santo André do..." if such a name existed, or worse, an unrelated city containing the same substring) — an **exact** match is the correct semantic for a picked-from-list value.
**Why it happens:** The filter-matching function isn't usually revisited when the input type above it changes, since it still "compiles" and still "works" in casual testing with a small dataset.
**How to avoid:** Change the Cidade branch of `clienteAtendeFiltros` from `.includes(...)` to an exact (still case-insensitive, for legacy-data safety) equality check once Cidade is Combobox-driven.
**Phase to address:** This phase. `[VERIFIED: read directly from components/clientes/FiltersPopover.tsx:85-88 this session]`

## Code Examples

### Cascading Estado → Cidade fields (shared component, recommended)

```typescript
// components/clientes/EstadoCidadeFields.tsx (recommended new shared component,
// used by both ClienteQuickCreateForm.tsx and ClienteDetailSheet.tsx instead of
// duplicating the cascade-fetch wiring twice)
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { UFS } from "@/lib/clientes/ufs"
// ... Select/Combobox/FormField imports ...

export function EstadoCidadeFields({ control }: { control: /* RHF Control */ any }) {
  const estado = /* watch("estado") via useWatch or form.watch */ ""
  const [cidades, setCidades] = useState<string[]>([])

  useEffect(() => {
    if (!estado) {
      setCidades([])
      return
    }
    let cancelled = false
    createClient()
      .rpc("cidades_por_estado", { p_uf: estado })
      .then(({ data }) => {
        if (!cancelled) setCidades((data ?? []).map((row: { nome: string }) => row.nome))
      })
    return () => {
      cancelled = true
    }
  }, [estado])

  // Estado: <Select> over UFS. Cidade: <Combobox> over `cidades`,
  // disabled={!estado} per D-02, cleared whenever estado changes.
}
```
`Source: this document's synthesis, following the existing browser-client RPC-call convention already used elsewhere in this codebase (lib/supabase/client.ts)`

### Import-time validation reusing the same lookups (`annotarLinha.ts` pattern)

```typescript
// lib/importacao/annotarLinha.ts — extends the existing findByNome-style
// lookup pattern already used for categoria/produtos/vendedor (see current
// implementation, ~line 70-94)
import { UFS, type Uf } from "@/lib/clientes/ufs"

// New lookup type, added to AnnotarLinhaLookups alongside vendedores/
// categorias/produtos — populated ONCE per import batch by the caller
// (app/actions/importacao.ts), same pattern as the existing three lookups:
// select nome, uf from cidades  (5,570 rows, cheap single read, matches
// this project's "narrow select() once, not per-row" convention)
export type CidadeLookup = { nome: string; uf: string }

// Inside annotarLinha(), alongside the existing categoria/produto checks:
const estadoValor = sanitized.estado?.trim().toUpperCase()
if (estadoValor && !UFS.includes(estadoValor as Uf)) {
  reasons.push(`Estado "${estadoValor}" não é uma sigla de UF válida`)
}

const cidadeValor = sanitized.cidade?.trim()
if (cidadeValor && estadoValor) {
  const match = lookups.cidades.find(
    (c) => c.uf === estadoValor && normalizeRazaoSocial(c.nome) === normalizeRazaoSocial(cidadeValor)
  )
  if (!match) reasons.push(`Cidade "${cidadeValor}" não encontrada para o estado ${estadoValor}`)
}
```
`Source: this document's synthesis, extending the existing pattern read directly from lib/importacao/annotarLinha.ts this session`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `estado`/`cidade` free-text `<Input>` fields, validated only with `z.string().min(1)` | `estado`: `<Select>` over a fixed 27-UF constant + `z.enum(UFS)`; `cidade`: `<Combobox>` over `cidades_por_estado(uf)` | This phase | Eliminates free-text typos at the point of entry across all 4 touchpoints (cadastro, edição, filtro, importação); makes Estado-based filtering/reporting reliable going forward |
| `FiltersPopover`'s `estadoOptions: string[]` derived dynamically from the currently-loaded client set (`KanbanBoard.tsx`'s `estadoOptions` memo) | Fixed `UFS` frontend constant, no dependency on loaded data | This phase | Estado filter options no longer disappear/reappear depending on which clients happen to be loaded; a UF with zero current clients is still selectable |

**Deprecated/outdated:**
- `KanbanBoard.tsx`'s `estadoOptions` `useMemo` (derives Estado filter options from loaded cards): superseded by the static `UFS` import — this memo becomes dead code once `FiltersPopover` is fed the constant directly instead of a prop derived from card data.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | IBGE's `servicodados.ibge.gov.br/api/v1/localidades/municipios` endpoint (and its per-UF variant) is the correct, current, free, authoritative source for the full 5,570-municipality dataset with a stable field shape (`nome`, nested `UF.sigla`) | Architecture Patterns Pattern 2 | If the API shape has changed since this session's live check, the offline seed-generation script needs adjusting — low risk since it's a one-time authoring step, easily re-run/re-verified before the migration is finalized |
| A2 | A single `INSERT INTO cidades (...) VALUES (...) × ~5,570` (or a small number of chunked `INSERT`s) in one migration file is an acceptable, performant way to seed this table via `supabase db push`, with no practical Postgres statement-size ceiling reached | Architecture Patterns Pattern 2, Standard Stack | If this proves too slow/awkward in practice (unlikely at 5,570 rows), the fallback is simply chunking into multiple `INSERT` statements within the same migration file — not a different mechanism |
| A3 | `COPY FROM <path>` and `\copy` are not viable inside a `supabase db push`-applied migration file | Architecture Patterns "Alternatives Considered" | If wrong, a `COPY`-based seed would be simpler to author than a giant `INSERT` — worth a quick confirmation against the Supabase CLI's actual migration-execution mechanism before ruling it out entirely, though the `INSERT`-based approach is safe/correct either way |
| A4 | 27 UF siglas (26 states + DF), the specific list enumerated in Pattern 3, is complete and correct | Architecture Patterns Pattern 3, Code Examples | Extremely low risk — this is a decades-static, widely-known Brazilian government fact; still worth a final visual cross-check against IBGE's own UF list before merging the constant |

## Open Questions

1. **Should the seed-generation script itself be committed to the repo (e.g., `scripts/gerar-seed-cidades.ts`), or is it a throwaway/local-only step?**
   - What we know: The *output* (the migration's `INSERT` statements) must be committed and versioned per `CLAUDE.md`'s migration discipline.
   - What's unclear: Whether the *generator* script itself has any future reuse value (e.g., re-running if IBGE ever adds/renames a municipality) worth keeping in the repo, vs. being a one-off local script.
   - Recommendation: Commit a small, documented one-time script (e.g., under `scripts/`) even if it's not wired into any npm script — cheap insurance against "how was this seed generated" being lost knowledge, and matches this project's existing precedent of keeping data-shape-generating logic (e.g., `lib/importacao/modelo.ts`) in the repo rather than as an ephemeral local artifact.

2. **Does the `EstadoCidadeFields` shared-component refactor (Recommended Project Structure) belong in this phase's plan, or is duplicating the cascade wiring across `ClienteQuickCreateForm.tsx` and `ClienteDetailSheet.tsx` acceptable for a first pass?**
   - What we know: Both forms currently render near-identical `cidade`/`estado` `<Input>` blocks independently (no shared component exists yet for this field pair).
   - What's unclear: Whether the planner should treat the shared component as required scope or a nice-to-have refactor.
   - Recommendation: Extract the shared component — the cascade-fetch logic (Estado-watch → RPC call → Cidade options → reset-on-Estado-change) is exactly the kind of stateful wiring that's error-prone to keep in sync if duplicated in two places, and this phase touches both forms anyway.

## Environment Availability

Skipped — this phase has no new external runtime dependency. The IBGE API is used only once, offline, at migration-authoring time (Pattern 2), never called by the deployed application. The Supabase CLI (`supabase db push`) required to apply the new migration is already an established part of this project's workflow (used for every prior migration).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (confirmed in `package.json`), existing `tests/` directory with per-domain subfolders |
| Config file | `vitest.config.ts` (existing, `environmentMatchGlobs` restricts jsdom to `tests/**/*.test.tsx`, per Phase 06-03 decision in `STATE.md`) |
| Quick run command | `npm run test -- tests/clientes tests/importacao` (scope to touched areas) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOC-01 | `estado` Zod schema rejects a non-UF value, accepts all 27 | unit | `npm run test -- tests/clientes/cliente-actions.test.ts` (extend existing) | ✅ extend existing |
| LOC-01 | `chk_estado_valido` constraint rejects an invalid `estado` insert/update at the DB level | integration (real Postgres/RLS) | new: `tests/clientes/estado-constraint.test.ts` | ❌ Wave 0 |
| LOC-02 | `cidades_por_estado('SP')` returns only São Paulo municipalities, sorted, non-empty | integration | new: `tests/clientes/cidades-por-estado.test.ts` | ❌ Wave 0 |
| LOC-02 | `cidades` table row count matches the seeded IBGE total (sanity check, catches a broken/partial seed) | integration | same file as above | ❌ Wave 0 |
| LOC-03 | `FiltersPopover` renders Estado's control before Cidade's control in DOM order | component | new/extend: `tests/importacao/AppSidebar.test.tsx`-style RTL test — recommend `tests/clientes/filters-popover.test.tsx` | ❌ Wave 0 |
| LOC-03 | Cidade combobox is disabled until an Estado is selected (D-02) | component | same new file | ❌ Wave 0 |
| LOC-04 | Backfill normalization: known legacy variants ("São Paulo", "sp ", "SP") all resolve to `"SP"` | unit | new: `tests/clientes/estado-normalizacao.test.ts` (test the pure normalization function directly) | ❌ Wave 0 |
| LOC-04 | A row that still doesn't match after normalization remains readable/editable (not blocked) | integration | extend `tests/clientes/rls-clientes.test.ts` or a new focused test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/clientes tests/importacao`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/clientes/estado-constraint.test.ts` — covers LOC-01's DB-level constraint (integration, needs local Supabase instance per this project's existing `tests/clientes/rls-clientes.test.ts` pattern)
- [ ] `tests/clientes/cidades-por-estado.test.ts` — covers LOC-02's RPC behavior + seed completeness
- [ ] `tests/clientes/filters-popover.test.tsx` — covers LOC-03's ordering + cascade-disable behavior (new component test file; no existing precedent for testing `FiltersPopover` specifically, though `tests/importacao/AppSidebar.test.tsx` and `tests/importacao/FileDropzone.test.tsx` establish this project's RTL-component-test pattern to follow)
- [ ] `tests/clientes/estado-normalizacao.test.ts` — covers LOC-04's backfill normalization logic as a pure, directly-unit-testable function (extract the normalization mapping into a small `lib/clientes/normalizarEstado.ts` pure function, mirroring `lib/importacao/dedupe.ts`'s existing `normalizeRazaoSocial` precedent, so it's testable without a DB)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged by this phase |
| V3 Session Management | No | Unchanged by this phase |
| V4 Access Control | Yes (narrow) | `cidades` RLS: `SELECT`-only policy to `authenticated`, no write policy at all (mirrors `historico`'s existing no-user-insert precedent) — verify no policy is accidentally added that allows write |
| V5 Input Validation | Yes | `z.enum(UFS)` for `estado` (client + Server Action re-validation, per this project's existing double-validation convention); server-side re-check that a submitted `cidade` value actually belongs to `cidades_por_estado(estado)` before writing (Zod alone cannot express this DB-dependent check — must be an explicit check inside the Server Action, not skipped just because the UI Combobox already constrains the choice) |
| V6 Cryptography | No | Unchanged by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted direct API/RPC call bypassing the Combobox UI, submitting an `estado`/`cidade` combination that doesn't actually exist together | Tampering | Server Action re-validates `estado ∈ UFS` and `cidade ∈ cidades_por_estado(estado)` server-side before every insert/update, per this project's established "Server Actions must never trust client input" rule — never rely on the Combobox's client-side constraint alone |
| A Vendedor attempting to `INSERT`/`UPDATE`/`DELETE` into `cidades` directly (bypassing the intended read-only posture) | Tampering / Elevation of Privilege | RLS enabled with **no** write policy of any kind on `cidades` (Postgres default-deny: a table with RLS enabled and no matching policy for a given operation blocks that operation entirely) — same posture already proven for `historico` in this codebase |

## Sources

### Primary (HIGH confidence)
- This project's own migrations, read directly: `supabase/migrations/0001_profiles_and_roles.sql` through `0006_fix_importar_clientes_lote_cte_rls_visibility.sql`
- This project's own component/schema source, read directly: `components/clientes/FiltersPopover.tsx`, `components/clientes/ClienteQuickCreateForm.tsx`, `lib/validations/cliente.ts`, `lib/importacao/annotarLinha.ts`, `package.json`, `components.json`
- `.planning/research/ARCHITECTURE.md` (v1.2 Additions, Pattern 10 + Anti-Pattern 7) — this project's own milestone-level research, HIGH confidence per that document's own citation
- `.planning/research/PITFALLS.md` (v1.2 Addendum, Pitfalls 9-10) — this project's own milestone-level research
- `.claude/skills/Supabase-conventions/SKILL.md` — read directly

### Secondary (MEDIUM confidence)
- WebFetch: `servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios` — official IBGE government API, field shape confirmed directly this session
- `.planning/research/STACK.md` (Milestone Addendum v1.2, item (e)) — this project's own milestone-level research on Base UI Combobox via `shadcn add combobox`

### Tertiary (LOW confidence)
- WebSearch: "IBGE API localidades municipios estados JSON download all 5570 municipalities" — corroborates the endpoint's existence/shape and the 5,570 total, web synthesis
- WebSearch: "Postgres seed migration large CSV data COPY vs INSERT thousands of rows Supabase" — corroborates that `COPY FROM <path>` requires server-side filesystem access and doesn't work against a hosted Supabase project via the CLI push path; general community/blog sources, not a single authoritative doc page

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new npm dependency, everything cross-checked directly against this repo's own `package.json`/`components.json` and the project's own prior milestone research
- Architecture: HIGH for the `cidades`/RPC/RLS pattern (directly extends this project's own proven `0002`/`0003` conventions); MEDIUM for the seed-generation mechanics (IBGE API confirmed directly, but the "INSERT vs COPY" tooling constraint is WebSearch-synthesized, not independently verified against Supabase CLI internals)
- Pitfalls: HIGH — both critical pitfalls are drawn directly from this project's own already-researched, already-cross-checked `PITFALLS.md`, plus two additional pitfalls found by direct code inspection this session (FiltersPopover field order, exact-vs-substring Cidade matching)

**Research date:** 2026-07-26
**Valid until:** IBGE municipality data itself is effectively permanent (municipalities are rarely created/renamed/merged — treat as valid indefinitely); the Base UI/shadcn dependency versions should be re-verified if this phase's implementation is delayed more than ~30 days from this research date
