# Phase 9: Filtros de Estado e Cidade Estruturados - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 9 (1 migration, 1 frontend constant, 1 shared component, 2 shadcn file copies, 3 edited components, 1 edited validation/import file each x2)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/0007_cidades_e_estado_valido.sql` | migration | batch (seed) + CRUD (read-only table + RPC) | `supabase/migrations/0002_clientes_and_funil.sql` (lookup tables + `historico`'s read-only-no-insert-policy) | exact |
| `lib/clientes/ufs.ts` | config/constant | — | none (new pattern: static frontend constant array) | no analog (trivial) |
| `lib/clientes/normalizarEstado.ts` | utility | transform | `lib/importacao/dedupe.ts` (`normalizeRazaoSocial`) | role-match |
| `components/ui/combobox.tsx` | component (shadcn file copy) | request-response (RPC-driven options) | `components/ui/select.tsx` | exact (sibling shadcn primitive, same Base UI family) |
| `components/clientes/EstadoCidadeFields.tsx` | component | request-response (cascading RPC read) | `components/clientes/ClienteQuickCreateForm.tsx`'s existing cidade/estado `FormField` block (lines 228-268) | role-match (new shared extraction of existing inline pattern) |
| `components/clientes/FiltersPopover.tsx` | component | request-response (in-memory filter, D-08) | itself (existing file, edited in place) | exact |
| `components/clientes/ClienteQuickCreateForm.tsx` | component (form) | CRUD (create) | itself (existing file, edited in place) | exact |
| `components/clientes/ClienteDetailSheet.tsx` | component (form) | CRUD (update) | `ClienteQuickCreateForm.tsx` (same cidade/estado field shape, per RESEARCH.md line 51) | exact |
| `lib/validations/cliente.ts` | utility (zod schema) | transform/validation | itself (existing file, edited in place) | exact |
| `lib/importacao/annotarLinha.ts` | utility (pure function) | transform/batch validation | itself (existing file, edited in place); lookup pattern from `findByNome`/`findVendedor` (lines 70-94) | exact |

## Pattern Assignments

### `supabase/migrations/0007_cidades_e_estado_valido.sql` (migration, batch+CRUD)

**Analog:** `supabase/migrations/0002_clientes_and_funil.sql`

**Lookup-table + RLS pattern to copy** (0002 lines 51-64, 171-172, 211-218 style — editable lookups get full Supervisor CRUD policies):
```sql
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
);
...
alter table categorias enable row level security;

create policy "usuarios autenticados leem categorias"
on categorias for select to authenticated using (true);
create policy "somente supervisor gerencia categorias (insert)"
on categorias for insert to authenticated with check (is_supervisor());
```

**`cidades` must NOT copy the CRUD-policy part** — it copies `historico`'s **read-only, no insert policy at all** posture instead (0002 lines 159-170, 340-357 area: `historico` has a `select` policy gated through the parent cliente, and deliberately no user-facing insert policy — it's written only by trusted server-side triggers). Concretely, per RESEARCH.md Pattern 1 (already cross-checked against this repo's own migrations):
```sql
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
```

**RPC pattern to copy — SECURITY INVOKER by omission** (matches every dashboard function in `0003_dashboard_aggregates.sql`, whose header comment states this rule explicitly for the project):
```sql
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
-- Deliberately NOT security definer.
```

**`NOT VALID` constraint pattern** — this project's own naming/style convention (`chk_ganho_somente_etapa_final`, `chk_perdido_exige_motivo` in 0002) extended to Estado:
```sql
-- Backfill first (simple case/whitespace-insensitive normalization, D-01):
update clientes set estado = upper(trim(estado));
-- (extend with any full-name -> sigla exact mapping needed, per D-01's
-- "simplest possible approach", no fuzzy matching)

alter table clientes
  add constraint chk_estado_valido
  check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT',
                     'MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO',
                     'RR','SC','SP','SE','TO'))
  not valid;

-- Best-effort final step — may remain un-validated if stray legacy rows
-- persist; does not block reads/writes to those rows (D-01/discretion note):
-- alter table clientes validate constraint chk_estado_valido;
```

**Seed data:** a single `insert into cidades (nome, uf) values (...), (...), ...;` generated once, offline, from the IBGE localities API (`servicodados.ibge.gov.br/api/v1/localidades/municipios`) — not fetched at runtime. See RESEARCH.md Pattern 2 for the generation approach; chunk into readable batches (~500-1000 rows/statement) if preferred, no functional requirement to do so.

**Error handling / validation:** none needed inside the migration itself beyond the `NOT VALID` sequencing above — this project's migrations don't wrap DDL in try/catch (Postgres DDL is transactional per-file by default via `supabase db push`).

---

### `lib/clientes/ufs.ts` (config/constant)

**No analog** — first plain frontend constant of this shape in the codebase. Follow RESEARCH.md's Pattern 3 exactly:
```typescript
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export type Uf = (typeof UFS)[number]
```

---

### `lib/clientes/normalizarEstado.ts` (utility, transform)

**Analog:** `lib/importacao/dedupe.ts`'s `normalizeRazaoSocial` (also reused directly by `lib/importacao/annotarLinha.ts`'s `findByNome`, lines 70-76 — same "extract a pure, directly-unit-testable normalization function" pattern this project already follows).

