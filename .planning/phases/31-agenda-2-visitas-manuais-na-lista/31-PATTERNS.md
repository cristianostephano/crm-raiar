# Phase 31: Agenda 2 — Visitas Manuais na Lista - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/00XX_agenda2_itens.sql` | migration | CRUD (RLS-only) | `supabase/migrations/0002_clientes_and_funil.sql` (write policies) + `supabase/migrations/0038_acessos_diarios.sql` (header tone, trigger-free table, LGPD comment) | role-match (composite — no single existing table has this exact asymmetric RLS shape) |
| `lib/validations/agenda2.ts` | utility (zod schema) | request-response | `lib/validations/cliente.ts` (pattern only, not read verbatim this pass — same shape as `createClienteSchema` seen via `ClienteQuickCreateForm.tsx` usage) | role-match |
| `lib/agenda2/itens.ts` | utility (pure functions) | transform | `lib/agenda/itens.ts` | exact (explicitly designed for reuse: `bucketDoItem`, `filtrarPorVendedor` imported unchanged) |
| `lib/supabase/queries/agenda2.ts` | service (data query) | CRUD (read) | `lib/supabase/queries/agenda.ts` | role-match (this one is direct-table read, not RPC — see divergence note) |
| `app/actions/agenda2.ts` | controller (Server Actions) | CRUD (write) | `app/actions/agenda.ts` (shape/error-union pattern) + `app/actions/clientes.ts` (`createCliente`, direct `.insert()` pattern) | exact |
| `app/(app)/agenda-2/page.tsx` | route (Server Component) | request-response | `app/(app)/agenda/page.tsx` | exact |
| `app/(app)/layout.tsx` (modified) | provider | request-response | itself — extend existing `agendaCount` fetch pattern with a second count | exact |
| `components/layout/AppSidebar.tsx` (modified) | component | request-response | itself — extend `PRINCIPAL_SECTION.links` array | exact |
| `components/agenda2/Agenda2List.tsx` | component (Client) | CRUD (read+filter) | `components/agenda/AgendaList.tsx` | exact |
| `components/agenda2/Agenda2ItemRow.tsx` | component (presentational) | transform | `components/agenda/AgendaItemRow.tsx` | exact |
| `components/agenda2/Agenda2ItemForm.tsx` | component (form, Dialog) | CRUD (create/update) | `components/clientes/ClienteQuickCreateForm.tsx` (form/Dialog/RHF+zod shape) + `components/agenda/ConcluirItemDialog.tsx` (date Popover+Calendar) + `components/clientes/ClienteDetailSheet.tsx` (apagar confirmation Dialog copy) | role-match (composite) |
| `tests/agenda2/rls-agenda2.test.ts` | test | CRUD | `tests/clientes/rls-clientes.test.ts` (not read this pass, cited by RESEARCH.md; use `tests/helpers/supabase-test-clients.ts` helpers) | role-match |
| `tests/agenda2/agenda2-item-row.test.tsx`, `agenda2-list.test.tsx`, `itens.test.ts` | test | transform/CRUD | `tests/agenda/agenda-item-row.test.tsx`, `tests/agenda/agenda-list.test.tsx`, `tests/agenda/itens.test.ts` | exact |
| `tests/agenda/app-sidebar-agenda.test.tsx` (modified) + siblings | test | request-response | itself | exact |

## Pattern Assignments

### `supabase/migrations/00XX_agenda2_itens.sql` (migration, CRUD)

**Analog:** `supabase/migrations/0002_clientes_and_funil.sql` (write-policy shape) + `supabase/migrations/0038_acessos_diarios.sql` (comment tone / "no SECURITY DEFINER" discipline)

**Table + comment pattern** (mirrors `acessos_diarios`, `0038` lines 69-75):
```sql
create table agenda2_itens (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references profiles(id),
  nome_cliente varchar(120) not null,
  bairro varchar(60) not null,
  data date not null,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table agenda2_itens is 'Agenda 2 (piloto v1.8): item manual de visita anotado pelo vendedor. Minimização LGPD: só nome livre, bairro, data, concluído, dono e carimbos.';

create index idx_agenda2_itens_vendedor_id on agenda2_itens (vendedor_id);
```

