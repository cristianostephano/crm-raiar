# Phase 3: Administração de Listas Editáveis - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 8 (2 page/layout, 1 server actions module, 1 queries module, 1 shared client component, 1 zod validation module, 1 nav edit, 1 migration check — no new migration needed)
**Analogs found:** 8 / 8 (this phase is almost entirely pattern reuse, per CONTEXT.md/RESEARCH-skip note)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/(app)/configuracoes/page.tsx` | controller (Server Component page) | request-response | `app/(app)/equipe/page.tsx` | exact |
| `app/(app)/layout.tsx` (modify — add nav link) | component (layout) | request-response | same file, existing "Gerenciar equipe" `Link` block | exact |
| `app/actions/listas.ts` (new) | service (Server Actions) | CRUD | `app/actions/clientes.ts` (`createCliente`/`updateCliente`/`deleteCliente`) | exact |
| `lib/supabase/queries/clientes.ts` (modify — no new reads needed) | service (query reader) | CRUD | `getCategoriasAtivas`/`getProdutosAtivos`/`getTiposTarefaAtivos`/`getMotivosPerdaAtivos` (same file) | exact (already implemented, read-only reuse) |
| `lib/validations/lista.ts` (new) | utility (zod schema) | transform | `lib/validations/cliente.ts` (`createClienteSchema`) | exact |
| `components/configuracoes/EditableListTab.tsx` (new, shared across 4 tabs) | component (client, form + list) | CRUD | `components/clientes/PerdaMotivoDialog.tsx` (Dialog + async confirm pattern) + `components/auth/InviteUserForm.tsx` (react-hook-form + zod + inline reveal pattern) | role-match (composite of two analogs) |
| `components/configuracoes/ConfiguracoesTabs.tsx` (new, tabs shell) | component (client, layout) | request-response | `components/ui/tabs.tsx` (already installed) + toolbar tab pattern in `components/clientes/ClienteToolbar.tsx` ("Todos"/"Incompletos" tabs, per UI-SPEC line 119 reference) | role-match |
| `supabase/migrations/000X_*.sql` | migration | n/a | **NOT NEEDED** — see Shared Patterns note below | n/a |

## Pattern Assignments

### `app/(app)/configuracoes/page.tsx` (controller, request-response)

**Analog:** `app/(app)/equipe/page.tsx` (full file, 96 lines — small enough for single read)

**Auth/redirect pattern (lines 18-37, copy verbatim structure):**
```typescript
export default async function EquipePage() {
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
  // ... then read whatever the page needs
}
```
For `configuracoes/page.tsx`, replace the `members` read (lines 39-44) with reads of the 4 lookup tables (or delegate reads into `ConfiguracoesTabs`/`EditableListTab` as Client Components fetching via a Server Action — see `PerdaMotivoDialog`'s effect-based fetch pattern below, since UI-SPEC's inline-edit/toggle interactivity needs Client Components, unlike the static `equipe` table).

**Page shell pattern (lines 46-51):**
```typescript
return (
  <div className="flex flex-1 flex-col gap-8 p-6">
    <div className="flex items-center justify-between">
      <h1 className="text-[28px] font-semibold">Gerenciar equipe</h1>
      <InviteUserForm />
    </div>
    {/* ... */}
```
For Configurações: per UI-SPEC line 118, there is no page-level action button beside the heading (unlike `equipe`) — so this becomes just `<h1 className="text-[28px] font-semibold">Configurações</h1>` followed directly by `<ConfiguracoesTabs />` (no `justify-between` wrapper needed since there's no second element).

**Empty-state pattern (lines 82-93)** — reuse the `rounded-lg border border-dashed py-16 text-center` shape for each tab's zero-active-values empty state (UI-SPEC Copywriting Contract), swapping in the "Nenhum valor ativo nesta lista." heading/body from UI-SPEC.

---

### `app/(app)/layout.tsx` (modify — add nav link)

**Analog:** same file, existing conditional `Link` block (lines 61-68)

**Exact pattern to copy for the new "Configurações" link, immediately after the "Gerenciar equipe" link, same `profile?.role === "supervisor"` guard:**
```typescript
{profile?.role === "supervisor" ? (
  <Link
    href="/configuracoes"
    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
  >
    Configurações
  </Link>
) : null}
```

---

### `app/actions/listas.ts` (service, CRUD) — NEW file, one action set per operation, generic over the 4 tables

**Analog:** `app/actions/clientes.ts` — copy the auth-check + error-code + revalidatePath skeleton from `createCliente`/`updateCliente`/`deleteCliente`, adapted to soft-delete (update `ativo`, not `delete`).

**Imports pattern (lines 1-12 of clientes.ts, adapt path):**
```typescript
"use server"

import { revalidatePath } from "next/cache"

import { createListaValorSchema, updateListaValorSchema } from "@/lib/validations/lista"
import { createClient } from "@/lib/supabase/server"
```

**Auth/authorization pattern — copy verbatim from `deleteCliente` (lines 271-292 of clientes.ts), since every write on the 4 lookup tables is Supervisor-only (mirrors D-02/ADM-05), unlike `createCliente`/`updateCliente` which allow Vendedor writes with a `responsavel` override:**
```typescript
export async function createListaValor(
  tabela: "categorias" | "produtos_consumidos" | "tipos_tarefa" | "motivos_perda",
  values: CreateListaValorInput
): Promise<CreateListaValorResult> {
  const parsed = createListaValorSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validation" } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  const { data: inserted, error } = await supabase
    .from(tabela)
    .insert({ nome: parsed.data.nome })
    .select("id, nome")
    .single()

  if (error) {
    // Same 23505 -> duplicate mapping as createCliente's D-06 razao_social
    // check — these 4 tables likely need a unique constraint on (nome) per
    // table if not already present; confirm against 0002_clientes_and_funil.sql.
    if (error.code === "23505") {
      return { error: { code: "duplicate_nome" } }
    }
    return { error: { code: "generic" } }
  }

  revalidatePath("/configuracoes")
  return { data: inserted! }
}
```

**Deactivate/reactivate pattern (soft-delete, replaces `deleteCliente`'s hard DELETE):**
```typescript
export async function setListaValorAtivo(
  tabela: "categorias" | "produtos_consumidos" | "tipos_tarefa" | "motivos_perda",
  id: string,
  ativo: boolean
): Promise<SetListaValorAtivoResult> {
  // ... same auth block as createListaValor ...

  const { data: updated, error } = await supabase
    .from(tabela)
    .update({ ativo })
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) return { error: { code: "generic" } }
  if (!updated) return { error: { code: "generic" } }

  revalidatePath("/configuracoes")
  return { data: { id: updated.id } }
}
```

**Edit pattern:** mirrors `updateCliente`'s validate -> auth-check -> `.update().eq("id", ...).select().maybeSingle()` -> 23505-mapping -> `revalidatePath` shape (lines 150-220 of clientes.ts), but without the `responsavel`-override branch (not applicable — every write here is Supervisor-only, no Vendedor-scoped variant).

**IMPORTANT — RLS is already fully in place, no migration needed:** `supabase/migrations/0002_clientes_and_funil.sql` (lines ~211-244) already has, for all 4 tables (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`): a read-open-to-authenticated SELECT policy, and Supervisor-only (`is_supervisor()`) INSERT/UPDATE/DELETE policies. This phase's Server Actions rely entirely on the existing UPDATE policy for deactivate/reactivate (never calling DELETE, per D-03) and the existing INSERT/UPDATE policies for create/edit. **Confirm whether each table has a unique constraint on `nome`** (needed for the "duplicate name" error mapping in UI-SPEC) — if not present, a small additive migration (`alter table ... add constraint ... unique (nome)`) is the only migration this phase might need, and only for that reason.

