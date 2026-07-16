# Phase 2: Cadastro e Funil de Vendas - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 15 (new/modified)
**Analogs found:** 12 / 15 (real, shipped Phase 1 code) + 3 no-analog (new domain concepts: kanban, migration, RLS-for-clientes)

**Note on RESEARCH.md:** Research was skipped this phase (project owner decision). Analogs below come from real, tested Phase 1 code (`InviteUserForm.tsx`, `equipe/page.tsx`, `app/(app)/layout.tsx`, `lib/supabase/*`, `0001_profiles_and_roles.sql`) per the orchestrator's guidance — prefer these over inventing new patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/0002_clientes_and_funil.sql` | migration | CRUD (schema) | `supabase/migrations/0001_profiles_and_roles.sql` | exact (structure: enable RLS + policy + trigger in one file, `is_supervisor()` reuse) |
| `components/clientes/ClienteQuickCreateForm.tsx` (Dialog, "Novo cliente") | component (form) | request-response | `components/auth/InviteUserForm.tsx` | exact (react-hook-form + zod + controlled Select) |
| `components/clientes/ClienteDetailSheet.tsx` (edit drawer) | component (form) | CRUD | `components/auth/InviteUserForm.tsx` | role-match (form + Select pattern; larger, multi-section) |
| `components/clientes/ClienteCard.tsx` (kanban card) | component | transform (render) | `app/(app)/equipe/page.tsx` table row rendering | partial (badge/row rendering only, no drag) |
| `components/clientes/KanbanBoard.tsx` (7-column board, dnd-kit) | component | event-driven (drag/drop) | none in codebase | no analog — see below |
| `components/clientes/FiltersPopover.tsx` | component | request-response | `components/auth/InviteUserForm.tsx` (Select pattern) | role-match (Select/multi-select conventions only) |
| `components/clientes/PerdaMotivoDialog.tsx` (confirm perdido w/ motivo) | component | request-response | `components/auth/InviteUserForm.tsx` | partial (small form-in-dialog pattern) |
| `components/clientes/HistoricoTimeline.tsx` | component | transform (read-only render) | `app/(app)/equipe/page.tsx` (read-only list rendering) | partial |
| `app/(app)/clientes/page.tsx` (list/kanban page) | route (protected page) | request-response (Server Component read) | `app/(app)/equipe/page.tsx` | exact (guard + role-based query pattern) |
| `app/(app)/layout.tsx` (nav link addition) | provider/layout | request-response | itself, existing file — extend, don't replace | exact (extend existing nav pattern) |
| `lib/supabase/queries/clientes.ts` (server-side data fetchers) | service | CRUD | `app/(app)/equipe/page.tsx` inline queries (no separate service file exists yet — extract) | role-match (query shape, not yet its own file) |
| `lib/validations/cliente.ts` (zod schemas) | utility | transform (validation) | `components/auth/InviteUserForm.tsx` (`inviteSchema`, superRefine trick) | exact (zod schema conventions, incl. Select empty-string handling) |
| `app/actions/clientes.ts` (Server Actions: create/update/delete/move-stage/mark-perdido/mark-ganho) | service (Server Action) | CRUD | `supabase/functions/invite-user/index.ts` (structured error codes) + `InviteUserForm.tsx` submit handler | role-match (error code propagation pattern) |
| `supabase/functions/` (none needed — decided in favor of Server Actions/RPC per Claude's Discretion in CONTEXT.md) | n/a | n/a | n/a | not applicable |
| `tests/clientes/*.test.ts` (RLS + validation tests) | test | request-response | none in codebase yet (Phase 1 tests, if present, not sampled) | no analog — see below |

## Pattern Assignments

### `supabase/migrations/0002_clientes_and_funil.sql` (migration, CRUD/schema)

**Analog:** `supabase/migrations/0001_profiles_and_roles.sql` (full file read, 91 lines)

**Structural pattern to copy** (whole-file convention, lines 1-10):
```sql
-- Single migration file on purpose (Pitfall 1 — RLS enable + policy + trigger
-- must not be split across migrations). ... any further change is a NEW
-- migration file, never an edit to this one).
-- Source: .planning/phases/.../XX-PATTERNS.md
```
Apply this same "one migration = table + RLS enable + all its policies + any trigger/function it needs" discipline to the new `clientes`, `funil_cards` (or equivalent), and enum-lookup tables (`categorias`, `produtos_consumidos`, `tipos_tarefa`).

**`is_supervisor()` reuse pattern** (lines 34-49) — do not redefine, reference the existing function from Phase 1 migration directly in new policies:
```sql
create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'supervisor'
  );
$$;
```
New RLS policies for `clientes` (Vendedor sees only own, Supervisor sees all) should follow the same `(select auth.uid())` wrapping convention (Pitfall 4 — evaluate once per statement, not per row) and use `is_supervisor()` in `using`/`with check` clauses instead of duplicating the subquery.

**Policy pattern shape** (lines 51-63) — permissive blanket SELECT for authenticated, explicit absence of write policy where write is not yet decided:
```sql
create policy "usuarios autenticados veem todos os perfis"
on profiles for select
to authenticated
using (true);
```
For `clientes`, this becomes role-conditional instead of `using (true)` — e.g. `using (is_supervisor() or responsavel = (select auth.uid()))`.

**Trigger pattern** (lines 68-90) — `handle_new_user` SECURITY DEFINER trigger shape is the template for any auto-populate trigger this phase might need (e.g. auto-creating the first funil card in "Aguardando contato" stage when a cliente is inserted, per the UI-SPEC's "no separate assign initial stage control needed").

**No analog for:** kanban stage/card data model (1 cliente = 1 active funil position vs. reentry) — CONTEXT.md defers this exact modeling decision to planning; no existing schema in this codebase models a stage machine yet.

---

### `components/clientes/ClienteQuickCreateForm.tsx` (component, request-response)

**Analog:** `components/auth/InviteUserForm.tsx` (full file read, 293 lines)

**Imports pattern** (lines 1-25):
```typescript
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
```
Swap the `Select`/`Input` import set to also include `Dialog`/`DialogContent`/`DialogTrigger` etc. (new component this phase, per UI-SPEC).

**Controlled-Select-from-first-render fix (critical, copy verbatim pattern)** (lines 27-59, comment + schema):
```typescript
// D-05: papel has no default — the Supervisor must explicitly choose it.
// `role` includes "" as a valid (but rejected) empty-state value: Base UI's
// Select must be controlled from the very first render...
const inviteSchema = z
  .object({ /* fields incl. role: z.enum(["", "supervisor", "vendedor"]) */ })
  .superRefine((data, ctx) => {
    if (data.role === "") {
      ctx.addIssue({ code: "custom", message: "Escolha o papel.", path: ["role"] })
    }
  })
```
Apply the identical `""` + `superRefine` trick to `ClienteQuickCreateForm`'s `responsavel` Select (Supervisor: no default pre-selected per UI-SPEC "mirroring Phase 1's D-05... no default role pre-selected... per CLI-03") and `categoria` Select in the full detail form.

**Select field render pattern** (lines 259-280):
```typescript
<Select
  value={field.value}
  onValueChange={(value) => field.onChange(value)}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Selecione o papel" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="supervisor">Supervisor</SelectItem>
    <SelectItem value="vendedor">Vendedor</SelectItem>
  </SelectContent>
</Select>
```

**Submit + Supabase call + error handling pattern** (lines 128-176):
```typescript
async function onSubmit(values: InviteFormValues) {
  setFormError(null)
  setSuccessMessage(null)
  try {
    const supabase = createClient()
    const { error } = await supabase.functions.invoke("invite-user", { body: {...values} })
    if (error) {
      // read structured error code from context, map to friendly copy
      ...
      setFormError(code === "email_exists" ? DUPLICATE_EMAIL_ERROR : GENERIC_ERROR)
      return
    }
    setSuccessMessage(SUCCESS_MESSAGE)
    form.reset({...})
    onInvited?.()
  } catch {
    setFormError(GENERIC_ERROR)
  }
}
```
For `ClienteQuickCreateForm`, replace `supabase.functions.invoke(...)` with a Server Action call (`createCliente(values)` from `app/actions/clientes.ts`), but keep the try/catch + form-level error banner + success message shape identical. Map D-06's duplicate razão social error the same way `email_exists` is mapped today — copy `Já existe um cliente cadastrado com essa razão social.` per the Copywriting Contract.

**Inline error/success banner pattern** (lines 185-201):
```typescript
{formError ? (
  <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {formError}
  </div>
) : null}
{successMessage ? (
  <div role="status" className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
    {successMessage}
  </div>
) : null}
```

**Submit button loading-state pattern** (lines 282-288):
```typescript
<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
  {form.formState.isSubmitting ? "Convidando..." : "Convidar"}
</Button>
```
Swap copy to "Cadastrando..." / "Cadastrar cliente" per Copywriting Contract.

---

### `components/clientes/ClienteDetailSheet.tsx` (component, CRUD)

**Analog:** `components/auth/InviteUserForm.tsx` (same file as above — reuse all patterns above: schema/superRefine, Select controlled pattern, submit/error handling, banners).

**Additional consideration (no direct analog in codebase):** multi-section form (Dados do cliente + Funil) with nested checklist (tarefas) and read-only timeline (histórico) has no precedent in Phase 1. Structure per UI-SPEC: reuse `Form`/`FormField` wrapper from `components/ui/form.tsx` for each section, but the tarefa checklist (checkbox + date picker + delete) and histórico timeline are new compositions — build them from primitive `components/ui/*` blocks (to be installed: `checkbox`, `calendar`, `popover`, `separator`) rather than adapting an existing composite.

---

### `app/(app)/clientes/page.tsx` (route, request-response)

**Analog:** `app/(app)/equipe/page.tsx` (full file read, 97 lines)

**Auth guard + role-based query pattern** (lines 18-37):
```typescript
export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { redirect("/login") }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (callerProfile?.role !== "supervisor") { redirect("/") }
  ...
}
```
For `clientes/page.tsx`, drop the Supervisor-only redirect (this page is for both roles) but keep the `user`/`callerProfile` fetch pattern to determine whether to show the vendedor filter (D-09) and vendedor name on cards (UI-SPEC: "Supervisor view only"). RLS itself (not this check) is what actually restricts which clientes rows come back per role — this app-layer check is only for conditionally rendering UI, matching the comment convention below.

**Comment convention to copy** (lines 12-17):
```typescript
/**
 * Supervisor-only "Gerenciar equipe" screen (AUTH-02, D-10). Redirects any
 * non-Supervisor to "/" — this app-layer redirect is UX only; the real
 * authorization boundaries are the invite-user Edge Function's 403 check
 * and this table's underlying `profiles` RLS SELECT policy (T-01-14).
 */
```
Adapt to state: "RLS on `clientes` (is_supervisor() OR responsavel = auth.uid()) is the real boundary; this page's query and UI conditionals are UX only."

**Data fetch + empty-state pattern** (lines 39-44, 82-93):
```typescript
const { data: members } = await supabase
  .from("profiles")
  .select("id, nome, sobrenome, email, role")
  .order("nome", { ascending: true })

const hasMembers = (members?.length ?? 0) > 0
...
{hasMembers ? ( /* table */ ) : ( /* empty state per copy contract */ )}
```
Apply the same `hasX ? list : emptyState` conditional to the kanban board (per column, and for the whole board when a brand-new vendedor has zero clients — copy: "Nenhum cliente cadastrado ainda...").

**Page heading pattern** (lines 47-51):
```typescript
<div className="flex flex-1 flex-col gap-8 p-6">
  <div className="flex items-center justify-between">
    <h1 className="text-[28px] font-semibold">Gerenciar equipe</h1>
    <InviteUserForm />
  </div>
```
Reuse the `text-[28px] font-semibold` Display heading class directly (matches UI-SPEC's "Display 28px/600") with "Clientes" as the title and the "Novo cliente" button in the same position.

---

### `app/(app)/layout.tsx` (extend existing file, not new)

**File itself is the analog for the nav-link addition** (lines 55-62):
```typescript
{profile?.role === "supervisor" ? (
  <Link href="/equipe" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
    Gerenciar equipe
  </Link>
) : null}
```
Add a new unconditional `<Link href="/clientes">Clientes</Link>` (or "Funil") alongside this, following the identical `text-sm font-medium text-primary underline-offset-4 hover:underline` styling — this is the nav integration point named in CONTEXT.md.

---

### `lib/validations/cliente.ts` (utility, transform)

**Analog:** `components/auth/InviteUserForm.tsx` schema section (lines 37-64)

**Pattern to copy:** zod object + `.superRefine` for any Select-backed field that must have "no default" (categoria, responsavel), plus the general shape:
```typescript
const clienteSchema = z.object({
  razaoSocial: z.string().min(1, "Informe a razão social."),
  // required address fields incl. new D-11 cidade/estado
  responsavel: z.string().min(1), // or "" + superRefine if Supervisor must choose explicitly
  categoria: z.enum([...]).optional(),
  // ...
})
```
Note zod v4 + `@hookform/resolvers` compatibility caveat documented in the analog (lines 45-50): avoid per-field `.refine()` on enum fields — use object-level `.superRefine` instead, or `zodResolver` generic inference breaks.

---

### `app/actions/clientes.ts` (service / Server Action, CRUD)

**Analog (error-code propagation):** `supabase/functions/invite-user/index.ts` is referenced by `InviteUserForm.tsx` comments (lines 144-160) as the source of the `{ error: { code, ... } }` structured body pattern:
```typescript
const context = (error as { context?: Response })?.context
let code: string | undefined
try {
  const body = await context?.clone().json()
  code = body?.error?.code
} catch { /* fall through to generic message */ }
```
Per CONTEXT.md's "Claude's Discretion," this phase's create/update/delete/move-stage actions are Server Actions calling Supabase directly (not Edge Functions), so the equivalent pattern is: catch Postgres unique-constraint violation (D-06 duplicate razão social) by error code (`23505`) and return a structured `{ error: { code: "duplicate_razao_social" } }` shape from the Server Action, consumed by the form the same way `email_exists` is consumed today.

---

## Shared Patterns

### Supabase client usage
**Source:** `lib/supabase/server.ts` (Server Components/Actions) and `lib/supabase/client.ts` (Client Components)
**Apply to:** All new files that query Supabase — Server Components (`clientes/page.tsx`) and Server Actions use `createClient()` from `server.ts` (async, cookie-based); any Client Component needing direct Supabase access (rare this phase, since forms should go through Server Actions per CLAUDE.md's "no separate Node backend" spirit — but if the kanban board needs Realtime or optimistic client reads, use `client.ts`'s `createBrowserClient`).

### RLS / is_supervisor() authorization boundary
**Source:** `supabase/migrations/0001_profiles_and_roles.sql` lines 34-49 + `app/(app)/equipe/page.tsx` lines 12-17 comment convention
**Apply to:** All new tables (`clientes`, funil/cards table, enum-lookup tables) and all pages/actions that branch UI on role — always pair an app-layer UX check with a real RLS policy using `is_supervisor()`, never rely on the app-layer check alone (CLAUDE.md: "nunca esconder só na UI").

### react-hook-form + zod + shadcn Form/Select pattern
**Source:** `components/auth/InviteUserForm.tsx` (whole file)
**Apply to:** `ClienteQuickCreateForm.tsx`, `ClienteDetailSheet.tsx`, `FiltersPopover.tsx`, `PerdaMotivoDialog.tsx` — the `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` composition from `components/ui/form.tsx`, the controlled-Select-from-mount `""` + `superRefine` trick, and the inline `role="alert"`/`role="status"` banner styling are all reusable verbatim.

### Error/success message copy pattern
**Source:** `components/auth/InviteUserForm.tsx` lines 66-69, 185-201
**Apply to:** All new forms — module-level `const X_ERROR = "..."` / `const SUCCESS_MESSAGE = "..."` constants near the top of the file, rendered via the same `role="alert"` / `role="status"` divs. Exact copy strings for this phase are already fixed in `02-UI-SPEC.md`'s Copywriting Contract table — use those verbatim, don't invent new phrasing.

### Protected-page structure
**Source:** `app/(app)/equipe/page.tsx` lines 18-51
**Apply to:** `app/(app)/clientes/page.tsx` — `async function Page()`, fetch `user` then `profile`, conditionally redirect or conditionally render, `p-6` page padding, `flex flex-1 flex-col gap-8` outer wrapper, `text-[28px] font-semibold` Display heading paired with a primary action button top-right.

## No Analog Found

Files/concepts with no close match in the codebase (planner should design fresh, informed by UI-SPEC and CONTEXT.md's "Claude's Discretion" section, and by `.planning/research/ARCHITECTURE.md`/`FEATURES.md` per the canonical refs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/clientes/KanbanBoard.tsx` | component | event-driven (drag-drop) | No `@dnd-kit` usage anywhere yet in this codebase — this is the first drag-and-drop feature; must be built from the library's docs/CLAUDE.md stack notes, not an internal analog |
| Funil/card data model (new tables + "1 cliente = 1 active card" vs. reentry logic) | model | event-driven (stage transitions) | CONTEXT.md explicitly defers this modeling decision to planning; `.planning/research/ARCHITECTURE.md` and `FEATURES.md` are the intended references, not existing code |
| `tests/clientes/*.test.ts` (RLS policy tests, kanban business-rule tests: ganho-only-final-stage, motivo-required-on-perda) | test | request-response | No test files were found in this pass of the codebase (only source files sampled); planner/executor should establish the Vitest/Playwright patterns per `.claude/CLAUDE.md`'s stack table (Vitest for schema/RLS-adjacent logic, Playwright for cross-role E2E) since no existing test file was available to copy from in this search |

## Metadata

**Analog search scope:** `components/auth/`, `components/ui/`, `app/(app)/`, `app/(auth)/`, `app/auth/`, `lib/supabase/`, `supabase/migrations/`, `supabase/functions/`
**Files scanned:** 15 (InviteUserForm.tsx, equipe/page.tsx, app/(app)/layout.tsx, lib/supabase/server.ts, lib/supabase/client.ts, 0001_profiles_and_roles.sql, directory listings of app/, lib/, components/, supabase/migrations/, supabase/functions/)
**Pattern extraction date:** 2026-07-16