**RLS write-policy pattern — DIVERGES from `clientes`** (`0002_clientes_and_funil.sql` lines 182-206, `clientes` SELECT/INSERT/UPDATE/DELETE policies use `or is_supervisor()` — Agenda 2 needs `and not is_supervisor()` instead on write, because D-16 makes Supervisor read-only, unlike `clientes` where Supervisor has full CRUD):
```sql
-- SELECT: same "dono ou supervisor" shape as clientes (0002 line 182-185)
create policy "vendedor ve os proprios itens da agenda2, supervisor ve todos"
on agenda2_itens for select to authenticated
using (vendedor_id = (select auth.uid()) or (select is_supervisor()));

-- INSERT/UPDATE/DELETE: inverted from clientes — supervisor explicitly excluded
create policy "vendedor cria os proprios itens da agenda2"
on agenda2_itens for insert to authenticated
with check (vendedor_id = (select auth.uid()) and not (select is_supervisor()));

create policy "vendedor edita os proprios itens da agenda2"
on agenda2_itens for update to authenticated
using (vendedor_id = (select auth.uid()) and not (select is_supervisor()))
with check (vendedor_id = (select auth.uid()) and not (select is_supervisor()));

create policy "vendedor apaga os proprios itens da agenda2"
on agenda2_itens for delete to authenticated
using (vendedor_id = (select auth.uid()) and not (select is_supervisor()));
```

**Trigger pattern** (no `SECURITY DEFINER` — mirrors the "zero elevation" discipline in `0038` line 155-157):
```sql
create or replace function agenda2_itens_before_update()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_agenda2_itens_before_update
  before update on agenda2_itens
  for each row execute function agenda2_itens_before_update();
```

**Header comment convention to copy:** one migration file per logical change, RLS enable + ALL policies in the SAME file (never split), a "Source:" footer block listing the phase docs and prior migrations consulted (see top of both analogs).

---

### `lib/agenda2/itens.ts` (utility, transform)

**Analog:** `lib/agenda/itens.ts` — import, don't reimplement

```typescript
// lib/agenda2/itens.ts
import { bucketDoItem, filtrarPorVendedor, type AgendaBucket } from "@/lib/agenda/itens"

export type Agenda2Item = {
  id: string
  nomeCliente: string
  bairro: string
  data: string // YYYY-MM-DD
  concluido: boolean
  criadoEm: string
  responsavel: string | null       // maps vendedor_id, needed for filtrarPorVendedor<T>
  responsavelNome: string | null
}

export type Agenda2Agrupada = Record<AgendaBucket, Agenda2Item[]>

export function agruparAgenda2(itens: Agenda2Item[], now: Date = new Date()): Agenda2Agrupada {
  const agrupado: Agenda2Agrupada = { atrasado: [], hoje: [], proximos: [] }
  for (const item of itens) agrupado[bucketDoItem(item.data, now)].push(item)
  return agrupado
}
// filtrarPorVendedor<Agenda2Item> is reused unchanged from lib/agenda/itens.ts (line 138-144)
```

**Local SECAO_ORDEM/tituloSecao pattern** (copy verbatim shape from `components/agenda/AgendaList.tsx` lines 42-48, adapt label text — "Próximos dias" per copy contract):
```typescript
const SECAO_ORDEM: AgendaBucket[] = ["atrasado", "hoje", "proximos"]
function tituloSecao(bucket: AgendaBucket, count: number): string {
  if (bucket === "atrasado") return `Atrasado (${count})`
  if (bucket === "hoje") return `Hoje (${count})`
  return `Próximos dias (${count})`
}
```

**Do NOT duplicate:** `bucketDoItem`'s `parseISO`/`differenceInCalendarDays` fuso-horário logic (`lib/agenda/itens.ts` lines 94-102) — import it, never rewrite date comparison with `new Date(string)`.

**Ordering rule (D-08/Pitfall 4):** DB query must `order by criado_em asc, id asc` — no client-side `.sort()` anywhere, same discipline `agruparAgenda`'s comment documents (lines 104-111).

---

### `lib/supabase/queries/agenda2.ts` (service, CRUD read)

