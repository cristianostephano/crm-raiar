# Phase 6: Importação — Upload, Mapeamento e Revisão - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 9
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/(app)/clientes/importar/page.tsx` | route (Supervisor-only guard) | request-response | `app/(app)/configuracoes/page.tsx` | exact |
| `components/importacao/ImportWizard.tsx` | component (client, stateful multi-step shell) | transform / event-driven | `components/configuracoes/EditableListTab.tsx` | role-match |
| `components/importacao/FileDropzone.tsx` | component | file-I/O | none (new UI pattern) | no analog |
| `lib/importacao/parseArquivo.ts` | utility (parse .xlsx/.csv client-side) | file-I/O, transform | `lib/clientes/exportacao.ts` (`@e965/xlsx` usage) | role-match |
| `components/importacao/ColumnMappingTable.tsx` | component | transform | `components/clientes/ClienteToolbar.tsx` (controlled-select shell) | role-match |
| `lib/importacao/dedupe.ts` | utility (razão-social normalization + duplicate detection) | transform | none direct — pattern from `lib/clientes/completude.ts` (pure function shape) | partial |
| `lib/validations/importacao.ts` | model/schema (per-row Zod, relaxed from cadastro) | CRUD (validation) | `lib/validations/cliente.ts` | exact |
| `app/actions/importacao.ts` (`validarLoteImportacao`) | service (Server Action, read-only) | request-response | `app/actions/clientes.ts` (`createCliente`) | exact |
| `components/importacao/ImportPreviewTable.tsx` | component (paginated review table) | CRUD (read-only preview) | `components/configuracoes/EditableListTab.tsx` (list rendering + per-row actions) | role-match |

Note: `confirmarLoteImportacao` and the `importar_clientes_lote` RPC/migration are explicitly **Phase 7 scope** per `06-UI-SPEC.md` line 155 and `ARCHITECTURE.md` Pattern 5 step 3 — not classified here, but the RPC pattern (`mover_card_funil`-style guard) is documented under Shared Patterns below since the Review screen's "Confirmar importação" button is built in this phase (its `onClick` wiring is Phase 7's job).

## Pattern Assignments

### `app/(app)/clientes/importar/page.tsx` (route, request-response)

**Analog:** `app/(app)/configuracoes/page.tsx` (full file, 43 lines)

**Supervisor-only guard pattern** (lines 16-35):
```tsx
export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (callerProfile?.role !== "supervisor") {
    redirect("/")
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-[28px] font-semibold">Configurações</h1>
      <ConfiguracoesTabs />
    </div>
  )
}
```
Copy this exact shape for `importar/page.tsx`: Server Component, `redirect("/login")` if unauthenticated, `redirect("/")` if `callerProfile?.role !== "supervisor"` (same guard `app/(app)/equipe/page.tsx` line 36 uses — `redirect("/")` when not supervisor). This is UX-only; the real boundary for any future write is the RLS/RPC guard (Phase 7), same reasoning as `ARCHITECTURE.md` Pattern 4. The page renders a client component wizard (`<ImportWizard />`) in place of `<ConfiguracoesTabs />`.

---

### `lib/importacao/parseArquivo.ts` (utility, file-I/O + transform)

**Analog:** `lib/clientes/exportacao.ts` (full file, 82 lines)

**Pure-function, dependency-isolated shape** (lines 6-14 comment + signature):
```typescript
import * as XLSX from "@e965/xlsx"
// ... pure function taking already-fetched rows, returning a transformed
// shape. No Supabase import, no "use server"/"use client" directive —
// stays unit-testable in isolation, safe to import from either a Route
// Handler or a Client Component.