**Pattern to copy:** a small, pure, no-I/O function taking a raw string and returning a normalized comparable form — same shape as `normalizeRazaoSocial`. Used both by the migration's backfill logic (informing what SQL `UPDATE` to write) and by a Vitest unit test (`tests/clientes/estado-normalizacao.test.ts` per RESEARCH.md's Validation Architecture) that exercises the mapping directly without touching the DB.

**Testing pattern:** mirrors `tests/importacao/annotarLinha.test.ts`'s style of testing a pure function with fabricated inputs — no `.env.local`/Supabase instance required.

---

### `components/ui/combobox.tsx` (component, shadcn file copy)

**Analog:** `components/ui/select.tsx` (read in full above — 202 lines).

**Import pattern** (select.tsx lines 1-7):
```typescript
"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"
```
Combobox will instead import from `@base-ui/react/combobox`, keeping the same `cn`/lucide-react import shape.

**Trigger visual-parity pattern to preserve exactly** (select.tsx lines 40-56 — UI-SPEC section 2 requires the Combobox trigger to look pixel-identical to this):
```typescript
className={cn(
  "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 ...",
  className
)}
```

**Popup/list chrome to preserve exactly** (select.tsx lines 83-96 — same `bg-popover`, `rounded-lg`, `shadow-md`, `ring-1 ring-foreground/10`, `max-h-(--available-height)` anchor-relative sizing UI-SPEC requires for the Combobox popup).

**Selected-item indicator to preserve exactly** (select.tsx lines 128-135 — `CheckIcon`, `size-4`, `absolute right-2`).

**Do not hand-write this file from scratch** — install via `npx shadcn@latest add combobox` (per RESEARCH.md/UI-SPEC Registry Safety) and only diff against `select.tsx` to confirm visual parity; the CLI output already targets the `base-nova` preset.

---

### `components/clientes/EstadoCidadeFields.tsx` (component, cascading RPC read)

**Analog:** the existing inline `cidade`/`estado` `FormField` pair inside `components/clientes/ClienteQuickCreateForm.tsx` (read directly, lines 228-268):
```typescript
<div className="grid grid-cols-3 gap-3">
  <FormField
    control={form.control}
    name="complemento"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Complemento</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  <FormField
    control={form.control}
    name="cidade"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Cidade</FormLabel>
        <FormControl>
          <Input autoComplete="address-level2" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  <FormField
    control={form.control}
    name="estado"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Estado</FormLabel>
        <FormControl>
          <Input autoComplete="address-level1" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```
The new component keeps the exact same `FormItem`/`FormLabel`/`FormControl`/`FormMessage` wrapper per field (UI-SPEC section 3: "no bespoke spacing introduced") but swaps each `<Input>` for `<Select>` (Estado, over `UFS`) and `<Combobox>` (Cidade, over `cidades_por_estado`). It must render the `complemento`/`cidade`/`estado` **row itself** (same `grid grid-cols-3 gap-3` container) so both `ClienteQuickCreateForm.tsx` and `ClienteDetailSheet.tsx` can drop it in as a single row replacement.

**Existing `Responsável` Select pattern to copy for the Estado field** (same file, lines 276-291 — the `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` shape already used for a required, non-sentinel dropdown in this exact form):
```typescript
<Select
  value={field.value}
  onValueChange={(value) => field.onChange(value)}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Selecione o responsável" />
  </SelectTrigger>
  <SelectContent>
    {teamMembers.map((member) => (
      <SelectItem key={member.id} value={member.id}>
        {member.nome} {member.sobrenome}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**RPC-call pattern** (browser Supabase client, per `lib/supabase/client.ts` — no analog RPC call exists yet in a Client Component in this codebase, so this is a new but simple usage of the existing `createClient()` helper):
```typescript
import { createClient } from "@/lib/supabase/client"