---

### `lib/validations/lista.ts` (utility, transform) — NEW file

**Analog:** `lib/validations/cliente.ts` (lines 24-40, `createClienteSchema`)

```typescript
import { z } from "zod"

export const createListaValorSchema = z.object({
  nome: z.string().min(1, "Digite um nome antes de adicionar."),
})

export const updateListaValorSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, "Digite um nome antes de adicionar."),
})

export type CreateListaValorInput = z.infer<typeof createListaValorSchema>
export type UpdateListaValorInput = z.infer<typeof updateListaValorSchema>
```
One shared schema reused across all 4 tabs (all 4 tables have the same `{ id, nome, ativo }` shape) — no need for 4 separate schema files.

---

### `components/configuracoes/EditableListTab.tsx` (component, CRUD) — NEW, shared across 4 tabs

**Analog 1 — Dialog + async confirm pattern:** `components/clientes/PerdaMotivoDialog.tsx` (full file, 202 lines). Copy the `open`/`onOpenChange` controlled-Dialog shape, the `isSubmitting`/`submitError` local state, and the try/catch around the async `onConfirm` call (lines 99-127) for the "Desativar" confirmation Dialog (UI-SPEC Copywriting Contract's low-friction confirm dialog).

**Analog 2 — inline reveal + react-hook-form + zod pattern:** `components/auth/InviteUserForm.tsx`. Copy:
- The "collapsed button -> inline form reveal" shell is NOT needed here (UI-SPEC keeps the "Adicionar" input+button always visible, not collapsed) — skip that part.
- The `useForm` + `zodResolver` + `Form`/`FormField`/`FormControl`/`FormMessage` wiring (lines 114-126, 178-215) for the "Adicionar novo valor" input.
- The `formError`/`successMessage` local-state + role="alert"/role="status" styled `div` blocks (lines 111-112, 185-201) for the UI-SPEC's success/error copy ("adicionado"/"Já existe um valor chamado...").

**New pattern this file must introduce (no direct analog in codebase) — inline-edit-in-place row:** UI-SPEC's row-level edit mode (Pencil -> Input replaces static text -> Check/X icon buttons) has no existing analog; build it as local component state (`editingId: string | null`) per `EditableListTab`, following the same "local state + async action call + error surfaced inline" shape as `PerdaMotivoDialog`'s `handleConfirm` (try/catch, `isSubmitting` flag disables the row's buttons during the async call).

**Toggle pattern ("Mostrar inativos" `Switch`):** No existing `Switch` usage in the codebase (UI-SPEC line 105 confirms `switch` is a new install this phase, `npx shadcn@latest add switch`) — no analog needed beyond standard shadcn/ui controlled-component usage (`checked`/`onCheckedChange`), same controlled pattern already used for `Select`'s `value`/`onValueChange` in `InviteUserForm.tsx`.

---

### `components/configuracoes/ConfiguracoesTabs.tsx` (component, request-response) — NEW, tabs shell

**Analog:** `components/ui/tabs.tsx` (already installed, Phase 2) — use directly, no modification. For the tab-labels-plus-active-indicator visual precedent, UI-SPEC line 119 references Phase 2's "Todos"/"Incompletos" tabs in `components/clientes/ClienteToolbar.tsx` — check that file for the exact `Tabs`/`TabsList`/`TabsTrigger` composition already used in this codebase before inventing a new one.

---

## Shared Patterns

### Supervisor-only route protection
**Source:** `app/(app)/equipe/page.tsx` lines 18-37
**Apply to:** `app/(app)/configuracoes/page.tsx` — identical redirect-to-`/` guard, this app-layer check is UX only (per UI-SPEC line 116); real boundary is RLS.

### Structured Server Action error codes + revalidatePath
**Source:** `app/actions/clientes.ts` — every action returns `{ data } | { error: { code } }`, never throws to the caller, and calls `revalidatePath` on success.
**Apply to:** All new `app/actions/listas.ts` actions (`createListaValor`, `updateListaValor`, `setListaValorAtivo`).

### Defense-in-depth authorization check before every write
**Source:** `deleteCliente` (clientes.ts lines 271-292) — checks `callerProfile.role === "supervisor"` in the Server Action itself, even though RLS is the real boundary.
**Apply to:** All 3 new lookup-table write actions (RLS already enforces Supervisor-only via `is_supervisor()`, this is a UX-layer early-reject mirroring that).

### Soft-delete via `ativo` column, never `DELETE`
**Source:** `lib/supabase/queries/clientes.ts`'s `getCategoriasAtivas`/etc. already filter `.eq("ativo", true)` — this phase's write side must only ever `.update({ ativo })`, never call `.delete()` on these 4 tables (D-03), even though a DELETE RLS policy exists on them (leftover from the original migration, not to be used by this phase's UI).
**Apply to:** `setListaValorAtivo` action (deactivate = `ativo: false`, reactivate = `ativo: true`).

### Zod schema shared between client validation and Server Action re-validation
**Source:** `lib/validations/cliente.ts` + `app/actions/clientes.ts`'s `createCliente` (`createClienteSchema.safeParse(values)`)
**Apply to:** `lib/validations/lista.ts` + `app/actions/listas.ts` — never trust client-side validation alone.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Row-level inline-edit-in-place interaction (Pencil -> Input -> Check/X) inside `EditableListTab.tsx` | component (client, UI state) | CRUD | No existing row in this codebase switches between display and edit mode in place; nearest precedent (`PerdaMotivoDialog`) uses a separate Dialog instead. Build from local `editingId` state + the same async-call/error-surface shape already used elsewhere. |
| `Switch` component usage | component | n/a | New shadcn/ui install this phase (`npx shadcn@latest add switch`), no prior usage in codebase to copy from — follow standard shadcn/ui controlled-component conventions. |

## Metadata

**Analog search scope:** `app/(app)/`, `app/actions/`, `lib/supabase/queries/`, `lib/validations/`, `components/clientes/`, `components/auth/`, `components/ui/`, `supabase/migrations/0002_clientes_and_funil.sql`
**Files scanned:** 8 read directly (equipe/page.tsx, clientes.ts actions, clientes.ts queries, cliente.ts validations, PerdaMotivoDialog.tsx, InviteUserForm.tsx, layout.tsx, migration policy section) + grep pass over migration file and components directory listing
**Pattern extraction date:** 2026-07-17