export function buildClientesWorkbook(rows: ClienteExportRow[]): Buffer {
  const sheetRows = rows.map((row) => ({ /* ... */ }))
  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
```
**Formula-injection guard to reuse verbatim (import path, not just export!):** `sanitizeCell` (lines 34-39) — the same leading-`=`/`+`/`-`/`@`/tab/CR check matters on the import side too (Pitfall A4/CSV injection, noted in `PITFALLS.md` "Milestone Addendum: v1.1"), since a malicious spreadsheet cell could carry a formula that a later re-export would reopen as executable. Import parsing should sanitize the same way before the value ever reaches the preview table.

**Apply this shape to `parseArquivo`:** a pure function (no Supabase/"use server"/"use client") that takes a `File`/`ArrayBuffer` and returns `{ headers: string[]; rows: string[][] }` — dispatch on extension: `.xlsx` → `XLSX.read(buffer, { type: "buffer" })` + `XLSX.utils.sheet_to_json(sheet, { header: 1 })`; `.csv` → `Papa.parse(text, { skipEmptyLines: true })`. Runs entirely in the browser per `ARCHITECTURE.md` Pattern 5 step 1 — no Route Handler needed for parsing itself.

---

### `lib/validations/importacao.ts` (model/schema, CRUD-validation data flow)

**Analog:** `lib/validations/cliente.ts` (full file, 110 lines — `createClienteSchema`, lines 24-55)

**Required/optional split + `""`-sentinel pattern to reuse** (lines 24-53):
```typescript
export const createClienteSchema = z
  .object({
    razaoSocial: z.string().min(1, "Informe a razão social."),
    cep: z.string().min(1, "Informe o CEP."),
    rua: z.string().min(1, "Informe a rua."),
    numero: z.string().min(1, "Informe o número."),
    complemento: z.string().optional(),
    cidade: z.string().min(1, "Informe a cidade."),
    estado: z.string().min(1, "Informe o estado."),
    responsavel: z.string(), // "" sentinel; rejected below via superRefine
    categoriaId: z.string().optional(),
    // ...
  })
  .superRefine((data, ctx) => {
    if (data.responsavel === "") {
      ctx.addIssue({ code: "custom", message: "Selecione o responsável.", path: ["responsavel"] })
    }
  })
```
**Why `.superRefine` not `.refine()` on the field:** per the comment (lines 17-23) chaining `.refine()` onto one field turns it into `ZodEffects`, breaking `@hookform/resolvers`' generic inference against zod v4 — same constraint applies to any per-row import schema built with `@hookform/resolvers`, though the import row schema itself is likely validated directly with `.safeParse()` in a Server Action (no react-hook-form on the server side), so this constraint only binds if the row schema is *also* reused client-side in the mapping/preview UI.

**Apply to `createImportRowSchema`:** define required fields identically to `createClienteSchema` (razaoSocial, cep, rua, numero, cidade, estado, responsavel — per `CONTEXT.md`'s reuse instruction "a validação de cada linha da planilha deve reaproveitar essas mesmas regras mínimas"), but with `categoriaId`/`produtoIds` resolved from free-text spreadsheet values (not already-known IDs) — resolution happens in the Server Action before Zod validation, using `getCategoriasAtivas`/`getProdutosAtivos` as the lookup source (see below), and an unresolvable value produces a structured `erro` annotation rather than a Zod validation failure.

---

### `app/actions/importacao.ts` — `validarLoteImportacao` (service, request-response, read-only)

**Analog:** `app/actions/clientes.ts` — `createCliente` (lines 1-97)

**Server Action shape to copy:**
```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClienteSchema, type CreateClienteInput } from "@/lib/validations/cliente"
import { createClient } from "@/lib/supabase/server"

export type CreateClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: CreateClienteErrorCode } }