useEffect(() => {
  if (!estado) { setCidades([]); return }
  let cancelled = false
  createClient()
    .rpc("cidades_por_estado", { p_uf: estado })
    .then(({ data }) => {
      if (!cancelled) setCidades((data ?? []).map((row: { nome: string }) => row.nome))
    })
  return () => { cancelled = true }
}, [estado])
```

**Cascade-reset requirement (D-02, UI-SPEC §1):** selecting a new Estado must reset Cidade to empty — no existing analog for this exact behavior; implement as a `field.onChange` side effect on the Estado `Select`'s `onValueChange` that also clears the `cidade` form field via `form.setValue("cidade", "")` (or the equivalent prop passed down for `FiltersPopover`'s non-RHF draft state — see below).

**Error handling:** none beyond the existing `FormMessage` (Zod-driven) — no try/catch needed around the RPC call per this project's convention for read-open, RLS-scoped lookup calls (matches how `categorias`/`produtos_consumidos` are read elsewhere: a failed fetch just leaves the list empty, no error toast infrastructure exists for this class of read in this codebase).

---

### `components/clientes/FiltersPopover.tsx` (component, edited in place)

**Analog:** itself — full file already read above (309 lines).

**Fix 1 — field order swap (LOC-03, Pitfall 3):** the Cidade block (current lines 255-265) must move to render **after** the Estado block (current lines 267-290), reversing today's order. Both blocks keep their existing `flex flex-col gap-1.5` wrapper (this popover's own hand-rolled non-`FormField` pattern, confirmed in UI-SPEC's Spacing Scale exceptions).

**Fix 2 — `estadoOptions` prop removed, replaced by direct `UFS` import:**
```typescript
// Before (current line 118, 283):
estadoOptions: string[]
...
{estadoOptions.map((estado) => (
  <SelectItem key={estado} value={estado}>{estado}</SelectItem>
))}

// After: import UFS from lib/clientes/ufs.ts directly inside this file,
// drop the estadoOptions prop from the function signature (line 109/118)
// and from every caller (KanbanBoard.tsx's estadoOptions useMemo, which
// becomes dead code and should be removed in the same change per
// RESEARCH.md's State of the Art table).
import { UFS } from "@/lib/clientes/ufs"
...
{UFS.map((uf) => (
  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
))}
```

**Fix 3 — Cidade becomes a `Combobox`, disabled until Estado chosen (D-02):** replace the current `<Input>` block (lines 255-265) with a `Combobox` sourced from `cidades_por_estado(draft.estado)`, `disabled={!draft.estado}`, placeholder `"Escolha o Estado primeiro"` when disabled / `"Todas as cidades"` when enabled+empty (UI-SPEC §4, Copywriting Contract). Selecting a new Estado in `draft` must also reset `draft.cidade` to `""` (same cascade-reset rule as EstadoCidadeFields, implemented here via the `Select`'s existing `onValueChange` draft-setter, e.g.:
```typescript
onValueChange={(value) =>
  setDraft((prev) => ({
    ...prev,
    estado: value === SEM_FILTRO ? null : String(value),
    cidade: "", // cascade reset, D-02/UI-SPEC §1
  }))
}
```

**Fix 4 — exact-match Cidade filter (Pitfall 4)** — change `clienteAtendeFiltros`'s Cidade branch (current lines 85-88):
```typescript
// Before:
const cidadeFiltro = filtros.cidade.trim().toLowerCase()
if (cidadeFiltro && !cliente.cidade.toLowerCase().includes(cidadeFiltro)) {
  return false
}