**Analog:** `lib/supabase/queries/agenda.ts` — same file shape, but DIVERGES because this is a direct-table read, not an RPC (the analog's `getAgenda()`/`getAgendaPendentesCount()` wrap `agenda_do_vendedor()`).

**Imports/mapRow pattern** (lines 1-51 of analog — camelCase mapping from snake_case row):
```typescript
import type { Agenda2Item } from "@/lib/agenda2/itens"
import { createClient } from "@/lib/supabase/server"

type Agenda2Row = {
  id: string
  vendedor_id: string
  nome_cliente: string
  bairro: string
  data: string
  concluido: boolean
  criado_em: string
  vendedor_nome: string | null // joined from profiles, if selected
}
```

**Count pattern — CRITICAL divergence, explicit filter required** (analog lines 79-91 trusts RLS alone because `agenda_do_vendedor()` pre-filters; Agenda 2's SELECT RLS is intentionally broader (dono OR supervisor), so the count query MUST filter explicitly — this is RESEARCH.md Pattern 6 / Pitfall 2+3):
```typescript
export async function getAgenda2PendentesCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from("agenda2_itens")
    .select("*", { count: "exact", head: true })
    .eq("vendedor_id", user.id)
    .eq("concluido", false)

  if (error) throw new Error(`Falha ao carregar a Agenda 2: ${error.message}`)
  return count ?? 0
}
```

---

### `app/actions/agenda2.ts` (controller, Server Actions)

**Analog:** `app/actions/agenda.ts` (error-union shape, `"use server"` header, `getAgendaAction` wrapper pattern lines 40-66) + `app/actions/clientes.ts`'s `createCliente` (direct `.insert()`, not RPC — cited in RESEARCH.md Pattern 4).

**Error-union + auth-guard pattern** (mirrors `getAgendaAction`, lines 42-66):
```typescript
export type Agenda2ErrorCode = "unauthenticated" | "validacao" | "salvar_falhou"
export type Agenda2Result =
  | { data: true; error?: undefined }
  | { data?: undefined; error: { code: Agenda2ErrorCode; message: string } }
```

**Create action pattern** (RESEARCH.md Pattern 4, full example already written there — copy verbatim structure):
```typescript
"use server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAgenda2ItemSchema, type CreateAgenda2ItemInput } from "@/lib/validations/agenda2"

export async function criarAgenda2Item(values: CreateAgenda2ItemInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: "Sessão expirada." } }

  const parsed = createAgenda2ItemSchema.safeParse(values)
  if (!parsed.success) return { error: { code: "validacao", message: "Verifique os campos." } }

  const { error } = await supabase.from("agenda2_itens").insert({
    nome_cliente: parsed.data.nomeCliente,
    bairro: parsed.data.bairro,
    data: parsed.data.data,
    vendedor_id: user.id, // NEVER accepted from the client
  })

  if (error) return { error: { code: "salvar_falhou", message: "Não foi possível salvar. Tente novamente." } }
  revalidatePath("/agenda-2")
  return { data: true }
}
```

**Concluir/desmarcar pattern** (direct `.update()`, no RPC — RESEARCH.md Pattern 2, no `SECURITY DEFINER`):
```typescript
export async function concluirAgenda2Item(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  const { error } = await supabase.from("agenda2_itens").update({ concluido: true }).eq("id", itemId)
  if (error) return { error: { code: "salvar_falhou", message: "Não foi possível salvar. Tente novamente." } }
  revalidatePath("/agenda-2")
  return { data: true }
}
```

**Error-handling convention:** never leak the raw DB error message to the UI — same generic string as `app/actions/agenda.ts` line 71 (`GENERIC_ERROR`) / `ClienteQuickCreateForm.tsx` line 41.

---

### `app/(app)/agenda-2/page.tsx` (route, Server Component)

**Analog:** `app/(app)/agenda/page.tsx` (full file, 76 lines) — copy structure almost verbatim.

**Auth-guard + role-derivation pattern** (lines 26-43 of analog):
```typescript
export default async function Agenda2Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const isSupervisor = profile?.role === "supervisor"

  let vendedorOptions: { id: string; nome: string }[] = []
  if (isSupervisor) {
    const { data: membros } = await supabase.from("profiles").select("id, nome, sobrenome").order("nome")
    vendedorOptions = (membros ?? []).map((m) => ({ id: m.id, nome: `${m.nome} ${m.sobrenome}` }))
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <Agenda2List isSupervisor={isSupervisor} vendedorOptions={vendedorOptions} />
    </div>
  )
}
```

**Simplification vs analog:** no `categoriaOptions`/`produtoOptions`/`motivoConclusaoRemotaOptions` — Agenda 2 has no `ClienteDetailSheet`/`ConcluirItemDialog` integration (isolated feature, per CONTEXT.md).

---

### `app/(app)/layout.tsx` (provider, modified)

**Analog:** itself — extend the existing tolerant-to-failure count pattern (lines 55-60), never merge counts.

```typescript
let agenda2Count = 0
try {
  agenda2Count = await getAgenda2PendentesCount()
} catch {
  agenda2Count = 0
}
// ... <AppSidebar ... agendaCount={agendaCount} agenda2Count={agenda2Count} />
```

**Rule:** each count is its own try/catch (mirrors comment lines 50-54 — "a single unhandled exception here would take the entire logged-in area down") — never combine into one try block.

---

### `components/layout/AppSidebar.tsx` (modified)

**Analog:** itself — extend `PRINCIPAL_SECTION.links` array (lines 77-95) and `AppSidebarProps`/`badgeCount` plumbing (lines 32-52, 155-165).

**Insertion point:**
```typescript
const PRINCIPAL_SECTION: NavSection = {
  label: "Principal",
  links: [
    { href: "/agenda", label: "Agenda", icon: ListChecks },
    { href: "/agenda-2", label: "Agenda 2", icon: NotebookPen }, // NEW, D-15 order
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/perdidos", label: "Perdidos", icon: Archive },
    { href: "/encerrados", label: "Encerrados", icon: PauseCircle },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
}
```

**Second independent badge wiring** (mirrors lines 42-43, 155-160 — map by href, never a shared counter):
```typescript
type AppSidebarProps = {
  // ...existing props
  agendaCount: number
  agenda2Count: number
}
// inside component, alongside principalSectionComContagem:
const principalSectionComContagem: NavSection = {
  ...PRINCIPAL_SECTION,
  links: PRINCIPAL_SECTION.links.map((link) => {
    if (link.href === "/agenda") return { ...link, badgeCount: agendaCount }
    if (link.href === "/agenda-2") return { ...link, badgeCount: agenda2Count }
    return link
  }),
}
```

**Badge/dot rendering itself (lines 251-330) requires NO changes** — it's already generic over any `link.badgeCount`, so "Agenda 2" automatically inherits the exact same expanded `Badge` classes and `data-slot="agenda-pendente-dot"` compact treatment. Do not restyle.

---

### `components/agenda2/Agenda2List.tsx` (component, Client)

**Analog:** `components/agenda/AgendaList.tsx` (full file, 517 lines) — mirror the fetch-on-mount/grouping/filter skeleton; DROP everything not in scope (export diário, calendário, sem-dia-fixo, ClienteDetailSheet/ConcluirItemDialog integration).

**FetchState + useEffect pattern** (lines 50-53, 118-164):
```typescript
type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: Agenda2Item[] }

const [state, setState] = useState<FetchState>({ status: "carregando" })
const [reloadKey, setReloadKey] = useState(0)

useEffect(() => {
  let cancelled = false
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setState({ status: "carregando" })
  getAgenda2Action().then((result) => {
    if (cancelled) return
    if (result.error) { setState({ status: "erro" }); return }
    setState({ status: "pronto", itens: result.data })
  })
  return () => { cancelled = true }
}, [reloadKey])
```

**Vendor filter Select pattern** (lines 42, 126-128, 211-217, 359-386 — `SEM_FILTRO` sentinel, `vendedoresDaAgenda`-equivalent, `Select`/`SelectItem`) — copy verbatim, opens on "Todos" by default (D-18), which is already this component's default (`vendedorFiltroId = null`).

**Empty states** — three variants needed (own empty, D-10, with CTA; vendor-filtered empty, no CTA; loading Skeleton) — mirror lines 389-454 structurally, but Agenda 2's OWN empty state (vendedor with zero items at all — not just zero after filter) needs the NEW CTA button per UI-SPEC, which `AgendaList.tsx`'s empty state (lines 446-454) does NOT have — this is the one deliberate divergence, documented in UI-SPEC's "Empty state" component contract.

**Error state text:** "Não foi possível carregar sua Agenda 2. Tente novamente." mirrors lines 395-403 exactly (button "Tentar novamente", `Button variant="outline"`).

---

### `components/agenda2/Agenda2ItemRow.tsx` (component, presentational)

**Analog:** `components/agenda/AgendaItemRow.tsx` (full file, 185 lines).

**Card/CardHeader/CardContent skeleton to copy verbatim** (lines 100-146, `Card size="sm"`, `gap-1.5`, `grid-cols-[1fr_auto]`):
```tsx
<Card size="sm" role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}
  className={cn("gap-1.5", onOpen && "cursor-pointer", mostraAtraso && "border-l-4 border-l-red-500")}>
  <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
    <CardTitle className={cn("truncate text-base leading-tight font-semibold",
      item.concluido && "text-muted-foreground line-through")}>
      {item.nomeCliente}
    </CardTitle>
    {/* badges */}
  </CardHeader>
  <CardContent className="flex flex-col gap-1.5 px-3">{/* bairro, date, actions */}</CardContent>
</Card>
```

**Critical divergences from the analog (NEW, per UI-SPEC/D-04/D-05/D-06):**
1. **No `opacity-60` on the whole card when concluído** — analog line 110-111 dims the entire card; Agenda 2 must NOT (full opacity always, only the title gets `line-through`).
2. **Editar button NEVER conditionally hidden** — analog's `concluido ? null : <Button>Concluir</Button>` pattern (lines 165-180) applies ONLY to the Concluir↔Desmarcar swap, never to Editar. This is RESEARCH.md Pitfall 5 / UI-SPEC's explicit warning.
3. Atraso guard: `mostraAtraso = atrasado && !concluido` (analog line 90) — reuse this exact guard unchanged.

**Concluir/Desmarcar button pattern** (analog lines 165-180, `event.stopPropagation()` before calling the handler — required so the row's own `onClick` doesn't also fire):
```tsx
<Button type="button" variant="outline" size="sm"
  onClick={(event) => { event.stopPropagation(); onConcluir() }}>
  <CheckCircle2 /> Concluir
</Button>
// when concluido: <RotateCcw /> Desmarcar, same stopPropagation guard
```

**Concluído badge** (analog lines 132-140, reused unchanged): `<Badge variant="outline" className="shrink-0 border-emerald-600 text-emerald-600"><CheckCircle2 />Concluído</Badge>`

**Atraso triangle+Tooltip** (analog lines 147-158, reused unchanged): `TriangleAlert` `size-3.5 shrink-0 text-amber-500`, `onClick` stops propagation, `parseISO`+`format(item.data, "dd/MM")` — never `new Date(string)`.

---

### `components/agenda2/Agenda2ItemForm.tsx` (component, Dialog form)

**Analog 1 — Dialog/RHF/zod shape:** `components/clientes/ClienteQuickCreateForm.tsx` (full file, 287 lines).

**Dialog + Trigger pattern** (lines 70-87, note Base UI `render=` prop, not `asChild`):
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger render={<Button><Plus />Adicionar visita</Button>} />
  <DialogContent className="sm:max-w-[420px]">
    <DialogHeader><DialogTitle>Adicionar visita</DialogTitle></DialogHeader>
    {/* fields component, mirrors ClienteQuickCreateFields */}
  </DialogContent>
</Dialog>
```

**Form/error/success banner pattern** (lines 105-149, 158-174):
```tsx
const form = useForm<CreateAgenda2ItemInput>({ resolver: zodResolver(createAgenda2ItemSchema), defaultValues })

async function onSubmit(values) {
  setFormError(null); setSuccessMessage(null)
  try {
    const result = await criarAgenda2Item(values)
    if (result.error) { setFormError(GENERIC_ERROR); return }
    setSuccessMessage(SUCCESS_MESSAGE)
    form.reset(defaultValues)
    onCreated()
  } catch { setFormError(GENERIC_ERROR) }
}
// role="alert" destructive banner (lines 158-165) / role="status" primary banner (167-174) — reused unchanged
```

**FormField/FormDescription pattern for LGPD hint** (mirrors `FormField`+`FormMessage` structure, lines 176-188, adding a `FormDescription` per UI-SPEC line 106):
```tsx
<FormField control={form.control} name="nomeCliente" render={({ field }) => (
  <FormItem>
    <FormLabel>Nome do cliente</FormLabel>
    <FormControl><Input {...field} /></FormControl>
    <FormDescription>Use o Nome Fantasia do cliente. Evite nome completo de pessoa e documentos.</FormDescription>
    <FormMessage />
  </FormItem>
)} />
```

**Analog 2 — date Popover+Calendar:** `components/agenda/ConcluirItemDialog.tsx` lines 291-303 (verbatim pattern, no disabled dates per D-09):
```tsx
<Popover>
  <PopoverTrigger className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm">
    {data ? format(data, "dd/MM/yyyy") : "Selecionar data"}
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar mode="single" selected={data} onSelect={setData} />
  </PopoverContent>
</Popover>
```

**Duplicate-warning banner (D-07, NEW — no direct analog, composed from existing primitives):**
```tsx
{duplicateWarning ? (
  <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
    <TriangleAlert className="size-4 shrink-0 text-amber-600" />
    {`Já existe um item parecido para ${format(parseISO(data), "dd/MM")}. Confirme se quer criar mesmo assim.`}
  </div>
) : null}
<Button type="submit" disabled={form.formState.isSubmitting}>
  {duplicateWarning ? "Criar mesmo assim" : "Adicionar visita"}
</Button>
```
Client-side check only, over the already-loaded item list (no extra Server Action/round-trip) — case-insensitive trimmed name + same date, per RESEARCH.md Pattern "Aviso de possível duplicado".

**Apagar-confirmation Dialog copy convention** (mirrors `components/clientes/ClienteDetailSheet.tsx` lines 1539-1549 structure — title/body/Cancelar-ghost/Apagar-destructive):
```tsx
<DialogHeader><DialogTitle>Apagar item</DialogTitle></DialogHeader>
<p className="text-sm text-muted-foreground">
  Tem certeza que deseja apagar o item de {nomeCliente} em {dataFormatada}? Essa ação não pode ser desfeita.
</p>
// buttons: "Cancelar" (ghost) / "Apagar" (destructive, "Apagando..." while pending)
```

---

## Shared Patterns

### RLS asymmetric-write pattern (owner-writes, supervisor-reads-only)
**Source:** `supabase/migrations/0002_clientes_and_funil.sql` lines 182-206 (structure to invert) + `supabase/migrations/0038_acessos_diarios.sql` (precedent of a role-scoped-only policy, lines 83-100)
**Apply to:** the single `agenda2_itens` migration file — all four policies live in one file, never split (Anti-Pattern already documented in RESEARCH.md).

### Server Action error-union + auth-guard
**Source:** `app/actions/agenda.ts` lines 40-66 (`GetAgendaResult` union, `getAgendaAction` early-return on `!user`)
**Apply to:** every function in `app/actions/agenda2.ts` — `{ data } | { error: { code, message } }` shape, `auth.getUser()` check first, generic error message never leaking the raw DB error.

### Fetch-on-mount Client Component skeleton
**Source:** `components/agenda/AgendaList.tsx` lines 50-53, 118-164 (`FetchState` discriminated union, `reloadKey` bump pattern, synchronous `setState` in effect body with lint suppression comment)
**Apply to:** `Agenda2List.tsx`.

### Date handling — never `new Date(string)` on a raw ISO string
**Source:** `lib/agenda/itens.ts` header comment + `bucketDoItem` (lines 81-102)
**Apply to:** `lib/agenda2/itens.ts`, `Agenda2ItemRow.tsx`, `Agenda2ItemForm.tsx`, `lib/supabase/queries/agenda2.ts` — always `parseISO`/text-comparison, never the raw `Date` constructor on a `YYYY-MM-DD` string.

### Menu badge/dot rendering (byte-for-byte reuse)
**Source:** `components/layout/AppSidebar.tsx` lines 251-330 (already generic over `link.badgeCount`) and `data-slot="agenda-pendente-dot"` classes
**Apply to:** "Agenda 2" entry — zero new styling, only new data feeding the existing generic renderer.

### Form Dialog + react-hook-form + zod
**Source:** `components/clientes/ClienteQuickCreateForm.tsx` (whole file)
**Apply to:** `Agenda2ItemForm.tsx` — `DialogTrigger render={...}` (Base UI, never `asChild`), `role="alert"`/`role="status"` banners, `form.formState.isSubmitting` disables submit with a "-ing" label swap.

## No Analog Found

None — every file in this phase has at least a role-match analog already in the codebase (this phase is explicitly "zero new technology, 100% recombination of proven patterns" per RESEARCH.md Summary).

## Metadata

**Analog search scope:** `components/layout/`, `components/agenda/`, `components/clientes/`, `lib/agenda/`, `lib/supabase/queries/`, `app/actions/`, `app/(app)/agenda/`, `app/(app)/layout.tsx`, `supabase/migrations/0002_*.sql`, `supabase/migrations/0038_*.sql`, `tests/agenda/`
**Files scanned:** 13 read directly (full or targeted sections)
**Pattern extraction date:** 2026-09-28