export async function createCliente(values: CreateClienteInput): Promise<CreateClienteResult> {
  const parsed = createClienteSchema.safeParse(values)
  if (!parsed.success) return { error: { code: "validation" } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated" } }

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  const isSupervisor = callerProfile?.role === "supervisor"
  // ... business rule, then supabase call, then structured error mapping
}
```

**Apply to `validarLoteImportacao(rows: ParsedImportRow[])`:**
- `"use server"` directive, discriminated `{ data } | { error }` return type — same as `CreateClienteResult`.
- Re-check `is_supervisor` (`callerProfile?.role === "supervisor"`) exactly like `createCliente` checks role for the `responsavel` override — here it should hard-reject (return an error / redirect analog) since only a Supervisor may run the import feature at all (`IMP-10`), matching the RPC-level guard reasoning in `ARCHITECTURE.md` Pattern 4 (`if not is_supervisor() then raise exception`).
- Per-row output shape: `{ row: number; status: "ok" | "duplicado" | "erro"; reason?: string; data: ResolvedRow }[]` — mirrors the "structured, non-revealing error code" discipline `createCliente` uses for `duplicate_razao_social` (line 89-91), but per-row instead of per-call since this is a batch.
- **Duplicate-check query pattern to copy** from `getClientesParaExportacao` (`lib/supabase/queries/clientes.ts` lines 367-370+): a single narrow-`select()` RLS-scoped query, no manual role branching — `supabase.from("clientes").select("id, razao_social").in("razao_social", batchRazaoSociais)` resolves DB-side duplicates in one round trip (per `ARCHITECTURE.md` Pattern 5 step 2), then in-batch duplicates are found via the same normalized-string comparison in `lib/importacao/dedupe.ts`.
- **Lookup resolution:** reuse `getCategoriasAtivas()` / `getProdutosAtivos()` verbatim (`lib/supabase/queries/clientes.ts` lines 541-552, 559-569) — both already return `LookupOption[]` (`{ id, nome }`), full-catalog, RLS-open to any authenticated user. Resolve each row's free-text categoria/produto against these lists case-insensitively; unresolvable → `erro` annotation per `06-CONTEXT.md` D-02 ("categoria 'X' não existe"), never silent blank/auto-create.
- **Never** trust client-sent field values as authorization inputs — same posture as `getClientesParaExportacao`'s `ids` parameter (lines 20-24 of the Route Handler comment): the parsed spreadsheet rows are data, not permission input; the `is_supervisor` check is the only gate.

---

### `components/importacao/ImportWizard.tsx` (component, event-driven multi-step)

**Analog:** `components/configuracoes/EditableListTab.tsx` (full file, 511 lines)

**State-machine + fetch/loading/error/success pattern to copy:**
- `useState` per concern (loading flag, error message, success message) rather than a single reducer — lines 73-95 show the flat `useState` style used throughout this codebase for form-adjacent components (also seen in `ClienteQuickCreateForm.tsx`, `PerdaMotivoDialog.tsx`).
- Synchronous loading-flag set before an async call starts, with an inline comment explaining why (`// eslint-disable-next-line react-hooks/set-state-in-effect`) — lines 104-106. Reuse this exact pattern for the "Lendo arquivo…" / "Validando linhas…" progress labels called out in `06-UI-SPEC.md` line 167.
- Structured error-code → user-facing-message mapping via a local function (lines 137-144, `DUPLICATE_ERROR`/`GENERIC_ERROR` constants at top of file, lines 40-48) — apply the same top-of-file message-constant pattern for the wizard's copy strings from the UI-SPEC's Copywriting Contract (e.g. `EMPTY_STATE_HEADING`, `WRONG_FILE_TYPE_ERROR`).
- `role="alert"` for errors / `role="status"` for success messages (lines 296-312) — reuse verbatim for the wizard's transient banners, matching `06-UI-SPEC.md` line 168's instruction to reuse `KanbanBoard.tsx`'s "bottom-centered, auto-dismissing banner, same `role=\"alert\"`/`role=\"status\"` split." (Note: `KanbanBoard.tsx`'s specific banner markup was not directly grep-matched in this codebase snapshot — `EditableListTab.tsx`'s inline alert/status `<div>`/`<p>` pattern above is the closest confirmed analog and satisfies the same accessibility contract; verify against `KanbanBoard.tsx` directly at execution time for the bottom-centered positioning specifics.)

**Loading skeleton pattern** — analog: `components/dashboard/GanhosPerdidosCards.tsx` (lines 61, 85-87):
```tsx
// loading state must be set synchronously so the Skeleton shows immediately
<Skeleton className="h-[140px] w-full" />
```
Reuse `Skeleton` from `components/ui/skeleton.tsx` for the parse/validate step transitions rather than introducing a spinner.

---

### `components/importacao/ImportPreviewTable.tsx` (component, CRUD-read-only preview)

**Analog:** `components/configuracoes/EditableListTab.tsx` (list-rendering + per-row action section, lines 347-465)

**Per-row action toggle pattern to copy** (lines 426-458 — active/inactive row with contextual action buttons):
```tsx
{valor.ativo ? (
  <>
    <Button variant="ghost" size="icon" aria-label={`Editar ${valor.nome}`} onClick={() => startEdit(valor)}>
      <Pencil className="size-4" />
    </Button>
    <Button variant="ghost" size="icon" aria-label={`Desativar ${valor.nome}`} onClick={() => openDeactivateDialog(valor)}>
      <EyeOff className="size-4" />
    </Button>
  </>
) : (
  <Button variant="ghost" size="icon" aria-label={`Reativar ${valor.nome}`} disabled={isReactivating} onClick={() => void reactivate(valor)}>
    <Eye className="size-4" />
  </Button>
)}
```
Apply this exact per-row conditional-action shape to duplicado rows: two `outline`/`ghost` buttons ("Importar mesmo assim" / "Pular"), defaulting to "Pular" (per `06-UI-SPEC.md` line 132), toggled via row-keyed local state (`useState<Record<number, "importar" | "pular">>`) — mirrors `editingId`/`reactivatingId` single-row-tracking state (lines 81, 95).

**Empty-state pattern** (lines 337-346):
```tsx
<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
  <p className="text-base font-semibold">Nenhum valor ativo nesta lista.</p>
  <p className="max-w-md text-sm text-muted-foreground">...</p>
</div>
```
Reuse verbatim for the "Nenhuma linha encontrada nesta planilha" empty state (`06-UI-SPEC.md` lines 141-142).

**Row-status left-border color vocabulary — reuse verbatim, do not reinvent:**
Source: `components/clientes/ClienteCard.tsx` lines 40-44:
```typescript
const TASK_STATUS_BORDER: Record<TaskStatus, string> = {
  on_time: "border-l-4 border-l-green-500",
  late: "border-l-4 border-l-amber-500",
  none: "border-l-4 border-l-red-500",
}
```
Per `06-UI-SPEC.md` lines 84-91, define an equivalent `Record<ReviewRowStatus, string>` mapping `ok → border-l-4 border-l-green-500`, `duplicado → border-l-4 border-l-amber-500`, `erro → border-l-4 border-l-red-500` (or `border-l-destructive`) — same 3-color vocabulary, same Tailwind utility shape, applied to `Table` rows instead of `ClienteCard`.

**New shadcn `Table` primitive:** none exists yet in `components/ui/` (per `06-UI-SPEC.md` line 30) — install via `shadcn` CLI (official registry, no vetting gate needed) rather than hand-rolling a `<table>`. Pair with `@tanstack/react-table` (already an approved dependency) for the 50-rows-per-page client-side pagination — no existing analog for `@tanstack/react-table` usage in this codebase yet, so this is the first table-with-pagination component; follow TanStack Table's standard `useReactTable` + `getPaginationRowModel()` composition directly, there is no in-repo precedent to deviate from.

---

### `components/importacao/ColumnMappingTable.tsx` (component, transform)

**Analog:** `components/clientes/ClienteToolbar.tsx` (controlled-input shell pattern, lines 36-60)

**Controlled-prop shape to copy:** the toolbar is a "purely a controlled-input shell — all... state and matching logic live in [the parent]" (comment lines 33-34). Apply the same discipline to `ColumnMappingTable`: it receives `columns: DetectedColumn[]`, `mapping: Record<string, SystemField>`, `onMappingChange: (column: string, field: SystemField) => void` as props and holds no state of its own — all mapping state lives in `ImportWizard`, matching this codebase's existing convention of keeping presentational list/table components state-free and delegating to the parent (also true of `EditableListTab` receiving `tabela` as a prop while managing its own CRUD state internally — the difference here is `ColumnMappingTable` is pure/controlled because the mapping choices must survive across the wizard's step navigation).

