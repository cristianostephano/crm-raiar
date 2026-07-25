# Phase 7: Importação — Confirmação e Gravação - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/0004_importar_clientes_lote.sql` | migration (RPC) | CRUD (batch insert) | `supabase/migrations/0002_clientes_and_funil.sql` (`mover_card_funil` RPC, section 8) | exact |
| `app/actions/importacao.ts` (add `confirmarLoteImportacao`) | service/Server Action | request-response (write) | `app/actions/importacao.ts`'s own `validarLoteImportacao` (same file) + `app/actions/clientes.ts`'s `createCliente`/`deleteCliente` (RPC-calling precedent: `app/actions/funil.ts`'s `moverCard`) | exact |
| `components/importacao/ImportSummary.tsx` (new) | component | request-response (render result) | `components/dashboard/GanhosPerdidosCards.tsx` (stat-tile Card layout) | role-match |
| `components/importacao/ImportWizard.tsx` (modified) | component | event-driven (button wiring + state) | itself (existing file, extend in place) | exact |

## Pattern Assignments

### `supabase/migrations/0004_importar_clientes_lote.sql` (migration, CRUD)

**Analog:** `supabase/migrations/0002_clientes_and_funil.sql`, section 8 (`mover_card_funil`, lines 350-383)

**File header/comment convention** (lines 1-24 of 0002): every migration opens with a multi-line `--` comment block stating what the file does, why it's a single whole-file migration, and links back to the ARCHITECTURE.md pattern number and the plan/phase source. Copy this convention for the new file header, citing "Pattern 4" and this phase's plan file.

**RPC pattern — deliberately NOT `security definer`, explicit guard, one raise-exception per rule** (lines 356-383):
```sql
create or replace function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa etapa_funil,
  p_novo_status status_acompanhamento_enum default null,
  p_motivo_perda_id uuid default null,
  p_nova_posicao numeric default null
)
returns void
language plpgsql
as $$
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = coalesce(p_motivo_perda_id, motivo_perda_id),
      posicao = coalesce(p_nova_posicao, posicao)
  where id = p_cliente_id;
end;
$$;
```
Apply the exact same shape to `importar_clientes_lote`: `language plpgsql`, no `security definer`, no `set search_path` (only the SECURITY DEFINER triggers later in the file use `set search_path = public` — this RPC must NOT, since it isn't `security definer`), a guard clause with `raise exception` before touching the table, then the actual `insert`.

**ARCHITECTURE.md's already-drafted body** (reuse verbatim, adjust column list if `resolved: ResolvedRow` shape differs — it doesn't, they match exactly per `06-02-SUMMARY.md`'s "no further transform expected" note):
```sql
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes em massa';
  end if;

  return query
  insert into clientes (
    razao_social, cep, rua, numero, complemento, cidade, estado,
    responsavel, categoria_id, contato, telefone, email, numero_de_lojas
  )
  select
    r.razao_social, r.cep, r.rua, r.numero, r.complemento, r.cidade, r.estado,
    r.responsavel, r.categoria_id, r.contato, r.telefone, r.email, r.numero_de_lojas
  from jsonb_to_recordset(p_clientes) as r(
    razao_social text, cep text, rua text, numero text, complemento text,
    cidade text, estado text, responsavel uuid, categoria_id uuid,
    contato text, telefone text, email text, numero_de_lojas int
  )
  on conflict (razao_social) do nothing
  returning clientes.razao_social, clientes.id, 'inserido'::text as status;
end;
$$;
```
**Note:** `produtoIds`/`cliente_produtos` are NOT part of this RPC's `jsonb_to_recordset` — `mover_card_funil`'s precedent and `0002`'s `cliente_produtos` join table both show multi-value produtos is handled as a *separate* insert against a join table, not folded into the parent row. If produtos need to be imported this phase, add a second `insert into cliente_produtos (...) select ... from jsonb_to_recordset(...) on conflict do nothing` block after the first, driven by the `returning` result's `id`s — mirror `updateCliente`'s replace-the-whole-set discipline (`app/actions/clientes.ts` lines 226-251) if produtos import is in scope; otherwise document `produtoIds` as deferred/dropped for the RPC's v1 signature (planner's call — CONTEXT.md's `ResolvedRow` does carry `produtoIds`, so silently dropping them would be a real gap to flag).

**Migration file naming convention:** next sequential 4-digit prefix + snake_case description, e.g. `0004_importar_clientes_lote.sql` (confirmed next available: `0001`, `0002`, `0003` exist).

**Indexes:** `razao_social` already has a `unique` constraint from `0002` (used directly by `on conflict (razao_social)` — no new index needed).

---

### `app/actions/importacao.ts` — add `confirmarLoteImportacao` (service/Server Action, request-response write)

**Analog 1 (structure/gate, same file):** `validarLoteImportacao` (lines 48-148 of the same file) — copy the exact `is_supervisor` app-layer gate pattern (auth check → profile role lookup → `forbidden` if not supervisor, checked BEFORE any data read) verbatim:
```typescript
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
```

**Analog 2 (D-02 revalidation — reuse, don't reimplement):** re-run the same `findDuplicates`/`normalizeRazaoSocial` call shape already used inside `validarLoteImportacao` (lines 100-113 of `app/actions/importacao.ts`):
```typescript
const existentesResult = await supabase.from("clientes").select("razao_social")
// ... same RLS-scoped narrow select as validarLoteImportacao — no manual
// responsavel filter, Supervisor already sees the whole base via RLS.

const batchForDedupe = rowsToConfirm.map((row, index) => ({
  row: index,
  razaoSocial: row.resolved.razaoSocial,
}))
const duplicates = findDuplicates(batchForDedupe, existentes)
// any row now in `duplicates` that was NOT already excluded by the caller
// (i.e. was "ok" at Step 3) must be excluded from the RPC call and counted
// under the distinct "Duplicado encontrado ao confirmar" reason (07-UI-SPEC.md).
```

**Analog 3 (calling an RPC from a Server Action, never a raw update/loop):** `app/actions/funil.ts`'s `moverCard` (lines 39-91) — the established shape for "pre-check with a friendly SELECT, then call the RPC, map the RPC error to a generic friendly message, `revalidatePath` on success":
```typescript
const { error } = await supabase.rpc("mover_card_funil", {
  p_cliente_id: clienteId,
  p_nova_etapa: novaEtapa,
  p_nova_posicao: novaPosicao,
})

if (error) {
  return {
    error: {
      code: "mover_falhou",
      message: "Não foi possível mover o card. Tente novamente.",
    },
  }
}

revalidatePath("/clientes")
return { data: true }
```
For `confirmarLoteImportacao`, call `supabase.rpc("importar_clientes_lote", { p_clientes: rowsToInsert })`, map any error to the 07-UI-SPEC.md copy ("Não foi possível concluir a importação agora. Nenhum cliente foi criado. Tente novamente."), and on success `revalidatePath("/clientes")` (matches `createCliente`'s post-insert revalidation target).

**Error-code union convention** (from `createCliente`/`deleteCliente` in `app/actions/clientes.ts`, lines 14-22 and 257-261): define a discriminated result type up front:
```typescript
export type ConfirmarLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type ConfirmarLoteResult =
  | { data: { importados: ImportadoRow[]; puladas: PuladaRow[] }; error?: undefined }
  | { data?: undefined; error: { code: ConfirmarLoteErrorCode } }
```

**Input shape:** `confirmarLoteImportacao` should accept the same `ValidatedRow[]` shape `validarLoteImportacao` already returns (specifically each row's `resolved: ResolvedRow`, already sanitized/resolved — see `lib/importacao/annotarLinha.ts` lines 40-55) filtered by the caller to only the rows the Supervisor kept as `ok`/accepted-duplicate at Step 3. Per `06-02-SUMMARY.md`'s "Next Phase Readiness" note, `ResolvedRow` is already the exact input shape expected — no further transform needed before building the RPC's `p_clientes` jsonb array.

**Skipped-row accounting (D-03, no persistence):** build the `puladas` breakdown purely in-memory from (a) rows the caller marked erro/duplicado-skipped in Step 3, plus (b) rows newly caught as duplicates by this action's own D-02 revalidation — grouped by reason string per 07-UI-SPEC.md's copy contract. Never write these to a table (D-03 is explicit: no persistence).

---

### `components/importacao/ImportSummary.tsx` (new component, request-response render)

**Analog:** `components/dashboard/GanhosPerdidosCards.tsx` (full file, 155 lines)

**Card/tile layout pattern** (lines 117-152 — apply the two-tile version, not three):
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <Card className="border-l-4 border-l-green-600">
    <CardContent className="flex flex-col gap-2 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <CircleCheck className="size-4 text-muted-foreground" />
        Clientes importados
      </div>
      <p className="text-xl leading-[1.2] font-semibold text-foreground">
        {integerFormatter.format(importadosCount)}
      </p>
    </CardContent>
  </Card>
  <Card className="border-l-4 border-l-amber-500">
    <CardContent className="flex flex-col gap-2 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <TriangleAlert className="size-4 text-muted-foreground" />
        Linhas puladas
      </div>
      <p className="text-xl leading-[1.2] font-semibold text-foreground">
        {integerFormatter.format(puladasCount)}
      </p>
    </CardContent>
  </Card>
</div>
```
**Important deviation from the analog, per 07-UI-SPEC.md:** use `text-xl leading-[1.2]` (the project's locked 20px display size), NOT `text-[36px] leading-[1.1]` — that 36px size is `GanhosPerdidosCards`' own one-off waiver, explicitly scoped to the Dashboard's 3 original tiles only and marked "do not reuse it anywhere else." Also: `border-l-green-600` reused verbatim for the success tile (matches the "Ganhos" tile precedent exactly), `border-l-amber-500` (not `border-l-destructive`) for the "puladas" tile, since puladas is informational, not a failure — this is a deliberate divergence from the analog's `border-l-destructive` "Perdidos" tile.

**Number formatting:** reuse the exact `Intl.NumberFormat("pt-BR")` instance pattern (line 23 of the analog):
```typescript
const integerFormatter = new Intl.NumberFormat("pt-BR")
```

**No loading/error fetch-state machine needed** — unlike `GanhosPerdidosCards` (which owns an async fetch effect), `ImportSummary` is a pure presentational component receiving the confirm result as props (already resolved synchronously by `ImportWizard`'s `confirmarLoteImportacao` call) — omit the `FetchState`/`useEffect` machinery from the analog entirely.

**Breakdown list (no direct analog in this codebase — new pattern):** plain `<ul>`/`<li>`, `text-sm text-muted-foreground`, one line per distinct reason, rendered only when `puladas.length > 0` — per 07-UI-SPEC.md's Layout & Interaction Notes. No table/analog needed since this is intentionally NOT a re-rendered `ImportPreviewTable`.

**Buttons row (analog: `ImportWizard.tsx`'s existing Voltar/Continuar row, lines 293-304):**
```tsx
<div className="flex gap-2">
  <Button type="button" onClick={onVerClientes}>Ver clientes</Button>
  <Button type="button" variant="outline" onClick={onImportarOutra}>
    Importar outra planilha
  </Button>
</div>
```

---

### `components/importacao/ImportWizard.tsx` (modified — wire confirm button + add summary step)

**Analog:** itself — the existing in-flight-loading and error-banner patterns already established in this same file are the source, not an external file.

**In-flight button pattern to copy** (mirrors the file's own `progressLabel`/`validating` synchronous-set-before-async-call precedent, lines 71-100):
```typescript
const [confirming, setConfirming] = useState(false)
const [confirmError, setConfirmError] = useState<string | null>(null)
const [confirmResult, setConfirmResult] = useState<ConfirmarLoteResult["data"] | null>(null)

function handleConfirmar() {
  if (!validatedRows) return
  setConfirming(true)
  setConfirmError(null)

  confirmarLoteImportacao(validatedRows).then((result) => {
    setConfirming(false)
    if (result.error) {
      setConfirmError(CONFIRM_ERROR)
      return
    }
    setConfirmResult(result.data)
  })
}
```
Button relabel while in flight (07-UI-SPEC.md's copy contract, same disabled+relabel convention as `EditableListTab.tsx`'s reactivate button — no new spinner component):
```tsx
<Button type="button" disabled={!validatedRows || confirming} onClick={handleConfirmar}>
  {confirming ? "Importando clientes…" : "Confirmar importação"}
</Button>
```
This directly replaces the existing documented no-op at lines 337-348 (the `onClick={() => { /* Fase 7 scope */ }}` block and its comment) — remove that comment entirely once wired.

**Error banner pattern to copy** (already used 3x in this same file, e.g. lines 229-236, 320-327 — identical markup, new copy string per 07-UI-SPEC.md):
```tsx
{confirmError ? (
  <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {confirmError}
  </div>
) : null}
```
Top-of-file constant, same convention as `VALIDATION_ERROR`/`PARSE_ERROR` (lines 30-33):
```typescript
const CONFIRM_ERROR =
  "Não foi possível concluir a importação agora. Nenhum cliente foi criado. Tente novamente."
```

**Replacing the wizard body / hiding the step indicator (07-UI-SPEC.md, Layout & Interaction Notes):** when `confirmResult` is set, render `<ImportSummary />` instead of the numbered `<ol>` step row + step body — add a `confirmResult !== null` branch before the existing `step === 1/2/3` ternary chain, mirroring how the file already branches on `step` at the top level (lines 180-198).

**"Importar outra planilha" reset (07-UI-SPEC.md explicit instruction):** reuses `handleRemoveFile`'s exact reset list (lines 156-163), extended with the new confirm-related state:
```typescript
function handleImportarOutra() {
  handleRemoveFile()
  setValidatedRows(null)
  setConfirmResult(null)
  setConfirmError(null)
  setStep(1)
}
```

---

## Shared Patterns

### `is_supervisor()` app-layer gate before any read/write
**Source:** `app/actions/clientes.ts`'s `deleteCliente` (lines 271-311), `app/actions/importacao.ts`'s `validarLoteImportacao` (lines 48-71)
**Apply to:** `confirmarLoteImportacao` — check auth + `is_supervisor` BEFORE any Supabase read, mirroring the existing discipline. The RPC's own `if not is_supervisor() then raise exception` (Pattern 4, ARCHITECTURE.md) is the real backstop; the Server Action check only produces a friendlier UX error before the network round-trip.

### Server Action → RPC call, never a raw update or a loop of single-row inserts
**Source:** `app/actions/funil.ts`'s `moverCard`/`marcarStatus` (lines 39-174)
```typescript
const { error } = await supabase.rpc("mover_card_funil", { ... })
if (error) {
  return { error: { code: "mover_falhou", message: "..." } }
}
revalidatePath("/clientes")
return { data: true }
```
**Apply to:** `confirmarLoteImportacao` calling `importar_clientes_lote` — same error-mapping/revalidatePath shape, adjusted to return the richer `{ importados, puladas }` result instead of a bare `true`.

### Reused dedupe engine (no new logic)
**Source:** `lib/importacao/dedupe.ts` — `normalizeRazaoSocial`, `findDuplicates` (both already exported, pure, dependency-free)
**Apply to:** `confirmarLoteImportacao`'s D-02 revalidation step — import and call directly, do not reimplement or wrap.

### Discriminated Result<T, ErrorCode> return shape
**Source:** every Server Action in `app/actions/clientes.ts`/`app/actions/funil.ts`/`app/actions/importacao.ts`
```typescript
export type XxxResult =
  | { data: T; error?: undefined }
  | { data?: undefined; error: { code: XxxErrorCode } }
```
**Apply to:** `confirmarLoteImportacao`'s return type.

### Disabled+relabeled button as the sole in-flight/double-submit guard (no dialog, no spinner component)
**Source:** `components/importacao/ImportWizard.tsx`'s own `disabled={!validatedRows}` button plus its `progressLabel`/`validating` Skeleton-row precedent (lines 219-227, 310-318); `EditableListTab.tsx`'s `disabled={isReactivating}` reactivate button (referenced in 07-UI-SPEC.md, not re-read here since the pattern is already fully specified in the UI spec's Copywriting Contract)
**Apply to:** the "Confirmar importação" button.

## No Analog Found

None — every file in this phase's scope has at least a role-match analog in the existing codebase; no file requires falling back to ARCHITECTURE.md's synthesized patterns alone (ARCHITECTURE.md's Pattern 4 SQL was itself cross-checked against the live `mover_card_funil` migration above and matches its shape).

## Metadata

**Analog search scope:** `supabase/migrations/`, `app/actions/`, `components/importacao/`, `components/dashboard/`, `lib/importacao/`
**Files scanned:** 9 (3 migrations, 6 action/component/lib files read in full)
**Pattern extraction date:** 2026-07-24
