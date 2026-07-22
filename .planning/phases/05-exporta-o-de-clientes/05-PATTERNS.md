# Phase 5: Exportação de Clientes - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 4 (1 new Route Handler, 1 new query function, 1 modified toolbar/header, 1 new lib helper for xlsx serialization)
**Analogs found:** 4 / 4

## Important architectural note before the assignments below

`RESEARCH.md`/`ARCHITECTURE.md` (Pattern 6) recommends `GET /api/clientes/exportar` re-running a fresh RLS-scoped `supabase.from('clientes').select(...)` and applying filters as URL query params, the same way a typical server-driven list screen would. **That is not how this codebase's actual filtering works.** Confirmed by reading `components/clientes/KanbanBoard.tsx` directly:

- `ClientesPage` (`app/(app)/clientes/page.tsx`) calls `getClientesAgrupadosPorEtapa()` **once** and loads every RLS-visible cliente into `KanbanBoard` as client state.
- Search (`searchQuery`), `filtros` (categoria/produto/cidade/estado/vendedor), `sortBy`, and `activeTab` (Todos/Incompletos) are all `useState` inside `KanbanBoard.tsx` and applied **in-memory** via `useMemo` (lines 291-321), calling `clienteAtendeFiltros`/`contarFiltrosAtivos`/`FILTROS_VAZIOS` from `components/clientes/FiltersPopover.tsx` and the local `sortClientes()` helper. There is an explicit code comment ("Pitfall 7: no re-query here") confirming this is deliberate — applying/clearing filters never triggers a new Supabase query.
- Consequence for D-05 ("exportação reflete TUDO que está aplicado na tela no momento do clique"): the Route Handler **cannot** independently recompute "what's on screen" from URL query params alone without duplicating `clienteAtendeFiltros`/`sortClientes` logic server-side (a second implementation of the same filter rules, which risks drifting out of sync — exactly the kind of duplication this codebase avoids elsewhere, e.g. `isClienteIncompleto` being shared instead of reimplemented).

**Recommended reconciliation (for the planner to lock down):** `KanbanBoard` already computes the final filtered+sorted `ClienteListItem[]` per column in its `useMemo` (the `result` returned there). The "Exportar" click should send the **ids of that already-filtered set** to the Route Handler (e.g. `POST /api/clientes/exportar` with `{ ids: string[] }` in the body, or `GET ?ids=a,b,c` for a smaller set) rather than re-deriving filters server-side. The Route Handler then does a fresh RLS-scoped query filtered `IN (ids)` — RLS still fully backstops it (a Vendedor passing another vendedor's id simply gets 0 rows for that id, same non-revealing posture as `getClienteById`), and zero filter logic is duplicated. This keeps Pattern 6's core value (Route Handler for download headers) while respecting this codebase's actual client-side-filtering architecture. Passing ids also naturally handles the "Incompletos" tab (a client-side-only concept, not a DB column) without inventing a matching server-side predicate.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/api/clientes/exportar/route.ts` | route (Route Handler) | request-response (file download) | `app/auth/confirm/route.ts` | role-match (only other Route Handler in the app) |
| `lib/supabase/queries/clientes.ts` (add `getClientesParaExportacao`) | service/query | CRUD (read) | `getClientesAgrupadosPorEtapa` in the same file | exact (same file, same RLS-scoped read pattern) |
| `lib/clientes/exportacao.ts` (new — xlsx row-building/serialization helper) | utility/transform | transform | `lib/clientes/completude.ts` (shared pure-function module, dependency-free) | role-match |
| `app/(app)/clientes/page.tsx` (add "Exportar" button next to `ClienteQuickCreateForm`) | component (page header) | request-response (trigger download) | `ClienteQuickCreateForm` placement in the same header row | exact (same header row, same file) |

## Pattern Assignments

### `app/api/clientes/exportar/route.ts` (route, request-response / file download)

**Analog:** `app/auth/confirm/route.ts` (the only existing Route Handler in this codebase)

**Imports pattern** (`app/auth/confirm/route.ts` lines 1-4):
```typescript
import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
```
For the export handler, swap in the xlsx library and the new query function:
```typescript
import { type NextRequest, NextResponse } from "next/server"

import { getClientesParaExportacao } from "@/lib/supabase/queries/clientes"
import { buildClientesWorkbook } from "@/lib/clientes/exportacao"

export const runtime = "nodejs" // STACK.md v1.1 Addendum: @e965/xlsx needs Node Buffer APIs, not Edge
```

**Handler shape pattern** (mirrors `GET` structure at lines 18-41 — parse request, call an existing `lib/supabase/*` helper, respond with a `NextResponse`):
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get("ids")
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : null

  // RLS on `clientes` (is_supervisor() OR responsavel = auth.uid()) is the
  // real boundary here — passing another vendedor's id simply returns 0 rows
  // for it, same non-revealing posture as getClienteById.
  const clientes = await getClientesParaExportacao(ids)

  const workbook = buildClientesWorkbook(clientes)
  const filename = `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(workbook, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
```

**Auth pattern:** No manual role branching, exactly per `ARCHITECTURE.md` Pattern 6 — `createClient()` (via `getClientesParaExportacao`, which reuses `lib/supabase/server.ts`) is the same SSR client every Server Component uses; RLS on `clientes` is the only authorization check, never re-implemented here.

**Error handling pattern:** `auth/confirm/route.ts` shows the project's convention of falling back to a clear redirect/response on missing/invalid input rather than throwing an unhandled error (lines 35-40). For export, mirror this with an explicit 401/redirect-to-login response if `supabase.auth.getUser()` returns no user (matching `app/(app)/clientes/page.tsx` lines 31-37's `redirect("/login")` check, adapted to a `NextResponse` since this is a Route Handler, not a Server Component).