// After:
const cidadeFiltro = filtros.cidade.trim().toLowerCase()
if (cidadeFiltro && cliente.cidade.toLowerCase() !== cidadeFiltro) {
  return false
}
```
`contarFiltrosAtivos` (line 59, `filtros.cidade.trim() !== ""`) needs no change — already correct for an exact-match Combobox-selected string.

**Testing pattern:** no existing `FiltersPopover`-specific test file — follow this project's established RTL component-test pattern from `tests/importacao/AppSidebar.test.tsx` / `tests/importacao/FileDropzone.test.tsx` (per RESEARCH.md's Validation Architecture) for the new `tests/clientes/filters-popover.test.tsx`.

---

### `components/clientes/ClienteQuickCreateForm.tsx` (component, edited in place)

**Analog:** itself — the `cidade`/`estado` block (lines 228-268, quoted in full under `EstadoCidadeFields.tsx` above) is replaced by `<EstadoCidadeFields control={form.control} />` (or equivalent props) inside the same `grid grid-cols-3 gap-3` row, keeping `complemento` as the first column unchanged (UI-SPEC §3: "does not change the row's layout, column count, or column order").

**`FormControl` single-child constraint to preserve** (per UI-SPEC §3, and confirmed by this file's existing `Responsável` field which already conditionally swaps between `<Select>` and `<Input>` inside one `FormItem`, lines 270-299) — `FormControl` expects exactly one cloneable child; the new `Combobox` must be wrapped the same way the current `<Input>` is.

---

### `components/clientes/ClienteDetailSheet.tsx` (component, edited in place)

**Analog:** `ClienteQuickCreateForm.tsx` (RESEARCH.md line 51 confirms both forms render this field pair identically today). Apply the same `EstadoCidadeFields` swap. Additionally implement UI-SPEC §5: a stale/legacy out-of-`UFS` `estado` value on an existing record must render/edit normally (no custom warning UI) — this is native `Select` behavior (value falls back silently if not in the `UFS` item list), no extra code needed beyond using the same `Select` as elsewhere.

---

### `lib/validations/cliente.ts` (utility, zod schema, edited in place)

**Analog:** itself — both `createClienteSchema` (lines 24-53) and `updateClienteSchema` (lines 75-107) currently have:
```typescript
cidade: z.string().min(1, "Informe a cidade."),
estado: z.string().min(1, "Informe o estado."),
```
in both schemas (lines 31-32 and 83-84).

**Pattern to apply** (RESEARCH.md's own synthesis, matching this file's existing `.superRefine`-avoidance-for-plain-enums convention — `z.enum` doesn't need the `ZodEffects`-inference workaround the file already documents for `responsavel`):
```typescript
import { UFS } from "@/lib/clientes/ufs"

estado: z.enum(UFS, { message: "Selecione um estado válido." }),
cidade: z.string().min(1, "Selecione uma cidade válida."),
```
Cidade stays a plain non-empty string at the Zod layer (Zod alone cannot check DB-dependent "belongs to `cidades_por_estado(estado)`" — per RESEARCH.md's Security Domain, that check belongs in the Server Action, not here). Apply identically to both schemas, same as the existing `cidade`/`estado` duplication pattern already in this file.

**Error-message copy** must match UI-SPEC's Copywriting Contract exactly: `"Selecione um estado válido."` / `"Selecione uma cidade válida."`.

---

### `lib/importacao/annotarLinha.ts` (utility, pure function, edited in place)

**Analog:** itself — the existing `findByNome`/`findVendedor` lookup-and-reason-push pattern (lines 70-94, and steps 2-4 inside `annotarLinha`, lines 124-162).

**Pattern to copy for Estado (new step, no analog lookup list needed — pure `UFS.includes` check):**
```typescript
import { UFS, type Uf } from "@/lib/clientes/ufs"

const estadoValor = sanitized.estado?.trim().toUpperCase()
if (estadoValor && !UFS.includes(estadoValor as Uf)) {
  reasons.push(`Estado "${estadoValor}" não é uma sigla de UF válida`)
}
```

**Pattern to copy for Cidade — same shape as the existing categoria/produto lookup steps** (lines 124-148, using `findByNome`-style matching but scoped by UF):
```typescript
export type CidadeLookup = { nome: string; uf: string }
// Added to AnnotarLinhaLookups alongside vendedores/categorias/produtos —
// populated once per import batch by the caller (app/actions/importacao.ts),
// same pattern as the other three lookups (narrow select(), read once).