**`Select` per-row pattern:** reuse `components/ui/select.tsx` the same way `ClienteToolbar`'s `FiltersPopover` and `ClienteQuickCreateForm`'s categoria/produto selects already do — one `Select` per detected column, with "Não importar esta coluna" always the last option (per `06-UI-SPEC.md` line 116/165).

---

## Shared Patterns

### Supervisor-only route guard
**Source:** `app/(app)/configuracoes/page.tsx` lines 16-35, `app/(app)/equipe/page.tsx` line 36
**Apply to:** `app/(app)/clientes/importar/page.tsx`
```tsx
if (!user) redirect("/login")
const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
if (callerProfile?.role !== "supervisor") redirect("/")
```

### Zod schema with `""`-sentinel required field + `.superRefine`
**Source:** `lib/validations/cliente.ts` lines 24-53
**Apply to:** `lib/validations/importacao.ts` per-row schema, and any client-side re-validation of the mapping/preview state.

### Structured discriminated-union Server Action result + error-code mapping
**Source:** `app/actions/clientes.ts` lines 14-22, 84-93
**Apply to:** `validarLoteImportacao`/`confirmarLoteImportacao` (latter is Phase 7) return types — `{ data } | { error: { code } }`, Postgres `23505` → structured non-revealing code.

### RLS-scoped narrow-`select()` read, no manual role branching
**Source:** `lib/supabase/queries/clientes.ts` `getClientesParaExportacao` (lines 349-366), `getCategoriasAtivas`/`getProdutosAtivos` (lines 541-569)
**Apply to:** the duplicate-check query and categoria/produto lookup resolution inside `validarLoteImportacao` — never add a manual `is_supervisor()`/`responsavel` filter on top of what RLS already does for reads; only the "may use this feature at all" gate needs an explicit check (see Pattern 4 reasoning in `ARCHITECTURE.md`).