---

### `lib/supabase/queries/clientes.ts` — add `getClientesParaExportacao` (service, CRUD read)

**Analog:** `getClientesAgrupadosPorEtapa` in the same file (lines 216-297), which is the established "one RLS-scoped read, shaped for a specific screen" pattern already used 6 times in this file (`getClienteById`, `getClientesAgrupadosPorEtapa`, `getTarefas`, `getHistorico`, `getTiposTarefaAtivos`, `getCategoriasAtivas`, `getProdutosAtivos`).

**Core pattern to copy** (structure from `getClientesAgrupadosPorEtapa`, lines 216-229 + 236 doc comment about RLS):
```typescript
/**
 * Full export row shape (D-02: razão social, endereço, categoria, contato,
 * telefone, email, produtos consumidos, número de lojas, responsável — PLUS
 * funil fields: etapa, status_acompanhamento, observação). Unlike
 * ClienteListItem (kanban card shape), this needs the raw endereço breakdown
 * (cep/rua/numero/complemento) that ClienteDetalhe already models — reuse
 * that column list rather than inventing a third shape.
 *
 * RLS on `clientes` (is_supervisor() OR responsavel = auth.uid()) scopes the
 * result automatically — NO manual role branching here, same posture as
 * every other reader in this file. When `ids` is provided (export reflects
 * exactly what's filtered/visible on screen, D-05), it's an additional
 * `.in("id", ids)` filter layered on top of RLS, never a replacement for it —
 * an id RLS wouldn't already allow returns 0 rows for that id, not an error.
 */
export async function getClientesParaExportacao(
  ids?: string[] | null
): Promise<ClienteExportRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from("clientes")
    .select(
      "id, razao_social, cep, rua, numero, complemento, cidade, estado, responsavel, profiles(nome, sobrenome), categoria_id, categorias(nome), contato, telefone, email, numero_de_lojas, cliente_produtos(produtos_consumidos(nome)), etapa, status_acompanhamento, observacao"
    )

  if (ids && ids.length > 0) {
    query = query.in("id", ids)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Falha ao carregar clientes para exportação: ${error.message}`)
  }

  // ...map rows to ClienteExportRow, same reduce/mapping style as
  // getClientesAgrupadosPorEtapa's row-mapping loop (lines 236-294)
}
```

**Error handling pattern:** copy the `throw new Error(...)` on Supabase error (line 226-228) — this file's convention is to throw on a hard read failure but return `null`/`[]` on "no matching row" (RLS-driven absence), never conflate the two.

---

### `lib/clientes/exportacao.ts` (new utility, transform) — xlsx row/workbook builder

**Analog:** `lib/clientes/completude.ts` — cited directly in `lib/supabase/queries/clientes.ts`'s header comment (lines 9-13) as "a dependency-free module" so it can be imported from both server and Client Components without pulling in `next/headers`. The xlsx-building helper should follow the same shape: a pure function taking already-fetched rows and returning a workbook buffer/blob, no Supabase import, no `"use server"`/`"use client"` directive needed.

**Core pattern:** Per `STACK.md`'s v1.1 Addendum ("Export (generate + download)" section), use `@e965/xlsx`'s `XLSX.utils.json_to_sheet` + `XLSX.write`:
```typescript
import * as XLSX from "@e965/xlsx"