const cidadeValor = sanitized.cidade?.trim()
if (cidadeValor && estadoValor) {
  const match = lookups.cidades.find(
    (c) => c.uf === estadoValor && normalizeRazaoSocial(c.nome) === normalizeRazaoSocial(cidadeValor)
  )
  if (!match) reasons.push(`Cidade "${cidadeValor}" não encontrada para o estado ${estadoValor}`)
}
```
Reuses `normalizeRazaoSocial` (already imported from `lib/importacao/dedupe.ts`, line 2) — no new normalization dependency.

**`AnnotarLinhaLookups` type extension** (current shape, lines 32-36):
```typescript
export type AnnotarLinhaLookups = {
  vendedores: VendedorLookup[]
  categorias: LookupOption[]
  produtos: LookupOption[]
  cidades: CidadeLookup[] // NEW
}
```

**Required-field handling stays unchanged** — the existing `createImportRowSchema.safeParse(...)` block (lines 166-192) already requires non-empty `cidade`/`estado` via `ENDERECO_FIELDS`; the new Estado/Cidade *value-validity* checks above are additive, pushed as extra reasons alongside (not replacing) the existing required-field check.

**Error handling / dedup:** no change — `Array.from(new Set(reasons))` (line 194) already dedupes, so no special handling needed if both a "required" and a "not valid" reason somehow overlap (they don't, since the value-validity checks are gated on the value being present, `if (estadoValor ...)`/`if (cidadeValor && estadoValor)`).

**Testing pattern:** extend the existing `tests/importacao/annotarLinha.test.ts` (pure-function unit tests, fabricated lookup lists, no Supabase instance) — same convention this file's own header comment documents.

---

## Shared Patterns

### Zod-required-field style
**Source:** `lib/validations/cliente.ts` (existing file-wide convention)
**Apply to:** `estado` in both `createClienteSchema`/`updateClienteSchema` — use `z.enum(UFS, { message: ... })` instead of `.min(1, ...)`; keep `cidade` as `z.string().min(1, ...)` since Cidade validity is DB-dependent, not enumerable client-side.

### Base UI Select/Combobox visual parity
**Source:** `components/ui/select.tsx` (full file)
**Apply to:** `components/ui/combobox.tsx` (new file) and every place Cidade's `Combobox` trigger renders (`EstadoCidadeFields.tsx`, `FiltersPopover.tsx`) — must match `SelectTrigger`'s `h-8`, `text-sm`, `rounded-lg border-input bg-transparent`, `disabled:opacity-50 disabled:cursor-not-allowed` exactly (UI-SPEC §2).

### Browser-client RPC read (no Server Action indirection)
**Source:** `lib/supabase/client.ts`'s `createClient()`
**Apply to:** every one of the 3 UI touchpoints that calls `cidades_por_estado(uf)` directly (`EstadoCidadeFields.tsx`, `FiltersPopover.tsx`) — read-open RLS policy on `cidades`, no Server Action needed, matching how `categorias`/`produtos_consumidos` are already read in this codebase.

### Server Action must re-validate what the client already constrained
**Source:** `CLAUDE.md` project-wide rule + this project's existing `updateCliente`/`createCliente` server-side re-validation convention (`lib/validations/cliente.ts`'s own header comment, "a Server Action must never trust client input")
**Apply to:** `app/actions/clientes.ts`'s `createCliente`/`updateCliente` (not directly in this phase's file list, but referenced by RESEARCH.md's Security Domain) — must re-check `estado ∈ UFS` (via the updated Zod schema, automatic) and `cidade ∈ cidades_por_estado(estado)` (an explicit DB-dependent check, since Zod can't express it) before every insert/update.

### `NOT VALID` → backfill → best-effort `VALIDATE CONSTRAINT`
**Source:** this project's own `chk_ganho_somente_etapa_final`/`chk_perdido_exige_motivo` constraint style in `0002_clientes_and_funil.sql`
**Apply to:** the new `chk_estado_valido` constraint in `0007_cidades_e_estado_valido.sql` — never add a hard, immediately-validated `CHECK`/`enum` directly against existing inconsistent data (Pitfall 1).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/clientes/ufs.ts` | config | — | First plain static frontend constant array of this kind in the codebase; trivial enough not to need a structural analog (use RESEARCH.md's Code Examples verbatim) |

## Metadata

**Analog search scope:** `components/clientes/`, `components/ui/`, `lib/validations/`, `lib/importacao/`, `lib/supabase/`, `supabase/migrations/`
**Files scanned:** `FiltersPopover.tsx`, `ClienteQuickCreateForm.tsx`, `lib/validations/cliente.ts`, `lib/importacao/annotarLinha.ts`, `components/ui/select.tsx`, `lib/supabase/client.ts`, `supabase/migrations/0002_clientes_and_funil.sql` (grep-scanned for table/policy/function structure)
**Pattern extraction date:** 2026-07-26