### `role="alert"` / `role="status"` transient message pattern
**Source:** `components/configuracoes/EditableListTab.tsx` lines 296-312, repeated across `ClienteQuickCreateForm.tsx`, `PerdaMotivoDialog.tsx`, `InviteUserForm.tsx`
**Apply to:** All new components in this phase showing inline validation/success/error banners (upload rejection, parse failure, per-row erro reasons use plain text per UI-SPEC, not this alert pattern — reserve `role="alert"` for step-level failures like "Não foi possível ler esta planilha").

### 3-color status-border vocabulary (never reinvent)
**Source:** `components/clientes/ClienteCard.tsx` lines 40-44 (`TASK_STATUS_BORDER`)
**Apply to:** `ImportPreviewTable.tsx` row status borders (ok/duplicado/erro), per `06-UI-SPEC.md` lines 84-91 explicit instruction to reuse this exact vocabulary.

### Skeleton-based async-step loading (no spinner library)
**Source:** `components/dashboard/GanhosPerdidosCards.tsx` lines 61, 85-87
**Apply to:** `ImportWizard.tsx`'s "Lendo arquivo…" / "Validando linhas…" progress feedback (`06-UI-SPEC.md` line 167).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/importacao/FileDropzone.tsx` | component | file-I/O | No existing drag-and-drop / native file-input UI anywhere in this codebase (the export flow triggers a download, never an upload) — build from scratch using a plain `<input type="file">` + native HTML5 drag events, styled with the existing spacing/color tokens from `06-UI-SPEC.md`; no in-repo pattern to copy beyond general component conventions (PascalCase, `"use client"`, controlled props). |
| `lib/importacao/dedupe.ts` (normalization algorithm specifically) | utility | transform | No existing string-normalization/fuzzy-match helper in the codebase (`ARCHITECTURE.md`/`STACK.md` mention `pg_trgm` as an option but this phase, being read-only/pre-confirm, favors a simple JS/TS normalization per `06-CONTEXT.md`'s "Claude's Discretion" — lowercase, strip accents/punctuation/"Ltda"/"S.A." suffixes, then exact-match compare). `lib/clientes/completude.ts` is the closest shape precedent only in the generic sense of "pure function, no Supabase import" — read it directly at execution time for that shape confirmation, but there is no duplicate-detection logic to copy. |

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/` (excluding `node_modules`, `.planning`)
**Files scanned:** ~40 (via Glob/grep across `app`, `components`, `lib`)
**Pattern extraction date:** 2026-07-22