import type { ClienteExportRow } from "@/lib/supabase/queries/clientes"

/** D-02 column order — cadastro fields first, then funil fields. */
export function buildClientesWorkbook(rows: ClienteExportRow[]): Buffer {
  const sheetRows = rows.map((row) => ({
    "Razão Social": row.razaoSocial,
    // Free-text fields (razão social, contato, observação) MUST be
    // sanitized against CSV/formula injection per PITFALLS.md's "Milestone
    // Addendum: v1.1" before being written to a cell — see that doc's exact
    // guidance (e.g. prefixing a leading =/+/-/@ with a single quote).
    Endereço: `${row.rua}, ${row.numero}${row.complemento ? ` - ${row.complemento}` : ""} - ${row.cidade}/${row.estado}`,
    Categoria: row.categoriaNome ?? "",
    Contato: row.contato ?? "",
    Telefone: row.telefone ?? "",
    Email: row.email ?? "",
    "Produtos consumidos": row.produtos.join(", "),
    "Número de lojas": row.numeroDeLojas ?? "",
    Responsável: row.responsavelNome ?? "",
    Etapa: row.etapaLabel,
    Status: row.statusAcompanhamento,
    Observação: row.observacao ?? "",
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
}
```

**Validation/sanitization note:** `PITFALLS.md` (referenced in `05-CONTEXT.md`'s canonical refs, "Milestone Addendum: v1.1") flags CSV/formula injection protection for free-text fields (`razao_social`, `contato`, `observacao`) — this must be applied inside this helper before cells are written, not left to the Route Handler.

---

### `app/(app)/clientes/page.tsx` — add "Exportar" button (component, request-response trigger)

**Analog:** `ClienteQuickCreateForm` placement in the same file, lines 69-79:
```tsx
<div className="flex items-center justify-between">
  <h1 className="text-[28px] font-semibold">Clientes</h1>
  <ClienteQuickCreateForm
    currentUserId={user.id}
    currentUserName={currentUserName}
    isSupervisor={isSupervisor}
    teamMembers={teamMembers}
  />
</div>
```

**Correction vs. `05-CONTEXT.md`'s "Reusable Assets" section:** that section states the "Novo cliente" button already lives in `ClienteToolbar.tsx` and the "Exportar" button should go there too. Reading the actual code shows this is not accurate — `ClienteQuickCreateForm` ("Novo cliente") is rendered in the page header row of `app/(app)/clientes/page.tsx` (lines 69-79), not inside `ClienteToolbar.tsx` (which only holds search/filters/sort/tabs, confirmed in the full read of that file). Per D-04 ("Exportar" fica ao lado de "Novo cliente"), the new button belongs **next to `ClienteQuickCreateForm` in this same header `div`**, not inside `ClienteToolbar.tsx`. Planner should target `app/(app)/clientes/page.tsx`, not `ClienteToolbar.tsx`, for D-04's placement — though `ClienteToolbar.tsx` is still the file that must be modified/read to know the current in-memory filtered+sorted list (see architectural note above), since the export click needs that computed list's ids, which live in `KanbanBoard.tsx`'s state, not the page.

**Since the filtered/sorted list lives in `KanbanBoard` (a Client Component) and not in the Server Component `page.tsx`, the "Exportar" button most likely needs to move into (or receive a callback/ref from) `KanbanBoard.tsx` itself** — mirroring how `ClienteToolbar` already receives filter/sort state as props from `KanbanBoard`. A reasonable shape: pass an `onExport` callback down from `KanbanBoard` (which has access to the computed `result` in its `useMemo`) up to wherever the button renders, or lift the button into `KanbanBoard`'s own returned JSX instead of `page.tsx`. This is a structural decision for the planner, not this document, but the constraint (button needs access to `KanbanBoard`'s filtered ids) is the concrete fact to plan against.

**Trigger pattern (Client Component click handler):**
```tsx
function handleExport() {
  const ids = filteredClienteIds // from the same useMemo KanbanBoard already computes
  const url = `/api/clientes/exportar?ids=${ids.join(",")}`
  window.location.assign(url) // simplest native download trigger — no fetch/blob needed
}
```

## Shared Patterns

### RLS as the only authorization boundary
**Source:** `lib/supabase/queries/clientes.ts` (every function in the file), `lib/supabase/server.ts`
**Apply to:** `getClientesParaExportacao` and the Route Handler — never add a manual `if (isSupervisor)` branch; `createClient()` + the existing `clientes` SELECT policy is the entire authorization story, exactly as `ARCHITECTURE.md` Pattern 6 states.

### SSR Supabase client construction
**Source:** `lib/supabase/server.ts` lines 12-36
**Apply to:** Both the new Route Handler and the new query function — `createClient()` is async, must be awaited, and is already safe to call from a Route Handler (same as Server Components/Actions).

### Dependency-free pure-function modules for shared logic
**Source:** `lib/clientes/completude.ts` (per the comment header in `lib/supabase/queries/clientes.ts` lines 9-13)
**Apply to:** `lib/clientes/exportacao.ts` — keep the xlsx-building function free of any Supabase/`next/headers` import so it stays testable with Vitest in isolation (per `CLAUDE.md`'s "toda funcionalidade nova precisa de teste automatizado").

### Client-side in-memory filtering (KanbanBoard) — do not duplicate server-side
**Source:** `components/clientes/KanbanBoard.tsx` lines 291-321, `components/clientes/FiltersPopover.tsx` lines 55-91
**Apply to:** The export flow overall (button trigger + Route Handler design) — see "Important architectural note" above. Reuse the ids of the already-computed filtered set; do not reimplement `clienteAtendeFiltros`/`sortClientes` server-side.

## No Analog Found

None — every file to be created/modified has at least a role-match or exact analog in the existing codebase (the project has exactly one prior Route Handler, one prior query-module file, and one prior "button next to the page title" pattern, all of which transfer directly).

## Metadata

**Analog search scope:** `app/`, `components/clientes/`, `lib/supabase/`, `lib/clientes/` (directories globbed and read directly)
**Files scanned:** `app/auth/confirm/route.ts`, `lib/supabase/queries/clientes.ts`, `lib/supabase/server.ts`, `components/clientes/ClienteToolbar.tsx`, `components/clientes/KanbanBoard.tsx` (partial, lines 1-100 + 250-330 range for filter state), `components/clientes/FiltersPopover.tsx` (partial, lines 1-90), `app/(app)/clientes/page.tsx`
**Pattern extraction date:** 2026-07-22
